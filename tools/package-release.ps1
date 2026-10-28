param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if ($manifest.manifest_version -ne 3) {
  throw 'Expected a Manifest V3 extension.'
}

if ($manifest.version -notmatch '^\d+\.\d+\.\d+$') {
  throw "Extension version must be a stable three-part version; found '$($manifest.version)'."
}

$runtimeFiles = @(
  'manifest.json',
  'background.js',
  'content.js',
  'page-agent.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png'
)

foreach ($relativePath in $runtimeFiles) {
  $path = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required release file is missing: $relativePath"
  }
}

$releaseDirectory = Join-Path $root 'dist'
New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
$archivePath = Join-Path $releaseDirectory "TwitchPlayerReset-$($manifest.version).zip"

if ((Test-Path -LiteralPath $archivePath) -and -not $Force) {
  throw "Release archive already exists: $archivePath. Use -Force to replace it."
}

if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$archive = [System.IO.Compression.ZipFile]::Open(
  $archivePath,
  [System.IO.Compression.ZipArchiveMode]::Create
)

try {
  foreach ($relativePath in $runtimeFiles) {
    $sourcePath = Join-Path $root $relativePath
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $sourcePath,
      $relativePath.Replace('\', '/'),
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
}
finally {
  $archive.Dispose()
}

Write-Output "Created release archive: $archivePath"
