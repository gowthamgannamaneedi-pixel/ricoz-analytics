$ErrorActionPreference = "Stop"

Write-Host "=================================================="
Write-Host "🚀 RICOZANALYTICS ANDROID ENVIRONMENT SETUP"
Write-Host "=================================================="

$baseDir = "C:\Users\gowth\android-sdk"
$jdkDir = Join-Path $baseDir "jdk-17"
$cmdlineDir = Join-Path $baseDir "cmdline-tools"
$cmdlineLatest = Join-Path $cmdlineDir "latest"

New-Item -ItemType Directory -Path $baseDir -Force | Out-Null
New-Item -ItemType Directory -Path $cmdlineDir -Force | Out-Null

# 1. Download and Extract OpenJDK 17
if (-not (Test-Path (Join-Path $jdkDir "bin\java.exe"))) {
    Write-Host "1. Downloading Microsoft OpenJDK 17..."
    $jdkUrl = "https://download.visualstudio.microsoft.com/download/pr/58dca6c6-c3c9-4daa-8e17-b7d0df501afc/667a0e2c93e1aab8df0707a31c42d190/microsoft-jdk-17.0.12-windows-x64.zip"
    $jdkZip = Join-Path $baseDir "jdk17.zip"
    
    curl.exe -L -o $jdkZip $jdkUrl --progress-bar
    Write-Host "Extracting OpenJDK 17..."
    $extractTmp = Join-Path $baseDir "jdk_tmp"
    Expand-Archive -Path $jdkZip -DestinationPath $extractTmp -Force
    
    $extractedFolder = Get-ChildItem -Path $extractTmp -Directory | Select-Object -First 1
    Move-Item -Path $extractedFolder.FullName -Destination $jdkDir -Force
    Remove-Item -Path $extractTmp -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $jdkZip -Force -ErrorAction SilentlyContinue
    Write-Host "✅ OpenJDK 17 installed to $jdkDir"
} else {
    Write-Host "✅ OpenJDK 17 already exists at $jdkDir"
}

# 2. Download and Extract Android Commandline Tools
if (-not (Test-Path (Join-Path $cmdlineLatest "bin\sdkmanager.bat"))) {
    Write-Host "2. Downloading Android Command-line Tools..."
    $cmdlineUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    $cmdlineZip = Join-Path $baseDir "cmdline-tools.zip"
    
    curl.exe -L -o $cmdlineZip $cmdlineUrl --progress-bar
    Write-Host "Extracting Commandline Tools..."
    $cmdlineTmp = Join-Path $baseDir "cmdline_tmp"
    Expand-Archive -Path $cmdlineZip -DestinationPath $cmdlineTmp -Force
    
    # Google's zip has a root folder named 'cmdline-tools'
    $innerCmdline = Join-Path $cmdlineTmp "cmdline-tools"
    if (Test-Path $cmdlineLatest) {
        Remove-Item -Path $cmdlineLatest -Recurse -Force -ErrorAction SilentlyContinue
    }
    Move-Item -Path $innerCmdline -Destination $cmdlineLatest -Force
    Remove-Item -Path $cmdlineTmp -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $cmdlineZip -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Android Command-line Tools installed to $cmdlineLatest"
} else {
    Write-Host "✅ Android Command-line Tools already exist at $cmdlineLatest"
}

# 3. Configure User Environment Variables
Write-Host "3. Configuring Persistent Environment Variables..."
[Environment]::SetEnvironmentVariable("JAVA_HOME", $jdkDir, "User")
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $baseDir, "User")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $baseDir, "User")

$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$pathsToAdd = @(
    (Join-Path $jdkDir "bin"),
    (Join-Path $cmdlineLatest "bin"),
    (Join-Path $baseDir "platform-tools")
)

$updatedPath = $currentPath
foreach ($p in $pathsToAdd) {
    if ($updatedPath -notlike "*$p*") {
        $updatedPath = "$p;$updatedPath"
    }
}
[Environment]::SetEnvironmentVariable("Path", $updatedPath, "User")

# Set for current process
$env:JAVA_HOME = $jdkDir
$env:ANDROID_HOME = $baseDir
$env:ANDROID_SDK_ROOT = $baseDir
$env:Path = "$($jdkDir)\bin;$($cmdlineLatest)\bin;$($baseDir)\platform-tools;$env:Path"

Write-Host "4. Verifying Installation Versions..."
$javaVer = & "$jdkDir\bin\java.exe" -version 2>&1
Write-Host "Java Version:"
Write-Host $javaVer

Write-Host "`nAccepting Android SDK licenses and installing platform-tools..."
# Accept licenses
$sdkManager = Join-Path $cmdlineLatest "bin\sdkmanager.bat"
$echoCmd = "cmd.exe /c ""for /l %i in (1,1,20) do @echo y | `"$sdkManager`" --licenses"""
Invoke-Expression $echoCmd

Write-Host "`nInstalling platform-tools and latest SDK..."
cmd.exe /c "echo y | `"$sdkManager`" ""platform-tools"" ""platforms;android-34"" ""build-tools;34.0.0"""

Write-Host "=================================================="
Write-Host "🎉 ENVIRONMENT SETUP COMPLETE!"
Write-Host "=================================================="

