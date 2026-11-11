import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://127.0.0.1:4173';
const SCREENSHOTS_DIR = 'C:/Users/gowth/.gemini/antigravity/brain/87331f27-4a58-47c0-b277-a30e971bc1c1/screenshots';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// 14 target breakpoints across 3 device tiers
const BREAKPOINTS = [
  // Mobile
  { tier: 'mobile', name: 'Mobile 320x640', width: 320, height: 640 },
  { tier: 'mobile', name: 'Mobile 360x800', width: 360, height: 800 },
  { tier: 'mobile', name: 'Mobile 375x812', width: 375, height: 812 },
  { tier: 'mobile', name: 'Mobile 390x844', width: 390, height: 844 },
  { tier: 'mobile', name: 'Mobile 430x932', width: 430, height: 932 },
  // Small & Medium
  { tier: 'tablet', name: 'Tablet 600x900', width: 600, height: 900 },
  { tier: 'tablet', name: 'Tablet 768x1024', width: 768, height: 1024 },
  { tier: 'tablet', name: 'Tablet 820x1180', width: 820, height: 1180 },
  { tier: 'tablet', name: 'Desktop/Tablet 1024x768', width: 1024, height: 768 },
  // Laptop & Desktop
  { tier: 'desktop', name: 'Laptop 1280x720', width: 1280, height: 720 },
  { tier: 'desktop', name: 'Laptop 1366x768', width: 1366, height: 768 },
  { tier: 'desktop', name: 'Desktop 1440x900', width: 1440, height: 900 },
  { tier: 'desktop', name: 'Desktop 1600x900', width: 1600, height: 900 },
  { tier: 'desktop', name: 'Desktop 1920x1080', width: 1920, height: 1080 },
];

const PAGES_TO_TEST = [
  { route: '/', name: 'Landing Page', auth: false },
  { route: '/login', name: 'Login Page', auth: false },
  { route: '/register', name: 'Register Page', auth: false },
  { route: '/forgot-password', name: 'Forgot Password Page', auth: false },
  { route: '/dashboard', name: 'Executive Dashboard', auth: true },
  { route: '/data-sources', name: 'Data Sources Page', auth: true },
  { route: '/datasets', name: 'Datasets Page', auth: true },
  { route: '/data-modeling', name: 'Data Modeling Page', auth: true },
  { route: '/data-quality', name: 'Data Quality Page', auth: true },
  { route: '/kpis', name: 'KPIs Page', auth: true },
  { route: '/reports', name: 'Reports Page', auth: true },
  { route: '/forecasts', name: 'Forecasts Page', auth: true },
  { route: '/alerts', name: 'Alerts Page', auth: true },
  { route: '/ai-insights', name: 'AI Insights Page', auth: true },
  { route: '/ai-assistant', name: 'AI Assistant Page', auth: true },
  { route: '/collaboration', name: 'Collaboration Page', auth: true },
  { route: '/billing', name: 'Billing & Plans Page', auth: true },
  { route: '/settings', name: 'Settings Page', auth: true },
  { route: '/governance', name: 'Governance Page', auth: true },
];

async function runComprehensiveAudit() {
  console.log(`Starting headless Chrome audit across all pages and viewports...`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();

  // Enable request interception to mock authenticated user & API endpoints
  await page.setRequestInterception(true);

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/auth/me')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          user: {
            id: 'mock-admin-001',
            name: 'Gowtham Admin',
            email: 'gowthamgannamaneedi@gmail.com',
            role: 'admin',
            organization_id: 'org-ricoz-primary',
            organizations: [
              { id: 'org-ricoz-primary', name: 'Ricoz Primary Organization', role: 'admin' }
            ]
          }
        })
      });
    } else if (url.includes('/api/billing/subscription')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          subscription: {
            plan: 'enterprise',
            status: 'active',
            current_period_end: '2027-11-10T00:00:00Z'
          }
        })
      });
    } else if (url.includes('/api/datasets')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            { id: 'ds-1', name: 'Mixed Variance Telemetry', row_count: 8, column_count: 7, created_at: new Date().toISOString() },
            { id: 'ds-2', name: 'Enterprise Sales 2026', row_count: 1540, column_count: 12, created_at: new Date().toISOString() }
          ],
          datasets: [
            { id: 'ds-1', name: 'Mixed Variance Telemetry', row_count: 8, column_count: 7, created_at: new Date().toISOString() },
            { id: 'ds-2', name: 'Enterprise Sales 2026', row_count: 1540, column_count: 12, created_at: new Date().toISOString() }
          ]
        })
      });
    } else if (url.includes('/api/data-sources')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          sources: [
            { id: 'src-1', name: 'sample_sales_report.csv', type: 'csv', status: 'ready', records: 252, updated_at: new Date().toISOString() }
          ]
        })
      });
    } else if (url.includes('/api/kpis') || url.includes('/api/metrics')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          metrics: [
            { id: 'm-1', name: 'Total Revenue', value: 84200000, formattedValue: '₹8,42,00,000', change: 18.4, status: 'good' },
            { id: 'm-2', name: 'Active Users', value: 14250, formattedValue: '14,250', change: 12.1, status: 'good' }
          ]
        })
      });
    } else if (url.includes('/api/collaboration/conversations')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          conversations: []
        })
      });
    } else if (url.includes('/api/collaboration/users') || url.includes('/api/organizations/users')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          users: [
            { id: 'u-1', name: 'Gowtham (Admin)', email: 'admin@ricoz.test', role: 'admin' },
            { id: 'u-2', name: 'Team Analyst', email: 'ricozanalytics@gmail.com', role: 'analyst' }
          ]
        })
      });
    } else if (url.includes('/api/')) {
      // General mock fallback for any backend endpoints
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success', data: [] })
      });
    } else {
      req.continue();
    }
  });

  // Pre-seed localStorage before navigating
  await page.goto(`${TARGET_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('ricoz_auth_token', 'mock-token-admin-123');
    localStorage.setItem('ricoz_active_org_id', 'org-ricoz-primary');
    localStorage.setItem('ricoz_theme', 'light');
  });

  const fullResults = [];

  // Helper to evaluate layout leaks
  const checkLayoutLeaks = async () => {
    return await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
      const clientWidth = doc.clientWidth;
      const hasHorizontalScroll = scrollWidth > clientWidth;

      const isClippedByAncestor = (el) => {
        let parent = el.parentElement;
        while (parent && parent !== doc && parent !== body) {
          const style = window.getComputedStyle(parent);
          const ox = style.overflowX;
          const o = style.overflow;
          if (['hidden', 'clip', 'auto', 'scroll'].includes(ox) || ['hidden', 'clip', 'auto', 'scroll'].includes(o)) {
            return true;
          }
          parent = parent.parentElement;
        }
        return false;
      };

      const leakingElements = [];
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.right > clientWidth + 1 && !isClippedByAncestor(el)) {
          leakingElements.push({
            tagName: el.tagName,
            className: (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : '',
            id: el.id || '',
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            clientWidth
          });
        }
      }

      return {
        scrollWidth,
        clientWidth,
        hasHorizontalScroll,
        leakingCount: leakingElements.length,
        topLeaks: leakingElements.slice(0, 3)
      };
    });
  };

  // Run test across selected representative breakpoints for each page
  // 320 (extreme mobile), 390 (standard phone), 768 (tablet portrait), 1024 (tablet landscape), 1440 (standard desktop)
  const auditViewports = [
    { name: 'Mobile 320x640', width: 320, height: 640 },
    { name: 'Mobile 390x844', width: 390, height: 844 },
    { name: 'Tablet 768x1024', width: 768, height: 1024 },
    { name: 'Desktop/Tablet 1024x768', width: 1024, height: 768 },
    { name: 'Desktop 1440x900', width: 1440, height: 900 },
  ];

  for (const pageItem of PAGES_TO_TEST) {
    console.log(`\nTesting: ${pageItem.name} (${pageItem.route})`);
    
    for (const vp of auditViewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      try {
        await page.goto(`${TARGET_URL}${pageItem.route}`, { waitUntil: 'networkidle0', timeout: 10000 });
      } catch (_) {
        // Fallback for slower loads
        await new Promise(r => setTimeout(r, 600));
      }
      await new Promise(r => setTimeout(r, 400));

      const metrics = await checkLayoutLeaks();
      const isPass = !metrics.hasHorizontalScroll && metrics.leakingCount === 0;

      console.log(`  [${isPass ? 'PASS' : 'FAIL'}] ${vp.name}: scrollW=${metrics.scrollWidth}, clientW=${metrics.clientWidth}, leaks=${metrics.leakingCount}`);
      if (!isPass && metrics.topLeaks.length > 0) {
        console.log(`    Leaks:`, JSON.stringify(metrics.topLeaks));
      }

      // Save screenshot for 320px and 1440px
      if ([320, 1440].includes(vp.width)) {
        const sanitizedRoute = pageItem.route === '/' ? 'landing' : pageItem.route.replace('/', '');
        const shotPath = path.join(SCREENSHOTS_DIR, `${sanitizedRoute}-${vp.width}x${vp.height}.png`);
        await page.screenshot({ path: shotPath, fullPage: false });
      }

      fullResults.push({
        page: pageItem.name,
        route: pageItem.route,
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        ...metrics,
        passed: isPass
      });
    }
  }

  await browser.close();

  const totalTests = fullResults.length;
  const passedTests = fullResults.filter(r => r.passed).length;
  console.log(`\n========================================`);
  console.log(`ALL PAGES AUDIT COMPLETE: ${passedTests}/${totalTests} PASSED (100% Target)`);
  console.log(`========================================`);

  if (passedTests < totalTests) {
    const failures = fullResults.filter(r => !r.passed);
    console.log('Failed Tests:', JSON.stringify(failures, null, 2));
  }
}

runComprehensiveAudit().catch(err => {
  console.error('Audit crashed:', err);
  process.exit(1);
});

