$ErrorActionPreference = "Stop"

$keystoreDir = "C:\Users\gowth\android-sdk\keystores"
$keystorePath = Join-Path $keystoreDir "ricoz-release.jks"
$credFilePath = Join-Path $keystoreDir "release-signing.properties"

if (-not (Test-Path $keystoreDir)) {
    New-Item -ItemType Directory -Path $keystoreDir -Force | Out-Null
}

if (Test-Path $keystorePath) {
    Write-Host "✅ Release keystore already exists at: $keystorePath"
    Write-Host "Preserving existing keystore (will not overwrite)."
} else {
    Write-Host "Generating production release keystore: $keystorePath..."
    
    # Generate high entropy 256-bit password
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rawBytes = New-Object byte[] 32
    $rng.GetBytes($rawBytes)
    $securePassword = [System.Convert]::ToBase64String($rawBytes).Replace('+', 'X').Replace('/', 'Y').Replace('=', 'Z')

    $env:RICOZ_KEYSTORE_PASSWORD = $securePassword
    $env:RICOZ_KEY_PASSWORD = $securePassword
    $env:RICOZ_KEY_ALIAS = "ricoz_release_key"

    $keytoolPath = "C:\Users\gowth\android-sdk\jdk-21\bin\keytool.exe"
    
    & $keytoolPath -genkeypair `
        -keystore $keystorePath `
        -alias $env:RICOZ_KEY_ALIAS `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -dname "CN=RicozAnalytics, OU=Mobile Engineering, O=Ricoz Analytics, L=Bengaluru, ST=Karnataka, C=IN" `
        -storepass:env RICOZ_KEYSTORE_PASSWORD `
        -keypass:env RICOZ_KEY_PASSWORD

    # Save credentials strictly outside git repo in secure keystore directory
    $credContent = @"
# RicozAnalytics Production Signing Credentials
# STRICTLY CONFIDENTIAL - DO NOT COMMIT TO VERSION CONTROL
RICOZ_KEYSTORE_FILE=$keystorePath
RICOZ_KEY_ALIAS=ricoz_release_key
RICOZ_KEYSTORE_PASSWORD=$securePassword
RICOZ_KEY_PASSWORD=$securePassword
"@
    Set-Content -Path $credFilePath -Value $credContent -Encoding UTF8

    Write-Host "✅ Production release keystore generated successfully!"
    Write-Host "Keystore Location: $keystorePath"
    Write-Host "Configuration Location: $credFilePath"
}
