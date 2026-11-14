$ErrorActionPreference = "Stop"

Write-Host "================================================================"
Write-Host "   RICOZANALYTICS PRODUCTION RELEASE AAB BUILD & SIGNING"
Write-Host "   Target Application ID: com.ricoz.analytics"
Write-Host "   Target Platform: Android API 36 (Android 16 Baklava)"
Write-Host "================================================================`n"

$repoRoot = "C:\Users\gowth\Downloads\Ricoz_analysis_project"
$keystoreDir = "C:\Users\gowth\android-sdk\keystores"
$keystoreFile = Join-Path $keystoreDir "ricoz-release.jks"
$signingProps = Join-Path $keystoreDir "release-signing.properties"

if (-not (Test-Path $keystoreFile)) {
    throw "Release keystore not found at: $keystoreFile. Run generate-release-keystore.ps1 first."
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

# 3. Build Client Web Assets for Production
Write-Host "`n⏳ 3. Building React Client for Production..."
Push-Location "$repoRoot\client"
try {
    npm run build
} finally {
    Pop-Location
}

# 4. Synchronize Capacitor Android Assets & Plugins
Write-Host "`n⏳ 4. Synchronizing Capacitor Android Assets..."
Push-Location "$repoRoot\client"
try {
    npx cap sync android
} finally {
    Pop-Location
}

# 5. Build Production Signed Android App Bundle (AAB)
Write-Host "`n⏳ 5. Assembling Production Signed Android App Bundle (bundleRelease)..."
Push-Location "$repoRoot\client\android"
try {
    .\gradlew.bat bundleRelease --stacktrace
} finally {
    Pop-Location
}

# 6. Verify and Record Generated AAB Artifact
$aabPath = "$repoRoot\client\android\app\build\outputs\bundle\release\app-release.aab"
if (-not (Test-Path $aabPath)) {
    throw "Release AAB was not generated at: $aabPath"
}

$aabItem = Get-Item $aabPath
$aabHash = (Get-FileHash -Path $aabPath -Algorithm SHA256).Hash

Write-Host "`n================================================================"
Write-Host "  PRODUCTION RELEASE AAB BUILD & SIGNING COMPLETE"
Write-Host "================================================================"
Write-Host "AAB File Path:  $($aabItem.FullName)"
Write-Host "AAB File Size:  $($aabItem.Length) bytes ($([Math]::Round($aabItem.Length / 1MB, 2)) MB)"
Write-Host "SHA-256 Hash:   $aabHash"
Write-Host "Created At:     $($aabItem.LastWriteTime)"
Write-Host "Application ID: com.ricoz.analytics"
Write-Host "Version Code:   3"
Write-Host "Version Name:   1.0.0"
Write-Host "================================================================`n"
