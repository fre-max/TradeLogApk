# Script pour aligner et signer l'APK avec v1, v2 et v3
$keystore = "C:\Users\kiemd\.android\debug.keystore"
$jarsigner = "C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot\bin\jarsigner.exe"
$zipalign = "C:\Users\kiemd\AppData\Local\Android\Sdk\build-tools\34.0.0\zipalign.exe"
$apksigner = "C:\Users\kiemd\AppData\Local\Android\Sdk\build-tools\34.0.0\apksigner.bat"
$apkSource = "android\app\build\outputs\apk\debug\app-debug.apk"
$apkAligned = "android\app\build\outputs\apk\debug\app-aligned.apk"
$apkFinal = "TradeLog-debug.apk"

Write-Host "1. Signature jarsigner..."
& $jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore $keystore -storepass android -keypass android $apkSource androiddebugkey

Write-Host "2. Zipalign..."
if (Test-Path $apkAligned) { Remove-Item -Force $apkAligned }
& $zipalign -f -p 4 $apkSource $apkAligned

Write-Host "3. Apksigner (v1, v2, v3)..."
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out $apkFinal $apkAligned

Write-Host "4. Verification signature..."
& $apksigner verify --verbose $apkFinal

Write-Host "APK pret a l'emploi !"
