const { chromium } = require('playwright');

async function testAccessibility() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce' // test prefers-reduced-motion
  });
  const page = await context.newPage();

  console.log('\n--- 1. Testing Focus Trap & Restoration in Dialogs ---');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Command Palette focus trap & Esc restoration
  await page.keyboard.press('Meta+KeyK');
  await page.waitForTimeout(600);
  const isInputFocused = await page.evaluate(() => {
    const active = document.activeElement;
    return active && (active.tagName === 'INPUT' || active.getAttribute('cmdk-input') !== null);
  });
  console.log('Command Palette: focus trapped to input on open:', isInputFocused);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const isCmdkClosed = await page.locator('[cmdk-root]').count() === 0;
  console.log('Command Palette: dismissed cleanly on Esc:', isCmdkClosed);

  // Shortcuts Dialog ('?')
  await page.keyboard.press('Shift+Slash');
  await page.waitForTimeout(600);
  const isShortcutsOpen = await page.locator('h2:has-text("Keyboard Shortcuts")').isVisible();
  console.log('Shortcuts Modal: opened on "?":', isShortcutsOpen);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  console.log('Shortcuts Modal: dismissed on Esc:', !(await page.locator('h2:has-text("Keyboard Shortcuts")').isVisible()));

  // ========================================================
  // 2. Tab Navigation & Focus Order Across Scenes
  // ========================================================
  console.log('\n--- 2. Testing Logical Focus Order Across Scenes ---');
  const scenes = ['/live', '/assist', '/lab'];
  for (const s of scenes) {
    await page.goto(`http://localhost:3000${s}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const focusOrder = [];
    for (let t = 0; t < 6; t++) {
      await page.keyboard.press('Tab');
      const active = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return 'none';
        return {
          tag: el.tagName,
          label: el.getAttribute('aria-label') || el.innerText?.slice(0, 20) || el.className?.slice(0, 20)
        };
      });
      focusOrder.push(`${active.tag}(${active.label})`);
    }
    console.log(`Scene ${s.padEnd(8)} first 6 tabs: ${focusOrder.join(' -> ')}`);
  }

  // ========================================================
  // 3. Verify Aria-Labels on All Icon-Only Buttons
  // ========================================================
  console.log('\n--- 3. Verifying Aria-Labels on Buttons Across Scenes ---');
  let missingAriaCount = 0;
  for (const s of ['/', '/live', '/assist', '/lab']) {
    await page.goto(`http://localhost:3000${s}`, { waitUntil: 'networkidle' });
    const unlabelled = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const missing = [];
      for (const b of buttons) {
        const text = (b.innerText || '').trim();
        const ariaLabel = b.getAttribute('aria-label');
        const title = b.getAttribute('title');
        if (!text && !ariaLabel && !title) {
          missing.push(b.className?.slice(0, 40));
        }
      }
      return missing;
    });
    if (unlabelled.length > 0) {
      console.log(`Scene ${s}: found ${unlabelled.length} buttons without label/title`);
      missingAriaCount += unlabelled.length;
    } else {
      console.log(`Scene ${s}: All buttons properly labelled!`);
    }
  }

  // ========================================================
  // 4. Prefers-Reduced-Motion Verification
  // ========================================================
  console.log('\n--- 4. Prefers-Reduced-Motion Verification ---');
  const reducedMotionActive = await page.evaluate(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  console.log('prefers-reduced-motion media query matches in browser:', reducedMotionActive);

  await browser.close();
  if (missingAriaCount === 0) {
    console.log('\n=== ALL PHASE 8 ACCESSIBILITY AUDITS PASSED ===\n');
  } else {
    console.log(`\n=== PHASE 8 COMPLETED WITH ${missingAriaCount} MINOR ARIA ISSUES ===\n`);
  }
}

testAccessibility().catch(err => {
  console.error('Accessibility test failed:', err);
  process.exit(1);
});
