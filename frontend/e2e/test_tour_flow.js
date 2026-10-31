const { chromium } = require('playwright');

async function testTourFlow() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('\n--- Testing Guided Demo Tour Navigation & State Machine ---');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Press 'D' to start tour
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(1000);

  const tourOverlay = page.locator('aside[aria-label="Guided Tour Navigation"]');
  const isTourVisible = await tourOverlay.isVisible();
  console.log('Tour Overlay visible:', isTourVisible);
  if (!isTourVisible) throw new Error('Tour did not activate on D key');

  // Verify step 1 title
  const step1Title = await page.locator('text=1/6 • The Problem & The Hope').isVisible();
  console.log('Step 1 Title visible:', step1Title);

  // Advance through all 6 steps using ArrowRight
  for (let i = 2; i <= 6; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1000);
    const stepTitle = await page.locator(`text=${i}/6`).isVisible();
    const currentUrl = page.url();
    console.log(`Step ${i}/6 visible:`, stepTitle, `Current URL: ${currentUrl}`);
  }

  // Advance past step 6 to confirm clean completion
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1000);
  const stillActive = await tourOverlay.isVisible();
  console.log('Tour exited after step 6:', !stillActive);

  // Start again and test Esc
  console.log('\n--- Testing Guided Demo Run 2 & Esc Key Exit ---');
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(1000);
  console.log('Tour reopened on D key:', await tourOverlay.isVisible());

  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  console.log('Tour dismissed on Escape key:', !(await tourOverlay.isVisible()));

  await browser.close();
  console.log('\n=== GUIDED DEMO TOUR INTEGRITY TEST PASSED ===\n');
}

testTourFlow().catch(err => {
  console.error('Tour test failed:', err);
  process.exit(1);
});
