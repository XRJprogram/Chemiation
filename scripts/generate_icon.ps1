Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$g.Clear([System.Drawing.Color]::Transparent)

# Rounded rectangle geometry
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

# 1. 完全扁平化纯色底色 (Solid Flat Background #FAF6E9 无任何渐变)
$flatBg = [System.Drawing.Color]::FromArgb(255, 250, 246, 233)
$bgBrush = New-Object System.Drawing.SolidBrush -ArgumentList $flatBg
$g.FillPath($bgBrush, $path)

# 2. 裁切于圆角矩形内绘制加粗网格 (Thickened Coordinate Grid)
$g.SetClip($path)

# 加粗网格：线条宽度 8px，间距 80px，颜色为清晰可见的枣红暖色系 (~24% 不透明度)
$gridColor = [System.Drawing.Color]::FromArgb(62, 184, 74, 40)
$gridPen = New-Object System.Drawing.Pen -ArgumentList $gridColor, 7.5

$step = 80
for ($x = $margin + $step; $x -lt ($margin + $w); $x += $step) {
    $g.DrawLine($gridPen, $x, 0, $x, $size)
}
for ($y = $margin + $step; $y -lt ($margin + $h); $y += $step) {
    $g.DrawLine($gridPen, 0, $y, $size, $y)
}

$g.ResetClip()

# 3. 加粗外边框 (Thickened Flat Border: 36px)
$borderColor = [System.Drawing.Color]::FromArgb(255, 214, 194, 164)
$borderPen = New-Object System.Drawing.Pen -ArgumentList $borderColor, 36
$g.DrawPath($borderPen, $path)

# 4. 枣红色 Century Gothic 字母 C (Jujube Red #B84A28, 同款 index 强调色)
$style = [System.Drawing.FontStyle]::Bold
$unit = [System.Drawing.GraphicsUnit]::Pixel
$font = New-Object System.Drawing.Font "Century Gothic", 590.0, $style, $unit
$jujubeColor = [System.Drawing.Color]::FromArgb(255, 184, 74, 40)
$textBrush = New-Object System.Drawing.SolidBrush -ArgumentList $jujubeColor

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center

$layoutRect = New-Object System.Drawing.RectangleF 0, 22, 1024, 1024
$g.DrawString("C", $font, $textBrush, $layoutRect, $sf)

$outputPng = Join-Path $PSScriptRoot "app-icon.png"
$bmp.Save($outputPng, [System.Drawing.Imaging.ImageFormat]::Png)

$gridPen.Dispose()
$borderPen.Dispose()
$bgBrush.Dispose()
$textBrush.Dispose()
$font.Dispose()
$g.Dispose()
$bmp.Dispose()
Write-Host "Success: Generated $outputPng"
