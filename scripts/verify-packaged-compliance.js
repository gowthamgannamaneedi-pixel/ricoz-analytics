const fs = require('fs');
const path = require('path');

const publicDir = 'client/android/app/src/main/assets/public';
const assetsDir = path.join(publicDir, 'assets');

console.log('=== VERIFYING PACKAGED ANDROID ASSETS ===');
console.log('Public dir exists:', fs.existsSync(publicDir));
console.log('Assets dir exists:', fs.existsSync(assetsDir));

const files = fs.readdirSync(assetsDir);
const privacyChunk = files.find(f => f.startsWith('PrivacyPolicyPage-'));
const deleteChunk = files.find(f => f.startsWith('DeleteAccountPage-'));
const loginChunk = files.find(f => f.startsWith('LoginPage-'));
const settingsChunk = files.find(f => f.startsWith('SettingsPage-'));

console.log('Privacy chunk: ', privacyChunk || 'MISSING');
console.log('Delete chunk:  ', deleteChunk || 'MISSING');
console.log('Login chunk:   ', loginChunk || 'MISSING');
console.log('Settings chunk:', settingsChunk || 'MISSING');

console.log('\n=== VERIFYING ROUTE REFERENCES IN CHUNKS ===');
if (loginChunk) {
  const loginContent = fs.readFileSync(path.join(assetsDir, loginChunk), 'utf8');
  console.log('LoginPage contains /privacy:       ', loginContent.includes('/privacy'));
  console.log('LoginPage contains /delete-account:', loginContent.includes('/delete-account'));
}

if (settingsChunk) {
  const settingsContent = fs.readFileSync(path.join(assetsDir, settingsChunk), 'utf8');
  console.log('SettingsPage contains /privacy:       ', settingsContent.includes('/privacy'));
  console.log('SettingsPage contains /delete-account:', settingsContent.includes('/delete-account'));
  console.log('SettingsPage contains delete-my-account API call:', settingsContent.includes('delete-my-account'));
}

console.log('\n=== VERIFYING STATIC HTML COPIES IN ASSETS ===');
console.log('public/privacy.html:       ', fs.existsSync(path.join(publicDir, 'privacy.html')));
console.log('public/delete-account.html:', fs.existsSync(path.join(publicDir, 'delete-account.html')));
console.log('public/.htaccess:          ', fs.existsSync(path.join(publicDir, '.htaccess')));
