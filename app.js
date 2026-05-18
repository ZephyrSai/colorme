/* ColorMe — a calm coloring studio
   Vanilla JS. No build step. Works as a static site (e.g. GitHub Pages). */

(() => {
  // ---------- palette ----------
  const PALETTE = [
    "#f6a6b5", "#f7c5a8", "#fde2a3", "#cfe8b4",
    "#a3d9c8", "#b8d4f0", "#cbb8e4", "#f4b6d2",
    "#e08395", "#d99063", "#e8c25a", "#92b87a",
    "#5f9b8a", "#6c9ec9", "#9c7fc4", "#c97aa3",
    "#7a4a2b", "#3a3027", "#8b6f5b", "#c0a060",
    "#fff8ed", "#d9c1ec", "#ffd5d5", "#c5e8d3",
  ];

  // ---------- state ----------
  const state = {
    mode: "manual",
    brush: "crayon",
    color: PALETTE[0],
    brushSize: 1,
    detail: 3,
    weight: 2,
    closeGaps: 0,
    blankCanvas: false,
    sourceImage: null,        // ImageBitmap or HTMLImageElement
    edgeMask: null,           // Uint8Array, 1 = wall (edge), 0 = open
    canvasW: 0,
    canvasH: 0,
    soundOn: true,
    musicOn: true,
    zenRunning: false,
    zenAbort: false,
  };

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    fileInput: $("#file-input"),
    fileInputHero: $("#file-input-hero"),
    sampleBtn: $("#sample-btn"),
    sampleBtnHero: $("#sample-btn-hero"),
    pasteBtn: $("#paste-btn"),
    blankBtn: $("#blank-btn"),
    blankBtnHero: $("#blank-btn-hero"),
    fluidCanvas: $("#fluid-canvas"),
    // abstract controls
    abstractUseColor: $("#abstract-usecolor"),
    abstractBloom: $("#abstract-bloom"),
    splatSizeSlider: $("#splat-size-slider"),
    splatSizeVal: $("#splat-size-val"),
    splatForceSlider: $("#splat-force-slider"),
    splatForceVal: $("#splat-force-val"),
    curlSlider: $("#curl-slider"),
    curlVal: $("#curl-val"),
    dissSlider: $("#diss-slider"),
    dissVal: $("#diss-val"),
    splatBtn: $("#splat-btn"),
    // history
    undoBtn: $("#undo-btn"),
    redoBtn: $("#redo-btn"),
    musicBtn: $("#music-btn"),
    soundBtn: $("#sound-btn"),
    themeBtn: $("#theme-btn"),
    panelToggle: $("#panel-toggle"),
    panelOverlay: $("#panel-overlay"),
    panel: document.querySelector(".panel.left"),
    palette: $("#palette"),
    customColor: $("#custom-color"),
    detailSlider: $("#detail-slider"),
    detailVal: $("#detail-val"),
    weightSlider: $("#weight-slider"),
    weightVal: $("#weight-val"),
    closeSlider: $("#close-slider"),
    closeVal: $("#close-val"),
    sizeSlider: $("#size-slider"),
    sizeVal: $("#size-val"),
    regenBtn: $("#regen-btn"),
    clearBtn: $("#clear-btn"),
    saveBtn: $("#save-btn"),
    welcome: $("#welcome"),
    canvasWrap: $("#canvas-wrap"),
    paintCanvas: $("#paint-canvas"),
    outlineCanvas: $("#outline-canvas"),
    fxCanvas: $("#fx-canvas"),
    hand: $("#hand"),
    bristles: $("#bristles"),
    toast: $("#toast"),
    stage: $("#stage"),
    zenStart: $("#zen-start"),
    zenStop: $("#zen-stop"),
    zenControls: $(".zen-controls"),
  };

  const paintCtx = els.paintCanvas.getContext("2d", { willReadFrequently: true });
  const outlineCtx = els.outlineCanvas.getContext("2d", { willReadFrequently: true });
  const fxCtx = els.fxCanvas.getContext("2d");

  // ---------- audio ----------
  const audio = {
    ctx: null,
    masterFx: null,
    masterMusic: null,
    musicReverbIn: null,
    musicStarted: false,
    noiseBuffer: null,
    ensure() {
      if (this.ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.masterFx = this.ctx.createGain();
      this.masterFx.gain.value = 0.55;
      this.masterFx.connect(this.ctx.destination);
      this.masterMusic = this.ctx.createGain();
      this.masterMusic.gain.value = 0;
      this.masterMusic.connect(this.ctx.destination);
      this.noiseBuffer = this._makeNoise(2);
    },
    _makeNoise(seconds) {
      const sr = this.ctx.sampleRate;
      const len = sr * seconds;
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
      return buf;
    },
    stroke(brush) {
      if (!state.soundOn) return;
      this.ensure();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();

      const t = this.ctx.currentTime;
      const dur = ({
        pencil: 0.18, crayon: 0.22, watercolor: 0.55, acrylic: 0.32, oil: 0.45, marker: 0.25
      })[brush] || 0.25;

      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      src.playbackRate.value = 0.7 + Math.random() * 0.6;

      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      if (brush === "pencil") {
        filter.type = "highpass"; filter.frequency.value = 1800;
        gain.gain.value = 0; gain.gain.linearRampToValueAtTime(0.10, t + 0.01);
      } else if (brush === "crayon") {
        filter.type = "bandpass"; filter.frequency.value = 900; filter.Q.value = 0.8;
        gain.gain.value = 0; gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
      } else if (brush === "watercolor") {
        filter.type = "lowpass"; filter.frequency.value = 600;
        gain.gain.value = 0; gain.gain.linearRampToValueAtTime(0.09, t + 0.06);
      } else if (brush === "acrylic") {
        filter.type = "lowpass"; filter.frequency.value = 1200;
        gain.gain.value = 0; gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
      } else if (brush === "oil") {
        filter.type = "bandpass"; filter.frequency.value = 500; filter.Q.value = 0.5;
        gain.gain.value = 0; gain.gain.linearRampToValueAtTime(0.15, t + 0.04);
      } else {
        filter.type = "lowpass"; filter.frequency.value = 1800;
        gain.gain.value = 0; gain.gain.linearRampToValueAtTime(0.15, t + 0.01);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      src.connect(filter); filter.connect(gain); gain.connect(this.masterFx);
      src.start(t);
      src.stop(t + dur + 0.05);
    },
    toggleMusic(on) {
      this.ensure();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      if (on) {
        if (!this.musicStarted) {
          this._startMusic();
          this.musicStarted = true;
        }
        this.masterMusic.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterMusic.gain.setValueAtTime(this.masterMusic.gain.value, this.ctx.currentTime);
        this.masterMusic.gain.linearRampToValueAtTime(0.55, this.ctx.currentTime + 1.2);
      } else {
        this.masterMusic.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterMusic.gain.setValueAtTime(this.masterMusic.gain.value, this.ctx.currentTime);
        this.masterMusic.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.2);
      }
    },
    _startMusic() {
      const ctx = this.ctx;

      // ---- reverb-like wash via feedback delay (cheap, no IR needed) ----
      const delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.38;
      const fb = ctx.createGain();
      fb.gain.value = 0.48;
      const damp = ctx.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 2400;
      delay.connect(damp);
      damp.connect(fb);
      fb.connect(delay);
      const wet = ctx.createGain();
      wet.gain.value = 0.45;
      damp.connect(wet);
      wet.connect(this.masterMusic);
      this.musicReverbIn = delay;

      // master tone filter for pad
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = "lowpass";
      padFilter.frequency.value = 1500;
      padFilter.Q.value = 0.7;
      padFilter.connect(this.masterMusic);
      padFilter.connect(delay);

      // slow LFO on filter
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.04;
      lfoGain.gain.value = 400;
      lfo.connect(lfoGain); lfoGain.connect(padFilter.frequency);
      lfo.start();

      // ---- chord progression in C minor: i - VI - iv - v ----
      // (sounds melancholic-calm; loops naturally)
      const chords = [
        { pad: [261.63, 311.13, 392.00], bass: 65.41,  mel: [523.25, 622.25, 783.99, 932.33, 1046.5] }, // Cm:  C4 Eb4 G4,  C2
        { pad: [207.65, 261.63, 311.13], bass: 51.91,  mel: [415.30, 523.25, 622.25, 830.61, 1046.5] }, // Ab:  Ab3 C4 Eb4, Ab1
        { pad: [174.61, 207.65, 261.63], bass: 43.65,  mel: [349.23, 415.30, 523.25, 698.46, 880.00] }, // Fm:  F3 Ab3 C4,  F1
        { pad: [196.00, 233.08, 293.66], bass: 49.00,  mel: [392.00, 466.16, 587.33, 783.99, 932.33] }, // Gm:  G3 Bb3 D4,  G1
      ];

      const chordSec = 8.5;          // each chord lasts ~8.5s
      const overlap = 1.2;           // chord crossfade overlap
      const startTime = ctx.currentTime + 0.05;

      const playChord = (chord, t0) => {
        // pad voices
        chord.pad.forEach((f, i) => {
          const o1 = ctx.createOscillator();
          const o2 = ctx.createOscillator();
          o1.type = "triangle"; o2.type = "sine";
          o1.frequency.value = f;
          o2.frequency.value = f * 1.004;
          const g = ctx.createGain();
          const peak = 0.13 / (1 + i * 0.15);
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(peak, t0 + 2.5);
          g.gain.linearRampToValueAtTime(peak, t0 + chordSec - 1.5);
          g.gain.linearRampToValueAtTime(0, t0 + chordSec + overlap);
          o1.connect(g); o2.connect(g); g.connect(padFilter);
          o1.start(t0); o2.start(t0);
          o1.stop(t0 + chordSec + overlap + 0.2);
          o2.stop(t0 + chordSec + overlap + 0.2);
        });
        // bass — sine + a touch of square for warmth (kept very soft)
        const b1 = ctx.createOscillator();
        b1.type = "sine"; b1.frequency.value = chord.bass;
        const bg = ctx.createGain();
        bg.gain.setValueAtTime(0, t0);
        bg.gain.linearRampToValueAtTime(0.18, t0 + 1.8);
        bg.gain.linearRampToValueAtTime(0.18, t0 + chordSec - 1.2);
        bg.gain.linearRampToValueAtTime(0, t0 + chordSec + overlap);
        b1.connect(bg); bg.connect(this.masterMusic);
        b1.start(t0); b1.stop(t0 + chordSec + overlap + 0.2);
      };

      const playMelodyNote = (freq, t0) => {
        // soft piano-ish tone: two sines (fundamental + 2nd partial) with quick attack & long decay
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        o1.type = "sine"; o2.type = "sine";
        o1.frequency.value = freq;
        o2.frequency.value = freq * 2.01;
        const g1 = ctx.createGain();
        const g2 = ctx.createGain();
        g1.gain.setValueAtTime(0, t0);
        g1.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
        g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.5);
        g2.gain.setValueAtTime(0, t0);
        g2.gain.linearRampToValueAtTime(0.05, t0 + 0.015);
        g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
        o1.connect(g1); o2.connect(g2);
        g1.connect(delay); g1.connect(this.masterMusic);
        g2.connect(delay); g2.connect(this.masterMusic);
        o1.start(t0); o2.start(t0);
        o1.stop(t0 + 4.7); o2.stop(t0 + 2.4);
      };

      // ---- scheduler: queue chords ~5s ahead, runs forever ----
      let chordIdx = 0;
      let nextChordTime = startTime;
      const scheduler = () => {
        const lookahead = ctx.currentTime + 5;
        while (nextChordTime < lookahead) {
          playChord(chords[chordIdx % chords.length], nextChordTime);
          // schedule a few melody notes within this chord
          const chord = chords[chordIdx % chords.length];
          const noteCount = 2 + Math.floor(Math.random() * 3);
          for (let n = 0; n < noteCount; n++) {
            const offset = 1.5 + Math.random() * (chordSec - 2.5);
            const freq = chord.mel[Math.floor(Math.random() * chord.mel.length)];
            playMelodyNote(freq, nextChordTime + offset);
          }
          nextChordTime += chordSec - overlap;
          chordIdx++;
        }
        setTimeout(scheduler, 1200);
      };
      scheduler();
    },
  };

  // ---------- toast ----------
  let toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (els.toast.hidden = true), 2200);
  }

  // ---------- palette UI ----------
  function buildPalette() {
    els.palette.innerHTML = "";
    PALETTE.forEach((c) => {
      const b = document.createElement("button");
      b.className = "color-chip";
      b.style.background = c;
      b.dataset.color = c;
      if (c === state.color) b.classList.add("active");
      b.addEventListener("click", () => setColor(c));
      els.palette.appendChild(b);
    });
  }
  function setColor(c) {
    state.color = c;
    $$(".color-chip").forEach((el) => el.classList.toggle("active", el.dataset.color === c));
    els.customColor.value = c;
    updateBristleColor();
    // in abstract mode the user's color drives the splats
    if (state.mode === "abstract" && window.ColormeFluid && els.abstractUseColor.checked) {
      window.ColormeFluid.setUserColor(hexToRgb(c));
    }
  }
  function updateBristleColor() {
    if (!els.bristles) return;
    // eraser is a "tool" not a color — show the bristles as paper-white
    const c = state.brush === "eraser" ? "#fefcf8" : state.color;
    els.bristles.setAttribute("fill", c);
  }

  // ---------- mode + brush UI ----------
  function applyModeClass() {
    els.canvasWrap.classList.toggle("manual-mode", state.mode === "manual");
  }
  function enterAbstractMode() {
    document.body.classList.add("abstract-mode");
    els.welcome.classList.add("hidden");
    els.canvasWrap.classList.add("hidden");
    els.fluidCanvas.classList.remove("hidden");
    // boot needs the canvas visible so WebGL sees non-zero clientWidth/Height
    requestAnimationFrame(() => {
      if (window.ColormeFluidBoot) window.ColormeFluidBoot();
      if (window.ColormeFluid) {
        window.ColormeFluid.start();
        syncAbstractConfig();
      }
    });
  }
  function leaveAbstractMode() {
    document.body.classList.remove("abstract-mode");
    if (window.ColormeFluid) window.ColormeFluid.stop();
    els.fluidCanvas.classList.add("hidden");
    if (state.canvasW > 0) {
      els.canvasWrap.classList.remove("hidden");
    } else {
      els.welcome.classList.remove("hidden");
    }
  }

  // Push all abstract controls into the fluid sim at once. Called on enter
  // (so prior settings are honored) and whenever the user changes one.
  function syncAbstractConfig() {
    if (!window.ColormeFluid) return;
    const F = window.ColormeFluid;
    F.setConfig("SPLAT_RADIUS", +els.splatSizeSlider.value);
    F.setConfig("SPLAT_FORCE", +els.splatForceSlider.value);
    F.setConfig("CURL", +els.curlSlider.value);
    F.setConfig("DENSITY_DISSIPATION", +els.dissSlider.value);
    F.setConfig("BLOOM", els.abstractBloom.checked);
    // color override
    if (els.abstractUseColor.checked) {
      F.setUserColor(hexToRgb(state.color));
      F.setConfig("COLORFUL", false);
    } else {
      F.setUserColor(null);
      F.setConfig("COLORFUL", true);
    }
  }
  $$(".mode-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const wasAbstract = state.mode === "abstract";
      $$(".mode-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      state.mode = b.dataset.mode;
      els.zenControls.classList.toggle("hidden", state.mode !== "zen");
      applyModeClass();
      // end any in-flight manual stroke, hide the hand for the new mode
      if (typeof manual !== "undefined" && manual.active) {
        manual.active = false;
        manual.region = null;
      }
      hideHand();
      // close the drawer on mobile so the user can see what they switched to
      if (els.panel.classList.contains("open")) setPanelOpen(false);

      if (state.mode === "abstract") enterAbstractMode();
      else if (wasAbstract) leaveAbstractMode();
    });
  });
  // ensure the class reflects the default mode at startup
  applyModeClass();

  $$(".brush-btn").forEach((b) => {
    b.addEventListener("click", () => {
      $$(".brush-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      state.brush = b.dataset.brush;
      updateBristleColor();   // eraser flips bristles to paper-white
    });
  });

  // ---------- image load ----------
  function bindFileInput(input) {
    input.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) loadImageFromFile(f);
      input.value = "";
    });
  }
  bindFileInput(els.fileInput);
  bindFileInput(els.fileInputHero);

  function loadImageFromFile(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setupCanvasFromImage(img);
    };
    img.onerror = () => toast("Could not load that image.");
    img.src = url;
  }

  els.sampleBtn.addEventListener("click", loadSample);
  els.sampleBtnHero.addEventListener("click", loadSample);
  els.blankBtn.addEventListener("click", loadBlankCanvas);
  els.blankBtnHero.addEventListener("click", loadBlankCanvas);

  // ---------- paste from clipboard ----------
  // Cmd/Ctrl+V works anywhere on the page
  document.addEventListener("paste", (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          loadImageFromFile(file);
          toast("Pasted from clipboard.");
          return;
        }
      }
    }
  });

  // Explicit "Paste" button — uses the async Clipboard API for cases where
  // keyboard paste isn't easy (mobile, embedded contexts, etc.)
  els.pasteBtn.addEventListener("click", async () => {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      toast("Press Cmd+V / Ctrl+V to paste an image.");
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          loadImageFromFile(blob);
          toast("Pasted from clipboard.");
          return;
        }
      }
      toast("No image in clipboard.");
    } catch (err) {
      // permission denied, or browser couldn't read — fall back to keyboard
      toast("Press Cmd+V / Ctrl+V to paste an image.");
    }
  });

  function loadSample() {
    const sw = 1000, sh = 700;
    const oc = document.createElement("canvas");
    oc.width = sw; oc.height = sh;
    const c = oc.getContext("2d");

    // sky gradient
    const sky = c.createLinearGradient(0, 0, 0, sh * 0.7);
    sky.addColorStop(0, "#a8d2ea");
    sky.addColorStop(0.55, "#f0d2bc");
    sky.addColorStop(1, "#f8dcc4");
    c.fillStyle = sky;
    c.fillRect(0, 0, sw, sh * 0.7);

    // sun
    c.fillStyle = "#fad876";
    c.beginPath(); c.arc(sw * 0.78, sh * 0.22, 55, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#d68f3e"; c.lineWidth = 3; c.stroke();

    // sun "rays" — concentric ring
    c.beginPath(); c.arc(sw * 0.78, sh * 0.22, 75, 0, Math.PI * 2); c.stroke();

    // distant mountain range
    c.fillStyle = "#9aa6c2";
    c.beginPath();
    c.moveTo(0, sh * 0.5);
    c.lineTo(sw * 0.12, sh * 0.30);
    c.lineTo(sw * 0.22, sh * 0.42);
    c.lineTo(sw * 0.34, sh * 0.26);
    c.lineTo(sw * 0.46, sh * 0.40);
    c.lineTo(sw * 0.58, sh * 0.32);
    c.lineTo(sw * 0.70, sh * 0.44);
    c.lineTo(sw * 0.82, sh * 0.32);
    c.lineTo(sw * 0.94, sh * 0.42);
    c.lineTo(sw, sh * 0.38);
    c.lineTo(sw, sh * 0.55);
    c.lineTo(0, sh * 0.55);
    c.closePath();
    c.fill();
    c.strokeStyle = "#5a6788"; c.lineWidth = 2; c.stroke();

    // mid mountains (darker)
    c.fillStyle = "#7a8aaa";
    c.beginPath();
    c.moveTo(0, sh * 0.58);
    c.lineTo(sw * 0.18, sh * 0.42);
    c.lineTo(sw * 0.30, sh * 0.50);
    c.lineTo(sw * 0.42, sh * 0.40);
    c.lineTo(sw * 0.55, sh * 0.48);
    c.lineTo(sw * 0.66, sh * 0.42);
    c.lineTo(sw * 0.80, sh * 0.50);
    c.lineTo(sw * 0.92, sh * 0.44);
    c.lineTo(sw, sh * 0.52);
    c.lineTo(sw, sh * 0.62);
    c.lineTo(0, sh * 0.62);
    c.closePath();
    c.fill();

    // grassy hills (foreground bank)
    c.fillStyle = "#7eaa70";
    c.beginPath();
    c.moveTo(0, sh * 0.62);
    c.quadraticCurveTo(sw * 0.20, sh * 0.55, sw * 0.40, sh * 0.60);
    c.quadraticCurveTo(sw * 0.60, sh * 0.66, sw * 0.80, sh * 0.58);
    c.quadraticCurveTo(sw * 0.92, sh * 0.55, sw, sh * 0.60);
    c.lineTo(sw, sh * 0.70);
    c.lineTo(0, sh * 0.70);
    c.closePath();
    c.fill();

    // water
    const water = c.createLinearGradient(0, sh * 0.70, 0, sh);
    water.addColorStop(0, "#6c9ec9");
    water.addColorStop(1, "#3f6e96");
    c.fillStyle = water;
    c.fillRect(0, sh * 0.70, sw, sh * 0.30);

    // water ripple lines
    c.strokeStyle = "rgba(255,255,255,0.55)";
    c.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const y = sh * 0.74 + i * 16;
      c.beginPath();
      c.moveTo(sw * 0.05, y);
      c.bezierCurveTo(sw * 0.25, y - 4, sw * 0.50, y + 3, sw * 0.95, y - 2);
      c.stroke();
    }

    // pagoda (right) — three-tiered
    const pX = sw * 0.72, pY = sh * 0.62;
    // base
    c.fillStyle = "#c5784a";
    c.fillRect(pX - 40, pY - 10, 80, 18);
    c.strokeStyle = "#3a3027"; c.lineWidth = 2; c.strokeRect(pX - 40, pY - 10, 80, 18);
    // tier 1 body
    c.fillStyle = "#f1d2a6"; c.fillRect(pX - 30, pY - 50, 60, 40);
    c.strokeRect(pX - 30, pY - 50, 60, 40);
    // tier 1 roof
    c.fillStyle = "#a04830";
    c.beginPath();
    c.moveTo(pX - 50, pY - 50); c.quadraticCurveTo(pX, pY - 78, pX + 50, pY - 50); c.closePath(); c.fill(); c.stroke();
    // tier 2 body
    c.fillStyle = "#f1d2a6"; c.fillRect(pX - 24, pY - 90, 48, 40); c.strokeRect(pX - 24, pY - 90, 48, 40);
    // tier 2 roof
    c.fillStyle = "#a04830";
    c.beginPath();
    c.moveTo(pX - 42, pY - 90); c.quadraticCurveTo(pX, pY - 115, pX + 42, pY - 90); c.closePath(); c.fill(); c.stroke();
    // tier 3 body
    c.fillStyle = "#f1d2a6"; c.fillRect(pX - 18, pY - 125, 36, 35); c.strokeRect(pX - 18, pY - 125, 36, 35);
    // tier 3 roof
    c.fillStyle = "#a04830";
    c.beginPath();
    c.moveTo(pX - 32, pY - 125); c.quadraticCurveTo(pX, pY - 148, pX + 32, pY - 125); c.closePath(); c.fill(); c.stroke();
    // spire
    c.fillStyle = "#c0a060";
    c.beginPath();
    c.moveTo(pX - 4, pY - 148); c.lineTo(pX + 4, pY - 148); c.lineTo(pX, pY - 172); c.closePath(); c.fill(); c.stroke();
    // pagoda windows
    c.fillStyle = "#5a4030";
    [[pY - 42, 14], [pY - 82, 12], [pY - 115, 10]].forEach(([py, sz]) => {
      c.fillRect(pX - sz / 2, py, sz, sz);
      c.strokeRect(pX - sz / 2, py, sz, sz);
    });

    // cherry blossom tree (left)
    const tX = sw * 0.18, tBase = sh * 0.68;
    // trunk
    c.fillStyle = "#5a3a25";
    c.beginPath();
    c.moveTo(tX - 8, tBase);
    c.lineTo(tX - 10, tBase - 70);
    c.lineTo(tX - 2, tBase - 130);
    c.lineTo(tX + 6, tBase - 130);
    c.lineTo(tX + 12, tBase - 70);
    c.lineTo(tX + 10, tBase);
    c.closePath();
    c.fill();
    c.strokeStyle = "#3a2418"; c.lineWidth = 2; c.stroke();
    // branches
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(tX, tBase - 90); c.quadraticCurveTo(tX - 30, tBase - 130, tX - 55, tBase - 145);
    c.moveTo(tX, tBase - 110); c.quadraticCurveTo(tX + 35, tBase - 140, tX + 60, tBase - 160);
    c.moveTo(tX, tBase - 125); c.quadraticCurveTo(tX - 10, tBase - 170, tX - 15, tBase - 195);
    c.stroke();
    // blossom clusters (multiple circles)
    const blossoms = [
      [tX - 60, tBase - 150, 35], [tX - 35, tBase - 175, 32], [tX - 10, tBase - 195, 36],
      [tX + 20, tBase - 180, 33], [tX + 50, tBase - 165, 30], [tX + 70, tBase - 145, 28],
      [tX - 40, tBase - 130, 30], [tX + 10, tBase - 145, 32], [tX - 70, tBase - 120, 26],
    ];
    blossoms.forEach(([x, y, r]) => {
      c.fillStyle = "#f6c2cf";
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#c97a8e"; c.lineWidth = 2; c.stroke();
      // inner highlight
      c.fillStyle = "#fde0e7";
      c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2); c.fill();
    });

    // little arched bridge over the water (mid-left to mid)
    const bX0 = sw * 0.34, bX1 = sw * 0.56, bY = sh * 0.74;
    c.fillStyle = "#b8865c";
    c.beginPath();
    c.moveTo(bX0, bY);
    c.quadraticCurveTo((bX0 + bX1) / 2, bY - 28, bX1, bY);
    c.lineTo(bX1, bY + 6);
    c.quadraticCurveTo((bX0 + bX1) / 2, bY - 20, bX0, bY + 6);
    c.closePath();
    c.fill();
    c.strokeStyle = "#5a3a25"; c.lineWidth = 2; c.stroke();
    // bridge rails (posts)
    c.lineWidth = 2;
    [0.25, 0.5, 0.75].forEach((t) => {
      const px = bX0 + (bX1 - bX0) * t;
      const py = bY - Math.sin(t * Math.PI) * 28 + 4;
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px, py + 14);
      c.stroke();
    });

    // boat with sail on water
    const boatX = sw * 0.42, boatY = sh * 0.88;
    c.fillStyle = "#8b6f5b";
    c.beginPath();
    c.moveTo(boatX - 32, boatY);
    c.quadraticCurveTo(boatX, boatY + 18, boatX + 32, boatY);
    c.lineTo(boatX + 28, boatY - 6);
    c.lineTo(boatX - 28, boatY - 6);
    c.closePath();
    c.fill();
    c.strokeStyle = "#3a2418"; c.lineWidth = 2; c.stroke();
    // mast
    c.beginPath();
    c.moveTo(boatX, boatY - 6); c.lineTo(boatX, boatY - 60);
    c.stroke();
    // sail (triangle)
    c.fillStyle = "#f5ecd9";
    c.beginPath();
    c.moveTo(boatX, boatY - 60);
    c.lineTo(boatX + 28, boatY - 8);
    c.lineTo(boatX, boatY - 8);
    c.closePath();
    c.fill();
    c.strokeStyle = "#7a4a2b"; c.lineWidth = 2; c.stroke();

    // lotus flowers on water
    function drawLotus(x, y, r) {
      // leaf pad
      c.fillStyle = "#6ea863";
      c.beginPath(); c.arc(x, y, r * 1.6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#3a5a30"; c.lineWidth = 1.5; c.stroke();
      // pad slit
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + r * 1.5, y); c.stroke();
      // petals
      c.fillStyle = "#f8c8d8";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const px = x + Math.cos(a) * r * 0.4;
        const py = y + Math.sin(a) * r * 0.4 - r * 0.2;
        c.beginPath();
        c.ellipse(px, py, r * 0.45, r * 0.8, a + Math.PI / 2, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#c97a8e"; c.lineWidth = 1.2; c.stroke();
      }
      // center
      c.fillStyle = "#f4d680";
      c.beginPath(); c.arc(x, y - r * 0.2, r * 0.25, 0, Math.PI * 2); c.fill();
    }
    drawLotus(sw * 0.08, sh * 0.86, 14);
    drawLotus(sw * 0.88, sh * 0.83, 16);
    drawLotus(sw * 0.62, sh * 0.92, 12);
    drawLotus(sw * 0.18, sh * 0.95, 13);

    // clouds
    function drawCloud(cx, cy, scale) {
      c.fillStyle = "#ffffff";
      c.strokeStyle = "#c0c8d6";
      c.lineWidth = 1.5;
      const parts = [[0, 0, 22], [22, -6, 18], [38, 0, 22], [16, 8, 18]];
      c.beginPath();
      parts.forEach(([dx, dy, r], i) => {
        c.moveTo(cx + (dx + r) * scale, cy + dy * scale);
        c.arc(cx + dx * scale, cy + dy * scale, r * scale, 0, Math.PI * 2);
      });
      c.fill(); c.stroke();
    }
    drawCloud(sw * 0.10, sh * 0.10, 1.0);
    drawCloud(sw * 0.38, sh * 0.07, 0.75);
    drawCloud(sw * 0.55, sh * 0.16, 0.85);

    // birds (small "V" shapes)
    c.strokeStyle = "#3a3027"; c.lineWidth = 2; c.lineCap = "round";
    function bird(x, y, s) {
      c.beginPath();
      c.moveTo(x - 8 * s, y); c.quadraticCurveTo(x - 4 * s, y - 6 * s, x, y);
      c.quadraticCurveTo(x + 4 * s, y - 6 * s, x + 8 * s, y);
      c.stroke();
    }
    bird(sw * 0.45, sh * 0.18, 1.2);
    bird(sw * 0.50, sh * 0.14, 1.0);
    bird(sw * 0.54, sh * 0.20, 0.9);
    bird(sw * 0.36, sh * 0.22, 0.8);

    const img = new Image();
    img.onload = () => setupCanvasFromImage(img);
    img.src = oc.toDataURL();
  }

  // ---------- canvas setup ----------
  function setupCanvasFromImage(img) {
    state.sourceImage = img;
    state.blankCanvas = false;
    _blankRegionCache = null;
    // fit canvas to stage with max dimension
    const maxDim = 1100;
    const stageBox = els.stage.getBoundingClientRect();
    const availW = Math.min(stageBox.width - 40, maxDim);
    const availH = Math.min(stageBox.height - 40, maxDim);
    const ratio = img.width / img.height;
    let w = availW, h = availW / ratio;
    if (h > availH) { h = availH; w = h * ratio; }
    w = Math.floor(w); h = Math.floor(h);

    state.canvasW = w; state.canvasH = h;
    [els.paintCanvas, els.outlineCanvas, els.fxCanvas].forEach((cv) => {
      cv.width = w; cv.height = h;
    });
    els.canvasWrap.style.width = w + "px";
    els.canvasWrap.style.height = h + "px";

    // paint layer starts as paper-white
    paintCtx.fillStyle = "#fefcf8";
    paintCtx.fillRect(0, 0, w, h);

    generateOutline();

    showCanvasArea();
    updateBristleColor();
    toast("Outline ready. Pick a color and start.");
  }

  // Blank canvas: no source image, no outline. Manual painting works
  // anywhere (the edge mask is all-zero so the whole surface is one region).
  // Zen mode is skipped — there are no sub-regions to fill.
  function loadBlankCanvas() {
    const maxDim = 1200;
    const stageBox = els.stage.getBoundingClientRect();
    const availW = Math.min(stageBox.width - 40, maxDim);
    const availH = Math.min(stageBox.height - 40, maxDim);
    // default to a 4:3 surface that fits the stage
    const ratio = 4 / 3;
    let w, h;
    if (availW / availH > ratio) { h = availH; w = h * ratio; }
    else { w = availW; h = w / ratio; }
    w = Math.floor(w); h = Math.floor(h);

    state.canvasW = w;
    state.canvasH = h;
    state.sourceImage = null;
    state.blankCanvas = true;
    _blankRegionCache = null;

    [els.paintCanvas, els.outlineCanvas, els.fxCanvas].forEach((cv) => {
      cv.width = w; cv.height = h;
    });
    els.canvasWrap.style.width = w + "px";
    els.canvasWrap.style.height = h + "px";

    paintCtx.fillStyle = "#fefcf8";
    paintCtx.fillRect(0, 0, w, h);
    outlineCtx.clearRect(0, 0, w, h);

    // all-zero edge mask → no walls, whole canvas is one region
    state.edgeMask = new Uint8Array(w * h);

    showCanvasArea();
    updateBristleColor();
    toast("Blank canvas ready. Pick a color and paint.");
  }

  // shared cleanup when revealing the canvas area (used by image + blank flows)
  function showCanvasArea() {
    if (state.mode === "abstract") {
      // user had abstract on but is now switching to a paint surface
      if (window.ColormeFluid) window.ColormeFluid.stop();
      state.mode = "manual";
      $$(".mode-btn").forEach((x) => x.classList.toggle("active", x.dataset.mode === "manual"));
      els.zenControls.classList.add("hidden");
      applyModeClass();
    }
    els.fluidCanvas.classList.add("hidden");
    els.welcome.classList.add("hidden");
    els.canvasWrap.classList.remove("hidden");
    els.canvasWrap.classList.add("ready");
    // a new canvas means the previous history doesn't apply anymore
    resetHistory();
  }

  // cached "everything is open" region for blank canvas — avoids running
  // a 1M-pixel flood fill on every pointer click.
  let _blankRegionCache = null;
  function getBlankRegion() {
    const w = state.canvasW, h = state.canvasH;
    if (!_blankRegionCache || _blankRegionCache.w !== w || _blankRegionCache.h !== h) {
      const mask = new Uint8Array(w * h);
      mask.fill(1);
      _blankRegionCache = {
        w, h,
        reg: {
          region: mask,
          area: w * h,
          bbox: { x0: 0, y0: 0, x1: w - 1, y1: h - 1 },
          centroid: { x: w / 2, y: h / 2 },
        },
      };
    }
    return _blankRegionCache.reg;
  }

  // ---------- outline generation ----------
  function generateOutline() {
    if (!state.sourceImage) return;
    const w = state.canvasW, h = state.canvasH;

    // draw source into hidden canvas
    const src = document.createElement("canvas");
    src.width = w; src.height = h;
    const sctx = src.getContext("2d");
    sctx.drawImage(state.sourceImage, 0, 0, w, h);
    const img = sctx.getImageData(0, 0, w, h);
    const data = img.data;

    // grayscale
    const gray = new Float32Array(w * h);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // small box blur to denoise
    const blurred = boxBlur(gray, w, h, 1);

    // Sobel edges
    const edges = new Float32Array(w * h);
    let maxE = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx =
          -blurred[i - w - 1] - 2 * blurred[i - 1] - blurred[i + w - 1] +
          blurred[i - w + 1] + 2 * blurred[i + 1] + blurred[i + w + 1];
        const gy =
          -blurred[i - w - 1] - 2 * blurred[i - w] - blurred[i - w + 1] +
          blurred[i + w - 1] + 2 * blurred[i + w] + blurred[i + w + 1];
        const m = Math.sqrt(gx * gx + gy * gy);
        edges[i] = m;
        if (m > maxE) maxE = m;
      }
    }

    // detail slider tunes the threshold (lower threshold = more lines)
    const tFrac = 0.42 - state.detail * 0.05; // detail 1..5 → 0.37..0.17
    const threshold = maxE * Math.max(0.05, tFrac);

    // build edge mask + a visual outline image
    const out = outlineCtx.createImageData(w, h);
    const outData = out.data;
    const mask = new Uint8Array(w * h);

    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
      const isEdge = edges[i] > threshold;
      mask[i] = isEdge ? 1 : 0;
      // transparent everywhere except edges (so paint shows underneath)
      outData[p] = 60; outData[p + 1] = 48; outData[p + 2] = 38;
      outData[p + 3] = isEdge ? 255 : 0;
    }

    // dilate to give line weight
    let finalMask = mask;
    for (let i = 1; i < state.weight; i++) {
      finalMask = dilate(finalMask, w, h);
    }

    // morphological CLOSING — dilate N times then erode N times. Bridges
    // small gaps in the outline so flood fill / region detection doesn't
    // leak across thin breaks. Lines stay roughly the same thickness.
    const close = state.closeGaps | 0;
    for (let i = 0; i < close; i++) finalMask = dilate(finalMask, w, h);
    for (let i = 0; i < close; i++) finalMask = erode(finalMask, w, h);

    // rewrite outline alpha to match the final mask (so the visible line
    // exactly matches the boundary used for region detection — no slivers)
    for (let i = 0, p = 0; i < finalMask.length; i++, p += 4) {
      outData[p + 3] = finalMask[i] ? 235 : 0;
    }

    state.edgeMask = finalMask;
    outlineCtx.clearRect(0, 0, w, h);
    outlineCtx.putImageData(out, 0, 0);

    // clear any existing paint
    paintCtx.fillStyle = "#fefcf8";
    paintCtx.fillRect(0, 0, w, h);
  }

  function boxBlur(src, w, h, radius) {
    const out = new Float32Array(src.length);
    const size = 2 * radius + 1;
    // horizontal
    const tmp = new Float32Array(src.length);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += src[y * w + Math.max(0, Math.min(w - 1, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum / size;
        const xAdd = Math.min(w - 1, x + radius + 1);
        const xSub = Math.max(0, x - radius);
        sum += src[y * w + xAdd] - src[y * w + xSub];
      }
    }
    // vertical
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / size;
        const yAdd = Math.min(h - 1, y + radius + 1);
        const ySub = Math.max(0, y - radius);
        sum += tmp[yAdd * w + x] - tmp[ySub * w + x];
      }
    }
    return out;
  }

  function dilate(mask, w, h) {
    const out = new Uint8Array(mask.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (mask[i]) { out[i] = 1; continue; }
        if ((x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) ||
            (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w])) {
          out[i] = 1;
        }
      }
    }
    return out;
  }

  function erode(mask, w, h) {
    const out = new Uint8Array(mask.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        // pixel survives only if all 4-neighbors are also set (and not at edge)
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) continue;
        if (mask[i - 1] && mask[i + 1] && mask[i - w] && mask[i + w]) out[i] = 1;
      }
    }
    return out;
  }

  // ---------- flood fill bounded by edges ----------
  // returns { region: Uint8Array, bbox: {x0,y0,x1,y1}, area: int, centroid: {x,y} }
  function findRegion(sx, sy) {
    const w = state.canvasW, h = state.canvasH;
    if (!state.edgeMask || sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
    const mask = state.edgeMask;
    const region = new Uint8Array(w * h);
    const stack = [sx, sy];
    let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0, cx = 0, cy = 0;

    while (stack.length) {
      const y = stack.pop();
      let x = stack.pop();
      let lx = x;
      while (lx >= 0 && !mask[y * w + lx] && !region[y * w + lx]) lx--;
      lx++;
      let spanUp = false, spanDown = false;
      while (lx < w && !mask[y * w + lx] && !region[y * w + lx]) {
        region[y * w + lx] = 1;
        area++; cx += lx; cy += y;
        if (lx < x0) x0 = lx;
        if (lx > x1) x1 = lx;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;

        if (y > 0) {
          const above = !mask[(y - 1) * w + lx] && !region[(y - 1) * w + lx];
          if (above && !spanUp) { stack.push(lx, y - 1); spanUp = true; }
          else if (!above && spanUp) spanUp = false;
        }
        if (y < h - 1) {
          const below = !mask[(y + 1) * w + lx] && !region[(y + 1) * w + lx];
          if (below && !spanDown) { stack.push(lx, y + 1); spanDown = true; }
          else if (!below && spanDown) spanDown = false;
        }
        lx++;
      }
    }

    if (area === 0) return null;
    return {
      region, area,
      bbox: { x0, y0, x1, y1 },
      centroid: { x: cx / area, y: cy / area },
    };
  }

  // ---------- brush params ----------
  // Each brush has its own dab renderer further below — these are just the
  // size, spacing along strokes, and a flag for sound throttling.
  const BRUSH_PARAMS = {
    pencil:     { radius:  5, spacing: 0.32 },
    crayon:     { radius: 11, spacing: 0.26 },
    watercolor: { radius: 18, spacing: 0.36 },
    acrylic:    { radius: 13, spacing: 0.32 },
    oil:        { radius: 13, spacing: 0.30 },
    marker:     { radius:  9, spacing: 0.22 },
    eraser:     { radius: 14, spacing: 0.22 },
  };
  const PAPER_RGB = { r: 0xfe, g: 0xfc, b: 0xf8 };  // matches the canvas fill

  function clamp(v) { return Math.max(0, Math.min(255, v)); }

  // ---------- paper grain (deterministic noise tile, same pattern every dab) ----------
  // A 256x256 random tile that tiles seamlessly across the canvas. Lookup is
  // O(1), so we can sample per pixel without hurting perf.
  const NOISE_SIZE = 256;
  const noiseTile = (() => {
    const t = new Float32Array(NOISE_SIZE * NOISE_SIZE);
    for (let i = 0; i < t.length; i++) t[i] = Math.random();
    return t;
  })();
  function paperGrain(x, y) {
    const ix = ((x | 0) % NOISE_SIZE + NOISE_SIZE) % NOISE_SIZE;
    const iy = ((y | 0) % NOISE_SIZE + NOISE_SIZE) % NOISE_SIZE;
    return noiseTile[iy * NOISE_SIZE + ix];
  }

  // ---------- dab helpers ----------
  function _dabBegin(cx, cy, r) {
    const w = state.canvasW, h = state.canvasH;
    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1));
    const x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
    const y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
    const dw = x1 - x0 + 1, dh = y1 - y0 + 1;
    if (dw <= 0 || dh <= 0) return null;
    return { id: paintCtx.getImageData(x0, y0, dw, dh), x0, y0, dw, dh, w };
  }
  function _dabEnd(c) { paintCtx.putImageData(c.id, c.x0, c.y0); }

  function _blend(px, pi, r, g, b, a) {
    px[pi]     = px[pi]     * (1 - a) + r * a;
    px[pi + 1] = px[pi + 1] * (1 - a) + g * a;
    px[pi + 2] = px[pi + 2] * (1 - a) + b * a;
    px[pi + 3] = 255;
  }

  // ---------- per-brush dab renderers ----------

  // PENCIL — scratchy graphite. Sparse coverage, desaturated color, paper grain
  // very visible. Builds up only with many overlapping strokes.
  function dabPencil(cx, cy, color, r, regionMask) {
    const c = _dabBegin(cx, cy, r);
    if (!c) return;
    const { id, x0, y0, dw, dh, w } = c;
    const px = id.data;
    const rgb = hexToRgb(color);
    const lum = (rgb.r + rgb.g + rgb.b) / 3;
    // desaturate ~60% toward gray — that's the graphite look
    const cr = rgb.r * 0.45 + lum * 0.2;
    const cg = rgb.g * 0.45 + lum * 0.2;
    const cb = rgb.b * 0.45 + lum * 0.2;
    const r2 = r * r;
    for (let y = 0; y < dh; y++) {
      const gy = y + y0;
      for (let x = 0; x < dw; x++) {
        const gx = x + x0;
        if (!regionMask[gy * w + gx]) continue;
        const dx = gx + 0.5 - cx, dy = gy + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const fall = 1 - Math.sqrt(d2) / r;
        // paper grain — sparse, denser near center
        const density = fall * fall * 0.85;
        if (paperGrain(gx, gy) > density) continue;
        const a = 0.32 + paperGrain(gx + 17, gy + 31) * 0.30;
        _blend(px, (y * dw + x) * 4, cr, cg, cb, a);
      }
    }
    _dabEnd(c);
  }

  // CRAYON — waxy chunks of pigment partially deposited on paper. Strong
  // paper-grain mask, full color, color jitter for granularity.
  function dabCrayon(cx, cy, color, r, regionMask) {
    const c = _dabBegin(cx, cy, r);
    if (!c) return;
    const { id, x0, y0, dw, dh, w } = c;
    const px = id.data;
    const rgb = hexToRgb(color);
    const r2 = r * r;
    for (let y = 0; y < dh; y++) {
      const gy = y + y0;
      for (let x = 0; x < dw; x++) {
        const gx = x + x0;
        if (!regionMask[gy * w + gx]) continue;
        const dx = gx + 0.5 - cx, dy = gy + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const fall = 1 - Math.sqrt(d2) / r;
        // strong paper grain — skip the "high points" of the paper
        if (paperGrain(gx, gy) < 0.32) continue;
        const a = 0.55 * fall * (0.7 + paperGrain(gx + 7, gy + 11) * 0.5);
        if (a < 0.02) continue;
        // pigment unevenness — random color jitter per pixel
        const j = (Math.random() - 0.5) * 32;
        _blend(px, (y * dw + x) * 4,
          clamp(rgb.r + j), clamp(rgb.g + j), clamp(rgb.b + j), a);
      }
    }
    _dabEnd(c);
  }

  // WATERCOLOR — transparent wash with a darker rim where water pools at the
  // edge of the brushstroke. Very low opacity → builds up gently when layered.
  function dabWatercolor(cx, cy, color, r, regionMask) {
    const c = _dabBegin(cx, cy, r);
    if (!c) return;
    const { id, x0, y0, dw, dh, w } = c;
    const px = id.data;
    const rgb = hexToRgb(color);
    const r2 = r * r;
    for (let y = 0; y < dh; y++) {
      const gy = y + y0;
      for (let x = 0; x < dw; x++) {
        const gx = x + x0;
        if (!regionMask[gy * w + gx]) continue;
        const dx = gx + 0.5 - cx, dy = gy + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const dist = Math.sqrt(d2);
        const fall = 1 - dist / r;
        // base wash: low alpha with soft falloff
        let a = 0.16 * Math.pow(fall, 1.3);
        // rim darken at outer 20% — that's the pooling effect
        if (fall < 0.22 && fall > 0.03) a *= 2.1;
        // slight paper-grain variation
        a *= 0.75 + paperGrain(gx + 3, gy + 5) * 0.5;
        if (a < 0.01) continue;
        _blend(px, (y * dw + x) * 4, rgb.r, rgb.g, rgb.b, a);
      }
    }
    _dabEnd(c);
  }

  // ACRYLIC — thick opaque paint with visible bristle streaks across the dab
  // and a slight specular highlight on the upper-left, like wet thick paint.
  function dabAcrylic(cx, cy, color, r, regionMask) {
    const c = _dabBegin(cx, cy, r);
    if (!c) return;
    const { id, x0, y0, dw, dh, w } = c;
    const px = id.data;
    const rgb = hexToRgb(color);
    const r2 = r * r;
    // bristle direction varies per dab so streaks aren't all aligned
    const streakAng = Math.random() * Math.PI;
    const sa = Math.sin(streakAng), ca = Math.cos(streakAng);
    for (let y = 0; y < dh; y++) {
      const gy = y + y0;
      for (let x = 0; x < dw; x++) {
        const gx = x + x0;
        if (!regionMask[gy * w + gx]) continue;
        const dx = gx + 0.5 - cx, dy = gy + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const fall = 1 - Math.sqrt(d2) / r;
        let a = 0.78 * Math.pow(fall, 0.45);          // near-opaque, soft edge
        if (a < 0.01) continue;
        // bristle bands: brightness modulated by perpendicular distance
        const perp = dx * sa - dy * ca;
        const band = Math.sin(perp * 1.6) * 0.5 + 0.5;
        const mul = 0.85 + band * 0.32;                // 0.85 .. 1.17
        let cr = rgb.r * mul, cg = rgb.g * mul, cb = rgb.b * mul;
        // gentle upper-left highlight (thick wet paint catching light)
        const hl = -dx * 0.45 - dy * 0.6;
        if (hl > 0) {
          const k = Math.min(0.22, (hl / r) * 0.22);
          cr += 255 * k; cg += 255 * k; cb += 255 * k;
        }
        _blend(px, (y * dw + x) * 4, clamp(cr), clamp(cg), clamp(cb), a);
      }
    }
    _dabEnd(c);
  }

  // OIL — buttery, swirly pigment with visible color streaks ranging from
  // darker to lighter shades, like paint pushed around with a palette knife.
  function dabOil(cx, cy, color, r, regionMask) {
    const c = _dabBegin(cx, cy, r);
    if (!c) return;
    const { id, x0, y0, dw, dh, w } = c;
    const px = id.data;
    const rgb = hexToRgb(color);
    const r2 = r * r;
    const swirl = Math.random() * Math.PI * 2;
    const swirlOff = Math.random() * 3;
    for (let y = 0; y < dh; y++) {
      const gy = y + y0;
      for (let x = 0; x < dw; x++) {
        const gx = x + x0;
        if (!regionMask[gy * w + gx]) continue;
        const dx = gx + 0.5 - cx, dy = gy + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const dist = Math.sqrt(d2);
        const fall = 1 - dist / r;
        let a = 0.70 * Math.pow(fall, 0.55);
        if (a < 0.01) continue;
        // swirling shade variation — concentric curving bands
        const ang = Math.atan2(dy, dx) + swirl + dist * 0.08;
        const swirlMix = (Math.sin(ang * 3 + dist * 0.4 + swirlOff) + 1) * 0.5;
        // blend among dark/mid/light tones
        const mul = 0.65 + swirlMix * 0.55;
        _blend(px, (y * dw + x) * 4,
          clamp(rgb.r * mul), clamp(rgb.g * mul), clamp(rgb.b * mul), a);
      }
    }
    _dabEnd(c);
  }

  // MARKER — flat opaque color with a hard edge and tiny rim darkening
  // (where the felt tip releases extra ink at the boundary).
  function dabMarker(cx, cy, color, r, regionMask) {
    const c = _dabBegin(cx, cy, r);
    if (!c) return;
    const { id, x0, y0, dw, dh, w } = c;
    const px = id.data;
    const rgb = hexToRgb(color);
    const r2 = r * r;
    const innerR = r * 0.85;
    for (let y = 0; y < dh; y++) {
      const gy = y + y0;
      for (let x = 0; x < dw; x++) {
        const gx = x + x0;
        if (!regionMask[gy * w + gx]) continue;
        const dx = gx + 0.5 - cx, dy = gy + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const dist = Math.sqrt(d2);
        let a;
        if (dist < innerR) a = 0.50;
        else if (dist < r * 0.97) a = 0.60;            // tiny rim accumulation
        else a = 0.50 * (1 - (dist - r * 0.97) / (r * 0.03));
        _blend(px, (y * dw + x) * 4, rgb.r, rgb.g, rgb.b, a);
      }
    }
    _dabEnd(c);
  }

  // ERASER — soft circular wipe back to paper color.
  function dabEraser(cx, cy, r, regionMask) {
    const c = _dabBegin(cx, cy, r);
    if (!c) return;
    const { id, x0, y0, dw, dh, w } = c;
    const px = id.data;
    const r2 = r * r;
    for (let y = 0; y < dh; y++) {
      const gy = y + y0;
      for (let x = 0; x < dw; x++) {
        const gx = x + x0;
        if (!regionMask[gy * w + gx]) continue;
        const dx = gx + 0.5 - cx, dy = gy + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const fall = 1 - Math.sqrt(d2) / r;
        const a = 0.85 * Math.pow(fall, 0.6);
        if (a < 0.01) continue;
        _blend(px, (y * dw + x) * 4, PAPER_RGB.r, PAPER_RGB.g, PAPER_RGB.b, a);
      }
    }
    _dabEnd(c);
  }

  // ---------- dispatcher ----------
  function brushDab(cx, cy, color, brush, regionMask, radiusOverride) {
    const p = BRUSH_PARAMS[brush];
    if (!p) return;
    // override (from zen plan) is taken as-is — caller already factored size in.
    // No override (manual drag) → base radius scaled by current size selector.
    const r = (radiusOverride != null)
      ? radiusOverride
      : p.radius * (state.brushSize || 1);
    if (r < 0.5) return;
    switch (brush) {
      case "pencil":     return dabPencil(cx, cy, color, r, regionMask);
      case "crayon":     return dabCrayon(cx, cy, color, r, regionMask);
      case "watercolor": return dabWatercolor(cx, cy, color, r, regionMask);
      case "acrylic":    return dabAcrylic(cx, cy, color, r, regionMask);
      case "oil":        return dabOil(cx, cy, color, r, regionMask);
      case "marker":     return dabMarker(cx, cy, color, r, regionMask);
      case "eraser":     return dabEraser(cx, cy, r, regionMask);
    }
  }

  // ---------- principal axis of a region (PCA on sampled pixels) ----------
  // Returns the angle (radians) of the region's longest direction plus centroid.
  function principalAxis(reg) {
    const w = state.canvasW;
    const { region, bbox } = reg;
    const stride = Math.max(2, Math.floor(Math.sqrt((bbox.x1 - bbox.x0 + 1) * (bbox.y1 - bbox.y0 + 1)) / 40));
    let n = 0, mx = 0, my = 0;
    const pts = [];
    for (let y = bbox.y0; y <= bbox.y1; y += stride) {
      for (let x = bbox.x0; x <= bbox.x1; x += stride) {
        if (region[y * w + x]) { pts.push(x, y); mx += x; my += y; n++; }
      }
    }
    if (n < 4) return { angle: 0, cx: reg.centroid.x, cy: reg.centroid.y, ratio: 1 };
    mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const dx = pts[i] - mx, dy = pts[i + 1] - my;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    sxx /= n; syy /= n; sxy /= n;
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    // eigenvalues — used to decide if region is "round" (axes similar)
    const tr = sxx + syy;
    const det = sxx * syy - sxy * sxy;
    const dsc = Math.max(0, tr * tr / 4 - det);
    const l1 = tr / 2 + Math.sqrt(dsc);
    const l2 = tr / 2 - Math.sqrt(dsc);
    const ratio = l2 > 0 ? l1 / l2 : 10;
    return { angle, cx: mx, cy: my, ratio };
  }

  // ---------- gestural stroke planning ----------
  //
  // The key idea: a real artist doesn't fill a region with parallel rows of
  // strokes (that's a 3D-printer infill pattern). They scatter individual
  // brush strokes one at a time. Each stroke has its own start, direction,
  // length and curve. The region fills up as strokes accumulate, with the
  // artist instinctively going to spots that still need paint.
  //
  // We model this by:
  //   - Classifying the region by shape (tiny / elongated / round)
  //   - Walking a coverage grid so we add strokes until we're "mostly done"
  //   - Each stroke is built by makeCurvingStroke — a random-walk style path
  //     that accumulates small angle changes (so it bends naturally instead
  //     of being a straight line)
  //   - Strokes get sorted by proximity so the hand doesn't teleport between
  //     opposite ends of the region

  // build one curving stroke from (sx,sy), in a base direction, for a length.
  // angle drifts via accumulated sinusoidal + tiny random noise => natural arc.
  function makeCurvingStroke(sx, sy, baseAngle, length, stepDist) {
    const stroke = [{ x: Math.round(sx), y: Math.round(sy) }];
    let x = sx, y = sy;
    let angle = baseAngle;
    let dist = 0;
    const phase = Math.random() * Math.PI * 2;
    const freq = 0.012 + Math.random() * 0.018;
    const amp = 0.025 + Math.random() * 0.05;            // radians per step
    const drift = (Math.random() - 0.5) * 0.0015;        // very slow overall bend
    while (dist < length) {
      angle += Math.sin(dist * freq + phase) * amp + drift;
      x += Math.cos(angle) * stepDist;
      y += Math.sin(angle) * stepDist;
      dist += stepDist;
      stroke.push({ x: Math.round(x), y: Math.round(y) });
    }
    return stroke;
  }

  // a tiny region — 1 to 3 small gestural marks through the center
  function planTinyRegion(reg, effRadius, axis) {
    const cx = reg.centroid.x, cy = reg.centroid.y;
    const r = Math.sqrt(reg.area / Math.PI);
    const n = 1 + Math.floor(Math.random() * 2);
    const strokes = [];
    for (let i = 0; i < n; i++) {
      const ang = (axis.ratio > 1.6 ? axis.angle : Math.random() * Math.PI)
                + (Math.random() - 0.5) * 0.6;
      const len = r * (1.6 + Math.random() * 0.8);
      const stepDist = Math.max(2, effRadius * 0.34);
      const sx = cx - Math.cos(ang) * len * 0.5;
      const sy = cy - Math.sin(ang) * len * 0.5;
      strokes.push(makeCurvingStroke(sx, sy, ang, len, stepDist));
    }
    return strokes;
  }

  // scatter curving strokes until the region is covered. This is the heart
  // of the natural look — strokes go in many different directions with many
  // different lengths and curves.
  function planScatteredStrokes(reg, effRadius, axis) {
    const w = state.canvasW, h = state.canvasH;
    const { region, bbox } = reg;
    const elongated = axis.ratio > 2.0;

    // ---- coverage grid (downsampled to one cell per ~brush radius) ----
    const cellSize = Math.max(3, Math.floor(effRadius * 0.85));
    const gw = Math.ceil((bbox.x1 - bbox.x0 + 1) / cellSize) + 1;
    const gh = Math.ceil((bbox.y1 - bbox.y0 + 1) / cellSize) + 1;
    // 0 = uncovered (inside region), 2 = outside region, >0.5 = covered
    const cov = new Float32Array(gw * gh);
    let inRegion = 0;
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const cx = bbox.x0 + gx * cellSize + cellSize / 2;
        const cy = bbox.y0 + gy * cellSize + cellSize / 2;
        const xi = Math.floor(cx), yi = Math.floor(cy);
        if (xi >= 0 && yi >= 0 && xi < w && yi < h && region[yi * w + xi]) inRegion++;
        else cov[gy * gw + gx] = 2;
      }
    }
    if (inRegion === 0) return [];

    const r_cells = Math.max(1, Math.ceil(effRadius / cellSize));
    function recordStroke(stroke) {
      for (let k = 0; k < stroke.length; k++) {
        const gx = Math.floor((stroke[k].x - bbox.x0) / cellSize);
        const gy = Math.floor((stroke[k].y - bbox.y0) / cellSize);
        for (let dy = -r_cells; dy <= r_cells; dy++) {
          for (let dx = -r_cells; dx <= r_cells; dx++) {
            if (dx * dx + dy * dy > r_cells * r_cells) continue;
            const tx = gx + dx, ty = gy + dy;
            if (tx < 0 || ty < 0 || tx >= gw || ty >= gh) continue;
            const i = ty * gw + tx;
            if (cov[i] < 2) cov[i] = Math.min(1.3, cov[i] + 0.6);
          }
        }
      }
    }

    function coveragePct() {
      let c = 0;
      for (let i = 0; i < cov.length; i++) if (cov[i] !== 2 && cov[i] >= 0.5) c++;
      return c / inRegion;
    }

    function pickStart() {
      // gather the uncovered cells; pick one at random (NOT a deterministic scan
      // order — that's what would re-create raster patterns).
      const candidates = [];
      for (let i = 0; i < cov.length; i++) {
        if (cov[i] < 0.4) candidates.push(i);
      }
      if (!candidates.length) return null;
      const i = candidates[Math.floor(Math.random() * candidates.length)];
      const gx = i % gw, gy = Math.floor(i / gw);
      return {
        x: bbox.x0 + gx * cellSize + cellSize / 2 + (Math.random() - 0.5) * cellSize,
        y: bbox.y0 + gy * cellSize + cellSize / 2 + (Math.random() - 0.5) * cellSize,
      };
    }

    const strokes = [];
    const maxStrokes = Math.min(45, Math.max(4, Math.ceil(reg.area / 700)));
    const targetCoverage = 0.92;
    const stepDist = Math.max(2, effRadius * 0.32);
    const longSide = Math.hypot(bbox.x1 - bbox.x0, bbox.y1 - bbox.y0);

    for (let i = 0; i < maxStrokes; i++) {
      if (coveragePct() >= targetCoverage) break;
      const start = pickStart();
      if (!start) break;

      // direction — elongated regions favor the long axis (small jitter);
      // round/blob regions get fully scattered directions (cross-hatch feel).
      const baseAngle = elongated
        ? axis.angle + (Math.random() - 0.5) * 0.7
        : axis.angle + (Math.random() - 0.5) * Math.PI;

      // varied length: bias toward medium with a tail of long sweeps
      // (square-of-random gives a nice distribution: many short, a few long)
      const lengthFrac = 0.35 + Math.pow(Math.random(), 1.6) * 1.6;
      const length = Math.min(longSide * 1.1, Math.sqrt(reg.area) * lengthFrac);

      // sometimes the stroke starts at the pick point and goes forward;
      // sometimes the pick point is the middle of the stroke.
      const startOffset = Math.random() < 0.5 ? 0 : length * (0.2 + Math.random() * 0.4);
      const sx = start.x - Math.cos(baseAngle) * startOffset;
      const sy = start.y - Math.sin(baseAngle) * startOffset;

      const stroke = makeCurvingStroke(sx, sy, baseAngle, length, stepDist);
      if (stroke.length < 3) continue;
      recordStroke(stroke);
      strokes.push(stroke);
    }

    return strokes;
  }

  // sort strokes greedily by proximity so the hand glides from one to the next
  // instead of teleporting across the region. Reverse a stroke if its end is
  // closer than its start.
  function sortStrokesByProximity(strokes) {
    if (strokes.length < 2) return strokes;
    const remaining = strokes.slice();
    const sorted = [remaining.shift()];
    while (remaining.length) {
      const ref = sorted[sorted.length - 1];
      const refEnd = ref[ref.length - 1];
      let bestIdx = 0, bestDist = Infinity, bestReverse = false;
      for (let i = 0; i < remaining.length; i++) {
        const s = remaining[i];
        const dStart = (s[0].x - refEnd.x) ** 2 + (s[0].y - refEnd.y) ** 2;
        const dEnd = (s[s.length - 1].x - refEnd.x) ** 2 + (s[s.length - 1].y - refEnd.y) ** 2;
        if (dStart < bestDist) { bestDist = dStart; bestIdx = i; bestReverse = false; }
        if (dEnd < bestDist) { bestDist = dEnd; bestIdx = i; bestReverse = true; }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      sorted.push(bestReverse ? next.slice().reverse() : next);
    }
    return sorted;
  }

  function planStrokes(reg, brush) {
    const p = BRUSH_PARAMS[brush];
    const sizeScale = Math.min(2.2, Math.max(1, Math.sqrt(reg.area) / 90));
    const effRadius = p.radius * sizeScale * (state.brushSize || 1);
    const axis = principalAxis(reg);

    let strokes;
    if (reg.area < 700) {
      strokes = planTinyRegion(reg, effRadius, axis);
    } else {
      strokes = planScatteredStrokes(reg, effRadius, axis);
    }
    strokes = sortStrokesByProximity(strokes);

    if (!strokes.length) {
      const cx0 = Math.round(reg.centroid.x);
      const cy0 = Math.round(reg.centroid.y);
      strokes = [[{ x: cx0 - 2, y: cy0 }, { x: cx0 + 2, y: cy0 }]];
    }
    strokes._effRadius = effRadius;
    return strokes;
  }

  // ---------- animate a single stroke (hand glides, dabs along the way) ----------
  function animateStroke(stroke, color, brush, regionMask, speedMul = 1, radius) {
    return new Promise((resolve) => {
      const p = BRUSH_PARAMS[brush];
      const r = radius || p.radius;
      const dabSpacing = Math.max(1.5, r * p.spacing);
      const msPerPixel = 4.2 * speedMul;
      // cap duration so very long strokes still complete in reasonable time
      const duration = Math.max(160, Math.min(1600, pathLength(stroke) * msPerPixel));
      const start = performance.now();

      audio.stroke(brush);
      let extraSoundAt = duration * 0.55;

      brushDab(stroke[0].x, stroke[0].y, color, brush, regionMask, r);
      let lastDabX = stroke[0].x, lastDabY = stroke[0].y;
      let rafHandle = 0;
      let watchdog = 0;

      function done() {
        if (rafHandle) cancelAnimationFrame(rafHandle);
        if (watchdog) clearTimeout(watchdog);
        resolve();
      }

      // watchdog: if rAF stops firing (tab backgrounded / browser stall), resolve so zen doesn't hang
      function armWatchdog() {
        if (watchdog) clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          // force-complete the rest of the stroke synchronously
          brushDab(stroke[stroke.length - 1].x, stroke[stroke.length - 1].y, color, brush, regionMask, r);
          done();
        }, duration + 1500);
      }
      armWatchdog();

      function frame(now) {
        // only honor the abort flag while zen is actually running — otherwise
        // a stale flag from a previous session silently kills manual painting.
        if (state.zenRunning && state.zenAbort) { done(); return; }
        const tRaw = Math.min(1, (now - start) / duration);
        // ease-in-out: hand accelerates from rest, cruises, decelerates to a stop
        const t = tRaw < 0.5
          ? 2 * tRaw * tRaw
          : 1 - Math.pow(-2 * tRaw + 2, 2) / 2;
        const fIdx = t * (stroke.length - 1);
        const idx = Math.floor(fIdx);
        const frac = fIdx - idx;
        const next = stroke[Math.min(stroke.length - 1, idx + 1)];
        const cur  = stroke[idx];
        const x = cur.x + (next.x - cur.x) * frac;
        const y = cur.y + (next.y - cur.y) * frac;

        const look = stroke[Math.min(stroke.length - 1, idx + 3)];
        const back = stroke[Math.max(0, idx - 3)];
        const ang = Math.atan2(look.y - back.y, look.x - back.x) * 180 / Math.PI;
        // a real wrist tilts more dynamically with the direction of motion
        const rot = -22 + Math.sin(ang * Math.PI / 180) * 18;
        placeHand(x, y, rot, /*instant*/ true);

        // dab along the path between the last dab and current point — bounded
        const dx = x - lastDabX, dy = y - lastDabY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= dabSpacing) {
          // cap dabs per frame to keep main thread responsive on slow devices
          const steps = Math.min(8, Math.ceil(dist / dabSpacing));
          for (let s = 1; s <= steps; s++) {
            const f = s / steps;
            brushDab(lastDabX + dx * f, lastDabY + dy * f, color, brush, regionMask, r);
          }
          lastDabX = x; lastDabY = y;
        }

        if (extraSoundAt > 0 && (now - start) > extraSoundAt && duration > 600) {
          audio.stroke(brush);
          extraSoundAt = -1;
        }

        if (t < 1) rafHandle = requestAnimationFrame(frame);
        else {
          brushDab(stroke[stroke.length - 1].x, stroke[stroke.length - 1].y, color, brush, regionMask, r);
          done();
        }
      }
      rafHandle = requestAnimationFrame(frame);
    });
  }

  function pathLength(stroke) {
    let len = 0;
    for (let i = 1; i < stroke.length; i++) {
      const dx = stroke[i].x - stroke[i - 1].x;
      const dy = stroke[i].y - stroke[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  // ---------- paint a whole region with multiple strokes ----------
  async function paintRegionWithStrokes(reg, color, brush, opts = {}) {
    const speedMul = opts.speedMul ?? 1;
    const interStrokePause = opts.interStrokePause ?? 80;
    const strokes = planStrokes(reg, brush);
    const effRadius = strokes._effRadius || BRUSH_PARAMS[brush].radius;

    if (!strokes.length) return;

    const first = strokes[0][0];
    placeHand(first.x - 60, first.y - 60, -45, /*instant*/ false);
    await delay(420);

    for (let i = 0; i < strokes.length; i++) {
      if (state.zenRunning && state.zenAbort) break;
      const stroke = strokes[i];

      if (i > 0) {
        const prevEnd = strokes[i - 1][strokes[i - 1].length - 1];
        const nextStart = stroke[0];
        const jumpDist = Math.hypot(nextStart.x - prevEnd.x, nextStart.y - prevEnd.y);
        if (jumpDist > 30) {
          // lift brush off canvas (small offset) and glide to next start
          placeHand(nextStart.x, nextStart.y - 6, -32, /*instant*/ false);
          await delay(Math.min(280, 90 + jumpDist * 1.1));
        }
      }

      // pace varies per stroke — confident sweeps, careful touches
      // (square-of-random gives a nice asymmetric distribution toward the median)
      const r = Math.random();
      const perStrokeSpeed = 0.7 + r * r * 0.8;     // 0.7 .. 1.5 (slower = more careful)
      await animateStroke(stroke, color, brush, reg.region, speedMul * perStrokeSpeed, effRadius);

      // brief variable pause — sometimes barely a beat, sometimes a thoughtful one
      if (interStrokePause > 0) {
        const longPause = Math.random() < 0.12;
        const pause = longPause
          ? interStrokePause * (2 + Math.random() * 2)
          : interStrokePause * (0.4 + Math.random() * 0.9);
        await delay(pause);
      }
    }
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
  }

  // ---------- hand animation ----------
  // brush tip in SVG viewBox is at (41, 72); transform-origin is set to that in CSS
  function placeHand(x, y, rot = -25, instant = false) {
    const cw = els.canvasWrap.clientWidth, ch = els.canvasWrap.clientHeight;
    const px = (x / state.canvasW) * cw;
    const py = (y / state.canvasH) * ch;
    const tipX = 41, tipY = 72;
    const tx = px - tipX;
    const ty = py - tipY;
    if (instant) els.hand.classList.remove("gliding");
    else els.hand.classList.add("gliding");
    els.hand.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
  }

  function showHand() { els.hand.classList.add("visible"); }
  function hideHand() { els.hand.classList.remove("visible"); }

  function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ---------- manual painting (cursor IS the brush, like MS Paint) ----------
  //
  // Press down → we find the region under the cursor and remember it as the
  // "active region". As long as the pointer is down, every move dabs the
  // brush along the path — but every dab is clipped to that one region's
  // mask, so the paint physically cannot bleed past the outline into a
  // neighbor. Move into the next region? You're just hovering over it; no
  // paint lands until you release and click in there.
  const manual = {
    active: false,
    region: null,        // active region while dragging
    hoverRegion: null,   // cached region under hover for the hand color
    lastX: 0, lastY: 0,
    soundAccum: 0,
    pointerId: null,
  };

  function canvasFromEvent(e) {
    const rect = els.paintCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (state.canvasW / rect.width),
      y: (e.clientY - rect.top)  * (state.canvasH / rect.height),
    };
  }

  els.canvasWrap.addEventListener("pointerdown", (e) => {
    if (state.mode !== "manual" || state.zenRunning) return;
    if (!state.edgeMask) return;
    if (e.button !== undefined && e.button !== 0) return; // left button only

    const { x, y } = canvasFromEvent(e);
    if (x < 0 || y < 0 || x >= state.canvasW || y >= state.canvasH) return;

    // blank canvas → one universal region. Photo outline → flood-fill bounded.
    const reg = state.blankCanvas
      ? getBlankRegion()
      : findRegion(Math.floor(x), Math.floor(y));
    if (!reg || reg.area < 4) return;

    // snapshot BEFORE the first dab — so this whole stroke becomes one undo step
    pushHistory();

    manual.active = true;
    manual.region = reg;
    manual.lastX = x;
    manual.lastY = y;
    manual.soundAccum = 0;
    manual.pointerId = e.pointerId;

    updateBristleColor();
    showHand();
    placeHand(x, y, -22 + (Math.random() * 6 - 3), /*instant*/ true);
    brushDab(x, y, state.color, state.brush, reg.region);
    audio.stroke(state.brush);

    try { els.canvasWrap.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });

  els.canvasWrap.addEventListener("pointermove", (e) => {
    if (state.mode !== "manual" || state.zenRunning) return;
    if (!state.edgeMask) return;

    const { x, y } = canvasFromEvent(e);

    // hand cursor follows the pointer in manual mode whenever we're over canvas
    const onCanvas = x >= 0 && y >= 0 && x < state.canvasW && y < state.canvasH;
    if (onCanvas) {
      showHand();
      placeHand(x, y, manual.active ? -22 : -25, /*instant*/ true);
    }

    if (!manual.active) return;

    // interpolate dabs between last pointer position and this one
    const dx = x - manual.lastX, dy = y - manual.lastY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const r = BRUSH_PARAMS[state.brush].radius * (state.brushSize || 1);
    const dabSpacing = Math.max(1.5, r * BRUSH_PARAMS[state.brush].spacing * 0.7);

    if (dist >= dabSpacing) {
      const steps = Math.min(20, Math.ceil(dist / dabSpacing));
      for (let s = 1; s <= steps; s++) {
        const f = s / steps;
        brushDab(
          manual.lastX + dx * f,
          manual.lastY + dy * f,
          state.color, state.brush, manual.region.region
        );
      }
      manual.lastX = x;
      manual.lastY = y;

      // periodic stroke sound on long drags
      manual.soundAccum += dist;
      if (manual.soundAccum > 80) {
        audio.stroke(state.brush);
        manual.soundAccum = 0;
      }
    }
  });

  function endManualStroke(e) {
    if (!manual.active) return;
    manual.active = false;
    manual.region = null;
    if (manual.pointerId !== null) {
      try { els.canvasWrap.releasePointerCapture(manual.pointerId); } catch (_) {}
      manual.pointerId = null;
    }
  }
  els.canvasWrap.addEventListener("pointerup", endManualStroke);
  els.canvasWrap.addEventListener("pointercancel", endManualStroke);

  els.canvasWrap.addEventListener("pointerleave", () => {
    if (!manual.active && state.mode === "manual" && !state.zenRunning) {
      hideHand();
    }
  });
  els.canvasWrap.addEventListener("pointerenter", () => {
    if (state.mode === "manual" && !state.zenRunning && state.edgeMask) {
      showHand();
    }
  });

  // prevent accidental text selection while dragging in manual mode
  els.canvasWrap.addEventListener("dragstart", (e) => e.preventDefault());

  // ---------- zen mode ----------
  async function startZen() {
    if (!state.edgeMask) { toast("Upload an image first."); return; }
    if (state.blankCanvas) { toast("Zen needs an outlined image — try Upload or Sample."); return; }
    if (state.zenRunning) return;
    pushHistory();                  // the whole zen run is one undo step
    state.zenRunning = true;
    state.zenAbort = false;
    els.canvasWrap.classList.add("zen-active");
    els.canvasWrap.classList.remove("ready");

    toast("Looking at the canvas…");

    const w = state.canvasW, h = state.canvasH;
    const totalPixels = w * h;
    const visited = new Uint8Array(totalPixels);
    const mask = state.edgeMask;
    const regions = [];
    let yieldCounter = 0;

    // skip any region larger than this — usually means edge detection leaked
    const maxRegionArea = Math.floor(totalPixels * 0.45);
    const minRegionArea = 80;

    const step = 6;
    outer: for (let y = step; y < h; y += step) {
      for (let x = step; x < w; x += step) {
        if (state.zenAbort) break outer;
        const i = y * w + x;
        if (mask[i] || visited[i]) continue;
        const reg = findRegion(x, y);
        if (!reg) continue;
        // mark visited regardless of whether we keep it, so we don't re-scan it
        for (let k = 0; k < reg.region.length; k++) if (reg.region[k]) visited[k] = 1;
        if (reg.area < minRegionArea || reg.area > maxRegionArea) continue;
        regions.push(reg);
        // yield every few regions so the UI thread breathes
        if (++yieldCounter % 4 === 0) await delay(0);
      }
    }

    // sort largest-first (artist paints background → midground → details)
    regions.sort((a, b) => b.area - a.area);
    // hard cap so very busy outlines don't take all day
    if (regions.length > 80) regions.length = 80;

    // soft pastel palette for zen
    const zenPalette = [
      "#f6a6b5", "#f7c5a8", "#fde2a3", "#cfe8b4", "#a3d9c8",
      "#b8d4f0", "#cbb8e4", "#f4b6d2", "#ffd5d5", "#d9c1ec",
      "#e6c89a", "#a8c8a8", "#9bc4d8",
    ];

    // an artist tends to settle on one or two brushes for a piece
    const brushes = ["watercolor", "acrylic", "oil", "crayon"];
    const chosenBrush = brushes[Math.floor(Math.random() * brushes.length)];

    showHand();
    let lastColor = null;

    for (let i = 0; i < regions.length; i++) {
      if (state.zenAbort) break;
      const reg = regions[i];

      let color;
      do {
        color = zenPalette[Math.floor(Math.random() * zenPalette.length)];
      } while (color === lastColor && zenPalette.length > 1);
      lastColor = color;
      state.color = color;
      updateBristleColor();

      // a real artist's pace: tiny consider-pause, then strokes
      try {
        await paintRegionWithStrokes(reg, color, chosenBrush, {
          speedMul: 1.0 + (reg.area > 12000 ? 0.25 : 0),
          interStrokePause: 90 + Math.random() * 110,
        });
      } catch (err) {
        // never let one bad region kill the whole zen session
        console.warn("zen: skipped region", err);
      }
      if (state.zenAbort) break;

      const isLongPause = Math.random() < 0.18;
      const restMs = isLongPause ? 900 + Math.random() * 700 : 280 + Math.random() * 360;

      if (i < regions.length - 1) {
        const next = regions[i + 1];
        const restX = (reg.centroid.x + next.centroid.x) / 2;
        const restY = (reg.centroid.y + next.centroid.y) / 2 - 60;
        placeHand(restX, restY, -38, false);
      }
      await delay(restMs);
    }

    // gentle exit: lift hand off to the side and fade
    if (regions.length) {
      const last = regions[regions.length - 1];
      placeHand(last.centroid.x - 120, last.centroid.y - 140, -55, false);
      await delay(500);
    }
    hideHand();
    els.canvasWrap.classList.remove("zen-active");
    els.canvasWrap.classList.add("ready");
    const wasAborted = state.zenAbort;
    state.zenRunning = false;
    state.zenAbort = false;     // reset so it can't leak into manual mode
    if (!wasAborted) toast("Done. A little peace.");
  }

  els.zenStart.addEventListener("click", startZen);
  els.zenStop.addEventListener("click", () => { state.zenAbort = true; });

  // ---------- sliders ----------
  els.detailSlider.addEventListener("input", () => {
    state.detail = +els.detailSlider.value;
    els.detailVal.textContent = ["very low", "low", "medium", "high", "very high"][state.detail - 1];
  });
  els.weightSlider.addEventListener("input", () => {
    state.weight = +els.weightSlider.value;
    els.weightVal.textContent = state.weight;
  });
  els.closeSlider.addEventListener("input", () => {
    state.closeGaps = +els.closeSlider.value;
    els.closeVal.textContent = state.closeGaps;
  });
  els.sizeSlider.addEventListener("input", () => {
    state.brushSize = +els.sizeSlider.value;
    els.sizeVal.textContent = state.brushSize.toFixed(1) + "×";
  });

  // ---------- abstract mode controls ----------
  function setAbstractConfigLabel(slider, valEl, fmt) {
    slider.addEventListener("input", () => {
      valEl.textContent = fmt ? fmt(+slider.value) : slider.value;
      syncAbstractConfig();
    });
  }
  setAbstractConfigLabel(els.splatSizeSlider, els.splatSizeVal, (v) => v.toFixed(2));
  setAbstractConfigLabel(els.splatForceSlider, els.splatForceVal, (v) => String(v | 0));
  setAbstractConfigLabel(els.curlSlider, els.curlVal, (v) => String(v | 0));
  setAbstractConfigLabel(els.dissSlider, els.dissVal, (v) => v.toFixed(1));
  els.abstractUseColor.addEventListener("change", syncAbstractConfig);
  els.abstractBloom.addEventListener("change", syncAbstractConfig);
  els.splatBtn.addEventListener("click", () => {
    if (window.ColormeFluid) window.ColormeFluid.randomSplats(8 + Math.floor(Math.random() * 12));
  });
  els.regenBtn.addEventListener("click", () => {
    if (!state.sourceImage) { toast("Upload an image first."); return; }
    generateOutline();
    toast("Outline regenerated.");
  });

  // ---------- undo / redo ----------
  //
  // One snapshot per user action: a stroke in manual mode, a full zen run,
  // or a Clear. Snapshots are PNG data URLs (compressed, ~100-500 KB each).
  // 20-entry cap so memory stays bounded (~10 MB worst case).
  const history = { undo: [], redo: [], max: 20 };

  function snapshotPaint() {
    if (!state.canvasW) return null;
    try { return els.paintCanvas.toDataURL("image/png"); }
    catch (_) { return null; }
  }
  function pushHistory() {
    const snap = snapshotPaint();
    if (!snap) return;
    if (history.undo.length >= history.max) history.undo.shift();
    history.undo.push(snap);
    history.redo.length = 0;
    updateHistoryButtons();
  }
  function resetHistory() {
    history.undo.length = 0;
    history.redo.length = 0;
    updateHistoryButtons();
  }
  function restorePaint(dataURL) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        paintCtx.clearRect(0, 0, state.canvasW, state.canvasH);
        paintCtx.drawImage(img, 0, 0);
        resolve();
      };
      img.onerror = resolve;
      img.src = dataURL;
    });
  }
  async function undoAction() {
    if (state.mode === "abstract") return;
    if (history.undo.length === 0) { toast("Nothing to undo."); return; }
    const cur = snapshotPaint();
    if (cur) history.redo.push(cur);
    await restorePaint(history.undo.pop());
    updateHistoryButtons();
  }
  async function redoAction() {
    if (state.mode === "abstract") return;
    if (history.redo.length === 0) { toast("Nothing to redo."); return; }
    const cur = snapshotPaint();
    if (cur) history.undo.push(cur);
    await restorePaint(history.redo.pop());
    updateHistoryButtons();
  }
  function updateHistoryButtons() {
    els.undoBtn.disabled = history.undo.length === 0;
    els.redoBtn.disabled = history.redo.length === 0;
  }
  els.undoBtn.addEventListener("click", undoAction);
  els.redoBtn.addEventListener("click", redoAction);
  document.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redoAction(); else undoAction();
    } else if (e.key.toLowerCase() === "y") {
      e.preventDefault();
      redoAction();
    }
  });
  updateHistoryButtons();

  // ---------- clear / save ----------
  els.clearBtn.addEventListener("click", () => {
    if (state.mode === "abstract") {
      if (window.ColormeFluid) {
        window.ColormeFluid.clear();
        toast("Cleared.");
      }
      return;
    }
    if (!state.canvasW) return;
    pushHistory();                 // so Clear can be undone
    paintCtx.fillStyle = "#fefcf8";
    paintCtx.fillRect(0, 0, state.canvasW, state.canvasH);
    toast("Paint cleared.");
  });

  els.saveBtn.addEventListener("click", () => {
    if (!state.canvasW) { toast("Nothing to save yet."); return; }
    // composite paint + outline into one
    const out = document.createElement("canvas");
    out.width = state.canvasW; out.height = state.canvasH;
    const c = out.getContext("2d");
    c.drawImage(els.paintCanvas, 0, 0);
    c.drawImage(els.outlineCanvas, 0, 0);
    out.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "colorme.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  });

  // ---------- color picker ----------
  els.customColor.addEventListener("input", (e) => {
    setColor(e.target.value);
  });

  // ---------- audio toggles ----------
  // music preference (persisted). Default: on. We can't actually start audio
  // until the user interacts with the page (browser autoplay rules), so we
  // arm a one-time listener that kicks off playback on first gesture.
  const musicPref = localStorage.getItem("colorme-music");
  state.musicOn = musicPref !== "off";
  els.musicBtn.setAttribute("aria-pressed", state.musicOn ? "true" : "false");

  let musicAutoStartArmed = state.musicOn;
  function maybeAutoStartMusic() {
    if (!musicAutoStartArmed) return;
    musicAutoStartArmed = false;
    if (state.musicOn) audio.toggleMusic(true);
  }
  window.addEventListener("pointerdown", maybeAutoStartMusic, { once: true, capture: true });
  window.addEventListener("keydown", maybeAutoStartMusic, { once: true, capture: true });

  els.musicBtn.addEventListener("click", () => {
    state.musicOn = !state.musicOn;
    musicAutoStartArmed = false;
    els.musicBtn.setAttribute("aria-pressed", state.musicOn ? "true" : "false");
    audio.toggleMusic(state.musicOn);
    localStorage.setItem("colorme-music", state.musicOn ? "on" : "off");
    toast(state.musicOn ? "Music on" : "Music off");
  });
  els.soundBtn.addEventListener("click", () => {
    state.soundOn = !state.soundOn;
    els.soundBtn.setAttribute("aria-pressed", state.soundOn ? "true" : "false");
    toast(state.soundOn ? "Brush sounds on" : "Brush sounds off");
  });

  // ---------- panel drawer (mobile / tablet) ----------
  function setPanelOpen(open) {
    els.panel.classList.toggle("open", open);
    els.panelOverlay.classList.toggle("visible", open);
    els.panelToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  els.panelToggle.addEventListener("click", () => {
    setPanelOpen(!els.panel.classList.contains("open"));
  });
  els.panelOverlay.addEventListener("click", () => setPanelOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.panel.classList.contains("open")) setPanelOpen(false);
  });
  // when the viewport gets wide enough that the panel is permanent, force-close
  // any leftover open state so the overlay doesn't stay around
  window.matchMedia("(min-width: 901px)").addEventListener("change", (m) => {
    if (m.matches) setPanelOpen(false);
  });

  // ---------- theme ----------
  // The actual data-theme attribute is set by the inline <head> script so we
  // get the right colors before first paint. Here we just sync the button UI
  // and wire the toggle.
  function syncThemeButton() {
    const theme = document.documentElement.getAttribute("data-theme") || "light";
    els.themeBtn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    els.themeBtn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  }
  syncThemeButton();
  els.themeBtn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("colorme-theme", next);
    syncThemeButton();
  });

  // ---------- init ----------
  buildPalette();
  updateBristleColor();

  // keyboard
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.zenRunning) state.zenAbort = true;
  });

  // handle resize — refit canvas if image present
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.sourceImage && !state.zenRunning) {
        // remember current paint and outline as images, re-fit, redraw
        const oldPaint = document.createElement("canvas");
        oldPaint.width = state.canvasW; oldPaint.height = state.canvasH;
        oldPaint.getContext("2d").drawImage(els.paintCanvas, 0, 0);

        setupCanvasFromImage(state.sourceImage);
        // restore old paint scaled
        paintCtx.drawImage(oldPaint, 0, 0, state.canvasW, state.canvasH);
      }
    }, 150);
  });
})();
