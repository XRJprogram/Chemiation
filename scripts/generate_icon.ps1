Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$g.Clear([System.Drawing.Color]::Transparent)

# Rounded rectangle
$margin = 32
$w = $size - ($margin * 2)
$h = $size - ($margin * 2)
$radius = 224
$rect = New-Object System.Drawing.Rectangle $margin, $margin, $w, $h

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
$path.AddArc(($rect.Right - $radius), $rect.Y, $radius, $radius, 270, 90)
$path.AddArc(($rect.Right - $radius), ($rect.Bottom - $radius), $radius, $radius, 0, 90)
$path.AddArc($rect.X, ($rect.Bottom - $radius), $radius, $radius, 90, 90)
$path.CloseFigure()

# Background color: warm beige
$c1 = [System.Drawing.Color]::FromArgb(255, 255, 252, 245)
$c2 = [System.Drawing.Color]::FromArgb(255, 243, 233, 215)
$pt1 = New-Object System.Drawing.Point 0, 0
$pt2 = New-Object System.Drawing.Point 0, 1024
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $pt1, $pt2, $c1, $c2
$g.FillPath($brush, $path)

# Border: subtle warm tone
$borderColor = [System.Drawing.Color]::FromArgb(255, 222, 209, 186)
$pen = New-Object System.Drawing.Pen -ArgumentList $borderColor, 18
$g.DrawPath($pen, $path)

$style = [System.Drawing.FontStyle]::Bold
$unit = [System.Drawing.GraphicsUnit]::Pixel
$font = New-Object System.Drawing.Font "Century Gothic", 580.0, $style, $unit
$brownColor = [System.Drawing.Color]::FromArgb(255, 90, 51, 25)
$textBrush = New-Object System.Drawing.SolidBrush -ArgumentList $brownColor

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center

$layoutRect = New-Object System.Drawing.RectangleF 0, 20, 1024, 1024
$g.DrawString("C", $font, $textBrush, $layoutRect, $sf)

$outputPng = Join-Path $PSScriptRoot "app-icon.png"
$bmp.Save($outputPng, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
Write-Host "Success: Generated $outputPng"
