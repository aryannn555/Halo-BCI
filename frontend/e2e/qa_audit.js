const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const VIEWPORTS = [
  { width: 1024, height: 768, label: '1024' },
  { width: 1280, height: 800, label: '1280' },
  { width: 1440, height: 900, label: '1440' },
  { width: 1920, height: 1080, label: '1920' },
];

const SCENES = [
  { path: '/', name: 'overview' },
  { path: '/live', name: 'live' },
  { path: '/assist', name: 'assist_arena', tabSelector: '[data-tab="arena"], button:has-text("Arena")' },
  { path: '/assist', name: 'assist_keyboard', tabSelector: '[data-tab="keyboard"], button:has-text("Keyboard")' },
  { path: '/assist', name: 'assist_commands', tabSelector: '[data-tab="commands"], button:has-text("Commands")' },
  { path: '/lab', name: 'lab' },
];

const SCREENSHOT_DIR = path.resolve(__dirname, '../../qa/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Contrast calculation helper (relative luminance)
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrast(rgb1, rgb2) {
  const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

async function runAudit() {
  console.log('\n================================================================================');
  console.log('🎭 HALO BCI — PLAYWRIGHT BROWSER AUDIT & SCREENSHOT SUITE');
  console.log('================================================================================\n');

  const browser = await chromium.launch();
  const allIssues = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Viewport: ${vp.width}x${vp.height} (${vp.label}) ---`);

    for (const scene of SCENES) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const consoleErrors = [];
      const failedRequests = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      page.on('requestfailed', req => {
        failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
      });

      page.on('response', res => {
        if (res.status() >= 400) {
          failedRequests.push(`${res.status()} ${res.url()}`);
        }
      });

      const targetUrl = `${BASE_URL}${scene.path}`;
      await page.goto(targetUrl, { waitUntil: 'networkidle' });

      if (scene.tabSelector) {
        try {
          const tab = await page.locator(scene.tabSelector).first();
          if (await tab.isVisible()) {
            await tab.click();
            await page.waitForTimeout(400);
          }
        } catch (e) {
          // tab might be default
        }
      }

      await page.waitForTimeout(800);

      // 1. Capture screenshot
      const shotName = `${scene.name}_${vp.label}.png`;
      const shotPath = path.join(SCREENSHOT_DIR, shotName);
      await page.screenshot({ path: shotPath, fullPage: false });

      // 2. DOM Layout measurements
      const layoutReport = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        const vpWidth = window.innerWidth;
        const vpHeight = window.innerHeight;

        // Check horizontal scroll
        const scrollWidth = Math.max(body.scrollWidth, html.scrollWidth);
        const hasHorizontalScroll = scrollWidth > vpWidth + 1;

        // Check elements extending beyond viewport horizontally
        const overflowingElements = [];
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > vpWidth + 2 && rect.width > 0 && rect.height > 0) {
            const tag = el.tagName.toLowerCase();
            const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0, 2).join('.') : '';
            overflowingElements.push(`${tag}.${cls} (right: ${Math.round(rect.right)}px > ${vpWidth}px)`);
          }
        });

        // Check interactive buttons sizing (< 40px height or width)
        const smallControls = [];
        const buttons = document.querySelectorAll('button, a[role="button"], input[type="button"]');
        buttons.forEach(btn => {
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            // Visible button
            if (rect.width < 32 || rect.height < 32) { // strict minimum interactive target
              const text = btn.innerText?.trim().slice(0, 15) || btn.getAttribute('aria-label') || 'unlabeled';
              smallControls.push(`"${text}" (${Math.round(rect.width)}x${Math.round(rect.height)}px)`);
            }
          }
        });

        // Check text overflow / clipping
        const clippedText = [];
        document.querySelectorAll('p, span, h1, h2, h3, h4, div').forEach(el => {
          // If element has text node child and scrollWidth > clientWidth with overflow hidden
          if (el.children.length === 0 && el.innerText && el.innerText.trim().length > 0) {
            const style = window.getComputedStyle(el);
            if (style.overflow === 'hidden' || style.textOverflow === 'ellipsis') {
              if (el.scrollWidth > el.clientWidth + 2) {
                clippedText.push(`"${el.innerText.slice(0, 20)}..." in <${el.tagName.toLowerCase()}>`);
              }
            }
          }
        });

        return {
          hasHorizontalScroll,
          scrollWidth,
          vpWidth,
          overflowingElements: overflowingElements.slice(0, 3),
          smallControls: smallControls.slice(0, 3),
          clippedText: clippedText.slice(0, 3),
        };
      });

      const sceneKey = `${scene.name} (${vp.label})`;
      const hasErrors = consoleErrors.length > 0 || failedRequests.length > 0 || layoutReport.hasHorizontalScroll;

      console.log(`  • ${sceneKey}: ${hasErrors ? '❌ ISSUES' : '✅ CLEAN'}`);
      if (consoleErrors.length > 0) {
        console.log(`    - Console errors (${consoleErrors.length}):`, consoleErrors.slice(0, 2));
        allIssues.push({ scene: sceneKey, type: 'console_error', details: consoleErrors });
      }
      if (failedRequests.length > 0) {
        console.log(`    - Failed requests (${failedRequests.length}):`, failedRequests.slice(0, 2));
        allIssues.push({ scene: sceneKey, type: 'network_fail', details: failedRequests });
      }
      if (layoutReport.hasHorizontalScroll) {
        console.log(`    - Horizontal scroll detected: scrollWidth=${layoutReport.scrollWidth} > vpWidth=${layoutReport.vpWidth}`);
        allIssues.push({ scene: sceneKey, type: 'horizontal_scroll', details: layoutReport });
      }
      if (layoutReport.overflowingElements.length > 0) {
        console.log(`    - Elements overflowing viewport:`, layoutReport.overflowingElements);
      }
      if (layoutReport.smallControls.length > 0) {
        console.log(`    - Sub-40px interactive controls:`, layoutReport.smallControls);
      }

      await page.close();
    }
  }

  await browser.close();

  console.log('\n================================================================================');
  console.log(`Audit Summary: ${allIssues.length} issues across all scenes and viewports.`);
  console.log('Screenshots saved in qa/screenshots/');
  console.log('================================================================================\n');

  return allIssues;
}

runAudit()
  .then(issues => {
    if (issues.length > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('Audit crashed:', err);
    process.exit(2);
  });
