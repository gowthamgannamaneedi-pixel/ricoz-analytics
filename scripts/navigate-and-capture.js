const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || 'C:/Users/gowth/.gemini/antigravity/brain/87331f27-4a58-47c0-b277-a30e971bc1c1';
const ADB = process.env.ADB_PATH || 'C:/Users/gowth/android-sdk/platform-tools/adb.exe';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function adbExec(cmd) {
  return execSync(`"${ADB}" ${cmd}`, { encoding: 'utf-8' });
}

function capture(filename) {
  const remote = `/sdcard/${filename}`;
  const local = path.join(ARTIFACT_DIR, filename);
  adbExec(`shell screencap -p ${remote}`);
  adbExec(`pull ${remote} "${local}"`);
  console.log(`Saved: ${filename} (${fs.statSync(local).size} bytes)`);
}

async function run() {
  const res = await fetch('http://127.0.0.1:9222/json');
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('No page target found');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let nextId = 1;
  function evalJs(code) {
    return new Promise(resolve => {
      const id = nextId++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result?.result?.value);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression: code, returnByValue: true, awaitPromise: true }
      }));
    });
  }

  // 1. DASHBOARD
  console.log('\n--- 1. Navigating to Dashboard ---');
  await evalJs(`
    (() => {
      const links = Array.from(document.querySelectorAll('a'));
      const dLink = links.find(l => l.getAttribute('href') === '/dashboard' || l.href.endsWith('/dashboard'));
      if (dLink) dLink.click();
      else window.location.href = 'https://localhost/dashboard';
    })()
  `);
  await sleep(4000);
  capture('dashboard_screen.png');

  // 2. DATASETS
  console.log('\n--- 2. Navigating to Datasets ---');
  await evalJs(`
    (() => {
      const links = Array.from(document.querySelectorAll('a'));
      const dLink = links.find(l => l.getAttribute('href') === '/datasets' || l.href.endsWith('/datasets'));
      if (dLink) dLink.click();
      else window.location.href = 'https://localhost/datasets';
    })()
  `);
  await sleep(3500);
  capture('datasets_screen.png');

  // 3. REPORTS
  console.log('\n--- 3. Navigating to Reports ---');
  await evalJs(`
    (() => {
      const links = Array.from(document.querySelectorAll('a'));
      const rLink = links.find(l => l.getAttribute('href') === '/reports' || l.href.endsWith('/reports'));
      if (rLink) rLink.click();
      else window.location.href = 'https://localhost/reports';
    })()
  `);
  await sleep(3500);
  capture('reports_screen.png');

  // 4. AI ASSIST
  console.log('\n--- 4. Navigating to AI Assist ---');
  await evalJs(`
    (() => {
      const links = Array.from(document.querySelectorAll('a'));
      const aLink = links.find(l => l.getAttribute('href') === '/ai-assistant' || l.href.endsWith('/ai-assistant'));
      if (aLink) aLink.click();
      else window.location.href = 'https://localhost/ai-assistant';
    })()
  `);
  await sleep(3500);
  capture('ai_assist_screen.png');

  ws.close();
  console.log('\n🎉 Successfully navigated and captured all screens!');
}

run().catch(console.error);
