# NeusicWave — Phase 2B Handoff for Claude Code
**Status:** Studio redesign COMPLETE. Three pages remain: /waveform/, /livestudio/, /hub landing.  
**Timeline:** All three built by Aug 15 (v1.0-blite launch).  
**Repo:** github.com/bnsceo/NeusicLabV1

---

## 🎯 CONTEXT & ARCHITECTURE

### What's Done
- **Phase 1 (merged main):** Bug fixes (JS wiring, 4-pad playback cap removal), kit system
- **Phase 2A (merged main):** Multi-kit drum engine (5 kits × 16 pads), per-kit synthesis params
- **Phase 2B (branch `design/phase2b-studio`):** 
  - Frontend: Marketing hero, 4-zone industrial shell, OS menubar, demo gate, agent client (6-section preferences, session memory, provider status lamp)
  - Backend: Python FastAPI at localhost:8000 (Hermes bridge, Ollama auto-detect, SQLite memory, CrewAI registry scaffold)
  - Verified: All 47 scripts boot clean, playback/kits/beat creation pass headless test

### What's Left
1. **`/waveform/`** — Waveform editor / sound design page (silver accent)
2. **`/livestudio/`** — Loop station / live looper page (copper accent)
3. **`/hub/`** — Marketing landing page (product hub with tri-accent design rule)

### How to Deploy
Each page becomes a standalone HTML at:
- `https://bnsceo.github.io/NeusicLabV1/waveform/index.html`
- `https://bnsceo.github.io/NeusicLabV1/livestudio/index.html`
- `https://bnsceo.github.io/NeusicLabV1/` (hub landing replaces current index)

Hosted on GitHub Pages; no backend required for landing pages.

---

## 🎨 DESIGN SYSTEM (LOCKED)

### Base Palette (30-nw-tokens.css already defines these)
```
Surfaces:
  --nw-black: #181817
  --nw-charcoal: #252423
  --nw-panel: #303432
  --nw-steel: #5e6b6a
  --nw-light-steel: #7d8685
  --nw-silver: #b0b3b2

Product Accents (per body[data-product]):
  Lab (NeusicLab):       gold #d4a574 / deep #b58b32
  Wave (Waveform):       silver #b0b3b2 / bright #d6dad9
  Live (LiveStudio):     copper #c97d5a / deep #a65b2d

Signal Colors:
  Meters: emerald #07de89 (never use as product accent)
  Record: rust #9b3e2d
  Clips: gold, teal, cream, slate (per clip type)

Typography:
  Font: "Arial Narrow", "Roboto Condensed", "Inter Tight", system-ui, sans-serif
  Sizes: 7px (micro), 8px (small), 9px (ctl), 10px (label), 14px (display), clamp(22px,5vw,34px) (hero)
  Weight: 600–700, letter-spacing 0.03em–0.16em, text-transform uppercase for labels

Hardware Aesthetic:
  Recessed borders: inset 0 2px 4px rgba(0,0,0,.75), inset 0 -1px rgba(255,255,255,.04)
  Raised edges: inset 0 1px rgba(255,255,255,.07), inset 0 -1px rgba(0,0,0,.45)
  Noise overlay: 4% opacity, soft-light blend
```

### Reusable CSS Classes (from 30-nw-tokens.css)
```css
.nw-surface          /* raised panel with gradient */
.nw-well             /* recessed container */
.nw-label            /* 10px uppercase, light-steel */
.nw-micro            /* 7px uppercase, steel */
.nw-btn              /* hardware button, gray gradient, hover + active states */
.nw-btn.is-active    /* accent-colored when toggled */
```

---

## 📄 PAGE SPECS

### Page 1: `/waveform/index.html` (Waveform Editor)

**Product Accent:** Silver `#b0b3b2` / bright `#d6dad9`  
**data-product:** `"wave"`

**Hero Section (above the app)**
```
Headline: "Shape, sculpt, and layer sounds.
          Waveform is the sound design studio."
Subheading: "Edit samples, design synths, layer effects — all in real time, in your browser."

3 bullets:
  • Load or record audio; edit waveforms with surgical precision
  • Design synths with an oscillator stack + real-time preview
  • Layer effects: reverb, delay, compression, EQ — print to sample

CTA button: "Open Waveform"
Entry tracking: localStorage key 'nw-entered-wave'

Below fold: 3 progressive-disclosure sections (each with screenshot frame)
  1. "Waveform editing & sample management"
     Paragraph about precision editing, drag-to-rearrange, non-destructive workflow
     Frame: SCREENSHOT — WAVEFORM EDITOR & TIMELINE
  
  2. "Synth design with presets & randomization"
     Paragraph about oscillators, filters, envelopes, preset library
     Frame: SCREENSHOT — SYNTH INTERFACE
  
  3. "Real-time effects processing"
     Paragraph about effect rack, send/return, wet/dry balance, chain UI
     Frame: SCREENSHOT — EFFECTS RACK
```

**App Structure (below hero, triggered by "Open Waveform" button)**
Same as NeusicLab:
- Menubar: FILE / EDIT / VIEW / HELP (all wired to the waveform engine functions)
- Transport strip (recessed): playback, BPM, record button, time display
- Left panel: sample browser, synth presets, undo/redo history
- Center workspace: large waveform canvas + synth editor (switchable via VIEW menu)
- Right inspector: selected sample/synth parameters

**Demo gate:** Save gated behind Pro (same gate as NeusicLab)  
**Agent:** Same 6-section preferences, same session memory scope  

**CSS files to create:**
- `css/50-waveform-hero.css` — hero, buttons, landing sections (copy 32-nw-menubar.css structure)
- `css/51-waveform-shell.css` — tailored 4-zone shell for waveform app (copy 31-nw-shell.css, adapt for waveform-specific regions)

**JS files to create:**
- `js/50-waveform-shell.js` — shell activation (copy 42-nw-shell.js, wire to waveform inspectors)
- Entry/exit handoff: copy logic from js/43-nw-menubar.js + app initialization

**Acceptance Criteria:**
- ✅ Hero loads with 3 bullets and CTA
- ✅ "Open Waveform" button toggles `body.nw-in-app` class and stores in localStorage
- ✅ 4-zone shell renders: transport (recessed), left panel, center (hero canvas space), right inspector
- ✅ Menubar wires to stub engine functions (e.g., `window.saveProjectToFile`, `window.playAudio`)
- ✅ Save gate shows upgrade dialog
- ✅ Mobile: panels collapse/slide-over
- ✅ Accent color throughout is silver (#b0b3b2)

---

### Page 2: `/livestudio/index.html` (Live Looper / Loop Station)

**Product Accent:** Copper `#c97d5a` / deep `#a65b2d`  
**data-product:** `"live"`

**Hero Section (above the app)**
```
Headline: "Loop, layer, perform.
          LiveStudio is real-time beat making."
Subheading: "Record loops on the fly, layer synths, triggers drums, and perform live — all with one take."

3 bullets:
  • 16-track loop station with footswitch control and MIDI learn
  • Real-time synth triggering and drum machine sequencer
  • One-shot recording: press record, play, release — loop set

CTA button: "Open LiveStudio"
Entry tracking: localStorage key 'nw-entered-live'

Below fold: 3 progressive-disclosure sections
  1. "Loop recording & layer management"
     Paragraph about loop length sync, quantize, volume per loop, mute/solo
     Frame: SCREENSHOT — LOOP GRID & TRANSPORT
  
  2. "Synth triggering & drum machine"
     Paragraph about keyboard/MIDI input, drum pads, synth voices, arpeggiator
     Frame: SCREENSHOT — PADS & SYNTH PANEL
  
  3. "Live control & MIDI mapping"
     Paragraph about footswitch support, CC mapping, tempo sync, overdub
     Frame: SCREENSHOT — CONTROL PANEL
```

**App Structure (below hero)**
- Menubar: FILE / EDIT / VIEW / HELP (simplified: New, Open, Export, Settings; no Save unless Pro)
- Transport strip: play/stop, loop length, tempo, record arm (bright red when armed)
- Left panel: loop track list (16 slots, one per row), mute/solo toggles, volume faders
- Center workspace: loop grid (4×4 or 8×2 layout), large waveform display for current loop, trigger pads for synth
- Right inspector: loop/synth parameters (decay, pitch, pan, effects send)

**Demo gate:** Same as studio (Save gated, Export free)  
**Agent:** Same 6-section preferences (with performance mode defaulting to "Live")

**CSS files to create:**
- `css/52-livestudio-hero.css` — hero sections (copy from 50-waveform-hero.css)
- `css/53-livestudio-shell.css` — tailored 4-zone shell for loop station (adapt 51-waveform-shell.css)

**JS files to create:**
- `js/52-livestudio-shell.js` — shell activation for live looper (copy 50-waveform-shell.js)
- Entry/exit handoff (copy from waveform)

**Acceptance Criteria:**
- ✅ Hero loads with 3 bullets and CTA
- ✅ "Open LiveStudio" button toggles app + localStorage
- ✅ Loop grid renders in center (16 slots, visual feedback on active loops)
- ✅ Menubar simplified (no Save unless Pro)
- ✅ Accent color throughout is copper (#c97d5a)
- ✅ Mobile: grid stacks, left panel collapses
- ✅ Performance mode defaults to "live" in agent prefs

---

### Page 3: `/hub/index.html` (NeusicWave Hub / Marketing Landing)

**Purpose:** Hub landing that links to all three apps (studio, waveform, livestudio) + explains the suite.  
**Accents:** Tri-segment rule (copper → silver → gold) under headline; product cards inherit their own accents

**Structure**
```html
<!-- Hero section -->
<header>
  <div class="nw-micro">NEUSICWAVE</div>
  <h1>Beats, loops, and full tracks — entirely in your browser.</h1>
  <p>Complete production suite in the browser. No installation. No login. Arrange, record, mix, design sounds, and perform live — pick your tool.</p>
  
  <!-- Tri-segment accent rule (copper/silver/gold) -->
  <div class="nw-tri-rule"></div>
  
  <!-- Three product cards -->
  <div class="product-cards">
    <!-- Card 1: NeusicLab -->
    <card class="product-card" data-product="lab">
      <div class="card-cap" style="background: var(--nw-lab-gold)">
        <span class="nw-micro">NEUSICLAB</span>
      </div>
      <h2>NeusicLab</h2>
      <p>Arrange, record, mix, and master. The finishing studio.</p>
      <ul>
        <li>Multi-track arrangement & waveform editing</li>
        <li>5 drum kits, sampler, effects</li>
        <li>Real-time mixing & WAV export</li>
      </ul>
      <button class="cta" onclick="location.href='/NeusicLabV1/studio/'">
        Enter NeusicLab
      </button>
    </card>
    
    <!-- Card 2: Waveform -->
    <card class="product-card" data-product="wave">
      <div class="card-cap" style="background: var(--nw-wave-silver)">
        <span class="nw-micro">WAVEFORM</span>
      </div>
      <h2>Waveform</h2>
      <p>Shape, sculpt, and layer sounds. The sound design studio.</p>
      <ul>
        <li>Waveform editing & sample library</li>
        <li>Synth design with presets & randomization</li>
        <li>Real-time effects processing</li>
      </ul>
      <button class="cta" onclick="location.href='/NeusicLabV1/waveform/'">
        Enter Waveform
      </button>
    </card>
    
    <!-- Card 3: LiveStudio -->
    <card class="product-card" data-product="live">
      <div class="card-cap" style="background: var(--nw-live-copper)">
        <span class="nw-micro">LIVESTUDIO</span>
      </div>
      <h2>LiveStudio</h2>
      <p>Loop, layer, perform. Real-time beat making on the fly.</p>
      <ul>
        <li>16-track loop station with quantize & sync</li>
        <li>Real-time synth triggering & drum machine</li>
        <li>MIDI learn & footswitch control</li>
      </ul>
      <button class="cta" onclick="location.href='/NeusicLabV1/livestudio/'">
        Enter LiveStudio
      </button>
    </card>
  </div>
</header>

<!-- Secondary sections -->
<section class="why-browser">
  <h2>Why browser?</h2>
  <p>No installation. No login. No subscription. The demo is the full suite — save and sync when you upgrade to Pro.</p>
</section>

<section class="faq">
  <h2>FAQ</h2>
  <details>
    <summary>Is NeusicWave free?</summary>
    <p>Yes. The demo is entirely free and includes everything. Save your projects by upgrading to Pro.</p>
  </details>
  <details>
    <summary>Do I need to be online?</summary>
    <p>No. All engines run locally in your browser. Internet is only needed to load the page and sync (if you choose).</p>
  </details>
  <details>
    <summary>Can I use it on my phone?</summary>
    <p>Yes. All apps are mobile-optimized. On smaller screens, panels collapse and stack.</p>
  </details>
</section>

<!-- Footer -->
<footer>
  <p>Made by Anderson Paulino · <a href="#">@neusicwave</a> on TikTok</p>
</footer>
```

**CSS Requirements:**
- Hero headline: clamp(22px, 5vw, 34px), gold accent baseline (default to lab)
- Tri-segment rule: `<div class="nw-tri-rule">` — linear gradient copper → silver → gold, 3px tall, full width
- Product cards: 3 columns on desktop, stack on mobile, each has accent-colored cap (mixer-strip style label), dark surface, border, hover scale/lift effect
- FAQ: styled as collapsible details, dark background
- Footer: light gray text, centered, small

**JS Requirements:**
- None (pure landing page, just click-to-navigate)
- No marketing hero entry/exit logic (not an app)

**Acceptance Criteria:**
- ✅ Hero with tri-segment rule (copper/silver/gold) renders
- ✅ Three product cards visible, each with correct accent cap color
- ✅ Cards stack on mobile (single column)
- ✅ CTA buttons link to `/studio/`, `/waveform/`, `/livestudio/`
- ✅ FAQ collapses/expands
- ✅ Footer centered with TikTok handle

---

## 🔧 BUILD CHECKLIST

### Per Page
- [ ] Create `/waveform/index.html` (with hero + shell)
- [ ] Create `/waveform/css/50-waveform-hero.css`
- [ ] Create `/waveform/css/51-waveform-shell.css`
- [ ] Create `/waveform/js/50-waveform-shell.js`
- [ ] Verify: hero loads, CTA works, demo gate appears on Save, mobile panels collapse

- [ ] Create `/livestudio/index.html` (with hero + shell)
- [ ] Create `/livestudio/css/52-livestudio-hero.css`
- [ ] Create `/livestudio/css/53-livestudio-shell.css`
- [ ] Create `/livestudio/js/52-livestudio-shell.js`
- [ ] Verify: hero loads, CTA works, loop grid renders, accent is copper

- [ ] Create `/index.html` (hub landing, replaces current)
- [ ] Create `/css/60-hub-landing.css` (hero, cards, tri-rule, FAQ)
- [ ] Verify: tri-rule renders, cards stack on mobile, links work

### Cross-Page
- [ ] All three pages inherit base tokens from `/app/css/30-nw-tokens.css`
- [ ] All three pages share `/app/css/32-nw-menubar.css` (menubar/dialog styles)
- [ ] Demo gate (`45-nw-demo-gate.js`) works on all app pages
- [ ] Agent client (`44-nw-agent.js`) available on all app pages
- [ ] Test on mobile: panels collapse, text readable, buttons tappable
- [ ] Commit to `design/phase2b-remaining` or same branch as phase2b-studio
- [ ] Create PR to merge all three pages + backend to `main`

### Deployment
- [ ] All files pushed to GitHub
- [ ] Files appear at correct paths when deployed to Pages:
  - `https://bnsceo.github.io/NeusicLabV1/waveform/`
  - `https://bnsceo.github.io/NeusicLabV1/livestudio/`
  - `https://bnsceo.github.io/NeusicLabV1/` (hub replaces root index)

---

## 📋 REQUIREMENTS SUMMARY

### Tech
- Pure HTML/CSS/JS (no build step)
- All pages inherit industrial hardware aesthetic from 30-nw-tokens.css
- Menubar, demo gate, and agent client are copy-pasted from NeusicLab with minimal adaptation
- No backend dependencies on landing pages

### Copy
- **NeusicLab:** "Arrange, record, mix, and master. The finishing studio."
- **Waveform:** "Shape, sculpt, and layer sounds. The sound design studio."
- **LiveStudio:** "Loop, layer, perform. Real-time beat making on the fly."
- **Hub headline:** "Beats, loops, and full tracks — entirely in your browser."

### Accents (LOCKED)
- Lab: gold #d4a574 / deep #b58b32
- Waveform: silver #b0b3b2 / bright #d6dad9
- LiveStudio: copper #c97d5a / deep #a65b2d
- Meters (if visible): emerald #07de89 (suite-wide, never as product accent)

### Mobile
- All panels collapse on screens ≤768px
- Cards stack to 1 column on landing
- Text and buttons remain readable and tappable

---

## 🚀 DEPLOYMENT ORDER

1. ✅ Phase 2B studio page complete + in `design/phase2b-studio` branch
2. **Build /waveform/ page** ← START HERE
3. **Build /livestudio/ page**
4. **Build /hub/ landing page**
5. **Merge all to main** (or create `design/phase2b-remaining` and merge once approved)
6. **Deploy to Pages** (automatic on merge to main if GitHub Pages is set to deploy from main branch)

---

## 📞 HANDOFF NOTES

**What's Reusable:**
- Copy `32-nw-menubar.css` → waveform + livestudio (menubar styling is identical)
- Copy `42-nw-shell.js` → 50-waveform-shell.js + 52-livestudio-shell.js (just change region IDs)
- Copy demo-gate logic from NeusicLab (same for all three)
- Copy agent client initialization from NeusicLab (same for all three)

**What's Different:**
- Each page's hero section (different bullet points, different screenshots)
- Each page's inspector content (waveform-specific params vs. loop params vs. synth params)
- Product accent color (set via `body[data-product]` data attribute)

**Assets Needed (NOT IN SCOPE FOR THIS BUILD):**
- Screenshot frames for hero sections (3 per page = 9 total screenshots)
- These can be placeholder frames initially; real screenshots come after apps are built

---

**Questions before you start?**

Otherwise: **clone the repo, create a new branch from `design/phase2b-studio`, and build away.** You've got everything you need.
