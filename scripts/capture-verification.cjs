const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'C:\\Users\\gowth\\.gemini\\antigravity\\brain\\87331f27-4a58-47c0-b277-a30e971bc1c1\\screenshots';

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

  on(event, handler) {
    if (!this.events.has(event)) this.events.set(event, []);
    this.events.get(event).push(handler);
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log('1. Starting headless Chrome...');
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

  try {
    // Wait for debugging port
    let connected = false;
    let pages = null;
    for (let i = 0; i < 20; i++) {
      await wait(500);
      try {
        pages = await httpGet('http://127.0.0.1:9222/json/list');
        if (pages && pages.length > 0) {
          connected = true;
          break;
        }
      } catch (e) {}
    }

    if (!connected || !pages || !pages[0].webSocketDebuggerUrl) {
      throw new Error('Failed to connect to Chrome debugging port.');
    }

    const wsUrl = pages[0].webSocketDebuggerUrl;
    console.log('2. Connected to Chrome CDP target:', wsUrl);

    const client = new CDPClient(wsUrl);
    await client.ready();

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    console.log('3. Navigating to http://localhost:4174/ ...');
    await client.send('Page.navigate', { url: 'http://localhost:4174/' });
    await wait(3000);

    // Verify Title & Hero
    const titleRes = await client.send('Runtime.evaluate', {
      expression: 'document.title'
    });
    console.log('Page Title:', titleRes.result.value);

    // ─── DESKTOP VIEWPORT: 1440 x 900 ───
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // ─── TEST 1: STORYTELLING 4-STEP WORKFLOW ───
    console.log('\n--- Testing Storytelling 4-Step Workflow ---');
    // Scroll to #how-it-works or Storytelling showcase
    await client.send('Runtime.evaluate', {
      expression: `
        const el = document.querySelector('#how-it-works') || document.querySelector('section');
        if (el) el.scrollIntoView({ behavior: 'instant' });
      `
    });
    await wait(1000);

    // Click step 3 (index 2: "Identify Trends and Metric Variances")
    const stepClickRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          // Find step buttons in storytelling showcase
          const stepButtons = Array.from(document.querySelectorAll('div')).filter(el => {
            return el.innerText && (el.innerText.includes('Identify Trends and Metric Variances') || el.innerText.includes('ANALYZE') && el.innerText.includes('03'));
          });
          const target = stepButtons.find(el => el.getAttribute('class')?.includes('group') || el.getAttribute('class')?.includes('cursor-pointer')) || stepButtons[0];
          if (target) {
            target.click();
            return { clicked: true, text: target.innerText.slice(0, 60) };
          }
          return { clicked: false, totalDivsFound: stepButtons.length };
        })()
      `,
      returnByValue: true
    });
    console.log('Step 3 Click Result:', stepClickRes.result.value);
    await wait(1500);

    // Verify active stage
    const activeStageCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const bodyText = document.body.innerText;
          const hasStage3 = bodyText.includes('STAGE 03') || bodyText.includes('Identify Trends') || bodyText.includes('Variance Analysis') || bodyText.includes('Regional breakdown');
          const badge = document.querySelector('.lg\\\\:col-span-7')?.innerText?.slice(0, 200) || '';
          return { hasStage3, badgeSnippet: badge };
        })()
      `,
      returnByValue: true
    });
    console.log('Stage 3 Verification:', activeStageCheck.result.value);

    // Capture screenshot: desktop-storytelling-step3.png
    console.log('Capturing desktop-storytelling-step3.png...');
    const shot1 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'desktop-storytelling-step3.png'), Buffer.from(shot1.data, 'base64'));

    // ─── TEST 2: PRICING SECTION & 44% DISCOUNT ───
    console.log('\n--- Testing Pricing Section & 44% Discount Math ---');
    await client.send('Runtime.evaluate', {
      expression: `
        const pricingEl = document.querySelector('#pricing');
        if (pricingEl) pricingEl.scrollIntoView({ behavior: 'instant', block: 'center' });
      `
    });
    await wait(1500);

    // Inspect pricing text in DOM
    const pricingData = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const pricingSection = document.querySelector('#pricing');
          if (!pricingSection) return { error: 'No #pricing section found' };
          const text = pricingSection.innerText;
          const has44 = text.includes('44%') || text.includes('Save 44%');
          const hasStarter = text.includes('4,697') || text.includes('₹4,697');
          const hasGrowth = text.includes('13,433') || text.includes('₹13,433');
          const hasEnterprise = text.includes('47,033') || text.includes('₹47,033');
          return {
            has44,
            hasStarter,
            hasGrowth,
            hasEnterprise,
            sectionTextPreview: text.slice(0, 400)
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Pricing verification in Annual mode:', pricingData.result.value);

    // Capture screenshot: desktop-pricing-annual-44pct.png
    console.log('Capturing desktop-pricing-annual-44pct.png (1440x900)...');
    const shot2 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'desktop-pricing-annual-44pct.png'), Buffer.from(shot2.data, 'base64'));

    // ─── TEST 3: TABLET VIEWPORT (768 x 1024) ───
    console.log('\n--- Capturing Tablet Viewport (768 x 1024) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: true
    });
    await wait(1000);
    await client.send('Runtime.evaluate', {
      expression: `
        const pricingEl = document.querySelector('#pricing');
        if (pricingEl) pricingEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      `
    });
    await wait(1000);
    const shot3 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'tablet-pricing-annual.png'), Buffer.from(shot3.data, 'base64'));
    console.log('Saved tablet-pricing-annual.png');

    // ─── TEST 4: MOBILE VIEWPORT (390 x 844) ───
    console.log('\n--- Capturing Mobile Viewport (390 x 844) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await wait(1000);
    await client.send('Runtime.evaluate', {
      expression: `
        const pricingEl = document.querySelector('#pricing');
        if (pricingEl) pricingEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      `
    });
    await wait(1000);
    const shot4 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'mobile-pricing-annual.png'), Buffer.from(shot4.data, 'base64'));
    console.log('Saved mobile-pricing-annual.png');

    client.close();
    console.log('\nAll browser visual verification screenshots captured successfully!');
  } finally {
    try {
      chromeProcess.kill('SIGKILL');
    } catch (e) {}
  }
}

main().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
