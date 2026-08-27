[CmdletBinding()]
param([string]$ProjectRoot = ".")

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Condition {
	param([bool]$Condition, [string]$Message)
	if (-not $Condition) { throw $Message }
}

try {
	Assert-Condition (Test-Path -LiteralPath $ProjectRoot -PathType Container) "ProjectRoot does not exist: $ProjectRoot"
	$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
	$manifestPath = Join-Path $root "package.json"
	$hostPath = Join-Path $root "src/index.js"
	$lifecyclePath = Join-Path $root "src/workbench-lifecycle.js"
	$patchPath = Join-Path $root "cordis.patch.yml"
	foreach ($path in @($manifestPath, $hostPath, $lifecyclePath, $patchPath)) {
		Assert-Condition (Test-Path -LiteralPath $path -PathType Leaf) "Missing M1 product file: $path"
	}

	$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
	Assert-Condition ($manifest.name -ceq "@dsh-embedded/dsh-embedded-workbench") "Unexpected package name"
	$expectedFiles = @("src/index.js", "src/client.js", "src/workbench-lifecycle.js", "cordis.patch.yml")
	Assert-Condition ([string]::Join("`n", @($manifest.files)) -ceq [string]::Join("`n", $expectedFiles)) "Unexpected package files"
	Assert-Condition (@($manifest.exports.PSObject.Properties).Count -eq 4) "Unexpected export count"
	Assert-Condition ($null -eq $manifest.exports.PSObject.Properties["./workbench-lifecycle"]) "Lifecycle must remain private"

	$contents = @{}
	foreach ($path in @($hostPath, $lifecyclePath, $patchPath)) { $contents[$path] = Get-Content -LiteralPath $path -Raw -Encoding UTF8 }
	$forbidden = @("defineTool", "ctx\.provide", "ctx\.tools", "globalThis", "fetch\(", "registerService")
	$forbiddenMatches = @()
	foreach ($entry in $contents.GetEnumerator()) {
		foreach ($pattern in $forbidden) {
			if ($entry.Value -match $pattern) { $forbiddenMatches += "$($entry.Key)::$pattern" }
		}
	}
	Assert-Condition ($forbiddenMatches.Count -eq 0) "Forbidden M1 capability token found: $($forbiddenMatches -join ', ')"

	$hostContent = $contents[$hostPath]
	Assert-Condition ($hostContent -match "createWorkbenchLifecycle") "Host Adapter must create private Lifecycle"
	Assert-Condition ($hostContent -match "return \(\) => lifecycle\.dispose\(\)") "Host Adapter must return one bound disposer"
	Assert-Condition (($contents[$lifecyclePath] -match "LIFECYCLE_CLEANUP_TIMEOUT") -and ($contents[$lifecyclePath] -match "remaining_resource_count")) "Lifecycle diagnostics incomplete"

	[ordered]@{
		status = "pass"
		evidence_level = "static"
		project_root = $root
		checks = [ordered]@{
			private_lifecycle = $true
			package_files = $true
			public_exports_unchanged = $true
			forbidden_capabilities = $true
			host_disposer = $true
			diagnostics = $true
		}
		forbidden_matches = @($forbiddenMatches)
	} | ConvertTo-Json -Depth 5 -Compress
	exit 0
} catch {
	[Console]::Error.WriteLine($_.Exception.Message)
	exit 1
}
