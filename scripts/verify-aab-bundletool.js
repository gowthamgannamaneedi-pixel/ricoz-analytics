const { execFileSync } = require('child_process');
const javaExe = 'C:/Users/gowth/android-sdk/jdk-21/bin/java.exe';
const bundletool = 'C:/Users/gowth/android-sdk/bundletool.jar';
const aabPath = 'client/android/app/build/outputs/bundle/release/app-release.aab';

const out = execFileSync(javaExe, ['-jar', bundletool, 'dump', 'manifest', '--bundle=' + aabPath], { encoding: 'utf8' });
console.log('=== BUNDLETOOL MANIFEST DUMP (First 1500 chars) ===');
console.log(out.slice(0, 1500));

const vcMatch = out.match(/android:versionCode="([^"]+)"/);
const vnMatch = out.match(/android:versionName="([^"]+)"/);
const pkgMatch = out.match(/package="([^"]+)"/);

console.log('\n=== PARSED VALUES FROM ACTUAL AAB MANIFEST ===');
console.log('Application ID:', pkgMatch ? pkgMatch[1] : 'unknown');
console.log('versionCode:   ', vcMatch ? vcMatch[1] : 'unknown');
console.log('versionName:   ', vnMatch ? vnMatch[1] : 'unknown');
