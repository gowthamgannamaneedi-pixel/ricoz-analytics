import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const BREAKPOINTS = [
  // Mobile
  { name: 'Mobile 320x640', width: 320, height: 640 },
  { name: 'Mobile 360x800', width: 360, height: 800 },
  { name: 'Mobile 375x812', width: 375, height: 812 },
  { name: 'Mobile 390x844', width: 390, height: 844 },
  { name: 'Mobile 430x932', width: 430, height: 932 },
  // Small & Medium
  { name: 'Tablet 600x900', width: 600, height: 900 },
  { name: 'Tablet 768x1024', width: 768, height: 1024 },
  { name: 'Tablet 820x1180', width: 820, height: 1180 },
  { name: 'Desktop/Tablet 1024x768', width: 1024, height: 768 },
  // Laptop & Desktop
  { name: 'Laptop 1280x720', width: 1280, height: 720 },
  { name: 'Laptop 1366x768', width: 1366, height: 768 },
  { name: 'Desktop 1440x900', width: 1440, height: 900 },
  { name: 'Desktop 1600x900', width: 1600, height: 900 },
  { name: 'Desktop 1920x1080', width: 1920, height: 1080 },
];

const TARGET_URL = 'http://127.0.0.1:4173';
const SCREENSHOTS_DIR = 'C:/Users/gowth/.gemini/antigravity/brain/87331f27-4a58-47c0-b277-a30e971bc1c1/screenshots';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runAudit() {
  console.log(`Starting headless Chrome audit with: ${CHROME_PATH}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  const results = [];

  for (const bp of BREAKPOINTS) {
    await page.setViewport({ width: bp.width, height: bp.height });
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 500));

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
      const clientWidth = doc.clientWidth;
      const hasHorizontalScroll = scrollWidth > clientWidth;

      // Check for unclipped overflow (elements leaking outside viewport without an overflowing ancestor)
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
        // Element extends past clientWidth and is not clipped by any ancestor
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
        topLeaks: leakingElements.slice(0, 5)
      };
    });

    const isPass = !metrics.hasHorizontalScroll && metrics.leakingCount === 0;
    console.log(`[${isPass ? 'PASS' : 'FAIL'}] ${bp.name} (${bp.width}x${bp.height}): scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth}, leaks=${metrics.leakingCount}`);
    if (!isPass && metrics.topLeaks.length > 0) {
      console.log('  Top leaking elements:', JSON.stringify(metrics.topLeaks, null, 2));
    }

    results.push({
      breakpoint: bp.name,
      width: bp.width,
      height: bp.height,
      ...metrics,
      passed: isPass
    });

    // Capture screenshot for key viewports
    if ([320, 390, 768, 1024, 1440].includes(bp.width)) {
      const screenshotPath = path.join(SCREENSHOTS_DIR, `landing-${bp.width}x${bp.height}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  Saved screenshot: ${screenshotPath}`);
    }
  }

  await browser.close();

  const totalPassed = results.filter(r => r.passed).length;
  console.log(`\nAudit Complete: ${totalPassed}/${results.length} breakpoints passed zero horizontal overflow.`);
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
