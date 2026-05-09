param(
  [ValidateSet('chrome', 'firefox', 'all')]
  [string]$Target = 'all'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $repoRoot
try {
  node scripts/build.js --target $Target
}
finally {
  Pop-Location
}
