# Halo — Design Brief & Visual Specification

Halo is an assistive brain-computer interface (BCI) designed for real-time motor-imagery decoding. The visual identity bridges **Apple visionOS spatial calmness** with **scientific laboratory instrumentation**. It avoids the tired "AI startup purple neon" tropes, instead embracing deep black voids, crystalline glass surfaces, hairline borders, and reactive ambient illumination that whispers rather than screams.

---

## 1. Aesthetic Identity & Feeling
- **Calm**: Dark, near-black slate backgrounds (`#07080A`) reduce eye fatigue during extended cognitive trials. Information is layered subtly, without visual noise.
- **Precise**: Strict mathematical rhythm, optical alignment, hairline 1px borders (`rgba(255, 255, 255, 0.07)`), and tabular monospace numerals for every live biological signal.
- **A Little Cinematic**: Two massive, heavily blurred radial glows (cyan on the left, amber on the right) rest quietly at 3–5% baseline opacity at the screen perimeter, dynamically swelling up to ~10% in direct harmonic response to the user's motor-imagery intent (`p_left` and `p_right`).
- **Honest**: Clear, quiet disclosure that all live data is streamed from recorded benchmark epochs (BCI Competition IV 2a), never faking live hardware sensor telemetry.

---

## 2. Color Palette & Semantic Tokens

| Token | Hex / Value | Role / Usage |
| :--- | :--- | :--- |
| `background` | `#07080A` | Deepest canvas backing |
| `surface-1` | `#0D0F12` | Base card and container surface |
| `surface-2` | `#14171B` | Raised interactive controls and nested widgets |
| `surface-glass` | `rgba(13, 15, 18, 0.72)` | Frosted backdrop blur glass (`backdrop-filter: blur(20px)`) |
| `border-subtle`| `rgba(255, 255, 255, 0.07)` | Hairline outer boundary on all panels |
| `highlight-top`| `rgba(255, 255, 255, 0.08)` | 1px inner specular highlight (`inset 0 1px 0`) for spatial depth |
| `text-primary` | `#F2F4F7` | High-contrast body, headers, and values |
| `text-muted` | `#8A919C` | Secondary descriptors, units, and timestamps |
| `left` (Cyan) | `#4CC9F0` | Left-hand motor imagery intent |
| `left-glow-12`| `rgba(76, 201, 240, 0.12)` | Subtle left intent tint / hover state |
| `left-glow-30`| `rgba(76, 201, 240, 0.30)` | Active left selection / peak focus |
| `right` (Amber)| `#FFB547` | Right-hand motor imagery intent |
| `right-glow-12`| `rgba(255, 181, 71, 0.12)` | Subtle right intent tint / hover state |
| `right-glow-30`| `rgba(255, 181, 71, 0.30)` | Active right selection / peak focus |
| `success` | `#34D399` | Stable connection, valid inference, high confidence |
| `error` | `#FF5C6C` | Connection drop, high jitter, ML exception |

---

## 3. Typography Scale & Hierarchy

All body typography uses **Geist Sans** (or Inter fallback) with optical kerning; all numerical data, timestamps, latencies, and coordinates strictly use **Geist Mono** with tabular lining figures (`tabular-nums`).

| Scale Step | Font Size / Line Height | Tracking | Weight | Used For |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | 36px / 44px (2.25rem) | -0.03em | 600 SemiBold | Overview hero headers, primary intent declaration |
| **Title 1** | 24px / 32px (1.5rem) | -0.02em | 600 SemiBold | Scene titles, major section headers |
| **Title 2** | 18px / 26px (1.125rem) | -0.015em | 500 Medium | Panel headers, card titles |
| **Body** | 14px / 20px (0.875rem) | 0.0em | 400 Regular | Descriptions, instructions, standard UI labels |
| **Caption** | 11px / 16px (0.6875rem) | +0.06em | 600 SemiBold | Uppercase section taglines, badges, status pills |
| **Mono Display** | 32px / 36px (2.0rem) | -0.02em | 500 Medium | Stat numbers, confidence % callouts |
| **Mono Body** | 13px / 18px (0.8125rem) | 0.0em | 400 Regular | Live telemetry readouts, latencies, sample rates |

---

## 4. Spacing Scale & Rhythm

Base grid unit is 4px. Layout containers use consistent padding and gaps to preserve breathing room:
- **`2` (8px)**: Micro gaps between badge icons and text, button internal padding.
- **`3` (12px)**: Card inner elements spacing, pill padding.
- **`4` (16px)**: Standard gap between related widgets, compact panel padding.
- **`6` (24px)**: Panel internal padding, grid column gaps.
- **`8` (32px)**: Section vertical gaps, container separations.
- **`12` (48px)**: Major scene component rhythm.
- **`16` (64px)**: Page-level top padding beneath floating navigation pill.

---

## 5. Radius Scale & Elevation Levels

- **`rounded-full` (9999px)**: Top floating navigation pill, control badges, dwell circular rings, status dots.
- **`rounded-3xl` (24px)**: Primary application glass panels (`GlassPanel`), hero cards, arena borders.
- **`rounded-2xl` (16px)**: Secondary internal cards, modal dialogs, metrics cards.
- **`rounded-xl` (12px)**: Buttons, dropdown pickers, command palette search bars.
- **`rounded-lg` (8px)**: Badges, keyboard hint tags (`<kbd>`).

### Elevation Matrix
1. **Canvas Level (`#07080A`)**: Background with micro-noise grain and intent-reactive radial glows.
2. **Surface 1 (`#0D0F12`)**: Foundational content cards with 1px border `rgba(255, 255, 255, 0.07)`.
3. **Glass Surface (`rgba(13, 15, 18, 0.72)`)**: 20px backdrop blur, 1px white 7% hairline, top specular highlight (`inset 0 1px 0 rgba(255, 255, 255, 0.08)`).
4. **Surface 2 / Raised**: Hover states, popovers, command palette (`#14171B`), floating visionOS nav bar.

---

## 6. Motion & Interaction Rules

- **Spring Dynamics**: Fluid, physical motion without bounce overshoot for data updates:
  - Default spring: `{ stiffness: 300, damping: 30 }`.
  - Ambient glow response: `{ stiffness: 120, damping: 20 }` (smooth breathing glow).
- **Scene Transitions**: Smooth fade with subtle 8px vertical slide over 250ms via `AnimatePresence`.
- **Navigation Pill Active Indicator**: Smooth layout tween via Framer Motion's `layoutId="nav-active-pill"`.
- **Number Tweening**: `StatNumber` smoothly interpolates numerical values rather than jarring instant jumps.
- **Micro-Interactions**:
  - Buttons & interactive pills: `scale: 1.02` on hover, `scale: 0.98` on click/active.
- **Accessibility**: All animations automatically collapse to immediate transitions when `prefers-reduced-motion` is active.
