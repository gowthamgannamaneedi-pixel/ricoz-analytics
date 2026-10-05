const { spawn } = require('child_process');
const http = require('http');

// Helper to find Chrome or Edge executable
const fs = require('fs');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browserPath = fs.existsSync(chromePath) ? chromePath : edgePath;

console.log('Using browser at:', browserPath);

// Start headless browser with remote debugging
const debugPort = 9223;
const browserProcess = spawn(browserPath, [
  '--headless=new',
  `--remote-debugging-port=${debugPort}`,
  '--no-sandbox',
  '--disable-gpu',
  '--disable-extensions'
]);

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

async function run() {
  await sleep(1500);
  const version = await getJson(`http://127.0.0.1:${debugPort}/json/version`);
  console.log('Browser connected:', version.Browser);

  // We can use the WebSocket debugger URL
  const WebSocket = require('ws');
  // If ws is not installed globally, let's check
}

run().catch(err => {
  console.error(err);
  if (browserProcess) browserProcess.kill();
  process.exit(1);
});
