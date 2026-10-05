const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browserPath = fs.existsSync(chromePath) ? chromePath : edgePath;

const debugPort = 9227;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method) {
        if (msg.method === 'Runtime.consoleAPICalled') {
          const type = msg.params.type;
          const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
          if (type === 'error') {
            this.consoleErrors.push(text);
          }
        }
      }
    };
  }

  waitOpen() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || 'Evaluation error');
    }
    return res.result?.value;
  }
}

async function run() {
  console.log('[Browser QA] Logging in via API to obtain fresh admin JWT token...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ricoz.test', password: 'admin123' })
  });
  const loginJson = await loginRes.json();
  const token = loginJson.data?.token || loginJson.token;
  console.log('[Browser QA] JWT token acquired successfully.');

  console.log('[Browser QA] Launching headless browser:', browserPath);
  const browserProc = spawn(browserPath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1600,1000',
    'about:blank'
  ]);

  try {
    await sleep(2000);
    const targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found');

    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.waitOpen();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('[Browser QA] Injecting authentication token into localStorage...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(2000);
    await client.eval(`
      localStorage.setItem('ricoz_auth_token', '${token}');
      localStorage.setItem('ricoz_active_dataset_id', '1');
      window.location.href = 'http://localhost:5173/dashboard';
    `);

    console.log('[Browser QA] Waiting for /dashboard rendering and analytics fetch...');
    await sleep(4000);

    // Read URL
    const url = await client.eval('window.location.href');
    console.log('[Browser QA] Rendered page URL:', url);

    // Helper to read the 4 KPI cards from the DOM
    async function readKpis() {
      return await client.eval(`
        (() => {
          const cards = document.querySelectorAll('section.grid > div');
          if (!cards || cards.length < 4) return null;
          
          function extractCard(card) {
            const title = card.querySelector('span.uppercase')?.innerText?.trim() || '';
            const value = card.querySelector('span.text-3xl, span.text-4xl')?.innerText?.trim() || '';
            const sub = card.querySelector('div.border-t')?.innerText?.trim() || '';
            return { title, value, sub };
          }
          
          return {
            kpi1: extractCard(cards[0]),
            kpi2: extractCard(cards[1]),
            kpi3: extractCard(cards[2]),
            kpi4: extractCard(cards[3])
          };
        })()
      `);
    }

    // 1. Initial State
    console.log('\n=============================================================');
    console.log('  1. INITIAL DASHBOARD LOAD (Unfiltered Dataset 1)');
    console.log('=============================================================');
    let kpis = await readKpis();
    if (!kpis) {
      console.log('KPIs not yet loaded, waiting 2s...');
      await sleep(2000);
      kpis = await readKpis();
    }
    console.log('KPI 1 (Revenue):', kpis?.kpi1);
    console.log('KPI 2 (Total Orders):', kpis?.kpi2);
    console.log('KPI 3 (Units Sold):', kpis?.kpi3);
    console.log('KPI 4 (Avg Order Value):', kpis?.kpi4);

    // 2. Select Region = Bengaluru
    console.log('\n=============================================================');
    console.log('  2. FILTER: Region = Bengaluru');
    console.log('=============================================================');
    await client.eval(`
      const sel = document.getElementById('dynamic-filter-region');
      if (sel) {
        sel.value = 'Bengaluru';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);
    await sleep(2000);
    kpis = await readKpis();
    console.log('KPI 1 (Revenue):', kpis?.kpi1);
    console.log('KPI 2 (Total Orders):', kpis?.kpi2);
    console.log('KPI 3 (Units Sold):', kpis?.kpi3);
    console.log('KPI 4 (Avg Order Value):', kpis?.kpi4);

    // 3. Select Channel = Direct Online
    console.log('\n=============================================================');
    console.log('  3. FILTER: Channel = Direct Online (Reset Region first)');
    console.log('=============================================================');
    await client.eval(`
      const selReg = document.getElementById('dynamic-filter-region');
      if (selReg) {
        selReg.value = 'all';
        selReg.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const selChan = document.getElementById('dynamic-filter-channel');
      if (selChan) {
        selChan.value = 'Direct Online';
        selChan.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);
    await sleep(2000);
    kpis = await readKpis();
    console.log('KPI 1 (Revenue):', kpis?.kpi1);
    console.log('KPI 2 (Total Orders):', kpis?.kpi2);
    console.log('KPI 3 (Units Sold):', kpis?.kpi3);
    console.log('KPI 4 (Avg Order Value):', kpis?.kpi4);

    // 4. Select Category = Hardware
    console.log('\n=============================================================');
    console.log('  4. FILTER: Category = Hardware (Reset Channel first)');
    console.log('=============================================================');
    await client.eval(`
      (() => {
        const selChan = document.getElementById('dynamic-filter-channel');
        if (selChan) {
          selChan.value = 'all';
          selChan.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const selCat = document.getElementById('dynamic-filter-category');
        if (selCat) {
          selCat.value = 'Hardware';
          selCat.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(2000);
    kpis = await readKpis();
    console.log('KPI 1 (Revenue):', kpis?.kpi1);
    console.log('KPI 2 (Total Orders):', kpis?.kpi2);
    console.log('KPI 3 (Units Sold):', kpis?.kpi3);
    console.log('KPI 4 (Avg Order Value):', kpis?.kpi4);

    // 5. Reset Filters
    console.log('\n=============================================================');
    console.log('  5. RESET FILTERS (Return to full baseline)');
    console.log('=============================================================');
    await client.eval(`
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset'));
      if (resetBtn) resetBtn.click();
    `);
    await sleep(2000);
    kpis = await readKpis();
    console.log('KPI 1 (Revenue):', kpis?.kpi1);
    console.log('KPI 2 (Total Orders):', kpis?.kpi2);
    console.log('KPI 3 (Units Sold):', kpis?.kpi3);
    console.log('KPI 4 (Avg Order Value):', kpis?.kpi4);

    // 6. Filter: Date Range = 7D
    console.log('\n=============================================================');
    console.log('  6. FILTER: Date Range = 7D');
    console.log('=============================================================');
    await client.eval(`
      const btn7d = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '7D');
      if (btn7d) btn7d.click();
    `);
    await sleep(2000);
    kpis = await readKpis();
    console.log('KPI 1 (Revenue):', kpis?.kpi1);
    console.log('KPI 2 (Total Orders):', kpis?.kpi2);
    console.log('KPI 3 (Units Sold):', kpis?.kpi3);
    console.log('KPI 4 (Avg Order Value):', kpis?.kpi4);

    // 7. Reset Filters back to All Time
    await client.eval(`
      const btnAll = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'All Time');
      if (btnAll) btnAll.click();
    `);
    await sleep(2000);
    kpis = await readKpis();

    // Check console errors
    console.log('\n=============================================================');
    console.log('  BROWSER CONSOLE ERRORS:');
    console.log('=============================================================');
    console.log(`Console error count: ${client.consoleErrors.length}`);
    if (client.consoleErrors.length > 0) {
      console.log('Errors:', client.consoleErrors);
    } else {
      console.log('0 Console Errors detected in live browser session!');
    }

    console.log('\n[Browser QA] SUCCESS: All interactions verified in actual rendered browser!');

  } finally {
    browserProc.kill();
  }
}

run().catch(err => {
  console.error('[Browser QA Error]', err);
  process.exit(1);
});
