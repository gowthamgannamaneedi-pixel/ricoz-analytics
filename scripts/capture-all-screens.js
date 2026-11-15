const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || 'C:/Users/gowth/.gemini/antigravity/brain/87331f27-4a58-47c0-b277-a30e971bc1c1';
const ADB = process.env.ADB_PATH || 'C:/Users/gowth/android-sdk/platform-tools/adb.exe';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function adbExec(cmd) {
  return execSync(`"${ADB}" ${cmd}`, { encoding: 'utf-8' });
}

function takeScreenshot(filename) {
  const remotePath = `/sdcard/${filename}`;
  const localPath = path.join(ARTIFACT_DIR, filename);
  adbExec(`shell screencap -p ${remotePath}`);
  adbExec(`pull ${remotePath} "${localPath}"`);
  console.log(`📸 Captured screenshot: ${localPath} (${fs.statSync(localPath).size} bytes)`);
  return localPath;
}

async function getDebuggerUrl() {
  const res = await fetch('http://127.0.0.1:9222/json');
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('No page target found on Android devtools');
  return page.webSocketDebuggerUrl;
}

function createDevToolsClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  async function evaluate(expression) {
    await ready;
    const res = await new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true }
      }));
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Evaluation exception');
    }
    return res.result ? res.result.value : undefined;
  }

  function close() {
    try { ws.close(); } catch(e) {}
  }

  return { ready, evaluate, close };
}

async function main() {
  console.log('🚀 Starting screen capture workflow...');

  // Ensure port forwarding is active for com.ricoz.analytics PID
  try {
    const psOutput = adbExec('shell "ps -A | grep com.ricoz.analytics"');
    const pidMatch = psOutput.match(/\S+\s+(\d+)/);
    if (!pidMatch) throw new Error('Could not find com.ricoz.analytics PID');
    const pid = pidMatch[1];
    console.log(`Found com.ricoz.analytics PID: ${pid}`);
    adbExec(`forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
  } catch(e) {
    console.warn('Port forward check warning:', e.message);
  }

  await sleep(1500);

  let wsUrl = await getDebuggerUrl();
  console.log('Connected to debugger URL:', wsUrl);
  let client = createDevToolsClient(wsUrl);
  await client.ready;

  // 1. SCREENSHOT 1: LOGIN SCREEN
  console.log('\n--- 1. Capturing Login Screen ---');
  await client.evaluate(`
    localStorage.clear();
    window.location.href = 'https://localhost/login';
  `);
  await sleep(3000);
  takeScreenshot('login_screen.png');

  // 2. AUTHENTICATE DIRECTLY VIA NODE.JS
  console.log('\n--- 2. Authenticating via Node.js API ---');
  const loginRes = await fetch('https://ricoz-analytics.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ricoz.test', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) {
    throw new Error('Node API login failed: ' + JSON.stringify(loginData));
  }
  console.log('API Login Success. User:', loginData.user.name, 'Org:', loginData.user.organization_id);

  // Set tokens in WebView and navigate to Dashboard
  console.log('Injecting session and navigating to Dashboard...');
  await client.evaluate(`
    localStorage.setItem('ricoz_auth_token', '${loginData.token}');
    localStorage.setItem('ricoz_active_org_id', '${loginData.user.organization_id}');
    window.location.href = 'https://localhost/dashboard';
  `);
  console.log('Waiting for Dashboard to load analytics...');
  await sleep(6000);
  takeScreenshot('dashboard_screen.png');

  // 3. SCREENSHOT 3: DATASETS SCREEN
  console.log('\n--- 3. Navigating to Datasets & Capturing Screen ---');
  await client.evaluate(`
    window.location.href = 'https://localhost/datasets';
  `);
  await sleep(4000);
  takeScreenshot('datasets_screen.png');

  // 4. SCREENSHOT 4: REPORTS SCREEN
  console.log('\n--- 4. Navigating to Reports & Capturing Screen ---');
  await client.evaluate(`
    window.location.href = 'https://localhost/reports';
  `);
  await sleep(4000);
  takeScreenshot('reports_screen.png');

  // 5. SCREENSHOT 5: AI ASSIST SCREEN
  console.log('\n--- 5. Navigating to AI Assist & Capturing Screen ---');
  await client.evaluate(`
    window.location.href = 'https://localhost/ai-assistant';
  `);
  await sleep(4000);
  takeScreenshot('ai_assist_screen.png');

  // 6. SCREENSHOT 6: SETTINGS SCREEN
  console.log('\n--- 6. Navigating to Settings & Capturing Screen ---');
  await client.evaluate(`
    window.location.href = 'https://localhost/settings';
  `);
  await sleep(4000);
  takeScreenshot('settings_screen.png');

  client.close();
  console.log('\n🎉 All 6 screenshots successfully captured and saved to artifact directory!');
}

main().catch(err => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
