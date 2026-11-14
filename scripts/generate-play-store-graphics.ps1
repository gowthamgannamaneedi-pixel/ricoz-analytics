Add-Type -AssemblyName System.Drawing

$outDir = "C:\Users\gowth\Downloads\Ricoz_analysis_project\play_store_assets"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$srcLogo = "C:\Users\gowth\Downloads\Ricoz_analysis_project\client\public\ricoz-logo.png"
if (-not (Test-Path $srcLogo)) {
    Write-Error "Source logo not found at $srcLogo"
    exit 1
}

$origLogo = [System.Drawing.Image]::FromFile($srcLogo)

# 1. 512x512 App Icon (32-bit PNG with alpha, modern rounded squircle)
Write-Host "Generating 512x512 Play Store App Icon..."
$iconBmp = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gIcon = [System.Drawing.Graphics]::FromImage($iconBmp)
$gIcon.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gIcon.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gIcon.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Clear background
$gIcon.Clear([System.Drawing.Color]::Transparent)

# Draw rounded rectangle background (crimson brand #BE123C)
$rect = New-Object System.Drawing.Rectangle(16, 16, 480, 480)
$radius = 100
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
$path.AddArc($rect.Right - $radius, $rect.Y, $radius, $radius, 270, 90)
$path.AddArc($rect.Right - $radius, $rect.Bottom - $radius, $radius, $radius, 0, 90)
$path.AddArc($rect.X, $rect.Bottom - $radius, $radius, $radius, 90, 90)
$path.CloseFigure()

$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point(512, 512)),
    [System.Drawing.Color]::FromArgb(225, 29, 72),  # #E11D48
    [System.Drawing.Color]::FromArgb(159, 18, 57)   # #9F1239
)
$gIcon.FillPath($bgBrush, $path)
$bgBrush.Dispose()

# Draw crisp white logo in center
$logoPad = 80
$logoDrawSize = 512 - (2 * $logoPad)
$gIcon.DrawImage($origLogo, $logoPad, $logoPad, $logoDrawSize, $logoDrawSize)

$iconPath = Join-Path $outDir "icon_512x512.png"
$iconBmp.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
$gIcon.Dispose()
$iconBmp.Dispose()
Write-Host "✅ Created: $iconPath"


# 2. 1024x500 Feature Graphic (24-bit PNG, no alpha, rich dark gradient with logo, title & telemetry motifs)
Write-Host "Generating 1024x500 Play Store Feature Graphic..."
$featBmp = New-Object System.Drawing.Bitmap(1024, 500, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$gFeat = [System.Drawing.Graphics]::FromImage($featBmp)
$gFeat.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gFeat.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$gFeat.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Background dark navy gradient (#0B1120 to #1E293B)
$bgFeatBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point(1024, 500)),
    [System.Drawing.Color]::FromArgb(11, 17, 32),   # Deep Dark Slate
    [System.Drawing.Color]::FromArgb(30, 41, 59)    # Slate 800
)
$gFeat.FillRectangle($bgFeatBrush, 0, 0, 1024, 500)
$bgFeatBrush.Dispose()

# Draw subtle accent glow top-right
$glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 225, 29, 72))
$gFeat.FillEllipse($glowBrush, 600, -100, 500, 500)
$glowBrush.Dispose()

# Draw Logo Icon on the left
$featLogoSize = 220
$featLogoX = 80
$featLogoY = 140
$gFeat.DrawImage($origLogo, $featLogoX, $featLogoY, $featLogoSize, $featLogoSize)

# Typography
$fontTitle = New-Object System.Drawing.Font("Segoe UI", 44, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fontSubtitle = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fontPills = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$crimsonBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(244, 63, 94)) # Rose 500
$grayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))  # Slate 400

# Title: RicozAnalytics
$textX = 330
$textY = 160
$gFeat.DrawString("Ricoz", $fontTitle, $whiteBrush, $textX, $textY)
$sizeRicoz = $gFeat.MeasureString("Ricoz", $fontTitle)
$gFeat.DrawString("Analytics", $fontTitle, $crimsonBrush, ($textX + $sizeRicoz.Width - 10), $textY)

# Subtitle
$gFeat.DrawString("Executive Business Intelligence & Real-Time Telemetry", $fontSubtitle, $grayBrush, $textX, ($textY + 56))

# Capability Pills
$pills = @("LIVE KPI TELEMETRY", "TIME-SERIES FORECASTS", "EXECUTIVE EXPORTS", "MULTI-TENANT GOVERNANCE")
$pillX = $textX
$pillY = $textY + 105

foreach ($pill in $pills) {
    $pillSize = $gFeat.MeasureString($pill, $fontPills)
    $pillWidth = [int]($pillSize.Width + 18)
    $pillHeight = 28

    # Pill background
    $pillBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 255, 255, 255))
    $gFeat.FillRectangle($pillBg, $pillX, $pillY, $pillWidth, $pillHeight)
    $pillBg.Dispose()

    # Pill border
    $pillPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 244, 63, 94), 1)
    $gFeat.DrawRectangle($pillPen, $pillX, $pillY, $pillWidth, $pillHeight)
    $pillPen.Dispose()

    # Pill text
    $pillTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(254, 205, 211)) # Rose 200
    $gFeat.DrawString($pill, $fontPills, $pillTextBrush, ($pillX + 9), ($pillY + 6))
    $pillTextBrush.Dispose()

    $pillX += ($pillWidth + 12)
}

$featPath = Join-Path $outDir "feature_graphic_1024x500.png"
$featBmp.Save($featPath, [System.Drawing.Imaging.ImageFormat]::Png)

$gFeat.Dispose()
$featBmp.Dispose()
$origLogo.Dispose()

Write-Host "✅ Created: $featPath"
Write-Host "Play Store graphics generation complete!"
