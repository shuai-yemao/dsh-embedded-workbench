[CmdletBinding()]
param([string]$ProjectRoot = ".")

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Condition {
	param([bool]$Condition, [string]$Message)
	if (-not $Condition) { throw $Message }
}

function Read-Text([string]$Path) {
	Assert-Condition (Test-Path -LiteralPath $Path -PathType Leaf) "Missing required file: $Path"
	return Get-Content -LiteralPath $Path -Raw -Encoding UTF8
}

try {
	$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
	$rootManifest = Get-Content -LiteralPath (Join-Path $root "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
	Assert-Condition ($rootManifest.name -ceq "@dsh-embedded/dsh-embedded-workbench") "Unexpected root package name"
	Assert-Condition (@($rootManifest.workspaces).Count -eq 4) "Expected four internal workspace packages"
	$optionalNames = @($rootManifest.optionalDependencies.PSObject.Properties.Name)
	Assert-Condition (($optionalNames.Count -eq 1) -and ($optionalNames[0] -ceq "@dsh-embedded/provider-reference")) "Reference must be the only optional package"
	$clientInject = @($rootManifest.dsh.client.inject)
	Assert-Condition (($clientInject.Count -eq 2) -and ($clientInject[0] -ceq "@deepseek-ai/dsh-api-gateway") -and ($clientInject[1] -ceq "@dsh-embedded/workbench-ui")) "Unexpected Bundle Client injection"

	$packagePaths = @(
		"package.json",
		"packages/workbench-contracts/package.json",
		"packages/workbench-core/package.json",
		"packages/workbench-ui/package.json",
		"packages/provider-reference/package.json"
	)
	foreach ($relativePath in $packagePaths) {
		$manifest = Get-Content -LiteralPath (Join-Path $root $relativePath) -Raw -Encoding UTF8 | ConvertFrom-Json
		Assert-Condition ($manifest.version -ceq "0.0.0") "Unexpected workspace version in $relativePath"
	}

	$patch = Read-Text (Join-Path $root "cordis.patch.yml")
	Assert-Condition (([regex]::Matches($patch, "(?m)^\s+- id:")).Count -eq 1) "Bundle must contribute exactly one Loader row"
	Assert-Condition ($patch -match "(?m)^\s+- id: dsh-embedded-workbench$") "Missing workbench Loader row"

	$providers = Read-Text (Join-Path $root "src/providers.js")
	Assert-Condition ($providers -match 'package_name: "@dsh-embedded/provider-reference"') "Missing Reference descriptor"
	Assert-Condition ($providers -notmatch 'from\s+["''][^"'']*provider-reference') "Provider descriptor imports an implementation"

	$coreSource = Get-ChildItem -LiteralPath (Join-Path $root "packages/workbench-core/src") -Filter "*.ts" | ForEach-Object { Read-Text $_.FullName }
	$uiSource = Get-ChildItem -LiteralPath (Join-Path $root "packages/workbench-ui/src") -Filter "*.ts*" | ForEach-Object { Read-Text $_.FullName }
	$productSource = [string]::Join("`n", @($coreSource + $uiSource))
	Assert-Condition ($productSource -notmatch 'provider-reference/(src|lib)') "Core or UI imports a Provider private path"
	Assert-Condition ($productSource -notmatch '(defineTool|registerTool|ctx\.tools)') "Workbench must not register Tools"
	Assert-Condition ($productSource -notmatch 'setInterval\(') "Workbench must not use unbounded interval polling"

	$typert = Read-Text (Join-Path $root "packages/workbench-core/lib/typert.host.js")
	$methods = [regex]::Matches($typert, "method:\s*'([^']+)'") | ForEach-Object { $_.Groups[1].Value }
	Assert-Condition (([string]::Join(",", @($methods))) -ceq "list,reconcile,retry") "Generated Typert methods must be list,reconcile,retry"
	Assert-Condition ($typert -match "workbenchCapabilities") "Missing generated workbenchCapabilities namespace"
	Assert-Condition ((Read-Text (Join-Path $root "packages/workbench-contracts/src/index.ts")) -match 'WORKBENCH_SETTINGS_NAMESPACE = "dsh-embedded-workbench"') "Unexpected Settings namespace"

	$declaredFiles = @($rootManifest.files)
	foreach ($relativePath in $declaredFiles) {
		Assert-Condition (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf) "Missing declared root pack file: $relativePath"
	}
	Assert-Condition (Test-Path -LiteralPath (Join-Path $root "packages/workbench-ui/lib/client.js") -PathType Leaf) "Missing generated UI Client"

	[ordered]@{
		status = "pass"
		evidence_level = "static/build"
		project_root = $root
		checks = [ordered]@{
			one_bundle_row = $true
			five_package_identity = $true
			provider_isolation = $true
			typert_methods = $true
			settings_namespace = $true
			zero_tools = $true
			pack_files_exist = $true
		}
	} | ConvertTo-Json -Depth 5 -Compress
} catch {
	[Console]::Error.WriteLine($_.Exception.Message)
	exit 1
}
