const https = require('https');

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timed out after 15s'));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function verifyProduction() {
  console.log('=====================================================');
  console.log('🌐 RICOZANALYTICS PRODUCTION ENVIRONMENT CHECK');
  console.log('=====================================================\n');

  // 1. Check Backend Health
  try {
    console.log('[1] Checking Render Backend API (https://ricoz-analytics.onrender.com/health)...');
    const backendRes = await fetchUrl('https://ricoz-analytics.onrender.com/health');
    console.log(`Backend Health Status: HTTP ${backendRes.statusCode}`);
    console.log(`Body:`, backendRes.body.substring(0, 200));
  } catch (err) {
    console.warn(`Backend check warning (may be cold starting or spinning up):`, err.message);
  }

  // 2. Check Backend API health
  try {
    console.log('\n[2] Checking Render Backend API Health (https://ricoz-analytics.onrender.com/api/health)...');
    const apiHealthRes = await fetchUrl('https://ricoz-analytics.onrender.com/api/health');
    console.log(`API Health Status: HTTP ${apiHealthRes.statusCode}`);
    console.log(`Body:`, apiHealthRes.body.substring(0, 200));
  } catch (err) {
    console.warn(`API health check warning:`, err.message);
  }

  // 3. Check Vercel Frontend
  try {
    console.log('\n[3] Checking Vercel Frontend (https://ricoz-analytics.vercel.app)...');
    const frontendRes = await fetchUrl('https://ricoz-analytics.vercel.app');
    console.log(`Frontend Status: HTTP ${frontendRes.statusCode}`);
    const isHtml = frontendRes.headers['content-type']?.includes('text/html');
    const hasRicoz = frontendRes.body.includes('Ricoz') || frontendRes.body.includes('root') || frontendRes.body.includes('vite');
    console.log(`Is HTML: ${isHtml}, Contains Vite/Ricoz root: ${hasRicoz}`);
  } catch (err) {
    console.warn(`Frontend check warning:`, err.message);
  }

  console.log('\n=====================================================');
  console.log('🏁 PRODUCTION CONNECTIVITY AUDIT COMPLETE');
  console.log('=====================================================');
}

verifyProduction().catch(console.error);

