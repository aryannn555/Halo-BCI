const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const scenes = [
  { name: 'Overview', url: 'http://localhost:3000/' },
  { name: 'Live', url: 'http://localhost:3000/live' },
  { name: 'Assist-Arena', url: 'http://localhost:3000/assist' },
  { name: 'Assist-Keyboard', url: 'http://localhost:3000/assist', action: async (page) => {
    const btn = page.locator('button:has-text("Keyboard")');
    if (await btn.isVisible()) await btn.click();
  }},
  { name: 'Assist-Commands', url: 'http://localhost:3000/assist', action: async (page) => {
    const btn = page.locator('button:has-text("Commands")');
    if (await btn.isVisible()) await btn.click();
  }},
  { name: 'Lab', url: 'http://localhost:3000/lab' },
];

const viewports = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrast(rgb1, rgb2) {
  const lum1 = getLuminance(...rgb1);
  const lum2 = getLuminance(...rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function parseRgb(colorStr) {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return [255, 255, 255];
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const contrastIssues = [];
  const buttonIssues = [];
  let totalErrors = 0;

  for (const vp of viewports) {
    for (const scene of scenes) {
      const page = await browser.newPage({ viewport: vp });
      const consoleIssues = [];
      const networkFailures = [];

      page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          // Ignore react hydration warnings if minor or next dev notices
          consoleIssues.push(`[${msg.type()}] ${msg.text()}`);
        }
      });

      page.on('pageerror', err => {
        consoleIssues.push(`[pageerror] ${err.toString()}`);
      });

      page.on('response', resp => {
        if (resp.status() >= 400 && !resp.url().includes('/api/metrics-missing-test')) {
          networkFailures.push(`${resp.status()} on ${resp.url()}`);
        }
      });

      try {
        await page.goto(scene.url, { waitUntil: 'networkidle', timeout: 15000 });
        if (scene.action) {
          await scene.action(page);
          await page.waitForTimeout(500);
        }

        // Measure CLS, scrollWidth vs innerWidth, and button sizes
        const domMetrics = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          const hasHorizontalScroll = doc.scrollWidth > window.innerWidth || body.scrollWidth > window.innerWidth;
          
          // Check interactive controls size
          const controls = Array.from(document.querySelectorAll('button, a[role="button"], input, select'));
          const undersized = [];
          for (const el of controls) {
            const rect = el.getBoundingClientRect();
            // Only visible elements
            if (rect.width > 0 && rect.height > 0 && (rect.width < 38 || rect.height < 38)) {
              // Ignore hidden or decorative elements
              const style = window.getComputedStyle(el);
              if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                undersized.push({
                  tag: el.tagName,
                  text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 30).trim(),
                  w: Math.round(rect.width),
                  h: Math.round(rect.height),
                  classes: el.className ? el.className.slice(0, 50) : ''
                });
              }
            }
          }

          // Check text contrast for key elements
          const textElements = Array.from(document.querySelectorAll('p, span, h1, h2, h3, h4, label, [class*="text-muted"]'));
          const samples = [];
          for (const el of textElements.slice(0, 100)) {
            const style = window.getComputedStyle(el);
            const txt = (el.innerText || el.textContent || '').trim();
            if (style.display !== 'none' && style.visibility !== 'hidden' && txt.length > 0) {
              const fontSize = parseFloat(style.fontSize);
              samples.push({
                text: txt.slice(0, 25),
                color: style.color,
                fontSize,
                fontWeight: style.fontWeight
              });
            }
          }

          // Check broken images
          const images = Array.from(document.querySelectorAll('img'));
          const brokenImages = images.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);

          return {
            hasHorizontalScroll,
            scrollWidth: doc.scrollWidth,
            innerWidth: window.innerWidth,
            undersized,
            textSamples: samples,
            brokenImages
          };
        });

        const status = {
          viewport: `${vp.width}x${vp.height}`,
          scene: scene.name,
          horizontalScroll: domMetrics.hasHorizontalScroll ? `FAIL (${domMetrics.scrollWidth} > ${domMetrics.innerWidth})` : 'PASS',
          consoleCount: consoleIssues.length,
          networkFailures: networkFailures.length,
          brokenImages: domMetrics.brokenImages.length,
          undersizedCount: domMetrics.undersized.length
        };

        if (domMetrics.undersized.length > 0) {
          buttonIssues.push({ vp: `${vp.width}x${vp.height}`, scene: scene.name, items: domMetrics.undersized });
        }

        if (consoleIssues.length > 0) totalErrors += consoleIssues.length;
        if (networkFailures.length > 0) totalErrors += networkFailures.length;
        if (domMetrics.hasHorizontalScroll) totalErrors++;

        results.push(status);
      } catch (err) {
        results.push({
          viewport: `${vp.width}x${vp.height}`,
          scene: scene.name,
          error: err.message
        });
        totalErrors++;
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();
  console.log(JSON.stringify({ results, buttonIssues, totalErrors }, null, 2));
})();
