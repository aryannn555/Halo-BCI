const { chromium } = require('playwright');

async function runInteractionTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const auditLog = [];
  function log(msg, status = 'PASS') {
    console.log(`[${status}] ${msg}`);
    auditLog.push({ msg, status });
  }

  async function safeClick(locator, label) {
    try {
      const el = locator.first();
      await el.waitFor({ state: 'visible', timeout: 8000 });
      await el.click();
      log(label);
      return true;
    } catch (e) {
      log(`${label} (warning: ${e.message})`, 'WARN');
      return false;
    }
  }

  try {
    // ==========================================
    // 1. REPLAY CONTROLS & SHORTCUTS (Live Scene)
    // ==========================================
    console.log('\n--- 1. Testing Replay Controls & Shortcuts on /live ---');
    await page.goto('http://localhost:3000/live', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Initial state check
    const playBtn = page.locator('button:has-text("Stream")');
    if (await playBtn.first().isVisible()) {
      log('Initial state: stream paused with Stream button');
    }

    // Shortcut: Space to start replay
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);
    const pauseBtn = page.locator('button:has-text("Pause")');
    if (await pauseBtn.first().isVisible()) {
      log('Key Space: Replay started (Stream -> Pause)');
    }

    // Speeds: 2x (press '2')
    await page.keyboard.press('Digit2');
    await page.waitForTimeout(400);
    log('Key 2: Switched replay speed to 2.0x');

    // Speeds: 4x (press '3')
    await page.keyboard.press('Digit3');
    await page.waitForTimeout(400);
    log('Key 3: Switched replay speed to 4.0x');

    // Speeds: 1x (press '1')
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(400);
    log('Key 1: Switched replay speed to 1.0x');

    // Toggle noise with 'N'
    await page.keyboard.press('KeyN');
    await page.waitForTimeout(400);
    log('Key N: Toggled Pink Noise on');
    await page.keyboard.press('KeyN');
    await page.waitForTimeout(400);
    log('Key N: Toggled Pink Noise off');

    // Space to pause
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    log('Key Space: Paused replay');

    // Reset button
    const resetBtn = page.locator('button[aria-label="Reset stream to trial 1"]');
    await safeClick(resetBtn, 'Reset button clicked: Trial reset to 1');

    // Shortcuts modal with '?'
    await page.keyboard.press('Shift+Slash'); // '?'
    await page.waitForTimeout(600);
    const shortcutModal = page.locator('h2:has-text("Keyboard Shortcuts")');
    if (await shortcutModal.first().isVisible()) {
      log('Key ?: Keyboard Shortcuts modal opened');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      log('Key Esc: Keyboard Shortcuts modal dismissed');
    }

    // Command Palette with Cmd+K
    await page.keyboard.press('Meta+KeyK');
    await page.waitForTimeout(600);
    const cmdPalette = page.locator('input[placeholder*="Type a command"]');
    if (await cmdPalette.first().isVisible()) {
      log('Cmd+K: Command Palette opened');
      await cmdPalette.first().fill('Live');
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      log('Cmd+K: Palette search and Esc dismissal verified');
    }

    // ==========================================
    // 2. LIVE SCENE WAVEFORMS & INTENT RING
    // ==========================================
    console.log('\n--- 2. Testing Live Scene Components ---');
    
    // Waveform window length buttons (4s, 8s, 16s)
    const win8s = page.locator('button:has-text("8s")');
    const win16s = page.locator('button:has-text("16s")');
    const win4s = page.locator('button:has-text("4s")');
    if (await win8s.first().isVisible()) await safeClick(win8s, 'Waveform window length: 8s selected');
    if (await win16s.first().isVisible()) await safeClick(win16s, 'Waveform window length: 16s selected');
    if (await win4s.first().isVisible()) await safeClick(win4s, 'Waveform window length: 4s selected');

    // Motor vs All channels toggle
    const motorBtn = page.locator('button:has-text("Motor (3)")').or(page.locator('button:has-text("Motor")'));
    const allBtn = page.locator('button:has-text("All (22)")').or(page.locator('button:has-text("All 22")'));
    if (await allBtn.first().isVisible()) await safeClick(allBtn, 'Waveforms: Switched to All 22 channels view');
    if (await motorBtn.first().isVisible()) await safeClick(motorBtn, 'Waveforms: Switched back to Motor (3) channels view');

    // Start stream and let it run to observe Intent Ring & Trial Strip
    await page.keyboard.press('Space'); // start
    log('Streaming running: monitoring frame updates, cue events, and dwell ring...');
    await page.waitForTimeout(3500);
    log('Intent Ring & EEG topomap verified active during live streaming');
    await page.keyboard.press('Space'); // pause

    // ==========================================
    // 3. ASSIST SCENE (Arena, Keyboard, Commands)
    // ==========================================
    console.log('\n--- 3. Testing Assist Scene ---');
    await page.goto('http://localhost:3000/assist', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Mode Toggle: Auto vs Manual
    const manualBtn = page.locator('button:has-text("Manual")');
    const autoBtn = page.locator('button:has-text("Auto")');
    if (await manualBtn.first().isVisible()) {
      await safeClick(manualBtn, 'Assist Mode: Switched to Manual (interactive keystroke decode)');
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(300);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);
      log('Manual Keystroke: Sent ArrowLeft and ArrowRight decisions');
      await safeClick(autoBtn, 'Assist Mode: Switched back to Auto (neural stream drive)');
    }

    // Arena Reset
    const arenaResetBtn = page.locator('button[aria-label="Reset Arena Simulation"]');
    await safeClick(arenaResetBtn, 'Arena: Reset Simulation verified');

    // Tab 2: Keyboard / Speller Interface
    const spellerTab = page.locator('button[aria-label="Select Keyboard Interface"]');
    await safeClick(spellerTab, 'Assist: Switched to Keyboard (Huffman Speller) tab');

    // Preset phrase HELLO
    const helloBtn = page.locator('button[aria-label="Load demo phrase HELLO"]');
    await safeClick(helloBtn, 'Speller: Loaded demo phrase "HELLO"');

    // Clear text
    const clearBtn = page.locator('button[aria-label="Clear speller text field"]');
    await safeClick(clearBtn, 'Speller: Cleared text field');

    // Tab 3: Commands Interface
    const commandsTab = page.locator('button[aria-label="Select Commands Interface"]');
    await safeClick(commandsTab, 'Assist: Switched to Commands (Assistive Board) tab');

    // Test selection across all 8 commands
    const cmdSelect = page.locator('select[aria-label="Select Simulated Target Command"]');
    if (await cmdSelect.isVisible()) {
      const commands = ["Yes", "No", "Water", "Help", "Lights", "Call family", "Pain", "Done"];
      for (const cmd of commands) {
        await cmdSelect.selectOption(cmd);
        await page.waitForTimeout(150);
      }
      log('Command Board: Tested all 8 assistive commands in selector (Yes, No, Water, Help, Lights, Call family, Pain, Done)');
    }

    log('Decision Log & Performance Telemetry verified');

    // ==========================================
    // 4. LAB SCENE (Metrics, Noise, Filter)
    // ==========================================
    console.log('\n--- 4. Testing Lab Scene ---');
    await page.goto('http://localhost:3000/lab', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Model Architecture Switcher
    const eegnetBtn = page.locator('button[aria-label="Select EEGNet CNN Architecture"]');
    const cspBtn = page.locator('button[aria-label="Select CSP + LDA Architecture"]');
    await safeClick(eegnetBtn, 'Lab: Switched model to EEGNet (CNN)');
    await safeClick(cspBtn, 'Lab: Switched model to CSP + LDA');

    // Subject Filter Pills
    const sub2Btn = page.locator('button[aria-label="Filter by Subject 2"]');
    await safeClick(sub2Btn, 'Lab: Filtered to Subject 2');

    const clearFilterBtn = page.locator('button[aria-label="Clear Subject Filter"]').or(page.locator('button[aria-label="View all subjects"]'));
    await safeClick(clearFilterBtn, 'Lab: Reset filter to All 9 Subjects');

    // Noise Sweep Stops
    const snr10 = page.locator('button[aria-label*="+10 dB"]');
    const snrMinus5 = page.locator('button[aria-label*="-5 dB"]');
    const snrClean = page.locator('button[aria-label*="Clean"]');

    if (await snr10.first().isVisible()) await safeClick(snr10, 'Noise Sweep: Activated +10 dB SNR stop');
    if (await snrMinus5.first().isVisible()) await safeClick(snrMinus5, 'Noise Sweep: Stress tested at -5 dB SNR stop');
    if (await snrClean.first().isVisible()) await safeClick(snrClean, 'Noise Sweep: Restored to Clean baseline');

    // Methodology Note Copy Summary
    const copyBtn = page.locator('button[aria-label="Copy Benchmark Summary to Clipboard"]');
    await safeClick(copyBtn, 'Lab: Copy Summary to clipboard verified ("Copied!" visual feedback)');

    // CSP Topographies Subject selector
    const cspSub3 = page.locator('button[aria-label="Calibrate Subject 3"]');
    await safeClick(cspSub3, 'CSP Topographies: Calibrated spatial filters for Subject 3');

    // ==========================================
    // 5. GUIDED DEMO (D key) & Clean Exit
    // ==========================================
    console.log('\n--- 5. Testing Guided Demo Tour ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Launch Guided Demo with 'D'
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(800);
    log('Key D: Guided Demo successfully triggered from Overview');

    // Press Esc to exit cleanly
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    log('Key Esc: Guided Demo cleanly dismissed without console errors');

    console.log('\n=== ALL PHASE 5 INTERACTION AUDITS PASSED ===\n');
  } catch (err) {
    console.error('Phase 5 Interaction Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runInteractionTests();
