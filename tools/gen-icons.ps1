# Generates the toolbar PNG icons (16/32/48/128) as a blue rounded square with "MD".
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File tools/gen-icons.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$accent = [System.Drawing.Color]::FromArgb(255, 0, 103, 181)
$white  = [System.Drawing.Color]::White

foreach ($s in 16, 32, 48, 128) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  $radius = [Math]::Max(2, [int]($s * 0.18))
  $d = $radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc($s - $d, 0, $d, $d, 270, 90)
  $path.AddArc($s - $d, $s - $d, $d, $d, 0, 90)
  $path.AddArc(0, $s - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $brush = New-Object System.Drawing.SolidBrush($accent)
  $g.FillPath($brush, $path)

  $fontSize = [Math]::Max(6, [int]($s * 0.44))
  $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textBrush = New-Object System.Drawing.SolidBrush($white)
  $rect = New-Object System.Drawing.RectangleF(0, 0, $s, $s)
  $g.DrawString('MD', $font, $textBrush, $rect, $sf)

  $g.Dispose()
  $bmp.Save((Join-Path $outDir ("icon{0}.png" -f $s)), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote icon$s.png"
}
