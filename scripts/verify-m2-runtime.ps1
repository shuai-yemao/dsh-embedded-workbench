[CmdletBinding()]
param(
	[string]$ProjectRoot = ".",
	[string]$NodePath = "F:\DSH Desktop\resources\app\node_modules\node\bin\node.exe",
	[string]$DshBin = "F:\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
	$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
	if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) { throw "Missing Desktop bundled Node: $NodePath" }
	if (-not (Test-Path -LiteralPath $DshBin -PathType Leaf)) { throw "Missing DSH CLI entry: $DshBin" }
	$env:DSH_M2_NODE = $NodePath
	$env:DSH_M2_BIN = $DshBin
	Push-Location $root
	try {
		& node --test test/runtime/m2-install.test.js
		if ($LASTEXITCODE -ne 0) { throw "M2 isolated install test failed with exit code $LASTEXITCODE" }
	} finally {
		Pop-Location
	}
	[ordered]@{
		status = "pass"
		evidence_level = "runtime"
		install_one_command = $true
		optional_missing_install = $true
		settings_preserved = $true
		isolated_dsh_home_only = $true
	} | ConvertTo-Json -Compress
} catch {
	[Console]::Error.WriteLine($_.Exception.Message)
	exit 1
}
