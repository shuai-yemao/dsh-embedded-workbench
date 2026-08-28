[CmdletBinding()]
param([string]$ProjectRoot = ".")

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
try {
	$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
	$provider = Join-Path $root "packages/provider-reference/src/lifecycle.ts"
	if (-not (Test-Path -LiteralPath $provider -PathType Leaf)) { throw "Missing Reference lifecycle provider" }
	$content = Get-Content -LiteralPath $provider -Raw -Encoding UTF8
	if (($content -notmatch "dispose") -or ($content -notmatch "cleanup")) { throw "Reference Provider lifecycle cleanup contract is incomplete" }
	[ordered]@{ status = "pass"; evidence_level = "static"; reference_provider_lifecycle = $true } | ConvertTo-Json -Compress
} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }
