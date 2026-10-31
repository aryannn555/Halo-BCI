const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Halo BCI — Complete Masterclass & Pitch Guide</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm 18mm 14mm;
      @bottom-right {
        content: counter(page) " / " counter(pages);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 8pt;
        color: #64748b;
      }
    }
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.55;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* Cover / Header Banner */
    .hero-banner {
      background: linear-gradient(135deg, #07090e 0%, #0f172a 100%);
      color: #ffffff;
      padding: 24px 28px;
      border-radius: 12px;
      margin-bottom: 22px;
      border: 1px solid #1e293b;
    }

    .hero-badge {
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 3px 8px;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 20px;
      margin-bottom: 10px;
    }

    .hero-title {
      font-size: 22pt;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.15;
      margin: 0 0 6px 0;
      color: #f8fafc;
    }

    .hero-subtitle {
      font-size: 10pt;
      color: #94a3b8;
      margin: 0;
      max-width: 90%;
    }

    .meta-strip {
      display: flex;
      gap: 18px;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 8pt;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #cbd5e1;
    }

    .meta-item strong {
      color: #38bdf8;
    }

    /* Headings */
    h2 {
      font-size: 13pt;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 5px;
      margin-top: 24px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      page-break-after: avoid;
    }

    .h2-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      background: #0284c7;
      color: #ffffff;
      border-radius: 6px;
      font-size: 8pt;
      font-weight: 700;
    }

    h3 {
      font-size: 10.5pt;
      font-weight: 700;
      color: #1e293b;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    p {
      margin: 0 0 9px 0;
    }

    /* Cards & Callouts */
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .card-highlight {
      background: #f0fdf4;
      border-color: #bbf7d0;
      border-left: 4px solid #16a34a;
    }

    .card-accent {
      background: #f0f9ff;
      border-color: #bae6fd;
      border-left: 4px solid #0284c7;
    }

    .card-warning {
      background: #fffbeb;
      border-color: #fde68a;
      border-left: 4px solid #d97706;
    }

    /* Key formula block */
    .formula-box {
      background: #0f172a;
      color: #f8fafc;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 9pt;
      margin: 8px 0;
      border: 1px solid #334155;
      page-break-inside: avoid;
    }

    .formula-box .comment {
      color: #94a3b8;
      font-size: 8pt;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin: 10px 0 14px 0;
      page-break-inside: avoid;
    }

    th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 7px 10px;
      font-weight: 600;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    td {
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    .tag-green {
      display: inline-block;
      padding: 2px 6px;
      background: #dcfce7;
      color: #15803d;
      border-radius: 4px;
      font-weight: 700;
      font-size: 7.5pt;
      font-family: monospace;
    }

    .tag-blue {
      display: inline-block;
      padding: 2px 6px;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 4px;
      font-weight: 700;
      font-size: 7.5pt;
      font-family: monospace;
    }

    /* Grid layout */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    /* Diagrams (SVG / ASCII representation) */
    .diagram-container {
      background: #07090e;
      color: #38bdf8;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 14px 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8pt;
      line-height: 1.45;
      margin: 10px 0 14px 0;
      white-space: pre;
      overflow-x: auto;
      page-break-inside: avoid;
    }

    .page-break {
      page-break-before: always;
    }

    ul, ol {
      margin: 0 0 10px 0;
      padding-left: 20px;
    }

    li {
      margin-bottom: 4px;
    }

    .qa-box {
      margin-bottom: 12px;
      border-left: 3px solid #0284c7;
      padding-left: 10px;
      page-break-inside: avoid;
    }

    .qa-box h4 {
      margin: 0 0 3px 0;
      font-size: 9.5pt;
      color: #0369a1;
    }

    .qa-box p {
      margin: 0;
      font-size: 9pt;
      color: #334155;
    }
  </style>
</head>
<body>

  <!-- HERO HEADER -->
  <div class="hero-banner">
    <div class="hero-badge">AI Manthan 2.0 • Complete Technical Dossier</div>
    <h1 class="hero-title">Halo BCI: The Complete Masterclass</h1>
    <p class="hero-subtitle">Comprehensive guide to the neuroscience, algorithmic decoding, system architecture, clinical benchmarks, and live pitch mastery.</p>
    <div class="meta-strip">
      <div class="meta-item">Accuracy: <strong>90.2% Held-Out</strong></div>
      <div class="meta-item">Latency: <strong>0.41 ms Inference</strong></div>
      <div class="meta-item">Data: <strong>BCI IV-2a (22 Ch @ 250 Hz)</strong></div>
      <div class="meta-item">Split: <strong>Strict Cross-Session</strong></div>
    </div>
  </div>

  <!-- SECTION 1 -->
  <h2><span class="h2-num">1</span> The Big Picture: Why Halo Exists</h2>
  
  <div class="card card-accent">
    <h3 style="margin-top:0;">The Clinical Need: Locked-In Syndrome & Severe Motor Paralysis</h3>
    <p>Patients suffering from <strong>Amyotrophic Lateral Sclerosis (ALS)</strong>, severe brainstem stroke, cervical spinal cord injury, or <strong>Locked-In Syndrome</strong> experience catastrophic loss of voluntary muscular control. Their vocal cords, hands, and facial musculature become completely paralyzed.</p>
    <p style="margin-bottom:0;">Crucially, <strong>their cognitive cortex and sensorimotor networks remain fully functional</strong>. When a locked-in individual imagines clenching their hand, their motor cortex fires the exact microvolt electrical rhythms as a healthy person—there are simply no functioning peripheral motor neurons to carry the signal across the neuromuscular junction.</p>
  </div>

  <h3>Halo's Mission & Tri-Tiered Assistive Agency</h3>
  <p>Halo is a <strong>non-invasive Assistive Brain-Computer Interface (BCI)</strong> that taps into scalp surface electrical potentials via high-density electroencephalography (EEG) and converts pure motor imagery intent into deterministic digital actuation:</p>
  <ul>
    <li><strong>Physical Navigation (Assistive Arena)</strong>: Translates directional motor intent into 2D rover and powered wheelchair steering.</li>
    <li><strong>Expressive Communication (Predictive Huffman Keyboard)</strong>: Information-theoretic typing engine using Huffman coding to compress candidate words into minimal neural decisions.</li>
    <li><strong>Critical Agency (Assistive Command Board)</strong>: Instant emergency and lifestyle requests (e.g., <em>"Water"</em>, <em>"Help"</em>, <em>"Call Family"</em>) triggered in exactly 3 binary neural choices (log₂ 8 = 3).</li>
  </ul>

  <!-- SECTION 2 -->
  <h2><span class="h2-num">2</span> The Neuroscience: What Happens in the Brain?</h2>

  <div class="diagram-container">
               ANTERIOR (Front of Head - Forehead)
                              ▲
                              │
       [LEFT HEMISPHERE]             [RIGHT HEMISPHERE]
       Electrode C3 (Motor Strip)     Electrode C4 (Motor Strip)
       Controls: RIGHT HAND           Controls: LEFT HAND
                              │
                              ▼
               POSTERIOR (Back of Head - Occiput)
  </div>

  <div class="grid-2">
    <div class="card">
      <h3 style="margin-top:0;">Contralateral Motor Cortex Control</h3>
      <p>The primary motor cortex (M₁) runs along the precentral gyrus. Somatotopic neural mapping is strictly <strong>contralateral</strong>:</p>
      <ul>
        <li>Imagining moving the <strong>Right Hand</strong> activates the <strong>Left Motor Cortex</strong> (measured by electrode <strong>C3</strong>).</li>
        <li>Imagining moving the <strong>Left Hand</strong> activates the <strong>Right Motor Cortex</strong> (measured by electrode <strong>C4</strong>).</li>
      </ul>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Sensorimotor Rhythms: Mu & Beta</h3>
      <p>Two primary oscillatory frequency bands dominate the motor strip:</p>
      <ul>
        <li><strong>Mu (&mu;) Rhythm (8–12 Hz)</strong>: Idling rhythm of sensorimotor neurons when at rest.</li>
        <li><strong>Beta (&beta;) Rhythm (16–24 Hz)</strong>: Modulated during active motor planning and post-movement synchronization.</li>
      </ul>
    </div>
  </div>

  <div class="card card-highlight">
    <h3 style="margin-top:0; color:#15803d;">The Fundamental Detection Signature: ERD vs. ERS</h3>
    <p>When millions of resting neurons oscillate together, their voltages summate, creating a high-amplitude wave. When you imagine movement, the neurons desynchronize to perform active computation:</p>
    <ul>
      <li><strong>ERD (Event-Related Desynchronization)</strong>: In the active hemisphere, wave amplitude drops drastically (&darr; power decreases).</li>
      <li><strong>ERS (Event-Related Synchronization)</strong>: In the resting hemisphere, wave amplitude remains high (&uarr; power stays high).</li>
    </ul>
    <div class="formula-box">
• IMAGINING LEFT HAND:   C4 Power Drops (ERD)  |  C3 Power Stays High (ERS)<br>
• IMAGINING RIGHT HAND:  C3 Power Drops (ERD)  |  C4 Power Stays High (ERS)
    </div>
  </div>

  <!-- SECTION 3 -->
  <h2><span class="h2-num">3</span> The Benchmark Dataset: BCI Competition IV-2a</h2>
  
  <p>Halo is benchmarked against the gold-standard clinical corpus in biomedical signal processing: <strong>BCI Competition IV Dataset 2a</strong> (BNCI2014_001):</p>
  
  <table>
    <thead>
      <tr>
        <th>Specification</th>
        <th>Value</th>
        <th>Scientific Significance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Participants</strong></td>
        <td>9 Human Subjects (S1–S9)</td>
        <td>Captures broad physiological diversity and subject-specific anatomical differences.</td>
      </tr>
      <tr>
        <td><strong>Electrode Array</strong></td>
        <td>22 Ag/AgCl Electrodes</td>
        <td>Standard international 10–20 placement covering frontal, motor, and parietal scalp regions.</td>
      </tr>
      <tr>
        <td><strong>Sampling Frequency</strong></td>
        <td>250 Hz (4 ms per sample)</td>
        <td>Sufficient to cleanly satisfy the Nyquist criterion for motor rhythms up to 125 Hz.</td>
      </tr>
      <tr>
        <td><strong>Validation Protocol</strong></td>
        <td><strong>Strict Cross-Session Split</strong></td>
        <td><strong>Session 1 (144 trials) = Train</strong> vs. <strong>Session 2 (144 trials) = Held-Out Test</strong> recorded on different days.</td>
      </tr>
    </tbody>
  </table>

  <div class="card card-warning">
    <strong>Why Cross-Session Held-Out Validation Matters to Judges:</strong>
    <p style="margin-bottom:0; margin-top:4px;">Many novice hackathon projects report 95%+ accuracy by randomly shuffling single-session trials. This causes severe temporal data leakage because adjacent EEG seconds share common impedance and noise. Scalp impedance, electrode gel drying, and mental fatigue change dramatically across days. <strong>Halo enforces a zero-leakage cross-session split</strong>, proving genuine real-world generalization.</p>
  </div>

  <div class="page-break"></div>

  <!-- SECTION 4 -->
  <h2><span class="h2-num">4</span> Machine Learning Architecture & Algorithmic Decoding</h2>

  <div class="diagram-container">
  Raw 22-Channel EEG (250 Hz) ──▶ [ 4th-Order Butterworth Bandpass (8–30 Hz) ]
                                                        │
                      ┌─────────────────────────────────┴─────────────────────────────────┐
                      ▼                                                                   ▼
       [ Classical Pipeline (Default) ]                                    [ Deep Learning Pipeline ]
         Common Spatial Patterns (CSP)                                      EEGNet (Compact CNN)
         6 Optimal Spatial Filters (Eigenvalue Decomp)                      Temporal Conv + Depthwise Conv
                      │                                                                   │
         Linear Discriminant Analysis (LDA)                                 Softmax Output
                      │                                                                   │
                      └───────────────────────────────┬───────────────────────────────────┘
                                                      ▼
                                       Predicted Motor Intent (P_left, P_right)
  </div>

  <div class="grid-2">
    <div class="card">
      <h3 style="margin-top:0;">Model A: CSP + LDA (Default Gold-Standard)</h3>
      <p><strong>Accuracy: 90.2% | Latency: 0.41 ms</strong></p>
      <p>Raw scalp EEG suffers from volume conduction (smearing through bone and skin). <strong>Common Spatial Patterns (CSP)</strong> computes linear combinations of all 22 electrodes ($W$) that maximize variance for Class 1 while simultaneously minimizing variance for Class 2:</p>
      <div class="formula-box">
Maximize: Var(Class 1) / Var(Class 2)<br>
Generalized Eigenvalue Problem:<br>
  Σ₁ W = λ Σ₂ W
      </div>
      <p>We extract 6 spatial filters (3 for left, 3 for right), calculate their log-normalized energy, and classify via <strong>Linear Discriminant Analysis (LDA)</strong>.</p>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">Model B: EEGNet (Convolutional Neural Net)</h3>
      <p><strong>Accuracy: 74.5% | Latency: 4.79 ms</strong></p>
      <p>Specialized compact architecture designed specifically for BCI by Lawhern et al. (2018):</p>
      <ul>
        <li><strong>Temporal Conv (1×64)</strong>: Learns digital frequency filters.</li>
        <li><strong>Depthwise Spatial Conv</strong>: Learns spatial filters across all 22 channels tied to temporal features.</li>
        <li><strong>Separable Conv</strong>: Decouples spatial reduction, keeping total parameter count under 2,500 to resist overfitting.</li>
      </ul>
    </div>
  </div>

  <div class="card card-highlight">
    <h3 style="margin-top:0; color:#15803d;">Crucial Judge Defense: Why does CSP+LDA outperform Deep Learning here?</h3>
    <p>Judges will ask: <em>"Why did you use classical CSP+LDA instead of a giant Transformer or Deep CNN?"</em></p>
    <p style="margin-bottom:0;"><strong>Your Winning Answer:</strong> <em>"Motor imagery clinical datasets have high inter-subject variability and small training sample sizes (144 trials per subject). Deep neural networks easily overfit to session-specific noise. CSP solves a closed-form generalized eigenvalue decomposition that directly models the physical dipole orientation of the sensorimotor cortex. It requires zero hyperparameter tuning, trains in 2 seconds, runs in 0.41 ms, and outperforms EEGNet by over 15 percentage points across held-out sessions (90.2% vs 74.5%). For assistive medical tech, deterministic reliability beats black-box complexity."</em></p>
  </div>

  <!-- SECTION 5 -->
  <h2><span class="h2-num">5</span> Real-Time Systems Architecture & Streaming Pipeline</h2>

  <div class="card">
    <h3 style="margin-top:0;">100 ms Streaming Cadence & Sliding Ring Buffer</h3>
    <ul>
      <li><strong>Input Cadence</strong>: Raw data is sampled at 250 Hz (1 sample every 4 ms).</li>
      <li><strong>WebSocket Packets</strong>: Packets of 25 samples are emitted every 100 ms (10 frames per second).</li>
      <li><strong>Sliding Buffer</strong>: The backend maintains a strict circular ring buffer of <strong>500 samples (2.0 seconds)</strong>.</li>
      <li><strong>Inference Execution</strong>: Every 100 ms, the 500-sample window is filtered through a 4th-order Butterworth bandpass (8–30 Hz) and evaluated through the decoder in <strong>0.41 milliseconds</strong>.</li>
    </ul>
  </div>

  <!-- SECTION 6 -->
  <h2><span class="h2-num">6</span> Frontend Architecture & Solving the "Midas Touch"</h2>

  <div class="card card-warning">
    <h3 style="margin-top:0; color:#b45309;">The "Midas Touch" Problem</h3>
    <p>In assistive BCI, if an action fires the instant a single probability reading spikes, false activations happen constantly whenever the patient blinks, swallows, or changes thought. This leads to profound user exhaustion.</p>
  </div>

  <div class="grid-2">
    <div class="card">
      <h3 style="margin-top:0;">Stage 1: Exponential Moving Average (EMA)</h3>
      <p>Single-frame probability jitters are smoothed continuously:</p>
      <div class="formula-box">
P_bar(t) = α · P(t) + (1 - α) · P_bar(t-1)<br>
where α = 0.3
      </div>
      <p>Spikes are suppressed unless sustained across consecutive 100 ms packets.</p>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">Stage 2: Dwell-Time Intent Ring</h3>
      <p>A circular HUD visually charges only when smoothed probability exceeds $P > 0.65$:</p>
      <ul>
        <li>Requires <strong>800 ms of sustained dwell time</strong>.</li>
        <li>Once full, it pulses and commits a discrete confirmation.</li>
        <li>If intent lapses, the ring discharges gracefully without misfiring.</li>
      </ul>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- SECTION 7 -->
  <h2><span class="h2-num">7</span> The Three Assistive Applications</h2>

  <div class="grid-2">
    <div class="card card-accent">
      <h3 style="margin-top:0;">1. Assistive Arena (Mobility)</h3>
      <p>Translates continuous directional intent into 2D rover steering:</p>
      <ul>
        <li>Left motor imagery steers left; right motor imagery steers right.</li>
        <li>Includes target pursuit simulation and obstacle collision boundaries.</li>
        <li>Features a manual keyboard mode for clinical therapist calibration.</li>
      </ul>
    </div>

    <div class="card card-highlight">
      <h3 style="margin-top:0;">2. Assistive Command Board (Agency)</h3>
      <p>Provides 8 critical daily and emergency life commands:</p>
      <ul>
        <li>Commands: <em>Yes, No, Water, Help, Lights, Call Family, Pain, Done</em>.</li>
        <li>Organized into a 3-level balanced binary tree (log₂ 8 = 3).</li>
        <li>A patient can summon help or water in exactly <strong>3 confirmed neural decisions</strong>.</li>
      </ul>
    </div>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">3. Predictive Huffman Keyboard (Communication)</h3>
    <p>Standard P300 matrix spellers require 15–30 seconds per letter. Halo uses an <strong>information-theoretic Huffman Coding Tree</strong>:</p>
    <ul>
      <li>Frequent English characters (E, T, A, O, I, N) are placed at tree depths 2–3; rare letters (Q, Z, X) are placed deeper.</li>
      <li>Each neural decision cuts the candidate alphabet in half (LEFT vs. RIGHT).</li>
      <li>Achieves an average of only <strong>4.2 neural decisions per character</strong>.</li>
      <li>Paired with prefix language modeling that provides instant single-decision word completions.</li>
    </ul>
  </div>

  <!-- SECTION 8 -->
  <h2><span class="h2-num">8</span> Quantitative Metrics & Noise Robustness Verification</h2>

  <div class="grid-2">
    <div class="card">
      <h3 style="margin-top:0;">Information Transfer Rate (ITR)</h3>
      <p>Measured using the standard clinical Wolpaw equation:</p>
      <div class="formula-box">
ITR = V · [ log₂N + P log₂P + (1-P) log₂((1-P)/(N-1)) ]
      </div>
      <p>For N = 2 classes, P = 0.902 accuracy, Halo delivers <strong>10.45 bits/minute</strong> of reliable communication bandwidth.</p>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">Noise Stress Testing (Live Signal Degradation)</h3>
      <p>Real hospital environments have heavy electromagnetic noise. Halo injects calibrated pink noise and 50 Hz powerline hum:</p>
      <ul>
        <li><strong>+20 dB SNR</strong>: Clean laboratory baseline.</li>
        <li><strong>0 dB to -5 dB SNR</strong>: Extreme stress (noise power 3.16× signal).</li>
        <li><strong>Second-Order Section (SOS) Filtering</strong> attenuates 50 Hz hum by <strong>>48 dB</strong>, maintaining stable classification.</li>
      </ul>
    </div>
  </div>

  <!-- SECTION 9 -->
  <h2><span class="h2-num">9</span> Hackathon Pitch Script & Tough Judge Q&A</h2>

  <div class="card card-highlight">
    <h3 style="margin-top:0; color:#15803d;">The 60-Second Elevator Pitch</h3>
    <p><em>"Judges, imagine waking up fully conscious, but completely unable to move a single muscle or speak a single word. This is the daily reality for hundreds of thousands of people living with ALS and locked-in syndrome.</em></p>
    <p><em>Meet <strong>Halo</strong>: a non-invasive Brain-Computer Interface that translates motor imagery EEG rhythms into digital autonomy in real time.</em></p>
    <p><em>When a patient imagines squeezing their left or right hand, their motor cortex desynchronizes its Mu rhythms. Halo captures these microvolt oscillations across 22 channels, filters them through Common Spatial Patterns, and decodes user intent in <strong>0.41 milliseconds</strong> with <strong>90.2% accuracy</strong> on strict held-out cross-session benchmarks.</em></p>
    <p style="margin-bottom:0;"><em>Rather than stopping at raw data, Halo delivers three clinical-grade assistive interfaces: an assistive wheelchair steering arena, an emergency command board reachable in just 3 neural decisions, and an information-theoretic Huffman speller. Halo restores agency, voice, and independence."</em></p>
  </div>

  <div class="qa-box">
    <h4>Q1: "Why non-invasive EEG instead of implants like Neuralink?"</h4>
    <p><em>"Invasive arrays require open craniotomy neurosurgery, carry risks of cortical scarring and chronic infection, and cost hundreds of thousands of dollars. Non-invasive EEG is 100% safe, portable, and accessible today. Our goal was to push the mathematical limits of signal processing to see how close we could get to implant-level agency without touching a scalpel."</em></p>
  </div>

  <div class="qa-box">
    <h4>Q2: "Isn't 90% accuracy too good for EEG? Did you have data leakage?"</h4>
    <p><em>"We were paranoid about data leakage. Many published papers cheat by randomly shuffling trials within the same recording day. Halo enforces a <strong>strict cross-session split</strong>: models train exclusively on Day 1 and test on Day 2 recorded weeks later. Furthermore, we verified this with a label-shuffle test where randomized labels dropped accuracy to exactly 47.92% (50% chance baseline). 90.2% is genuine held-out accuracy."</em></p>
  </div>

  <div class="qa-box">
    <h4>Q3: "How do you handle user fatigue during extended use?"</h4>
    <p><em>"Halo uses adaptive Exponential Moving Average (EMA) smoothing and an 800 ms dwell-time Intent Ring to eliminate accidental triggers. Additionally, the speller utilizes Huffman tree compression and language modeling to reduce cognitive load—requiring only 4.2 decisions per character instead of scanning through 26 keys."</em></p>
  </div>

  <!-- SECTION 10 -->
  <h2><span class="h2-num">10</span> Key Numbers Cheat-Sheet for Pitching</h2>

  <table>
    <thead>
      <tr>
        <th>Metric</th>
        <th>Value</th>
        <th>Clinical & Engineering Meaning</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Held-Out Accuracy</strong></td>
        <td><span class="tag-green">90.2%</span></td>
        <td>Mean test-set accuracy on Session 2 across all 9 subjects.</td>
      </tr>
      <tr>
        <td><strong>Inference Latency</strong></td>
        <td><span class="tag-blue">0.41 ms</span></td>
        <td>Time to compute CSP spatial filtering + LDA classification.</td>
      </tr>
      <tr>
        <td><strong>End-to-End Latency</strong></td>
        <td><span class="tag-blue">1.42 ms</span></td>
        <td>Time from WebSocket frame arrival to Intent Ring visual update.</td>
      </tr>
      <tr>
        <td><strong>Information Transfer Rate</strong></td>
        <td><strong>10.45 bits/min</strong></td>
        <td>Standard Wolpaw ITR measuring pure communication bandwidth.</td>
      </tr>
      <tr>
        <td><strong>Sampling Rate</strong></td>
        <td><strong>250 Hz</strong></td>
        <td>250 voltage readings per second per channel (4 ms period).</td>
      </tr>
      <tr>
        <td><strong>Electrode Array</strong></td>
        <td><strong>22 Channels</strong></td>
        <td>International 10–20 standard cap with C3, Cz, C4 motor focus.</td>
      </tr>
      <tr>
        <td><strong>Dwell Time Threshold</strong></td>
        <td><strong>800 ms</strong></td>
        <td>Sustained intention window to completely prevent false activations.</td>
      </tr>
      <tr>
        <td><strong>Bandpass Filter</strong></td>
        <td><strong>8–30 Hz</strong></td>
        <td>4th-order Butterworth isolating Mu (8–12 Hz) & Beta (16–24 Hz).</td>
      </tr>
      <tr>
        <td><strong>Powerline Rejection</strong></td>
        <td><strong>> 48 dB</strong></td>
        <td>Attenuation of 50 Hz mains hum via Second-Order Sections (SOS).</td>
      </tr>
    </tbody>
  </table>

</body>
</html>
`;

async function generatePdf() {
  const outputPath = path.resolve(__dirname, '../HALO_BCI_MASTERCLASS.pdf');
  console.log('Generating PDF at:', outputPath);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '14mm',
      bottom: '16mm',
      left: '14mm',
      right: '14mm'
    }
  });

  await browser.close();
  console.log('PDF generated successfully!');
  const stats = fs.statSync(outputPath);
  console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
}

generatePdf().catch(err => {
  console.error('Failed to generate PDF:', err);
  process.exit(1);
});
