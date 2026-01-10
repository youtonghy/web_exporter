param(
  [ValidateSet('chrome', 'firefox', 'all')]
  [string]$Target = 'all'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$distRoot = Join-Path $repoRoot 'dist'

function Reset-DistFolder([string]$path) {
  if (Test-Path $path) {
    Remove-Item -Recurse -Force $path
  }
  New-Item -ItemType Directory -Path $path | Out-Null
}

function Copy-ExtensionFiles([string]$outDir) {
  $items = @(
    'content.js',
    'popup.html',
    'popup.js',
    'popup.css',
    'background.js',
    'icons',
    'src'
  )

  foreach ($item in $items) {
    $srcPath = Join-Path $repoRoot $item
    if (!(Test-Path $srcPath)) {
      throw "Missing required item: $item"
    }
    Copy-Item -Recurse -Force $srcPath (Join-Path $outDir $item)
  }
}

function New-ChromeMv3Package() {
  $outDir = Join-Path $distRoot 'chrome-mv3'
  Reset-DistFolder $outDir

  Copy-ExtensionFiles $outDir

  $manifestTemplate = Join-Path $repoRoot 'manifests/manifest.chrome.v3.json'
  Copy-Item -Force $manifestTemplate (Join-Path $outDir 'manifest.json')

  Write-Host "Built: $outDir"
}

function New-FirefoxMv2Package() {
  $outDir = Join-Path $distRoot 'firefox-mv2'
  Reset-DistFolder $outDir

  Copy-ExtensionFiles $outDir

  $manifestTemplate = Join-Path $repoRoot 'manifests/manifest.firefox.v2.json'
  Copy-Item -Force $manifestTemplate (Join-Path $outDir 'manifest.json')

  Write-Host "Built: $outDir"
}

Reset-DistFolder $distRoot | Out-Null

switch ($Target) {
  'chrome' { New-ChromeMv3Package }
  'firefox' { New-FirefoxMv2Package }
  'all' {
    New-ChromeMv3Package
    New-FirefoxMv2Package
  }
}
