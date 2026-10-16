const https = require('https');
const http = require('http');

async function measureRequest(targetUrl, payload) {
  const isHttps = targetUrl.startsWith('https');
  const client = isHttps ? https : http;
  const url = new URL(targetUrl);
  const data = JSON.stringify(payload);

  const start = performance.now();
  let dnsTime = 0, tcpTime = 0, tlsTime = 0, firstByteTime = 0, totalTime = 0;

  return new Promise((resolve) => {
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'LatencyTester/1.0'
      }
    }, (res) => {
      res.once('readable', () => {
        firstByteTime = performance.now() - start;
      });

      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        totalTime = performance.now() - start;
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (_) { parsed = body; }
        resolve({
          statusCode: res.statusCode,
          totalTime: Math.round(totalTime),
          firstByteTime: Math.round(firstByteTime),
          dnsTime: Math.round(dnsTime),
          tcpTime: Math.round(tcpTime),
          tlsTime: Math.round(tlsTime),
          body: parsed
        });
      });
    });

    req.on('socket', (socket) => {
      socket.on('lookup', () => { dnsTime = performance.now() - start; });
      socket.on('connect', () => { tcpTime = performance.now() - start; });
      socket.on('secureConnect', () => { tlsTime = performance.now() - start; });
    });

    req.on('error', (err) => {
      resolve({
        error: err.message,
        totalTime: Math.round(performance.now() - start)
      });
    });

    req.write(data);
    req.end();
  });
}

async function pingGet(targetUrl) {
  const isHttps = targetUrl.startsWith('https');
  const client = isHttps ? https : http;
  const start = performance.now();
  return new Promise((resolve) => {
    client.get(targetUrl, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          duration: Math.round(performance.now() - start)
        });
      });
    }).on('error', (err) => {
      resolve({ error: err.message, duration: Math.round(performance.now() - start) });
    });
  });
}

async function main() {
  console.log('=== RICOZANALYTICS DEMO REQUEST LATENCY MEASUREMENT ===\n');

  // Check Render server wake status
  console.log('1. Checking Render live backend health / wake status...');
  const liveHealth = await pingGet('https://ricoz-analytics.onrender.com/api/demo-request/smtp-status');
  console.log('Live backend ping response:', liveHealth);

  const testPayload = {
    fullName: 'Benchmark Latency Lead',
    workEmail: 'ricozanalytics+bench@gmail.com',
    company: 'Acme Enterprise Benchmark',
    teamSize: '50-200',
    primaryDataSource: 'PostgreSQL',
    notes: 'Performance latency benchmark measurement'
  };

  // Test local backend
  console.log('\n2. Measuring local backend (http://localhost:5000/api/demo-request)...');
  const localRes = await measureRequest('http://localhost:5000/api/demo-request', testPayload);
  console.log('Local Result:', {
    statusCode: localRes.statusCode,
    totalTime: `${localRes.totalTime} ms`,
    firstByteTime: `${localRes.firstByteTime} ms`,
    success: localRes.body?.success,
    emailDelivery: localRes.body?.data?.email_delivery
  });

  // Test live Render backend
  console.log('\n3. Measuring LIVE Render backend (https://ricoz-analytics.onrender.com/api/demo-request)...');
  const liveRes = await measureRequest('https://ricoz-analytics.onrender.com/api/demo-request', testPayload);
  console.log('Live Render Result:', {
    statusCode: liveRes.statusCode,
    totalTime: `${liveRes.totalTime} ms (${(liveRes.totalTime / 1000).toFixed(2)} seconds)`,
    firstByteTime: `${liveRes.firstByteTime} ms`,
    dnsTime: `${liveRes.dnsTime} ms`,
    tcpTime: `${liveRes.tcpTime} ms`,
    tlsTime: `${liveRes.tlsTime} ms`,
    success: liveRes.body?.success,
    emailDelivery: liveRes.body?.data?.email_delivery
  });

  console.log('\n=== MEASUREMENT COMPLETE ===');
}

main().catch(console.error);
