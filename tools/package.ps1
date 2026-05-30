# Build the Chrome Web Store upload zip: only the runtime files, manifest at the root.
# Entries are written with forward-slash separators (required for valid extension zips;
# Windows .NET can otherwise emit backslashes).
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File tools/package.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
$version = $manifest.version

$build = Join-Path $root 'build'
$pkg = Join-Path $build 'pkg'
if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force }
New-Item -ItemType Directory -Force -Path $pkg | Out-Null

# Runtime files only. Excludes test/, tools/, node_modules/, docs, dev config, CLAUDE.md.
Copy-Item (Join-Path $root 'manifest.json') $pkg
foreach ($d in 'src', 'vendor', 'icons') {
  Copy-Item (Join-Path $root $d) (Join-Path $pkg $d) -Recurse
}
# VENDOR.md is dev documentation; no need to ship it.
$vendorDoc = Join-Path $pkg 'vendor/VENDOR.md'
if (Test-Path $vendorDoc) { Remove-Item $vendorDoc -Force }

$zip = Join-Path $build ("devops-to-md-{0}.zip" -f $version)
if (Test-Path $zip) { Remove-Item $zip -Force }

$fs = [System.IO.File]::Open($zip, [System.IO.FileMode]::CreateNew)
$archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -Recurse -File $pkg | Sort-Object FullName | ForEach-Object {
    $rel = $_.FullName.Substring($pkg.Length + 1).Replace('\', '/')
    $entry = $archive.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
    $in = [System.IO.File]::OpenRead($_.FullName)
    $out = $entry.Open()
    try { $in.CopyTo($out) } finally { $out.Dispose(); $in.Dispose() }
    Write-Host ("  " + $rel)
  }
}
finally {
  $archive.Dispose()
  $fs.Dispose()
}
Write-Host ("Built {0}" -f $zip)
