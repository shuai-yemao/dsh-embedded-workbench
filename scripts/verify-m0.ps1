[CmdletBinding()]
param(
	[string]$ProjectRoot = ".",
	[string]$ProfileDir,
	[string]$BaseUrl,
	[string]$ToolSnapshotPath,
	[string]$BaselineTools,
	[string]$CandidateTools
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Condition {
	param(
		[bool]$Condition,
		[string]$Message
	)

	if (-not $Condition) {
		throw $Message
	}
}

function Get-PropertyValue {
	param(
		[object]$Object,
		[string]$Name
	)

	$property = $Object.PSObject.Properties[$Name]
	Assert-Condition ($null -ne $property) "Missing manifest property: $Name"
	return $property.Value
}

function Assert-ExactStringArray {
	param(
		[object[]]$Actual,
		[string[]]$Expected,
		[string]$Name
	)

	$actualText = [string]::Join("`n", @($Actual | ForEach-Object { [string]$_ }))
	$expectedText = [string]::Join("`n", $Expected)
	Assert-Condition ($actualText -ceq $expectedText) "Unexpected $Name"
}

try {
	Assert-Condition (Test-Path -LiteralPath $ProjectRoot -PathType Container) "ProjectRoot does not exist: $ProjectRoot"
	$resolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
	$packagePath = Join-Path $resolvedRoot "package.json"
	$patchPath = Join-Path $resolvedRoot "cordis.patch.yml"
	$sourcePaths = @(
		(Join-Path $resolvedRoot "src/index.js"),
		(Join-Path $resolvedRoot "src/client.js")
	)

	Assert-Condition (Test-Path -LiteralPath $packagePath -PathType Leaf) "Missing package.json"
	Assert-Condition (Test-Path -LiteralPath $patchPath -PathType Leaf) "Missing cordis.patch.yml"
	foreach ($sourcePath in $sourcePaths) {
		Assert-Condition (Test-Path -LiteralPath $sourcePath -PathType Leaf) "Missing product source: $sourcePath"
	}

	$manifest = Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json
	$packageId = "@dsh-embedded/dsh-embedded-workbench"
	Assert-Condition ((Get-PropertyValue $manifest "name") -ceq $packageId) "Unexpected package name"
	Assert-Condition ((Get-PropertyValue $manifest "private") -eq $true) "Package must stay private"
	Assert-Condition ((Get-PropertyValue $manifest "type") -ceq "module") "Package must stay ESM"

	$exports = Get-PropertyValue $manifest "exports"
	Assert-Condition (@($exports.PSObject.Properties).Count -eq 4) "Unexpected export count"
	Assert-Condition ($exports.PSObject.Properties["."].Value -ceq "./src/index.js") "Unexpected root export"
	Assert-Condition ($exports.PSObject.Properties["./client"].Value -ceq "./src/client.js") "Unexpected client export"
	Assert-Condition ($exports.PSObject.Properties["./cordis.patch.yml"].Value -ceq "./cordis.patch.yml") "Unexpected patch export"
	Assert-Condition ($exports.PSObject.Properties["./package.json"].Value -ceq "./package.json") "Unexpected package export"

	Assert-ExactStringArray -Actual @($manifest.files) -Expected @(
		"src/index.js",
		"src/client.js",
		"src/workbench-lifecycle.js",
		"cordis.patch.yml"
	) -Name "package files"

	$dsh = Get-PropertyValue $manifest "dsh"
	Assert-Condition ($dsh.bundle.patch -ceq "./cordis.patch.yml") "Unexpected DSH patch path"
	Assert-Condition ($dsh.client.platform -ceq "web") "Unexpected DSH client platform"
	Assert-ExactStringArray -Actual @($dsh.client.inject) -Expected @(
		"@deepseek-ai/dsh-client-runtime",
		"@deepseek-ai/dsh-client-ui-settings"
	) -Name "DSH client inject"

	$peerDependencies = Get-PropertyValue $manifest "peerDependencies"
	Assert-ExactStringArray -Actual @($peerDependencies.PSObject.Properties.Name | Sort-Object) -Expected @(
		"@deepseek-ai/cordis",
		"@deepseek-ai/dsh-client-runtime",
		"@deepseek-ai/dsh-client-ui-settings"
	) -Name "peer dependencies"
	Assert-Condition ($peerDependencies."@deepseek-ai/cordis" -ceq "^4.0.1") "Unexpected Cordis peer dependency"
	Assert-Condition ($peerDependencies."@deepseek-ai/dsh-client-runtime" -ceq "0.1.1-rc.1") "Unexpected runtime peer dependency"
	Assert-Condition ($peerDependencies."@deepseek-ai/dsh-client-ui-settings" -ceq "0.1.1-rc.1") "Unexpected settings peer dependency"
	foreach ($dependencySection in @("dependencies", "devDependencies", "optionalDependencies", "peerDependenciesMeta")) {
		Assert-Condition ($null -eq $manifest.PSObject.Properties[$dependencySection]) "M0 must not declare $dependencySection"
	}

	$patch = Get-Content -LiteralPath $patchPath -Raw -Encoding UTF8
	$composition = [string]::Join("`n", @(
		$patch -split "`r?`n" |
			Where-Object { $_.Trim() -and -not $_.TrimStart().StartsWith("#") }
	))
	$expectedComposition = [string]::Join("`n", @(
		"- insert:",
		"    - id: dsh-embedded-workbench",
		"      name: '@dsh-embedded/dsh-embedded-workbench'"
	))
	Assert-Condition ($composition -ceq $expectedComposition) "Patch must contain exactly one M0 insert row"

	$forbiddenPatterns = @(
		"defineTool",
		'ctx\.tools',
		'inject\s*:\s*\[\s*["'']tools["'']',
		"@deepseek-ai/dsh-tools",
		'\bconnection\b',
		'\bremote\b'
	)
	$productFiles = @($packagePath, $patchPath) + $sourcePaths
	$forbiddenMatches = @()
	foreach ($productFile in $productFiles) {
		$content = Get-Content -LiteralPath $productFile -Raw -Encoding UTF8
		foreach ($pattern in $forbiddenPatterns) {
			if ($content -match $pattern) {
				$forbiddenMatches += "${productFile}::$pattern"
			}
		}
	}
	Assert-Condition ($forbiddenMatches.Count -eq 0) "Forbidden M0 token found: $($forbiddenMatches -join ', ')"

	$profileStatus = "not_requested"
	if ($PSBoundParameters.ContainsKey("ProfileDir")) {
		Assert-Condition (Test-Path -LiteralPath $ProfileDir -PathType Container) "ProfileDir does not exist: $ProfileDir"
		$profileStatus = "readable"
	}

	$baseUrlStatus = "not_requested"
	if ($PSBoundParameters.ContainsKey("BaseUrl")) {
		$uri = [Uri]$BaseUrl
		Assert-Condition ($uri.Scheme -in @("http", "https")) "BaseUrl must use http or https"
		$response = Invoke-WebRequest -Uri $uri -Method Get -TimeoutSec 5 -UseBasicParsing
		$baseUrlStatus = "http_$($response.StatusCode)"
	}

	$toolSnapshotStatus = "not_requested"
	if ($PSBoundParameters.ContainsKey("ToolSnapshotPath")) {
		Assert-Condition (Test-Path -LiteralPath $ToolSnapshotPath -PathType Leaf) "ToolSnapshotPath does not exist: $ToolSnapshotPath"
		$null = Get-Content -LiteralPath $ToolSnapshotPath -Raw -Encoding UTF8 | ConvertFrom-Json
		$toolSnapshotStatus = "readable"
	}

	$hasBaseline = $PSBoundParameters.ContainsKey("BaselineTools")
	$hasCandidate = $PSBoundParameters.ContainsKey("CandidateTools")
	Assert-Condition ($hasBaseline -eq $hasCandidate) "BaselineTools and CandidateTools must be supplied together"
	$toolDiff = $null
	if ($hasBaseline) {
		foreach ($snapshotPath in @($BaselineTools, $CandidateTools)) {
			Assert-Condition (Test-Path -LiteralPath $snapshotPath -PathType Leaf) "Tool snapshot does not exist: $snapshotPath"
		}
		$baselineSnapshot = Get-Content -LiteralPath $BaselineTools -Raw -Encoding UTF8 | ConvertFrom-Json
		$candidateSnapshot = Get-Content -LiteralPath $CandidateTools -Raw -Encoding UTF8 | ConvertFrom-Json
		Assert-Condition ($baselineSnapshot.marker -ceq "dsh-embedded-tool-snapshot") "Invalid baseline tool snapshot marker"
		Assert-Condition ($candidateSnapshot.marker -ceq "dsh-embedded-tool-snapshot") "Invalid candidate tool snapshot marker"
		$baselineRaw = @($baselineSnapshot.tools | ForEach-Object { [string]$_ })
		$candidateRaw = @($candidateSnapshot.tools | ForEach-Object { [string]$_ })
		$baselineUnique = @($baselineRaw | Sort-Object -Unique)
		$candidateUnique = @($candidateRaw | Sort-Object -Unique)
		$added = @($candidateUnique | Where-Object { $_ -notin $baselineUnique })
		$removed = @($baselineUnique | Where-Object { $_ -notin $candidateUnique })
		$unchanged = @($baselineUnique | Where-Object { $_ -in $candidateUnique })
		$toolDiff = [ordered]@{
			baseline_raw_count = $baselineRaw.Count
			candidate_raw_count = $candidateRaw.Count
			baseline_unique_count = $baselineUnique.Count
			candidate_unique_count = $candidateUnique.Count
			added = @($added)
			removed = @($removed)
			unchanged_count = $unchanged.Count
		}
		Assert-Condition (($added.Count -eq 0) -and ($removed.Count -eq 0)) "Tool set changed: added=[$($added -join ',')] removed=[$($removed -join ',')]"
	}

	[ordered]@{
		status = "pass"
		evidence_level = "static"
		project_root = $resolvedRoot
		checks = [ordered]@{
			manifest = $true
			exports = $true
			patch = $true
			files = $true
			forbidden = $true
			profile = $profileStatus
			base_url = $baseUrlStatus
			tool_snapshot = $toolSnapshotStatus
		}
		forbidden_matches = @($forbiddenMatches)
		tool_diff = $toolDiff
	} | ConvertTo-Json -Depth 5 -Compress
	exit 0
} catch {
	[Console]::Error.WriteLine($_.Exception.Message)
	exit 1
}
