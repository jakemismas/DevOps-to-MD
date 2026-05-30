# Generates the optional Chrome Web Store small promo tile (440x280).
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File tools/gen-promo.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$build = Join-Path $root 'build'
New-Item -ItemType Directory -Force -Path $build | Out-Null

$w = 440; $h = 280
$accent = [System.Drawing.Color]::FromArgb(255, 0, 103, 181)
$white = [System.Drawing.Color]::White

$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear($accent)

# Rounded "MD" badge, left.
$badge = 132; $bx = 36; $by = ($h - $badge) / 2; $r = 26; $d = $r * 2
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($bx, $by, $d, $d, 180, 90)
$path.AddArc($bx + $badge - $d, $by, $d, $d, 270, 90)
$path.AddArc($bx + $badge - $d, $by + $badge - $d, $d, $d, 0, 90)
$path.AddArc($bx, $by + $badge - $d, $d, $d, 90, 90)
$path.CloseFigure()
$g.FillPath((New-Object System.Drawing.SolidBrush($white)), $path)
$mdFont = New-Object System.Drawing.Font('Segoe UI', 58, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString('MD', $mdFont, (New-Object System.Drawing.SolidBrush($accent)), (New-Object System.Drawing.RectangleF($bx, $by, $badge, $badge)), $sf)

# Title + subtitle, right.
$tx = $bx + $badge + 28
$titleFont = New-Object System.Drawing.Font('Segoe UI', 34, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$subFont = New-Object System.Drawing.Font('Segoe UI', 18, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('DevOps to', $titleFont, (New-Object System.Drawing.SolidBrush($white)), $tx, 86)
$g.DrawString('Markdown', $titleFont, (New-Object System.Drawing.SolidBrush($white)), $tx, 126)
$g.DrawString('Work item to clean Markdown', $subFont, (New-Object System.Drawing.SolidBrush($white)), $tx, 176)

$g.Dispose()
$out = Join-Path $build 'promo-440x280.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host ("wrote {0}" -f $out)
