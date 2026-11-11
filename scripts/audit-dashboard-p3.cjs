const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const jwt = require('../server/node_modules/jsonwebtoken');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'C:\\Users\\gowth\\.gemini\\antigravity\\brain\\87331f27-4a58-47c0-b277-a30e971bc1c1\\screenshots';
const JWT_SECRET = require('../server/config').jwtSecret;

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.events = new Map();

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method) {
        const listeners = this.events.get(msg.method) || [];
        listeners.forEach((fn) => fn(msg.params));
      }
    };
  }

  ready() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log('=====================================================');
  console.log('📱 RICOZANALYTICS DASHBOARD P3 RESPONSIVENESS AUDIT');
  console.log('=====================================================');

  // Generate Admin JWT
  const orgId = '00000000-0000-0000-0000-000000000001';
  const token = jwt.sign(
    { id: 1, email: 'admin@ricoz.test', role: 'admin', organization_id: orgId },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  console.log('1. Starting headless Chrome on port 9222...');
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1440,900',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  await wait(2000);

  let pages = null;
  for (let i = 0; i < 20; i++) {
    try {
      pages = await httpGet('http://127.0.0.1:9222/json/list');
      if (pages && pages.length > 0) break;
    } catch (_) {}
    await wait(500);
  }

  if (!pages || !pages[0]?.webSocketDebuggerUrl) {
    throw new Error('Unable to connect to Chrome remote debugging port.');
  }

  const client = new CDPClient(pages[0].webSocketDebuggerUrl);
  await client.ready();

  await client.send('Page.enable');
  await client.send('DOM.enable');
  await client.send('Runtime.enable');

  // Authenticate via local storage
  console.log('2. Authenticating session...');
  await client.send('Page.navigate', { url: 'http://localhost:4174/' });
  await wait(1500);

  await client.send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('ricoz_auth_token', ${JSON.stringify(token)});
      localStorage.setItem('ricoz_active_org_id', ${JSON.stringify(orgId)});
    `
  });

  console.log('3. Navigating to /dashboard...');
  await client.send('Page.navigate', { url: 'http://localhost:4174/dashboard' });
  await wait(3000);

  // Viewports required by directive: 320px, 360px, 375px, 390px, 430px, tablet (768px), desktop (1440px)
  const viewports = [
    { name: 'dashboard-iphone-se-320', width: 320, height: 640, isMobile: true },
    { name: 'dashboard-android-compact-360', width: 360, height: 740, isMobile: true },
    { name: 'dashboard-iphone-8-375', width: 375, height: 667, isMobile: true },
    { name: 'dashboard-iphone-14-390', width: 390, height: 844, isMobile: true },
    { name: 'dashboard-iphone-pro-max-430', width: 430, height: 932, isMobile: true },
    { name: 'dashboard-ipad-tablet-768', width: 768, height: 1024, isMobile: false },
    { name: 'dashboard-desktop-standard-1440', width: 1440, height: 900, isMobile: false }
  ];

  const auditReport = [];

  for (const vp of viewports) {
    console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})`);

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      mobile: vp.isMobile
    });
    await wait(1000);

    const metrics = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          try {
            const docWidth = document.documentElement.clientWidth;
            const scrollWidth = document.documentElement.scrollWidth;
            const bodyScrollWidth = document.body ? document.body.scrollWidth : docWidth;
            const maxScroll = Math.max(scrollWidth, bodyScrollWidth);
            const hasHorizontalOverflow = maxScroll > docWidth + 2;

            // Check key widgets
            const hasHeader = !!document.querySelector('h1');
            const headerText = document.querySelector('h1')?.textContent || '';
            const bodyText = document.body.innerText || '';
            const hasRegional = bodyText.includes('Regional Performance');
            const hasChannel = bodyText.includes('Sales by Channel');
            const hasTrend = bodyText.includes('Sales Revenue Trend');
            const hasProducts = bodyText.includes('Top Performing Products');
            const hasSignals = bodyText.includes('Decision Signals');
            const hasTransactions = bodyText.includes('Recent Sales Transaction');

            return {
              docWidth,
              scrollWidth: maxScroll,
              hasHorizontalOverflow,
              hasHeader,
              headerText,
              hasRegional,
              hasChannel,
              hasTrend,
              hasProducts,
              hasSignals,
              hasTransactions
            };
          } catch (e) {
            return { error: e.message };
          }
        })()
      `,
      returnByValue: true
    });

    const res = metrics.result.value || {};
    console.log(`  clientWidth: ${res.docWidth}px, scrollWidth: ${res.scrollWidth}px, overflow: ${res.hasHorizontalOverflow ? 'FAIL ❌' : 'PASS ✅'}`);
    console.log(`  Widgets present: Regional=${res.hasRegional}, Channel=${res.hasChannel}, Trend=${res.hasTrend}, Products=${res.hasProducts}, Signals=${res.hasSignals}, Table=${res.hasTransactions}`);

    // Capture screenshot
    const screenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false
    });

    const screenshotPath = path.join(SCREENSHOT_DIR, `${vp.name}.png`);
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`  📸 Screenshot saved: ${screenshotPath}`);

    auditReport.push({
      viewport: vp.name,
      dimensions: `${vp.width}x${vp.height}`,
      hasOverflow: res.hasHorizontalOverflow,
      metrics: res,
      screenshot: screenshotPath
    });
  }

  // Also capture Dark Mode for 1440px and 390px to compare directly with reference image
  console.log('\n--- Capturing Dark Mode comparison screenshots ---');
  for (const vp of [
    { name: 'dashboard-dark-desktop-1440', width: 1440, height: 900, isMobile: false },
    { name: 'dashboard-dark-iphone-14-390', width: 390, height: 844, isMobile: true }
  ]) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      mobile: vp.isMobile
    });
    // Toggle dark class on documentElement
    await client.send('Runtime.evaluate', {
      expression: `document.documentElement.classList.add('dark');`
    });
    await wait(800);

    const screenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false
    });
    const screenshotPath = path.join(SCREENSHOT_DIR, `${vp.name}.png`);
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`  📸 Dark Mode Screenshot: ${screenshotPath}`);
  }

  client.close();
  try {
    chromeProcess.kill('SIGKILL');
  } catch (_) {}

  console.log('\n=====================================================');
  console.log('AUDIT SUMMARY:');
  const allPassed = auditReport.every(r => !r.hasOverflow);
  console.log(`Overall Responsiveness Status: ${allPassed ? 'ALL VIEWPORTS PASSED (0px Overflow) ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('=====================================================');
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
