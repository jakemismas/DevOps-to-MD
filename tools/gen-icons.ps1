# Generates the toolbar PNG icons (16/32/48/128) from icons/source.png.
# Trims the uniform background margin, recenters on a square with a small margin, and
# downscales with high-quality bicubic. Preserves a transparent background if the source
# has one; otherwise fills with the source's background color (sampled from a corner).
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File tools/gen-icons.ps1
param(
  [string]$Source = (Join-Path (Split-Path -Parent $PSScriptRoot) 'icons/source.png')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'icons'
$src = [System.Drawing.Bitmap]::FromFile($Source)
$w0 = $src.Width; $h0 = $src.Height

# Detect the content bounding box on a downsampled probe (fast, good enough for margins).
$pw = 120; $ph = [int][math]::Round($h0 * $pw / $w0)
$probe = New-Object System.Drawing.Bitmap($pw, $ph)
$pg = [System.Drawing.Graphics]::FromImage($probe)
$pg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$pg.DrawImage($src, 0, 0, $pw, $ph)
$pg.Dispose()

$bg = $probe.GetPixel(0, 0)
$bgTransparent = $bg.A -lt 16
function Test-Background($c) {
  if ($bgTransparent) { return $c.A -lt 16 }
  return (([math]::Abs($c.R - $bg.R) + [math]::Abs($c.G - $bg.G) + [math]::Abs($c.B - $bg.B)) -lt 36) -and ($c.A -gt 200)
}

$minX = $pw; $minY = $ph; $maxX = 0; $maxY = 0; $found = $false
for ($y = 0; $y -lt $ph; $y++) {
  for ($x = 0; $x -lt $pw; $x++) {
    if (-not (Test-Background $probe.GetPixel($x, $y))) {
      $found = $true
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$probe.Dispose()
if (-not $found) { $minX = 0; $minY = 0; $maxX = $pw - 1; $maxY = $ph - 1 }

# Scale the probe-space bbox back to source pixels.
$sx = $w0 / $pw
$bx = [int][math]::Floor($minX * $sx)
$by = [int][math]::Floor($minY * $sx)
$bw = [int][math]::Ceiling((($maxX - $minX) + 1) * $sx)
$bh = [int][math]::Ceiling((($maxY - $minY) + 1) * $sx)
if ($bx -lt 0) { $bx = 0 }; if ($by -lt 0) { $by = 0 }
if (($bx + $bw) -gt $w0) { $bw = $w0 - $bx }
if (($by + $bh) -gt $h0) { $bh = $h0 - $by }

# Square side = larger content dimension plus an 8% margin on each edge.
$content = [math]::Max($bw, $bh)
$side = $content + 2 * [int][math]::Round($content * 0.08)

foreach ($s in 16, 32, 48, 128) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  if ($bgTransparent) { $g.Clear([System.Drawing.Color]::Transparent) } else { $g.Clear($bg) }

  $scale = $s / $side
  $dw = $bw * $scale; $dh = $bh * $scale
  $dx = ($s - $dw) / 2; $dy = ($s - $dh) / 2
  $srcRect = New-Object System.Drawing.RectangleF($bx, $by, $bw, $bh)
  $dstRect = New-Object System.Drawing.RectangleF($dx, $dy, $dw, $dh)
  $g.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

  $g.Dispose()
  $bmp.Save((Join-Path $outDir ("icon{0}.png" -f $s)), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host ("wrote icon{0}.png ({0}x{0})" -f $s)
}
$src.Dispose()
Write-Host ("source {0}x{1}; content bbox px x={2} y={3} w={4} h={5}; transparentBg={6}" -f $w0, $h0, $bx, $by, $bw, $bh, $bgTransparent)
