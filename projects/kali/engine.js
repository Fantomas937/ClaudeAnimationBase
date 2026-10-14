// engine.js: drawing helpers, the WebGL post-processing pass and the hooks render.mjs drives (window.ready, renderAt,
// renderSheet, gpuInfo). Every frame is a pure function of t: frames render out of order and in parallel workers.
const W = 1920, H = 1080, TAU = Math.PI * 2;
const DUR = CUES.duration;
const PROJECT = { duration: DUR, audio: 'out/kali/mix.wav' };   // render.mjs muxes this into --clip
const BEAT = CUES.beat, BAR = CUES.bar;
const COL = {
  bg: '#02040A', navy: '#071022', deep: '#0B1A38', blue: '#367BF0', blue2: '#249EFF', ice: '#9CC8FF',
  cyan: '#3BE8FF', mag: '#FF2E7E', white: '#EEF5FF', dim: '#16264A', red: '#FF3B4E',
};
const F = { display: 'Orbitron', label: '"Chakra Petch"', mono: '"JetBrains Mono"' };

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = x => Math.pow(clamp(x), 3);
const expoOut = x => { x = clamp(x); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); };
const backOut = (x, s = 1.7) => { x = clamp(x) - 1; return 1 + (s + 1) * x * x * x + s * x * x; };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hash2 = (a, b) => hash(a * 57.3 + b * 911.7);
// 1 at t0, decaying with rate k; 0 before t0
const spike = (t, t0, k = 8) => t < t0 ? 0 : Math.exp(-(t - t0) * k);
// the most recent event in a sorted list, as time since it (Infinity if none yet)
function since(t, list) { let best = Infinity; for (const e of list) { if (e > t) break; best = t - e; } return best; }
const kickPulse = (t, k = 9) => Math.exp(-since(t, CUES.kicks) * k);
// voice / mix envelopes from the soundtrack, sampled at 60 Hz
const envAt = (arr, t) => { const f = t * 60, i = Math.floor(f), a = arr[i] || 0, b = arr[i + 1] || 0; return lerp(a, b, f - i); };
const vo = t => envAt(CUES.voEnv, t), mixLevel = t => envAt(CUES.mixEnv, t);
const word = (w, n = 0) => CUES.words.filter(x => x.w === w)[n].t;

// ---------- canvas ----------
const sc = document.createElement('canvas'); sc.width = W; sc.height = H;
const X = sc.getContext('2d');
// scratch layer for elements that get sliced, masked or tinted
const lc = document.createElement('canvas'); lc.width = W; lc.height = H;
const L = lc.getContext('2d');

function font(c, fam, size, weight = 700, spacing = 0) { c.font = `${weight} ${size}px ${fam}`; c.letterSpacing = spacing + 'px'; }
// text with optional chromatic split: offsets the red/cyan copies by `split` px along x
function text(c, s, x, y, o = {}) {
  const { fam = F.label, size = 40, weight = 700, spacing = 0, color = COL.white, align = 'center', base = 'middle', alpha = 1, split = 0 } = o;
  if (alpha <= 0.002) return;
  c.save(); font(c, fam, size, weight, spacing); c.textAlign = align; c.textBaseline = base; c.globalAlpha = alpha;
  if (split > 0.3) {
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = COL.mag; c.fillText(s, x - split, y);
    c.fillStyle = COL.cyan; c.fillText(s, x + split, y);
    c.globalCompositeOperation = 'source-over';
  }
  c.fillStyle = color; c.fillText(s, x, y);
  c.restore();
}
const measure = (c, s, fam, size, weight = 700, spacing = 0) => { c.save(); font(c, fam, size, weight, spacing); const w = c.measureText(s).width; c.restore(); return w; };
// "decrypt" reveal: each character scrambles until its own reveal time, then locks
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=<>/\\|';
function decode(s, t, t0, dur = 0.35, seed = 0) {
  if (t < t0) return '';
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ti = t0 + dur * (i / Math.max(1, s.length - 1)) * 0.7, show = t0 + dur * 0.3 * i / s.length;
    if (t < show) break;
    out += t >= ti + dur * 0.3 || s[i] === ' ' ? s[i] : GLYPHS[Math.floor(hash2(i + seed, Math.floor(t * 30)) * GLYPHS.length)];
  }
  return out;
}
function line(c, x1, y1, x2, y2, col, w = 2, alpha = 1) { c.save(); c.globalAlpha = alpha; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore(); }
// corner brackets around a box
function brackets(c, x, y, w, h, len, col, lw = 3, alpha = 1) {
  c.save(); c.globalAlpha = alpha; c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
  for (const [px, py, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    c.moveTo(px + dx * len, py); c.lineTo(px, py); c.lineTo(px, py + dy * len);
  }
  c.stroke(); c.restore();
}
// box with clipped (chamfered) corners, the "tech panel" shape
function chamfer(c, x, y, w, h, k) {
  c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h - k); c.lineTo(x + w - k, y + h); c.lineTo(x, y + h); c.lineTo(x, y + k); c.closePath();
}
function radialGlow(c, x, y, r, col, a = 1) {
  if (a <= 0 || r <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = clamp(a); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore();
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// ---------- the Kali logo ----------
const DRAGON = new Path2D(KALI_LOGO.dragon.d), WORD = new Path2D(KALI_LOGO.word.d);

// ---------- post-processing (WebGL2): bloom, chromatic aberration, block glitch, scanlines, grain, vignette ----------
const out = document.getElementById('out');
const gl = out.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FS_BRIGHT = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D s; uniform vec2 px;
void main(){ vec3 c = vec3(0.);
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) c += texture(s, uv + vec2(i, j) * px).rgb;
  c /= 9.; float l = max(c.r, max(c.g, c.b)); o = vec4(c * smoothstep(.40, 1., l), 1.); }`;
const FS_BLUR = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D s; uniform vec2 dir;
void main(){ float w[5] = float[](.227027, .1945946, .1216216, .054054, .016216); vec3 c = texture(s, uv).rgb * w[0];
  for (int i = 1; i < 5; i++) { c += texture(s, uv + dir * float(i)).rgb * w[i]; c += texture(s, uv - dir * float(i)).rgb * w[i]; }
  o = vec4(c, 1.); }`;
const FS_FINAL = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D s, b1, b2; uniform float glitch, ca, flash, bloom, scan, grain, vig, warp, seed, fade; uniform vec3 flashCol;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 q = uv, cc = q - .5;
  q = .5 + cc * (1. + warp * dot(cc, cc));
  // block glitch: bands of the frame shoved sideways, a few lines torn
  float band = floor(q.y * 22. + floor(seed * 5.));
  if (h(vec2(band, floor(seed * 17.))) < glitch * .45) q.x += (h(vec2(band, seed)) - .5) * .16 * glitch;
  float fine = floor(q.y * 540.);
  if (h(vec2(fine, seed * 3.1)) < glitch * .08) q.x += (h(vec2(fine, seed)) - .5) * .05;
  vec2 d = (q - .5) * ca * .010 + vec2(ca * .0025 + glitch * .01 * (h(vec2(band, 9.)) - .5), 0.);
  vec3 c = vec3(texture(s, q + d).r, texture(s, q).g, texture(s, q - d).b);
  c += (texture(b1, q).rgb * .7 + texture(b2, q).rgb * .9) * bloom;
  c *= 1. - scan * (.5 + .5 * sin(gl_FragCoord.y * 3.14159 * .5));
  c *= mix(1., smoothstep(1.25, .25, length(cc * vec2(1., .9)) * 1.45), vig);
  c += (h(gl_FragCoord.xy * .37 + seed * 91.) - .5) * grain;
  c = mix(c, flashCol, clamp(flash, 0., 1.));
  c = max(c, vec3(.004, .007, .016));
  o = vec4(c * fade, 1.);
}`;
function shader(fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(p, sh);
  }
  gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
function tex(w, h) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  return t;
}
function target(w, h) { const t = tex(w, h), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h }; }
const P = { bright: shader(FS_BRIGHT), blur: shader(FS_BLUR), fin: shader(FS_FINAL) };
const sceneTex = tex(W, H);
const RT = { a4: target(W / 4, H / 4), b4: target(W / 4, H / 4), a8: target(W / 8, H / 8), b8: target(W / 8, H / 8) };
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
function pass(prog, dst, texs, uni) {
  gl.useProgram(prog);
  gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null); gl.viewport(0, 0, dst ? dst.w : W, dst ? dst.h : H);
  texs.forEach(([name, t], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(gl.getUniformLocation(prog, name), i); });
  for (const [k, v] of Object.entries(uni || {})) {
    const loc = gl.getUniformLocation(prog, k);
    Array.isArray(v) ? (v.length === 2 ? gl.uniform2fv(loc, v) : gl.uniform3fv(loc, v)) : gl.uniform1f(loc, v);
  }
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
function blur(src, tmp, spread) {
  pass(P.blur, tmp, [['s', src.t]], { dir: [spread / src.w, 0] });
  pass(P.blur, src, [['s', tmp.t]], { dir: [0, spread / src.h] });
}
const hexRGB = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
function post(fx) {
  gl.bindTexture(gl.TEXTURE_2D, sceneTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sc);
  pass(P.bright, RT.a4, [['s', sceneTex]], { px: [1 / W, 1 / H] });
  blur(RT.a4, RT.b4, 1.6); blur(RT.a4, RT.b4, 2.4);
  pass(P.blur, RT.a8, [['s', RT.a4.t]], { dir: [0, 0] });
  blur(RT.a8, RT.b8, 2.0); blur(RT.a8, RT.b8, 3.0);
  pass(P.fin, null, [['s', sceneTex], ['b1', RT.a4.t], ['b2', RT.a8.t]], {
    glitch: fx.glitch, ca: fx.ca, flash: fx.flash, flashCol: hexRGB(fx.flashCol || '#FFFFFF'), bloom: fx.bloom, scan: fx.scan,
    grain: fx.grain, vig: fx.vig, warp: fx.warp, seed: fx.seed, fade: fx.fade,
  });
}

// ---------- hooks for render.mjs ----------
function frame(t) { X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over'; drawFrame(X, t); post(fxAt(t)); }
window.renderAt = async (t, type = 'image/png', q = .92) => { frame(t); return out.toDataURL(type, q); };
window.renderSheet = async (times, cols = 3, w = 640, crop = null) => {
  const [, , cw, ch] = crop || [0, 0, W, H], h = Math.round(w * ch / cw), rows = Math.ceil(times.length / cols), s = document.createElement('canvas');
  s.width = cols * w; s.height = rows * h; const c = s.getContext('2d'), ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now(); frame(times[i]); ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h, [cx, cy] = crop || [0, 0];
    c.drawImage(out, cx, cy, cw, ch, x, y, w, h);
    c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x, y, 84, 24); c.fillStyle = '#fff'; c.font = '15px sans-serif'; c.fillText(times[i].toFixed(2) + 's', x + 6, y + 17);
  }
  return { url: s.toDataURL('image/jpeg', .9), ms };
};
window.gpuInfo = () => { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); };

(async () => {
  await Promise.all([
    `900 100px ${F.display}`, `700 100px ${F.display}`, `700 100px ${F.label}`, `500 100px ${F.label}`, `400 40px ${F.mono}`, `700 40px ${F.mono}`,
  ].map(f => document.fonts.load(f)));
  window.ready = true;
  if (!location.search.includes('render')) {
    const s = document.getElementById('scrub'), lab = document.getElementById('tt'); s.max = DUR;
    let busy = false, want = +(new URLSearchParams(location.search).get('t') || 0);
    const go = async () => { if (busy) return; busy = true; while (want != null) { const t = want; want = null; const t0 = performance.now(); frame(t); lab.textContent = `${t.toFixed(2)}s · ${Math.round(performance.now() - t0)} ms`; } busy = false; };
    s.value = want; s.addEventListener('input', () => { want = +s.value; go(); }); go();
  }
})();
