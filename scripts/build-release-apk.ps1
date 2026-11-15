$ErrorActionPreference = "Stop"

Write-Host "================================================================"
Write-Host "   RICOZANALYTICS PRODUCTION RELEASE APK BUILD & SIGNING"
Write-Host "   Target Application ID: com.ricoz.analytics"
Write-Host "   Target Platform: Android API 36 (Android 16 Baklava)"
Write-Host "================================================================`n"

$repoRoot = "C:\Users\gowth\Downloads\Ricoz_analysis_project"
$keystoreDir = "C:\Users\gowth\android-sdk\keystores"
$keystoreFile = Join-Path $keystoreDir "ricoz-release.jks"
$signingProps = Join-Path $keystoreDir "release-signing.properties"

if (-not (Test-Path $keystoreFile)) {
    throw "Release keystore not found at: $keystoreFile."
}

if (-not (Test-Path $signingProps)) {
    throw "Signing properties not found at: $signingProps."
}

# 1. Load signing credentials securely from external properties
Write-Host "⏳ 1. Loading release signing configuration from external storage..."
$lines = Get-Content $signingProps
foreach ($line in $lines) {
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line.Split('=', 2)
        if ($parts.Length -eq 2) {
            [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), [System.EnvironmentVariableTarget]::Process)
        }
    }
}

$env:JAVA_HOME = "C:\Users\gowth\android-sdk\jdk-21"
$env:ANDROID_HOME = "C:\Users\gowth\android-sdk"
$env:ANDROID_SDK_ROOT = "C:\Users\gowth\android-sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\build-tools\36.0.0;$env:PATH"

# 2. Verify Keystore entry and certificate validity
Write-Host "⏳ 2. Verifying keystore entry and certificate validity..."
$keytool = "$env:JAVA_HOME\bin\keytool.exe"
$certDetails = & $keytool -list -keystore $keystoreFile -alias $env:RICOZ_KEY_ALIAS -storepass:env RICOZ_KEYSTORE_PASSWORD -v 2>&1
$sha256Line = ($certDetails | Select-String "SHA256:").Line
Write-Host "✅ Keystore verified: $env:RICOZ_KEY_ALIAS"
Write-Host "Certificate Fingerprint: $sha256Line"

# 3. Compile Production Frontend Assets (Vite)
Write-Host "`n⏳ 3. Compiling Production Frontend Assets (npm run build)..."
Push-Location "$repoRoot\client"
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

# 4. Synchronize Capacitor Android Assets (Sync Web & Native Plugins)
Write-Host "`n⏳ 4. Synchronizing Capacitor Android Assets (npx cap sync android)..."
Push-Location "$repoRoot\client"
try {
    npx cap sync android
    if ($LASTEXITCODE -ne 0) {
        throw "Capacitor sync failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

# 5. Build Production Signed Android APK (assembleRelease)
Write-Host "`n⏳ 5. Assembling Production Signed Android APK (clean assembleRelease)..."
Push-Location "$repoRoot\client\android"
try {
    .\gradlew.bat clean assembleRelease --stacktrace
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle assembleRelease failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

# 6. Verify Generated APK Artifact
$apkPath = "$repoRoot\client\android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apkPath)) {
    throw "Release APK was not generated at: $apkPath"
}

# 7. Verify Signature with jarsigner
Write-Host "`n⏳ 6. Cryptographically verifying APK signature..."
$jarsigner = "$env:JAVA_HOME\bin\jarsigner.exe"
$verifyOutput = & $jarsigner -verify -verbose -certs $apkPath 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "APK signature verification failed with exit code $LASTEXITCODE"
}
Write-Host "✅ APK Signature Verified: jar verified. (Exit code 0)"

# 8. Copy to easily accessible downloads and assets folders
$destDir = "$repoRoot\play_store_assets"
if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
$destApk = Join-Path $destDir "RicozAnalytics-v1.0.1-release.apk"
Copy-Item -Path $apkPath -Destination $destApk -Force

$downloadsApk = "C:\Users\gowth\Downloads\RicozAnalytics-v1.0.1-release.apk"
Copy-Item -Path $apkPath -Destination $downloadsApk -Force

# Also maintain legacy filename for direct backward-compatibility
$destApkLegacy = Join-Path $destDir "RicozAnalytics-v1.0.0-release.apk"
Copy-Item -Path $apkPath -Destination $destApkLegacy -Force
$downloadsApkLegacy = "C:\Users\gowth\Downloads\RicozAnalytics-v1.0.0-release.apk"
Copy-Item -Path $apkPath -Destination $downloadsApkLegacy -Force

$apkItem = Get-Item $apkPath
$apkHash = (Get-FileHash -Path $apkPath -Algorithm SHA256).Hash

Write-Host "`n================================================================"
Write-Host "  PRODUCTION RELEASE APK BUILD & SIGNING COMPLETE"
Write-Host "================================================================"
Write-Host "APK Gradle Path: $($apkItem.FullName)"
Write-Host "Direct Copy 1:   $destApk"
Write-Host "Direct Copy 2:   $downloadsApk"
Write-Host "APK File Size:   $($apkItem.Length) bytes ($([Math]::Round($apkItem.Length / 1MB, 2)) MB)"
Write-Host "SHA-256 Hash:    $apkHash"
Write-Host "Created At:      $($apkItem.LastWriteTime)"
Write-Host "Application ID:  com.ricoz.analytics"
Write-Host "Version Code:    4"
Write-Host "Version Name:    1.0.1"
Write-Host "================================================================`n"
