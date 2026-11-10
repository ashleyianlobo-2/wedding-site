/* ============================================================
   Pressed Botanical wedding monograph — behavior
   ============================================================ */

/* PASTE YOUR GOOGLE APPS SCRIPT URL HERE (ends in /exec).
   See GOOGLE-SHEET-SETUP.md. Until set, the form shows a
   "not connected yet" note instead of sending. */
const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbyDvEV-I16JGOVQihRioQGRflIZJmPgcUpT6gvda3c4sckdBOW1IgxkeiJmSlhoq--M/exec";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── Vapor countdown above FOREVER ("[timer] until forever") ─
   Ported from the React "countdown-vapor-digits" component to
   vanilla canvas 2D (no React/Tailwind), extended to DDD:HH:MM:SS
   for a wedding. Each digit change sublimates the old glyph into
   ink grains that drift up on curl-noise wind while the new glyph
   condenses back via an underdamped spring. The real <time> stays
   the source of truth (screen readers, reduced motion).
   Set WEDDING_DATE to your date & local time (24h). */
const WEDDING_DATE = "2026-12-20T14:00"; // 20 December 2026, 2:00 pm — change the time if needed
initVaporCountdown(new Date(WEDDING_DATE).getTime());

function initVaporCountdown(targetMs) {
  const root = document.querySelector("[data-vc-root]");
  const wrap = document.querySelector(".portal__timer");
  if (!root || Number.isNaN(targetMs)) { if (wrap) wrap.style.display = "none"; return; }
  const canvas = root.querySelector("[data-vc-canvas]");
  const timeEl = root.querySelector("[data-countdown]");
  const digitEls = Array.from(root.querySelectorAll("[data-vc-digit]"));
  const sepEls = Array.from(root.querySelectorAll("[data-vc-sep]"));
  let sepDots = []; // static colon grains: x, y pairs, drawn every frame
  const N = digitEls.length; // DDD HH MM SS = 9

  /* hero-well physics constants (kept from the original) */
  const FLOATS = 6, MAX_GRAINS = 2500, SAMPLE_STRIDE = 3, DOT = 2; // 2px squares on a 3px grid — original component values
  const dot = (x, y) => ctx.fillRect(Math.round(x - DOT / 2), Math.round(y - DOT / 2), DOT, DOT);
  const SPRING_K = 90, ZETA = 0.55, DRAG = 0.92, DT_MAX = 0.032;
  const FIELD_SCALE = 0.008, CURL_EPS = 0.75;
  const PAD_X = 36, PAD_TOP = 90, PAD_BOTTOM = 20;
  const dampC = 2 * ZETA * Math.sqrt(SPRING_K);

  /* deterministic 2-octave value noise → curl-noise wind field */
  const hash2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123; return n - Math.floor(n); };
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const noise2 = (x, y) => 0.65 * vnoise(x, y) + 0.35 * vnoise(x * 2.1 + 19.7, y * 2.1 + 7.3);
  console.assert(noise2(1.3, 2.7) >= 0 && noise2(1.3, 2.7) <= 1, "noise out of range");

  const reduced = reduceMotion;
  const pad = (n, w) => String(n).padStart(w, "0");
  const remaining = () => Math.max(0, targetMs - Date.now());
  const toDigits = () => {
    let r = Math.round(remaining() / 1000);
    const d = Math.min(999, Math.floor(r / 86400)); r %= 86400;
    const h = Math.floor(r / 3600); r %= 3600;
    const m = Math.floor(r / 60), s = r % 60;
    return pad(d, 3) + pad(h, 2) + pad(m, 2) + pad(s, 2);
  };
  const applyDateTime = () =>
    timeEl.setAttribute("datetime", `P${digits.slice(0, 3)}DT${digits.slice(3, 5)}H${digits.slice(5, 7)}M${digits.slice(7)}S`);

  const ctx = canvas.getContext("2d");
  let grainColor = getComputedStyle(digitEls[0]).color || "#16281d";
  const slots = Array.from({ length: N }, () => ({
    g: new Float32Array(MAX_GRAINS * FLOATS), v: new Float32Array(MAX_GRAINS * FLOATS), gc: 0, vc: 0, active: false,
  }));
  let glyphs = null, cells = [], cw = 0, ch = 0, lastW = 0, lastH = 0, raf = 0, last = 0;
  let digits = "0".repeat(N);

  const loop = (now) => {
    if (!ctx) return;
    const dt = Math.min(Math.max((now - last) / 1000, 0), DT_MAX);
    last = now;
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = grainColor;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < sepDots.length; i += 2) dot(sepDots[i], sepDots[i + 1]);
    let anyActive = false;
    for (let s = 0; s < N; s++) {
      const slot = slots[s], g = slot.g, v = slot.v;
      if (!slot.active) {
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < slot.gc; i++) { const o = i * FLOATS; dot(g[o], g[o + 1]); }
        continue;
      }
      anyActive = true;
      let settled = true;
      for (let i = 0; i < slot.gc; i++) {
        const o = i * FLOATS;
        let x = g[o], y = g[o + 1], vx = g[o + 2], vy = g[o + 3];
        const hx = g[o + 4], hy = g[o + 5];
        vx = (vx + (SPRING_K * (hx - x) - dampC * vx) * dt) * DRAG;
        vy = (vy + (SPRING_K * (hy - y) - dampC * vy) * dt) * DRAG;
        x += vx * dt; y += vy * dt;
        g[o] = x; g[o + 1] = y; g[o + 2] = vx; g[o + 3] = vy;
        if (Math.abs(x - hx) > 0.5 || Math.abs(y - hy) > 0.5 || Math.abs(vx) > 2 || Math.abs(vy) > 2) settled = false;
        ctx.globalAlpha = 0.5 + 0.5 * Math.min(1, Math.hypot(vx, vy) / 500);
        dot(x, y);
      }
      let j = 0;
      while (j < slot.vc) {
        const o = j * FLOATS;
        const age = v[o + 4] + dt * 1000, life = v[o + 5];
        if (age >= life) { const lo = (slot.vc - 1) * FLOATS; for (let k = 0; k < FLOATS; k++) v[o + k] = v[lo + k]; slot.vc--; continue; }
        v[o + 4] = age;
        let x = v[o], y = v[o + 1], vx = v[o + 2], vy = v[o + 3];
        const nx = x * FIELD_SCALE, ny = y * FIELD_SCALE;
        const dndx = noise2(nx + CURL_EPS, ny) - noise2(nx - CURL_EPS, ny);
        const dndy = noise2(nx, ny + CURL_EPS) - noise2(nx, ny - CURL_EPS);
        let wx = dndy, wy = -dndx;
        const cl = Math.hypot(wx, wy) || 1;
        const sp = 40 + 50 * hash2(j * 1.31, s * 7.7);
        wx = (wx / cl) * sp * 0.6; wy = (wy / cl) * sp * 0.6 - sp * 0.8;
        const mix = Math.min(1, dt * 5);
        vx += (wx - vx) * mix; vy += (wy - vy) * mix;
        x += vx * dt; y += vy * dt;
        v[o] = x; v[o + 1] = y; v[o + 2] = vx; v[o + 3] = vy;
        ctx.globalAlpha = (1 - age / life) * (0.5 + 0.5 * Math.min(1, Math.hypot(vx, vy) / 500));
        dot(x, y);
        j++;
      }
      if (slot.vc > 0) settled = false;
      if (settled) {
        for (let i = 0; i < slot.gc; i++) { const o = i * FLOATS; g[o] = g[o + 4]; g[o + 1] = g[o + 5]; g[o + 2] = 0; g[o + 3] = 0; }
        slot.active = false;
      }
    }
    ctx.globalAlpha = 1;
    raf = anyActive ? requestAnimationFrame(loop) : 0;
  };
  const wake = () => { if (!raf && ctx) { last = performance.now(); raf = requestAnimationFrame(loop); } };

  const transition = (s, d) => {
    if (!glyphs) return;
    const slot = slots[s], g = slot.g, v = slot.v;
    let vc = 0;
    for (let i = 0; i < slot.gc && vc < MAX_GRAINS; i++) {
      const o = i * FLOATS, vo = vc * FLOATS;
      v[vo] = g[o]; v[vo + 1] = g[o + 1]; v[vo + 2] = g[o + 2] * 0.4; v[vo + 3] = g[o + 3] * 0.4 - 12;
      v[vo + 4] = 0; v[vo + 5] = 600 + Math.random() * 300; vc++;
    }
    slot.vc = vc;
    const homes = glyphs[d], cell = cells[s], n = homes.length / 2;
    slot.gc = n;
    for (let i = 0; i < n; i++) {
      const o = i * FLOATS, hx = cell.x + homes[i * 2], hy = cell.y + homes[i * 2 + 1];
      if (vc > 0) {
        const src = ((Math.random() * vc) | 0) * FLOATS;
        g[o] = v[src] + (Math.random() - 0.5) * 10; g[o + 1] = v[src + 1] + (Math.random() - 0.5) * 10;
        g[o + 2] = (Math.random() - 0.5) * 40; g[o + 3] = -20 - Math.random() * 40;
      } else { g[o] = hx; g[o + 1] = hy; g[o + 2] = 0; g[o + 3] = 0; }
      g[o + 4] = hx; g[o + 5] = hy;
    }
    slot.active = true;
  };

  const init = () => {
    if (!ctx) return;
    const rootRect = root.getBoundingClientRect();
    const w = Math.round(rootRect.width), h = Math.round(rootRect.height);
    if (w < 2 || h < 2) return;
    lastW = w; lastH = h; cw = w + PAD_X * 2; ch = h + PAD_TOP + PAD_BOTTOM;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    canvas.style.left = `${-PAD_X}px`; canvas.style.top = `${-PAD_TOP}px`;
    canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    grainColor = getComputedStyle(digitEls[0]).color || grainColor;
    /* cells = each digit's CENTRE, so centre-relative glyph homes drop in cleanly */
    cells = digitEls.map((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left - rootRect.left + PAD_X + r.width / 2), y: Math.round(r.top - rootRect.top + PAD_TOP + r.height / 2) }; });

    /* Raster wider than the cell so broad glyphs (4, 0) aren't clipped; canvas
       text is proportional, so size to the font, not the tabular cell width. */
    const cellRect = digitEls[0].getBoundingClientRect();
    const cs = getComputedStyle(digitEls[0]);
    const fontPx = parseFloat(cs.fontSize) || cellRect.height;
    const gw = Math.max(2, Math.ceil(Math.max(cellRect.width, fontPx) * 1.4));
    const gh = Math.max(2, Math.ceil(cellRect.height));
    const off = document.createElement("canvas"); off.width = gw; off.height = gh;
    const octx = off.getContext("2d", { willReadFrequently: true });
    if (!octx) return;
    octx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    octx.textAlign = "center"; octx.textBaseline = "middle"; octx.fillStyle = "#fff";
    const sample = (chr) => {
      octx.clearRect(0, 0, gw, gh); octx.fillText(chr, gw / 2, gh / 2);
      const alpha = octx.getImageData(0, 0, gw, gh).data, pts = [];
      for (let y = 1; y < gh; y += SAMPLE_STRIDE) { const row = y * gw; for (let x = 1; x < gw; x += SAMPLE_STRIDE) if (alpha[(row + x) * 4 + 3] > 128) pts.push(x, y); }
      const total = pts.length / 2, keepEvery = Math.max(1, Math.ceil(total / MAX_GRAINS));
      const homes = new Float32Array(Math.ceil(total / keepEvery) * 2);
      let n = 0;
      for (let i = 0; i < total; i += keepEvery) { homes[n * 2] = pts[i * 2] - gw / 2; homes[n * 2 + 1] = pts[i * 2 + 1] - gh / 2; n++; }
      return homes.subarray(0, n * 2);
    };
    glyphs = [];
    for (let d = 0; d < 10; d++) glyphs.push(sample(String(d)));
    const colon = sample(":");
    sepDots = [];
    for (const el of sepEls) {
      const r = el.getBoundingClientRect();
      const cx = Math.round(r.left - rootRect.left + PAD_X + r.width / 2), cy = Math.round(r.top - rootRect.top + PAD_TOP + r.height / 2);
      for (let i = 0; i < colon.length; i += 2) sepDots.push(cx + colon[i], cy + colon[i + 1]);
    }
    for (let s = 0; s < N; s++) {
      const slot = slots[s], homes = glyphs[Number(digits.charAt(s))], cell = cells[s], n = homes.length / 2;
      slot.gc = n; slot.vc = 0; slot.active = false;
      for (let i = 0; i < n; i++) {
        const o = i * FLOATS, hx = cell.x + homes[i * 2], hy = cell.y + homes[i * 2 + 1];
        slot.g[o] = hx; slot.g[o + 1] = hy; slot.g[o + 2] = 0; slot.g[o + 3] = 0; slot.g[o + 4] = hx; slot.g[o + 5] = hy;
      }
    }
    wake();
  };

  let timer;
  const schedule = () => { timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 15); };
  const tick = () => {
    const next = toDigits();
    if (next !== digits) {
      for (let s = 0; s < N; s++) if (next.charAt(s) !== digits.charAt(s)) {
        digitEls[s].textContent = next.charAt(s);
        if (!reduced) transition(s, Number(next.charAt(s)));
      }
      digits = next; applyDateTime();
      if (!reduced) wake();
    }
    if (remaining() > 0) schedule();
  };

  digits = toDigits();
  for (let s = 0; s < N; s++) digitEls[s].textContent = digits.charAt(s);
  applyDateTime();
  if (remaining() > 0) schedule();
  if (reduced || !ctx) return;

  document.fonts?.ready.then(() => {
    init();
    new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect; if (!r) return;
      if (Math.round(r.width) !== lastW || Math.round(r.height) !== lastH) init();
    }).observe(root);
  });
}

/* ── Frontispiece entrance on load ──────────────────────── */
window.addEventListener("load", () => {
  document.querySelector(".front")?.classList.add("ready");
});

/* ── Reveal plates on scroll (reveal once) ──────────────── */
const toReveal = document.querySelectorAll(".reveal, .specimen");
if (!reduceMotion && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  toReveal.forEach((el) => io.observe(el));

  /* Stagger siblings that share a grid without an explicit data-d (30–80ms) */
  document.querySelectorAll(".specimens__grid, .ledger, .order").forEach((group) => {
    [...group.children].forEach((el, i) => {
      if (el.classList.contains("reveal") || el.classList.contains("specimen")) {
        if (!el.dataset.d) el.style.transitionDelay = (i * 0.06).toFixed(2) + "s";
      }
    });
  });
} else {
  toReveal.forEach((el) => el.classList.add("in"));
}

/* ── Portal: scroll-driven camera through type ──────────────
   Ported from Glyph Portal (scroll animation only). A big word
   clips a green field; scrolling flies the camera into one
   letter's ink until the field fills the frame. Reduced motion
   gets the static CSS fallback above and skips all of this. */
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };

/* Largest opaque square in a glyph (linear time) → a guaranteed ink
   target, so the camera lands on a stroke, not a hole. Scans at 3×. */
function interior(ctx, char, font) {
  const cv = ctx.canvas;
  ctx.font = font;
  const m = ctx.measureText(char), pad = 8;
  const left = Math.ceil(m.actualBoundingBoxLeft), ascent = Math.ceil(m.actualBoundingBoxAscent);
  cv.width = Math.max(1, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2);
  cv.height = Math.max(1, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2);
  ctx.font = font; ctx.fontKerning = "none";
  ctx.fillText(char, pad + left, pad + ascent);
  const { width, height } = cv, px = ctx.getImageData(0, 0, width, height).data;
  const rows = new Uint16Array(width + 1);
  let size = 0, bx = 0, by = 0;
  for (let y = 0; y < height; y++) {
    let diag = 0;
    for (let x = 0; x < width; x++) {
      const above = rows[x + 1];
      rows[x + 1] = px[(y * width + x) * 4 + 3] > 245 ? Math.min(above, rows[x], diag) + 1 : 0;
      diag = above;
      if (rows[x + 1] > size) { size = rows[x + 1]; bx = x; by = y; }
    }
  }
  if (size < 3) return null;
  return { x: (bx + 1 - size / 2 - pad - left) / 3, y: (by + 1 - size / 2 - pad - ascent) / 3, radius: (size / 2 - 1) / 3 };
}

function initPortal(section) {
  const pin = section.querySelector(".portal__pin");
  const field = section.querySelector(".portal__field");
  const art = section.querySelector(".portal__art");
  const clip = section.querySelector("#portal-clip");
  const glyph = section.querySelector(".portal__glyph");
  const text = (glyph.textContent || "").trim();
  const len = clamp(parseFloat(section.dataset.scroll) || 2.4, 1, 8);
  const focus = (section.dataset.focus || "").trim();
  section.style.setProperty("--len", len);
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });

  let W = 1, H = 1, travel = 1, startScale = 1, endScale = 1;
  let center = { x: 0, y: 0 }, bounds = { width: 1, height: 1, x: 0, y: 0 }, target = null;

  function readInk() {
    const cs = getComputedStyle(glyph);
    const f100 = `${cs.fontWeight} 100px ${cs.fontFamily}`;
    const f300 = `${cs.fontWeight} 300px ${cs.fontFamily}`;
    ctx.font = f100; ctx.fontKerning = "none";
    const M = ctx.measureText(text);
    bounds = { x: -M.actualBoundingBoxLeft, y: -M.actualBoundingBoxAscent,
      width: M.actualBoundingBoxLeft + M.actualBoundingBoxRight,
      height: M.actualBoundingBoxAscent + M.actualBoundingBoxDescent };
    if (!bounds.width || !bounds.height) return false;
    center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const chars = Array.from(text), want = focus ? chars.indexOf(focus) : -1;
    const candidates = [];
    chars.forEach((ch, i) => {
      ctx.font = f100;
      const adv = ctx.measureText(chars.slice(0, i).join("")).width;
      const found = interior(ctx, ch, f300);
      if (found) candidates.push({ x: found.x + adv, y: found.y, radius: found.radius, i });
    });
    target = candidates.find((c) => c.i === want)
      || [...candidates].sort((a, b) => b.radius - a.radius || Math.abs(a.x - center.x) - Math.abs(b.x - center.x))[0]
      || null;
    if (!target) console.warn("Portal: no ink found in", JSON.stringify(text));
    return !!target;
  }

  function layout() {
    if (!pin.clientWidth) return false;
    W = pin.clientWidth; H = pin.clientHeight; travel = H * len;
    art.setAttribute("viewBox", `0 0 ${W} ${H}`);
    if (!readInk()) return false;
    startScale = Math.min(W * 0.84 / bounds.width, H * 0.38 / bounds.height);
    endScale = Math.max(startScale, Math.hypot(W, H) / (target.radius * 1.35));
    section.style.setProperty("--word-top", `${H / 2 - (bounds.height * startScale) / 2}px`); // timer sits above this
    section.dataset.ready = "true";
    return true;
  }

  function paint(p) {
    const t = clamp(p / 0.78);
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    const scale = Math.exp(Math.log(startScale) + Math.log(endScale / startScale) * eased);
    const blend = endScale === startScale ? 0 : (1 / scale - 1 / startScale) / (1 / endScale - 1 / startScale);
    const cx = center.x + (target.x - center.x) * blend;
    const cy = center.y + (target.y - center.y) * blend;
    clip.setAttribute("transform", `scale(${scale})`);
    glyph.setAttribute("transform", `translate(${W / 2 / scale - cx} ${H * 0.5 / scale - cy})`);
    field.style.clipPath = t >= 1 ? "none" : "url(#portal-clip)";
    section.style.setProperty("--cap", 1 - smooth(0.01, 0.16, p));
  }

  let ok = false, raf = 0;
  const progress = () => clamp(-section.getBoundingClientRect().top / travel);
  const render = () => { raf = 0; if (ok) paint(progress()); };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(render); };
  const relayout = () => { ok = layout(); if (ok) paint(progress()); };

  relayout();
  document.fonts?.ready.then(relayout);
  addEventListener("scroll", schedule, { passive: true });
  new ResizeObserver(relayout).observe(section);
}

if (!reduceMotion) document.querySelectorAll("[data-portal]").forEach(initPortal);

/* ── RSVP dot-grid backdrop ─────────────────────────────────
   Ported from the login component's WebGL shader to canvas 2D
   (no Three.js): a grid of gold/cream squares that flicker and
   radiate in from the centre when the card scrolls into view. */
function initDots(canvas) {
  const ctx = canvas.getContext("2d");
  const CELL = 22, DOT = 7, SPEED = 3, FREQ = 5;
  const LEVELS = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1.0];
  const COLORS = ["201,162,39", "220,194,119", "243,236,220"]; /* gold, gold-lite, cream */
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rnd = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  let W = 0, H = 0, cols = 0, rows = 0, raf = 0, start = 0, visible = false;

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
  }
  function draw(now) {
    raf = 0; if (!visible) return;
    if (!start) start = now;
    const t = (now - start) / 1000, cx = cols / 2, cy = rows / 2;
    ctx.clearRect(0, 0, W, H);
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const off = rnd(gx, gy);
        const bucket = Math.floor(t / FREQ + off + FREQ) + 1;
        let op = LEVELS[Math.min(9, (rnd(gx * bucket * 0.731, gy * bucket * 1.317) * 10) | 0)];
        const timing = Math.hypot(gx - cx, gy - cy) * 0.14 + off * 0.15, prog = t * SPEED;
        if (prog < timing) continue;                 /* not yet revealed */
        if (prog < timing + 0.12) op *= 1.25;        /* leading-edge brighten */
        ctx.fillStyle = `rgba(${COLORS[(off * COLORS.length) | 0]},${Math.min(1, op) * 0.5})`;
        ctx.fillRect(gx * CELL, gy * CELL, DOT, DOT);
      }
    }
    raf = requestAnimationFrame(draw);
  }
  const schedule = () => { if (!raf && visible) raf = requestAnimationFrame(draw); };
  console.assert(rnd(3, 7) >= 0 && rnd(3, 7) < 1, "dot hash out of range");
  resize();
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) { start = 0; schedule(); }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(canvas);
}
if (!reduceMotion) { const dots = document.querySelector(".reply__dots"); if (dots) initDots(dots); }

/* ── RSVP watching face ─────────────────────────────────────
   Eyes follow the cursor and blink every 3s; they shut while the
   guest writes their private note (stands in for the password field). */
function initPeeker(face) {
  const note = document.getElementById("note");
  note?.addEventListener("focus", () => face.classList.add("is-shut"));
  note?.addEventListener("blur", () => face.classList.remove("is-shut"));
  if (reduceMotion) return;
  const REACH = 4.5; // px a pupil can travel from centre
  addEventListener("pointermove", (e) => {
    const r = face.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1, k = (REACH * Math.min(1, d / 200)) / d; // eases to centre when cursor is near
    face.style.setProperty("--px", `${dx * k}px`);
    face.style.setProperty("--py", `${dy * k}px`);
  }, { passive: true });
  setInterval(() => {
    face.classList.add("is-blink");
    setTimeout(() => face.classList.remove("is-blink"), 180);
  }, 3000);
}
{ const face = document.querySelector(".peeker"); if (face) initPeeker(face); }

/* ── Animated dropdown (vanilla port of emerald-ui) ─────────
   Chevron rotates, menu fades/slides/scales open with staggered
   items (CSS), click-outside and Escape close. Selection writes
   the hidden input and button label. */
function initDropdown(dd) {
  const btn = dd.querySelector(".dropdown__btn");
  const textEl = dd.querySelector("[data-dropdown-text]");
  const input = dd.querySelector("[data-dropdown-input]");
  const open = () => { dd.setAttribute("data-open", ""); btn.setAttribute("aria-expanded", "true"); };
  const close = () => { dd.removeAttribute("data-open"); btn.setAttribute("aria-expanded", "false"); };
  btn.addEventListener("click", () => (dd.hasAttribute("data-open") ? close() : open()));
  dd.querySelectorAll(".dropdown__opt").forEach((o) => o.addEventListener("click", () => {
    input.value = o.dataset.value;
    textEl.textContent = o.textContent;
    dd.setAttribute("data-selected", "");
    close(); btn.focus();
  }));
  document.addEventListener("mousedown", (e) => { if (!dd.contains(e.target)) close(); });
  dd.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); btn.focus(); } });
}
document.querySelectorAll("[data-dropdown]").forEach(initDropdown);

/* ── RSVP reply card ────────────────────────────────────── */
const form = document.getElementById("rsvpForm");
const statusEl = document.getElementById("rsvpStatus");
const submitBtn = document.getElementById("rsvpSubmit");
const conditionals = [...document.querySelectorAll(".field--conditional")];
const accepts = (v) => typeof v === "string" && v.startsWith("Accepts");

/* Each party dropdown appears only when its event is accepted */
form?.addEventListener("change", (e) => {
  if (e.target.name !== "roce" && e.target.name !== "wedding") return;
  const yes = accepts(e.target.value);
  form.querySelectorAll(`.field--conditional[data-when="${e.target.name}-yes"]`).forEach((f) => (f.hidden = !yes));
});

function setError(name, msg) {
  const slot = form.querySelector(`.field__error[data-for="${name}"]`);
  if (slot) slot.textContent = msg || "";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("name", "");
  setError("roce", "");
  setError("wedding", "");

  const data = new FormData(form);
  const name = (data.get("name") || "").toString().trim();
  const roce = data.get("roce");
  const wedding = data.get("wedding");

  let bad = false;
  if (!name) { setError("name", "Please record the guest's name."); bad = true; }
  if (!roce) { setError("roce", "Please let us know about the Roce."); bad = true; }
  if (!wedding) { setError("wedding", "Please let us know about the Wedding."); bad = true; }
  if (bad) return;

  if (!accepts(roce)) data.set("roce_headcount", "0");
  if (!accepts(wedding)) data.set("wedding_headcount", "0");

  if (!RSVP_ENDPOINT || RSVP_ENDPOINT.includes("PASTE_YOUR")) {
    statusEl.className = "form__status is-err";
    statusEl.textContent = "The reply card isn't connected yet — see GOOGLE-SHEET-SETUP.md.";
    return;
  }

  submitBtn.disabled = true;
  statusEl.className = "form__status";
  statusEl.textContent = "Sealing…";

  try {
    /* Apps Script returns no CORS headers, so fire-and-forget.
       URLSearchParams keeps this a simple request (no preflight). */
    await fetch(RSVP_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      body: new URLSearchParams([...data.entries()]),
    });
    form.reset();
    conditionals.forEach((f) => (f.hidden = true));
    document.querySelectorAll("[data-dropdown]").forEach((dd) => {
      dd.removeAttribute("data-selected");
      const t = dd.querySelector("[data-dropdown-text]");
      if (t) t.textContent = "Select a number";
    });
    statusEl.className = "form__status is-ok";
    statusEl.textContent = "Received";
  } catch (err) {
    statusEl.className = "form__status is-err";
    statusEl.textContent = "The reply didn't send — please try again, or email us.";
    submitBtn.disabled = false;
  }
});
