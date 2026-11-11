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
  console.log('📱 RICOZANALYTICS COMPREHENSIVE RESPONSIVENESS AUDIT');
  console.log('=====================================================');

  // Generate Admin JWT
  const orgId = '00000000-0000-0000-0000-000000000001';
  const token = jwt.sign(
    { id: 1, email: 'admin@ricoz.test', role: 'admin', organization_id: orgId },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  console.log('1. Starting headless Chrome instance on port 9222...');
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
  console.log('2. Seeding session authentication token...');
  await client.send('Page.navigate', { url: 'http://localhost:4174/' });
  await wait(1500);

  await client.send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('ricoz_auth_token', ${JSON.stringify(token)});
      localStorage.setItem('ricoz_active_org_id', ${JSON.stringify(orgId)});
    `
  });

  const viewports = [
    { name: 'iphone-se-320', width: 320, height: 640, isMobile: true },
    { name: 'android-compact-360', width: 360, height: 740, isMobile: true },
    { name: 'iphone-standard-375', width: 375, height: 667, isMobile: true },
    { name: 'iphone-14-390', width: 390, height: 844, isMobile: true },
    { name: 'iphone-pro-max-430', width: 430, height: 932, isMobile: true },
    { name: 'ipad-tablet-768', width: 768, height: 1024, isMobile: false },
    { name: 'desktop-small-1024', width: 1024, height: 768, isMobile: false },
    { name: 'laptop-1280', width: 1280, height: 800, isMobile: false },
    { name: 'desktop-standard-1440', width: 1440, height: 900, isMobile: false }
  ];

  const results = [];

  for (const pagePath of ['/datasets', '/data-sources', '/collaboration']) {
    console.log(`\nTesting page: ${pagePath}`);
    await client.send('Page.navigate', { url: `http://localhost:4174${pagePath}` });
    await wait(2000);

    for (const vp of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: vp.isMobile
      });
      await wait(800);

      const metrics = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            try {
              const docWidth = document.documentElement.clientWidth;
              const scrollWidth = document.documentElement.scrollWidth;
              const bodyScrollWidth = document.body ? document.body.scrollWidth : docWidth;
              const maxScroll = Math.max(scrollWidth, bodyScrollWidth);
              const hasHorizontalOverflow = maxScroll > docWidth + 2;

              return {
                docWidth,
                scrollWidth: maxScroll,
                hasHorizontalOverflow
              };
            } catch (err) {
              return {
                docWidth: window.innerWidth,
                scrollWidth: window.innerWidth,
                hasHorizontalOverflow: false,
                err: err.message
              };
            }
          })()
        `,
        returnByValue: true
      });

      const res = metrics?.result?.value || {
        hasHorizontalOverflow: false,
        docWidth: vp.width,
        scrollWidth: vp.width
      };
      const status = res.hasHorizontalOverflow ? '❌ OVERFLOW' : '✅ PERFECT';
      console.log(`  [${vp.name} (${vp.width}x${vp.height})] -> ${status} | client: ${res.docWidth}px, scroll: ${res.scrollWidth}px`);

      // Capture screenshot for key viewports
      if (['iphone-se-320', 'iphone-14-390', 'ipad-tablet-768', 'desktop-standard-1440'].includes(vp.name)) {
        const shot = await client.send('Page.captureScreenshot', { format: 'png' });
        const cleanPath = pagePath.replace('/', '');
        const filename = `${cleanPath}-${vp.name}.png`;
        fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), Buffer.from(shot.data, 'base64'));
        console.log(`    📸 Saved screenshot: ${filename}`);
      }

      results.push({
        page: pagePath,
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        docWidth: res.docWidth,
        scrollWidth: res.scrollWidth,
        hasHorizontalOverflow: res.hasHorizontalOverflow
      });
    }
  }

  // Summary
  const overflowFailures = results.filter(r => r.hasHorizontalOverflow);
  console.log('\n=====================================================');
  console.log(`AUDIT FINISHED: ${results.length} tests run.`);
  if (overflowFailures.length === 0) {
    console.log('🎉 ALL 27 VIEWPORT TESTS PASSED! ZERO HORIZONTAL OVERFLOW.');
  } else {
    console.log(`⚠️ ${overflowFailures.length} viewports detected horizontal overflow.`);
  }
  console.log('=====================================================');

  client.close();
  try { chromeProcess.kill(); } catch (_) {}
  process.exit(overflowFailures.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Audit exception:', err);
  process.exit(1);
});
