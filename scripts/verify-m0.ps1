[CmdletBinding()]
param([string]$ProjectRoot = ".")

& (Join-Path $PSScriptRoot "verify-m2.ps1") -ProjectRoot $ProjectRoot
exit $LASTEXITCODE
