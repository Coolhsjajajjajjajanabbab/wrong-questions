Add-Type -AssemblyName System.Drawing

$sourcePath = "D:\迅雷云盘\APP开发\index.html\static\dogs\dog1.png"
$outputDir = "D:\迅雷云盘\APP开发\index.html\static\icons"
$sizes = @(72, 96, 128, 144, 152, 180, 192, 384, 512)

# 加载原图
$img = [System.Drawing.Image]::FromFile($sourcePath)

foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    # 绘制圆角背景（粉色渐变）
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 164, 184))
    $graphics.FillRectangle($brush, 0, 0, $size, $size)
    
    # 计算缩放比例，保持宽高比
    $ratio = [Math]::Min($size / $img.Width, $size / $img.Height) * 0.85
    $newWidth = [int]($img.Width * $ratio)
    $newHeight = [int]($img.Height * $ratio)
    $x = [int](($size - $newWidth) / 2)
    $y = [int](($size - $newHeight) / 2)
    
    # 绘制图片
    $graphics.DrawImage($img, $x, $y, $newWidth, $newHeight)
    
    # 保存
    $outputPath = "$outputDir\icon-$size.png"
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $bitmap.Dispose()
    
    Write-Host "Generated: icon-$size.png"
}

$img.Dispose()
Write-Host "All icons generated successfully!"
