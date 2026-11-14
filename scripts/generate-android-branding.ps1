Add-Type -AssemblyName System.Drawing

$srcLogo = "C:\Users\gowth\Downloads\Ricoz_analysis_project\client\public\ricoz-logo.png"
$resDir = "C:\Users\gowth\Downloads\Ricoz_analysis_project\client\android\app\src\main\res"

if (-not (Test-Path $srcLogo)) {
    Write-Error "Source logo not found at $srcLogo"
    exit 1
}

$origImg = [System.Drawing.Image]::FromFile($srcLogo)

# Densities and sizes
$densities = @{
    "mdpi" = @{ icon = 48; fg = 108; splashW = 320; splashH = 480; splashLandW = 480; splashLandH = 320 }
    "hdpi" = @{ icon = 72; fg = 162; splashW = 480; splashH = 800; splashLandW = 800; splashLandH = 480 }
    "xhdpi" = @{ icon = 96; fg = 216; splashW = 720; splashH = 1280; splashLandW = 1280; splashLandH = 720 }
    "xxhdpi" = @{ icon = 144; fg = 324; splashW = 960; splashH = 1600; splashLandW = 1600; splashLandH = 960 }
    "xxxhdpi" = @{ icon = 192; fg = 432; splashW = 1280; splashH = 1920; splashLandW = 1920; splashLandH = 1280 }
}

function Create-SquareIcon($size, $isRound) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($isRound) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $size, $size)
        $g.SetClip($path)
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $g.FillEllipse($brush, 0, 0, $size, $size)
        $brush.Dispose()
    } else {
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $g.FillRectangle($brush, 0, 0, $size, $size)
        $brush.Dispose()
    }

    # Center the logo with padding
    $pad = [int]($size * 0.12)
    $drawSize = $size - (2 * $pad)
    $g.DrawImage($origImg, $pad, $pad, $drawSize, $drawSize)

    $g.Dispose()
    return $bmp
}

function Create-Foreground($size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Transparent background, logo centered within safe zone (66% of canvas)
    $logoSize = [int]($size * 0.65)
    $offset = [int](($size - $logoSize) / 2)
    $g.DrawImage($origImg, $offset, $offset, $logoSize, $logoSize)

    $g.Dispose()
    return $bmp
}

function Create-Splash($w, $h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Brand dark background #0F172A
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
    $g.FillRectangle($bgBrush, 0, 0, $w, $h)
    $bgBrush.Dispose()

    # Center logo scaled
    $logoDimension = [Math]::Min($w, $h) * 0.40
    $x = ($w - $logoDimension) / 2
    $y = ($h - $logoDimension) / 2
    $g.DrawImage($origImg, [int]$x, [int]$y, [int]$logoDimension, [int]$logoDimension)

    $g.Dispose()
    return $bmp
}

Write-Host "Generating Android launcher icons and adaptive icons..."
foreach ($d in $densities.Keys) {
    $cfg = $densities[$d]
    $dir = Join-Path $resDir "mipmap-$d"
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

    # 1. ic_launcher.png
    $iconBmp = Create-SquareIcon $cfg.icon $false
    $iconBmp.Save((Join-Path $dir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $iconBmp.Dispose()

    # 2. ic_launcher_round.png
    $roundBmp = Create-SquareIcon $cfg.icon $true
    $roundBmp.Save((Join-Path $dir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $roundBmp.Dispose()

    # 3. ic_launcher_foreground.png
    $fgBmp = Create-Foreground $cfg.fg
    $fgBmp.Save((Join-Path $dir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $fgBmp.Dispose()

    # 4. Portrait Splash
    $portDir = Join-Path $resDir "drawable-port-$d"
    if (-not (Test-Path $portDir)) { New-Item -ItemType Directory -Path $portDir -Force | Out-Null }
    $portSplash = Create-Splash $cfg.splashW $cfg.splashH
    $portSplash.Save((Join-Path $portDir "splash.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $portSplash.Dispose()

    # 5. Landscape Splash
    $landDir = Join-Path $resDir "drawable-land-$d"
    if (-not (Test-Path $landDir)) { New-Item -ItemType Directory -Path $landDir -Force | Out-Null }
    $landSplash = Create-Splash $cfg.splashLandW $cfg.splashLandH
    $landSplash.Save((Join-Path $landDir "splash.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $landSplash.Dispose()
}

# Main drawable/splash.png
$drawableDir = Join-Path $resDir "drawable"
$defaultSplash = Create-Splash 1080 1920
$defaultSplash.Save((Join-Path $drawableDir "splash.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$defaultSplash.Dispose()

$origImg.Dispose()
Write-Host "✅ Android launcher icons, adaptive icons, and splash screens generated successfully!"

