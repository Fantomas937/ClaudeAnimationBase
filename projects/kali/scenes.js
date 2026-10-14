// scenes.js: the shots. Every time comes from CUES (the soundtrack's timeline): bars, kicks, the zaps under the tool
// names and the exact word times of the voice-over, so picture and sound cannot drift apart.
//
//   0.00  intro       Kali root shell, "ROOT ACCESS ... GRANTED", the grid wakes up        VO: root access... granted
//   3.75  drop        600+ PENETRATION TESTING TOOLS                                       VO: over 600 tools
//   5.63  tools       eight flagship tools, one per eighth note, over a wall of the rest
//   7.50  lineage     2006 BackTrack -> 2013 Kali 1.0 -> 2016 Kali Rolling -> 2026
//   9.38  debian      built on Debian, rolling release, four point releases a year
//  11.25  platforms   runs anywhere: eight ways to get Kali, one per eighth note
//  13.13  free        FREE ... AND ALWAYS WILL BE                                           VO: free... and always will be
//  16.20  montage     every stat at once on the snare roll
//  16.88  breakdown   the motto, word by word, over a waveform of the whisper itself        VO: the quieter you become...
//  20.63  silence     one cursor blink
//  21.09  logo        the hit: the dragon, KALI, LINUX                                       VO: Kali Linux
const DROP = CUES.drop, BREAK = CUES.breakdown, CUT = CUES.cut, HIT = CUES.hit;
const BARS = n => n * BAR;
const GROOVE = t => t >= DROP && t < BREAK;

// ---------- shared backgrounds ----------
function backdrop(c, t, glow = 0.5, col = COL.deep) {
  c.fillStyle = COL.bg; c.fillRect(-60, -60, W + 120, H + 120);
  radialGlow(c, W / 2, H * 0.48, 1100, rgba(col, 1), glow);
}
// falling hex columns, snapped to a character grid
function dataRain(c, t, a = 0.3, spd = 1, col = COL.blue) {
  if (a <= 0.01) return;
  c.save(); font(c, F.mono, 20, 400); c.textAlign = 'center'; c.textBaseline = 'top';
  const cols = 64, cw = W / cols, rh = 24;
  for (let i = 0; i < cols; i++) {
    const sp = (70 + hash(i) * 240) * spd, len = 6 + Math.floor(hash(i + 7) * 16);
    const head = Math.floor((((t * sp + hash(i + 3) * 3000) % (H + len * rh + 300)) - 120) / rh) * rh;
    for (let k = 0; k < len; k++) {
      const y = head - k * rh; if (y < -rh || y > H) continue;
      c.globalAlpha = a * (1 - k / len) * (k ? 0.55 : 1);
      c.fillStyle = k ? col : COL.ice;
      c.fillText('0123456789ABCDEF'[Math.floor(hash2(i * 31 + k, Math.floor(t * 12 + hash(i) * 9)) * 16)], (i + 0.5) * cw, y);
    }
  }
  c.restore();
}
// perspective grid floor rushing toward the camera
function gridFloor(c, t, a, spd = 1, hy = 700, col = COL.blue, off = 0) {
  if (a <= 0.01) return;
  const f = 900, camH = 260, zNear = f * camH / (H + 40 - hy), zFar = 9000, gap = 260;
  const py = z => hy + f * camH / z, px = (x, z) => W / 2 + f * x / z;
  c.save(); c.strokeStyle = col; c.lineCap = 'round';
  for (let i = -18; i <= 18; i++) {
    const x = i * gap;
    c.globalAlpha = a * 0.55 * (1 - Math.abs(i) / 19); c.lineWidth = 2;
    c.beginPath(); c.moveTo(px(x, zNear), py(zNear)); c.lineTo(px(x, zFar), py(zFar)); c.stroke();
  }
  const shift = ((t * spd + off) * gap * 2) % gap;
  for (let k = 0; k < 40; k++) {
    const z = zNear + k * gap - shift; if (z < zNear * 0.98) continue; if (z > zFar) break;
    const y = py(z), fadeK = 1 - (z - zNear) / (zFar - zNear);
    c.globalAlpha = a * fadeK * fadeK; c.lineWidth = 1 + 2.5 * fadeK;
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
  }
  c.restore();
  radialGlow(c, W / 2, hy, 900, rgba(COL.blue, 0.55), a);
  c.save(); c.globalAlpha = a * 0.9; c.fillStyle = COL.ice; c.fillRect(0, hy - 1, W, 2); c.restore();
}
// rays from the centre
function rays(c, t, a, n = 48, rot = 0, col = COL.blue, cx = W / 2, cy = H / 2) {
  if (a <= 0.01) return;
  c.save(); c.translate(cx, cy); c.rotate(rot); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const ang = i / n * TAU + hash(i) * 0.08, w = 0.006 + hash(i + 50) * 0.018, r0 = 220 + hash(i + 9) * 120;
    c.globalAlpha = a * (0.25 + 0.75 * hash(i + 21)) * (0.6 + 0.4 * Math.sin(t * 6 + i));
    c.fillStyle = col; c.beginPath(); c.moveTo(Math.cos(ang - w) * r0, Math.sin(ang - w) * r0);
    c.lineTo(Math.cos(ang) * 2400, Math.sin(ang) * 2400); c.lineTo(Math.cos(ang + w) * r0, Math.sin(ang + w) * r0); c.fill();
  }
  c.restore();
}
// particles blasted out from (cx, cy) at t0
function burst(c, t, t0, n = 140, cx = W / 2, cy = H / 2, power = 1, col = COL.ice) {
  const a = t - t0; if (a < 0 || a > 2.2) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const ang = hash(i * 3.1 + t0) * TAU, sp = (300 + hash(i + t0 * 7) * 1700) * power, life = 0.6 + hash(i + 99) * 1.4;
    if (a > life) continue;
    const d = sp * (1 - Math.exp(-a * 2.2)) / 2.2, x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d * 0.75;
    const k = 1 - a / life, s = 1.5 + hash(i + 5) * 3.5;
    c.globalAlpha = k; c.fillStyle = hash(i + 1) > 0.8 ? COL.cyan : col;
    c.fillRect(x - s / 2, y - s / 2, s * (1 + 6 * k * hash(i + 2)), s);
  }
  c.restore();
}
// slow ambient dust
function dust(c, t, a = 0.5, n = 90) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = (hash(i) * W + t * (8 + hash(i + 1) * 30) * (hash(i + 2) > 0.5 ? 1 : -1) + W * 4) % W;
    const y = (hash(i + 3) * H - t * (6 + hash(i + 4) * 22) + H * 4) % H, s = 1 + hash(i + 5) * 2.5;
    c.globalAlpha = a * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * (1 + hash(i + 6) * 3) + i)));
    c.fillStyle = hash(i + 7) > 0.7 ? COL.cyan : COL.ice; c.fillRect(x, y, s, s);
  }
  c.restore();
}
function shockwave(c, t, t0, cx = W / 2, cy = H / 2, max = 1500, col = COL.ice) {
  const k = seg(t, t0, t0 + 0.9); if (k <= 0 || k >= 1) return;
  const r = 60 + max * expoOut(k);
  c.save(); c.globalCompositeOperation = 'lighter';
  c.globalAlpha = (1 - k) * 0.9; c.strokeStyle = col; c.lineWidth = 34 * (1 - k) + 2;
  c.beginPath(); c.ellipse(cx, cy, r, r * 0.82, 0, 0, TAU); c.stroke();
  c.globalAlpha = (1 - k) * 0.5; c.strokeStyle = COL.cyan; c.lineWidth = 6;
  c.beginPath(); c.ellipse(cx, cy, r * 0.8, r * 0.66, 0, 0, TAU); c.stroke();
  c.restore();
}

// ---------- HUD: frame furniture that makes it feel like an operator's screen ----------
function hud(c, t, a) {
  if (a <= 0.01) return;
  const m = 44, beat = Math.floor((t - DROP) / BEAT), fl = 0.85 + 0.15 * hash(Math.floor(t * 20));
  c.save(); c.globalAlpha = a * fl;
  brackets(c, m, m, W - 2 * m, H - 2 * m, 54, COL.blue, 3, 0.9);
  text(c, 'KALI://ARSENAL', m + 26, m + 30, { fam: F.mono, size: 20, weight: 700, color: COL.ice, align: 'left', spacing: 3 });
  text(c, 'UID 0 · ROOT', m + 26, m + 58, { fam: F.mono, size: 16, weight: 400, color: COL.blue, align: 'left', spacing: 2 });
  const sec = Math.floor(t), fr = Math.floor((t - sec) * 30);
  const on = Math.floor(t / BEAT) % 2 === 0;
  c.fillStyle = COL.red; c.globalAlpha = a * (on ? 1 : 0.25); c.beginPath(); c.arc(W - m - 268, m + 30, 8, 0, TAU); c.fill(); c.globalAlpha = a * fl;
  text(c, `REC  00:00:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`, W - m - 26, m + 30, { fam: F.mono, size: 20, weight: 700, color: COL.ice, align: 'right', spacing: 2 });
  // beat lamps + bar counter
  for (let i = 0; i < 4; i++) {
    c.fillStyle = GROOVE(t) && ((beat % 4) + 4) % 4 === i ? COL.cyan : COL.dim;
    c.fillRect(W - m - 150 + i * 30, H - m - 44, 22, 14);
  }
  const bar = Math.floor(t / BAR) + 1;
  text(c, `BAR ${String(bar).padStart(2, '0')}/13`, W - m - 160, H - m - 37, { fam: F.mono, size: 16, weight: 400, color: COL.blue, align: 'right', spacing: 2 });
  // signal meter from the real mix level
  const lv = mixLevel(t);
  text(c, 'SIGNAL', m + 26, H - m - 37, { fam: F.mono, size: 16, weight: 400, color: COL.blue, align: 'left', spacing: 2 });
  for (let i = 0; i < 16; i++) { c.fillStyle = i / 16 < lv ? (i > 12 ? COL.mag : COL.cyan) : COL.dim; c.fillRect(m + 110 + i * 14, H - m - 44, 10, 14); }
  // rulers on the side edges
  for (let i = 0; i < 26; i++) {
    const y = ((i * 44 + t * 60) % (H - 2 * m - 120)) + m + 60;
    line(c, m - 14, y, m - (i % 4 ? 4 : -6), y, COL.blue, 2, 0.6); line(c, W - m + 14, y, W - m + (i % 4 ? 4 : -6), y, COL.blue, 2, 0.6);
  }
  c.restore();
}

// ---------- 0.00 intro: the shell ----------
const PROMPT_USER = [['┌──(', COL.blue], ['kali㉿kali', COL.blue2], [')-[', COL.blue], ['~', COL.white], [']', COL.blue]];
const PROMPT_ROOT = [['┌──(', COL.blue], ['root㉿kali', COL.red], [')-[', COL.blue], ['~', COL.white], [']', COL.blue]];
const LOAD = ['nmap', 'metasploit-framework', 'burpsuite', 'wireshark', 'aircrack-ng', 'hashcat', 'john', 'sqlmap', 'hydra', 'nikto',
  'responder', 'bettercap', 'netexec', 'impacket-scripts', 'wpscan', 'ghidra', 'radare2', 'beef-xss', 'recon-ng', 'mimikatz'];
function termLines(t) {
  const L = [];
  const typed = (s, t0, t1) => s.slice(0, Math.floor(s.length * seg(t, t0, t1)));
  if (t >= 0.1) L.push(PROMPT_USER);
  if (t >= 0.12) L.push([['└─$ ', COL.blue], [typed('sudo -i', 0.18, 0.45), COL.white]]);
  if (t >= 0.55) L.push([['[sudo] password for kali: ', COL.ice], [typed('••••••••', 0.6, 0.88), COL.ice]]);
  if (t >= 0.98) L.push(PROMPT_ROOT);
  if (t >= 1.0) L.push([['└─# ', COL.red], [typed('./arsenal --load all', 1.04, 1.5), COL.white]]);
  for (let i = 0; i < LOAD.length; i++) {
    const ti = 1.6 + i * 0.085; if (t < ti) break;
    const name = LOAD[i], dots = '.'.repeat(Math.max(3, 26 - name.length));
    L.push([['[+] ', COL.cyan], ['load ' + name + ' ', COL.ice], [dots + ' ', COL.dim], ['OK', COL.cyan]]);
  }
  return L;
}
function terminal(c, t, a) {
  const L = termLines(t), lh = 44, x = 150, y0 = 226, vis = 16;
  const scroll = Math.max(0, L.length - vis) * lh;
  // the terminal window itself
  const wx = 100, wy = 120, ww = 1240, wh = 860;
  c.save(); c.globalAlpha = a;
  c.fillStyle = 'rgba(3,8,20,0.82)'; chamfer(c, wx, wy, ww, wh, 18); c.fill();
  c.strokeStyle = COL.blue; c.lineWidth = 2; chamfer(c, wx, wy, ww, wh, 18); c.stroke();
  c.fillStyle = rgba(COL.blue, 0.18); c.fillRect(wx + 18, wy + 2, ww - 20, 44);
  line(c, wx, wy + 46, wx + ww, wy + 46, COL.blue, 2);
  text(c, t < 0.98 ? 'kali@kali: ~' : 'root@kali: ~', wx + ww / 2, wy + 24, { fam: F.mono, size: 20, weight: 700, color: COL.ice, spacing: 2 });
  for (let i = 0; i < 3; i++) { c.strokeStyle = COL.ice; c.lineWidth = 2; c.strokeRect(wx + ww - 120 + i * 34, wy + 15, 18, 18); }
  c.beginPath(); c.rect(wx, wy + 48, ww, wh - 50); c.clip();
  font(c, F.mono, 31, 400); c.textBaseline = 'middle'; c.textAlign = 'left';
  L.forEach((segs, i) => {
    let xx = x; const y = y0 + i * lh - scroll; if (y < wy + 60) return;
    for (const [s, col] of segs) { c.fillStyle = col; c.fillText(s, xx, y); xx += c.measureText(s).width; }
    if (i === L.length - 1 && Math.floor(t * 4) % 2 === 0) { c.fillStyle = COL.ice; c.fillRect(xx + 4, y - 17, 17, 34); }
  });
  c.restore();
}
function banner(c, t) {
  const t0 = 0.62, open = expoOut(seg(t, t0, t0 + 0.22)), squash = 1 - easeIn(seg(t, 3.28, 3.62));
  if (open <= 0 || squash <= 0) return;
  const g = word('GRANTED'), w = 1080, h = 330 * open * squash, x = W / 2 - w / 2, y = H / 2 - h / 2, ok = t >= g;
  c.save();
  c.fillStyle = 'rgba(2,6,16,0.9)'; chamfer(c, x, y, w, h, 26); c.fill();
  c.strokeStyle = ok ? COL.cyan : COL.blue; c.lineWidth = 3; chamfer(c, x, y, w, h, 26); c.stroke();
  if (ok) { c.globalAlpha = spike(t, g, 7) * 0.55; c.fillStyle = COL.cyan; chamfer(c, x, y, w, h, 26); c.fill(); c.globalAlpha = 1; }
  brackets(c, x - 18, y - 18, w + 36, h + 36, 40, ok ? COL.cyan : COL.blue2, 3, 0.9);
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  const cy = H / 2;
  text(c, 'AUTH · SUDO · UID 0', x + 34, cy - 118, { fam: F.mono, size: 20, weight: 700, color: COL.blue, align: 'left', spacing: 4 });
  text(c, ok ? 'SESSION 0x7F3A' : 'VERIFYING' + '.'.repeat(1 + Math.floor(t * 6) % 3), x + w - 34, cy - 118, { fam: F.mono, size: 20, weight: 400, color: COL.blue, align: 'right', spacing: 3 });
  const s1 = decode('ROOT', t, word('ROOT'), 0.22, 3), s2 = decode('ACCESS', t, word('ACCESS'), 0.32, 9);
  text(c, (s1 + ' ' + s2).trim(), W / 2, cy - 30, { fam: F.display, size: 104, weight: 900, color: COL.white, spacing: 10, split: 3 + 14 * spike(t, word('ACCESS'), 10) });
  if (!ok) {
    const p = seg(t, word('ACCESS'), g);
    for (let i = 0; i < 24; i++) { c.fillStyle = i / 24 < p ? COL.blue2 : COL.dim; c.fillRect(W / 2 - 360 + i * 30, cy + 78, 22, 26); }
  } else {
    const k = expoOut(seg(t, g, g + 0.18));
    text(c, 'GRANTED', W / 2, cy + 92, { fam: F.label, size: 84 * lerp(1.5, 1, k), weight: 700, color: COL.cyan, spacing: 34, split: 24 * spike(t, g, 6) + 2 });
  }
  c.restore();
}
function intro(c, t) {
  backdrop(c, t, 0.25 + 0.4 * seg(t, 1.875, 3.75));
  const b1 = seg(t, BAR, DROP);
  dataRain(c, t, 0.08 + 0.22 * b1, 1 + 3 * easeIn(b1));
  gridFloor(c, t, 0.75 * ease(seg(t, BAR, BAR + 0.9)), 0.5 + 5 * easeIn(b1), 760);
  terminal(c, t, t < word('ROOT') - 0.1 ? 1 : lerp(1, 0.32, seg(t, word('ROOT') - 0.1, word('ROOT') + 0.2)) * (1 - easeIn(seg(t, 3.0, 3.5))));
  banner(c, t);
  // CRT power-on: a line of light that opens into the picture
  if (t < 0.22) {
    const wk = easeOut(seg(t, 0, 0.08)), hk = easeOut(seg(t, 0.08, 0.22)), hh = Math.max(3, H * hk), ww = W * wk;
    c.fillStyle = '#000';
    c.fillRect(-60, -60, W + 120, (H - hh) / 2 + 60); c.fillRect(-60, (H + hh) / 2, W + 120, (H - hh) / 2 + 60);
    c.fillRect(-60, -60, (W - ww) / 2 + 60, H + 120); c.fillRect((W + ww) / 2, -60, (W - ww) / 2 + 60, H + 120);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - hk; c.fillStyle = COL.ice; c.fillRect((W - ww) / 2, H / 2 - 2, ww, 4); c.restore();
  }
  // the last beat sucks everything into a line of light
  const k = seg(t, 3.28, DROP);
  if (k > 0) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const wl = W * easeIn(k) * 1.1, hl = 2 + 16 * Math.pow(k, 5);
    c.globalAlpha = 0.9; c.fillStyle = COL.ice; c.fillRect(W / 2 - wl / 2, H / 2 - hl / 2, wl, hl);
    c.restore();
    radialGlow(c, W / 2, H / 2, 300 + 900 * k, rgba(COL.blue2, 1), k);
  }
}

// ---------- 3.75 drop: 600+ ----------
function bigNumber(c, t, cx, cy, size, main, tail, split, scale = 1) {
  c.save(); c.translate(cx, cy); c.scale(scale, scale);
  const w1 = measure(c, main, F.display, size, 900, 4), w2 = measure(c, tail, F.display, size * 0.62, 900, 0);
  text(c, main, -(w1 + w2) / 2, 0, { fam: F.display, size, weight: 900, color: '#DCE8FF', align: 'left', spacing: 4, split });
  text(c, tail, -(w1 + w2) / 2 + w1 + 6, -size * 0.17, { fam: F.display, size: size * 0.62, weight: 900, color: COL.cyan, align: 'left', split: split * 0.6 });
  c.restore();
}
function drop600(c, t) {
  const lt = t - DROP;
  backdrop(c, t, 0.9);
  rays(c, t, 0.12 + 0.25 * spike(t, DROP, 2) + 0.08 * kickPulse(t), 56, t * 0.08);
  gridFloor(c, t, 0.55, 2.2, 800);
  dataRain(c, t, 0.12, 1.6);
  shockwave(c, t, DROP);
  burst(c, t, DROP, 160, W / 2, 470, 1.1);
  const sc = lerp(1.45, 1, expoOut(lt / 0.32)) * (1 + 0.03 * kickPulse(t, 10)) + 0.06 * spike(t, word('600'), 7);
  bigNumber(c, t, W / 2, 470, 400, '600', '+', 4 + 40 * spike(t, DROP, 5) + 8 * kickPulse(t, 12), sc);
  // scanner sweep when the voice says "600"
  const s = seg(t, word('600'), word('600') + 0.35);
  if (s > 0 && s < 1) {
    const x = lerp(420, 1500, ease(s));
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.sin(s * Math.PI);
    const g = c.createLinearGradient(x - 120, 0, x + 20, 0); g.addColorStop(0, 'rgba(59,232,255,0)'); g.addColorStop(1, 'rgba(59,232,255,0.8)');
    c.fillStyle = g; c.fillRect(x - 120, 250, 140, 440); c.fillStyle = COL.white; c.fillRect(x + 18, 250, 4, 440); c.restore();
  }
  text(c, decode('// ARSENAL SIZE', t, DROP + 0.12, 0.3, 4), W / 2, 225, { fam: F.mono, size: 24, weight: 700, color: COL.blue2, spacing: 8 });
  const lab = decode('PENETRATION TESTING TOOLS', t, DROP + 0.25, 0.5, 11);
  text(c, lab, W / 2, 770, { fam: F.label, size: 54, weight: 700, color: COL.ice, spacing: 16 });
  const lw = 520 * expoOut(seg(t, DROP + 0.3, DROP + 0.7));
  line(c, W / 2 - 560 - lw, 770, W / 2 - 560, 770, COL.blue, 3); line(c, W / 2 + 560, 770, W / 2 + 560 + lw, 770, COL.blue, 3);
  text(c, decode('PREINSTALLED · ONE DISTRO', t, DROP + 0.6, 0.4, 2), W / 2, 840, { fam: F.mono, size: 22, weight: 400, color: COL.blue, spacing: 6 });
}

// ---------- 5.63 tools: one per eighth note ----------
// tool -> category as Kali files them (its kali-tools-* metapackages in gitlab.com/kalilinux/packages/kali-meta)
const TOOLS = [['NMAP', 'INFORMATION GATHERING'], ['METASPLOIT', 'EXPLOITATION TOOLS'], ['BURP SUITE', 'WEB APPLICATION ANALYSIS'],
  ['WIRESHARK', 'SNIFFING & SPOOFING'], ['AIRCRACK-NG', 'WIRELESS · 802.11'], ['HASHCAT', 'PASSWORD ATTACKS'], ['SQLMAP', 'DATABASE ASSESSMENT'],
  ['RADARE2', 'REVERSE ENGINEERING']];
// all of these are in Kali's kali-tools-* metapackages
const WALL = ['hydra', 'nikto', 'responder', 'bettercap', 'wpscan', 'dirb', 'theharvester', 'recon-ng', 'maltego', 'beef-xss', 'enum4linux',
  'impacket-scripts', 'netexec', 'john', 'crunch', 'cewl', 'medusa', 'ettercap', 'kismet', 'reaver', 'wifite', 'set', 'ghidra', 'binwalk',
  'autopsy', 'sleuthkit', 'exploitdb', 'msfpc', 'masscan', 'amass', 'proxychains4', 'tcpdump', 'mitmproxy', 'mimikatz', 'hashid', 'wordlists',
  'dnsenum', 'fierce', 'edb-debugger', 'apktool', 'jadx', 'rizin', 'dnsrecon', 'hping3', 'fping', 'ike-scan', 'dmitry', 'braa'];
function toolWall(c, t, a) {
  c.save(); font(c, F.mono, 26, 700, 2); c.textBaseline = 'middle';
  for (let r = 0; r < 14; r++) {
    const s = Array.from({ length: 30 }, (_, i) => WALL[Math.floor(hash(r * 41 + i) * WALL.length)]).join('  ·  ');
    const w = c.measureText(s).width, dir = r % 2 ? 1 : -1, x = ((t * (500 + hash(r) * 500) * dir) % w + w) % w;
    c.globalAlpha = a * (0.10 + 0.12 * hash(r + 3)); c.fillStyle = r % 3 ? COL.blue : COL.ice;
    c.fillText(s, -x, 60 + r * 75); c.fillText(s, w - x, 60 + r * 75);
  }
  c.restore();
}
function tools(c, t) {
  const lt = t - BARS(3), step = BEAT / 2, i = clamp(Math.floor(lt / step), 0, 7), li = lt - i * step;
  const [name, cat] = TOOLS[i], v = i % 4, inv = v === 1 && li < 0.07;
  backdrop(c, t, 0.6);
  if (inv) { c.fillStyle = COL.blue; c.fillRect(-60, -60, W + 120, H + 120); }
  toolWall(c, t, inv ? 0.3 : 1);
  gridFloor(c, t, 0.35, 3, 860);
  const k = expoOut(li / 0.12), dx = (1 - k) * (v % 2 ? -90 : 90) + (v % 2 ? 1 : -1) * li * 60;
  const size = Math.min(250, 1640 / (name.length * 0.82));
  const x = v === 0 ? 150 : v === 1 ? W - 150 : W / 2, align = v === 0 ? 'left' : v === 1 ? 'right' : 'center';
  c.save(); c.translate(dx, 0);
  text(c, `[${String(i + 1).padStart(2, '0')}]  ${cat}`, x, 400, { fam: F.mono, size: 30, weight: 700, color: inv ? COL.bg : COL.cyan, align, spacing: 6 });
  if (v === 3) {
    c.save(); font(c, F.display, size, 900, 6); c.textAlign = align; c.textBaseline = 'middle';
    c.strokeStyle = COL.cyan; c.lineWidth = 4; c.strokeText(name, x, 560); c.restore();
    text(c, name, x, 560, { fam: F.display, size, weight: 900, color: COL.white, align, spacing: 6, alpha: seg(li, 0.05, 0.12), split: 3 });
  } else {
    c.save(); if (v === 2) { c.translate(x, 560); c.scale(1.12, 1); c.translate(-x, -560); }
    text(c, name, x, 560, { fam: F.display, size, weight: 900, color: inv ? COL.bg : COL.white, align, spacing: 6, split: inv ? 0 : 3 + 20 * spike(li, 0, 14) });
    c.restore();
  }
  c.restore();
  // scanner line sweeping each card
  const sy = lerp(300, 820, li / step);
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5; c.fillStyle = COL.cyan; c.fillRect(0, sy, W, 2); c.restore();
  // counter racing to 600+
  const n = Math.floor(lerp(1, 600, easeOut(lt / BAR)));
  text(c, `TOOL ${String(n).padStart(3, '0')}${n >= 600 ? '+' : ''} / 600+`, W / 2, 860, { fam: F.mono, size: 26, weight: 700, color: COL.blue2, spacing: 6 });
}

// ---------- 7.50 lineage ----------
const LINEAGE = [[2006, 'BACKTRACK'], [2013, 'KALI LINUX 1.0'], [2016, 'KALI ROLLING'], [2026, '13 YEARS ON']];
function lineage(c, t) {
  const t0 = BARS(4), lt = t - t0, j = clamp(Math.floor(lt / BEAT), 0, 3), lj = lt - j * BEAT;
  backdrop(c, t, 0.7);
  dataRain(c, t, 0.1, 1.2);
  gridFloor(c, t, 0.4, 1.6, 900);
  text(c, decode('// LINEAGE', t, t0 + 0.05, 0.25, 6), W / 2, 190, { fam: F.mono, size: 24, weight: 700, color: COL.blue2, spacing: 8 });
  // the big year rolls from one milestone to the next
  const prev = j ? LINEAGE[j - 1][0] : 1999, cur = LINEAGE[j][0], k = expoOut(lj / 0.22);
  const yr = String(Math.round(lerp(prev, cur, k)));
  text(c, yr, W / 2, 420 + (1 - k) * 20, { fam: F.display, size: 290, weight: 900, color: COL.white, spacing: 10, split: 3 + 22 * spike(lj, 0, 10) + 6 * kickPulse(t, 12) });
  text(c, decode(LINEAGE[j][1], t, t0 + j * BEAT, 0.25, j * 7), W / 2, 610, { fam: F.label, size: 58, weight: 700, color: COL.cyan, spacing: 18 });
  // timeline
  const x0 = 260, x1 = 1660, y = 790, xe = lerp(x0, x1, expoOut(lt / (3 * BEAT + 0.15)));
  line(c, x0, y, x1, y, COL.dim, 4); line(c, x0, y, xe, y, COL.blue2, 4);
  LINEAGE.forEach(([yr2, nm], n) => {
    const nx = lerp(x0, x1, n / 3), on = lt >= n * BEAT, p = backOut(seg(lt, n * BEAT, n * BEAT + 0.2), 3);
    c.save(); c.fillStyle = on ? COL.cyan : COL.dim; c.beginPath(); c.arc(nx, y, on ? 12 * p + 2 : 8, 0, TAU); c.fill();
    if (on) { c.strokeStyle = COL.cyan; c.lineWidth = 3; c.globalAlpha = 1 - seg(lt, n * BEAT, n * BEAT + 0.5); c.beginPath(); c.arc(nx, y, 12 + 50 * seg(lt, n * BEAT, n * BEAT + 0.5), 0, TAU); c.stroke(); }
    c.restore();
    text(c, String(yr2), nx, y - 44, { fam: F.mono, size: 28, weight: 700, color: on ? COL.white : COL.dim, spacing: 4 });
    text(c, nm, nx, y + 46, { fam: F.label, size: 24, weight: 700, color: on ? COL.ice : COL.dim, spacing: 4 });
  });
}

// ---------- 9.38 debian / rolling / quarterly ----------
function debian(c, t) {
  const t0 = BARS(5), lt = t - t0;
  backdrop(c, t, 0.7, COL.deep);
  dataRain(c, t, 0.1, 1.2);
  // left: the claims
  text(c, decode('BUILT ON', t, t0, 0.2, 1), 170, 330, { fam: F.label, size: 44, weight: 500, color: COL.ice, align: 'left', spacing: 14 });
  text(c, decode('DEBIAN', t, t0 + 0.03, 0.25, 5), 160, 450, { fam: F.display, size: 160, weight: 900, color: COL.white, align: 'left', spacing: 8, split: 3 + 18 * spike(t, t0, 8) });
  const r1 = t0 + BEAT;
  text(c, decode('ROLLING RELEASE', t, r1, 0.3, 8), 170, 600, { fam: F.label, size: 64, weight: 700, color: COL.cyan, align: 'left', spacing: 10 });
  text(c, decode('UPDATED CONTINUOUSLY', t, r1 + BEAT, 0.3, 14), 172, 680, { fam: F.mono, size: 26, weight: 400, color: COL.blue2, align: 'left', spacing: 6 });
  line(c, 170, 735, 170 + 640 * expoOut(seg(t, r1, r1 + 0.6)), 735, COL.blue, 3);
  // right: four point releases a year, one segment per beat
  const cx = 1390, cy = 520, R = 230, lit = clamp(Math.floor(lt / BEAT) + 1, 0, 4);
  c.save(); c.translate(cx, cy);
  c.rotate(t * 0.4);
  for (let i = 0; i < 72; i++) { c.globalAlpha = 0.6; c.fillStyle = i % 6 ? COL.dim : COL.blue; c.fillRect(R + 52, -1.5, i % 6 ? 12 : 22, 3); c.rotate(TAU / 72); }
  c.restore();
  c.save(); c.translate(cx, cy); c.lineCap = 'butt';
  for (let i = 0; i < 4; i++) {
    const a0 = -Math.PI / 2 + i * TAU / 4 + 0.06, a1 = a0 + TAU / 4 - 0.12, on = i < lit, p = expoOut(seg(lt, i * BEAT, i * BEAT + 0.2));
    c.strokeStyle = COL.dim; c.lineWidth = 30; c.beginPath(); c.arc(0, 0, R, a0, a1); c.stroke();
    if (on) { c.strokeStyle = COL.cyan; c.lineWidth = 30; c.beginPath(); c.arc(0, 0, R, a0, lerp(a0, a1, p)); c.stroke(); }
    const am = (a0 + a1) / 2;
    text(c, '.' + (i + 1), Math.cos(am) * (R + 105), Math.sin(am) * (R + 105), { fam: F.display, size: 38, weight: 700, color: on ? COL.white : COL.dim });
  }
  c.restore();
  text(c, String(Math.max(1, lit)), cx, cy - 22, { fam: F.display, size: 150, weight: 900, color: COL.white, split: 3 + 14 * spike(lt % BEAT, 0, 10) });
  text(c, 'RELEASES / YEAR', cx, cy + 82, { fam: F.label, size: 28, weight: 700, color: COL.ice, spacing: 6 });
}

// ---------- 11.25 platforms ----------
const PLATFORMS = [['INSTALLER', 'BARE METAL', 'disc'], ['VIRTUAL MACHINES', 'PREBUILT IMAGES', 'vm'], ['ARM', 'SINGLE-BOARD PCs', 'chip'],
  ['MOBILE', 'KALI NETHUNTER', 'phone'], ['CLOUD', 'PUBLIC CLOUD', 'cloud'], ['CONTAINERS', 'DOCKER · LXC', 'boxes'], ['LIVE BOOT', 'USB · PERSISTENCE', 'usb'], ['WSL', 'ON WINDOWS', 'term']];
function icon(c, kind, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s / 60, s / 60); c.strokeStyle = col; c.lineWidth = 4; c.lineJoin = 'round'; c.beginPath();
  if (kind === 'disc') { c.arc(30, 30, 28, 0, TAU); c.moveTo(38, 30); c.arc(30, 30, 8, 0, TAU); }
  else if (kind === 'vm') { c.rect(2, 6, 56, 42); c.moveTo(2, 16); c.lineTo(58, 16); c.rect(14, 24, 32, 18); c.moveTo(20, 56); c.lineTo(40, 56); }
  else if (kind === 'chip') { c.rect(14, 14, 32, 32); for (let i = 0; i < 4; i++) { const o = 19 + i * 7.5; c.moveTo(o, 14); c.lineTo(o, 4); c.moveTo(o, 46); c.lineTo(o, 56); c.moveTo(14, o); c.lineTo(4, o); c.moveTo(46, o); c.lineTo(56, o); } }
  else if (kind === 'phone') { c.roundRect(16, 2, 28, 56, 6); c.moveTo(26, 50); c.lineTo(34, 50); }
  else if (kind === 'cloud') { c.moveTo(14, 46); c.arc(14, 36, 10, Math.PI / 2, Math.PI * 1.5); c.arc(28, 24, 14, Math.PI, 0); c.arc(46, 34, 12, -Math.PI / 2, Math.PI / 2); c.closePath(); }
  else if (kind === 'boxes') { c.rect(4, 32, 24, 22); c.rect(32, 32, 24, 22); c.rect(18, 6, 24, 22); }
  else if (kind === 'usb') { c.rect(18, 22, 24, 36); c.rect(23, 4, 14, 18); c.moveTo(27, 10); c.lineTo(27, 14); c.moveTo(33, 10); c.lineTo(33, 14); }
  else if (kind === 'term') { c.rect(2, 8, 56, 44); c.moveTo(12, 22); c.lineTo(22, 30); c.lineTo(12, 38); c.moveTo(28, 40); c.lineTo(42, 40); }
  c.stroke(); c.restore();
}
function platforms(c, t) {
  const t0 = BARS(6), lt = t - t0;
  backdrop(c, t, 0.7);
  dataRain(c, t, 0.08, 1);
  gridFloor(c, t, 0.3, 1.2, 960);
  text(c, decode('RUNS ANYWHERE', t, t0, 0.3, 3), W / 2, 200, { fam: F.display, size: 86, weight: 900, color: COL.white, spacing: 12, split: 3 + 16 * spike(t, t0, 8) });
  const tw = 380, th = 240, gap = 30, x0 = (W - (4 * tw + 3 * gap)) / 2;
  PLATFORMS.forEach(([name, sub, kind], i) => {
    const ti = t0 + i * BEAT / 2; if (t < ti) return;
    const p = backOut(seg(t, ti, ti + 0.16), 2.2), fl = spike(t, ti, 7);
    const x = x0 + (i % 4) * (tw + gap), y = 330 + Math.floor(i / 4) * (th + gap);
    c.save(); c.translate(x + tw / 2, y + th / 2); c.scale(1, p); c.translate(-tw / 2, -th / 2);
    c.fillStyle = rgba(COL.deep, 0.85); chamfer(c, 0, 0, tw, th, 22); c.fill();
    if (fl > 0.02) { c.globalAlpha = fl * 0.6; c.fillStyle = COL.cyan; chamfer(c, 0, 0, tw, th, 22); c.fill(); c.globalAlpha = 1; }
    c.strokeStyle = fl > 0.3 ? COL.cyan : COL.blue; c.lineWidth = 3; chamfer(c, 0, 0, tw, th, 22); c.stroke();
    icon(c, kind, 30, 30, 62, COL.cyan);
    text(c, `0${i + 1}`, tw - 28, 46, { fam: F.mono, size: 22, weight: 700, color: COL.blue, align: 'right' });
    text(c, name, 30, 150, { fam: F.label, size: name.length > 12 ? 34 : 44, weight: 700, color: COL.white, align: 'left', spacing: 4 });
    text(c, sub, 30, 198, { fam: F.mono, size: 20, weight: 400, color: COL.ice, align: 'left', spacing: 3 });
    c.restore();
  });
}

// ---------- 13.13 free ----------
function free(c, t) {
  const tf = word('FREE'), lt = t - tf;
  backdrop(c, t, 0.85);
  rays(c, t, 0.1 + 0.2 * spike(t, tf, 3), 40, -t * 0.06, COL.blue);
  dataRain(c, t, 0.12, 1.4);
  gridFloor(c, t, 0.4, 2, 880);
  shockwave(c, t, tf, W / 2, 470, 1400);
  burst(c, t, tf, 90, W / 2, 470, 0.9);
  // FREE slams, then rises to make room for the rest of the line
  const up = ease(seg(t, word('AND') - 0.1, word('AND') + 0.25));
  const s = lerp(1.6, 1, expoOut(Math.max(0, lt) / 0.25)) * lerp(1, 0.62, up) * (1 + 0.025 * kickPulse(t));
  c.save(); c.translate(W / 2, lerp(480, 350, up)); c.scale(s, s);
  text(c, 'FREE', 0, 0, { fam: F.display, size: 380, weight: 900, color: COL.white, spacing: 14, split: 4 + 34 * spike(t, tf, 5) + 6 * kickPulse(t, 12) });
  c.restore();
  const ws = ['AND', 'ALWAYS', 'WILL', 'BE'], size = 104, sp = 8, gapW = 44;
  const widths = ws.map(w => measure(c, w, F.label, size, 700, sp)), total = widths.reduce((a, b) => a + b, 0) + gapW * 3;
  let x = W / 2 - total / 2;
  const be = word('BE');
  ws.forEach((w, i) => {
    const tw = word(w), k = expoOut(seg(t, tw, tw + 0.15));
    if (t >= tw) {
      c.save(); c.translate(x + widths[i] / 2, 640); c.scale(lerp(1.35, 1, k), lerp(1.35, 1, k));
      text(c, w, 0, 0, { fam: F.label, size, weight: 700, color: t >= be ? mixHex(COL.white, COL.cyan, spike(t, be, 3)) : COL.white, spacing: sp, alpha: k, split: 2 + 16 * spike(t, tw, 9) });
      c.restore();
    }
    x += widths[i] + gapW;
  });
  const lw = 700 * expoOut(seg(t, be, be + 0.4));
  line(c, W / 2 - lw / 2, 735, W / 2 + lw / 2, 735, COL.cyan, 3);
  text(c, decode('( AS IN BEER )', t, be + 0.1, 0.35, 21), W / 2, 790, { fam: F.mono, size: 28, weight: 700, color: COL.blue2, spacing: 10 });
}
function mixHex(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), ch = s => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, clamp(k)));
  return '#' + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
}

// ---------- 16.20 montage on the snare roll ----------
const FLASH = ['600+', 'NMAP', '2013', 'DEBIAN', 'ROOT', 'ARM', 'FREE', 'MSF', 'WIFI', 'HASH', 'SQLi', '0DAY', 'KALI', 'KALI', 'KALI'];
function montage(c, t) {
  const t0 = 16.2, lt = t - t0, step = lt < 0.35 ? BEAT / 4 : BEAT / 8;
  const i = lt < 0.35 ? Math.floor(lt / (BEAT / 4)) : 3 + Math.floor((lt - 0.35) / (BEAT / 8));
  const inv = i % 2 === 1;
  c.fillStyle = inv ? COL.blue : COL.bg; c.fillRect(-60, -60, W + 120, H + 120);
  dataRain(c, t, inv ? 0.15 : 0.3, 4, inv ? COL.bg : COL.blue);
  const s = FLASH[Math.min(i, FLASH.length - 1)];
  const k = clamp((t - t0 - (i < 3 ? i * BEAT / 4 : 0.35 + (i - 3) * BEAT / 8)) / step);
  text(c, s, W / 2, H / 2, { fam: F.display, size: 330 * lerp(1.15, 1, expoOut(k / 0.5)), weight: 900, color: inv ? COL.bg : COL.white, spacing: 10, split: inv ? 0 : 18 });
  const close = seg(t, BREAK - 0.07, BREAK);
  if (close > 0) { c.fillStyle = COL.bg; c.fillRect(-60, -60, W + 120, (H / 2 + 60) * close); c.fillRect(-60, H - (H / 2 + 60) * close, W + 120, (H / 2 + 60) * close + 60); }
}

// ---------- 16.88 breakdown: the motto ----------
function wordsLine(c, t, ws, y, size, col, spacing, fam = F.label, weight = 500) {
  const sp = spacing, gapW = size * 0.42;
  const widths = ws.map(([w]) => measure(c, w, fam, size, weight, sp)), total = widths.reduce((a, b) => a + b, 0) + gapW * (ws.length - 1);
  let x = W / 2 - total / 2;
  ws.forEach(([w, tw], i) => {
    const k = ease(seg(t, tw - 0.04, tw + 0.25));
    if (k > 0) text(c, w, x + widths[i] / 2, y + (1 - k) * 14, { fam, size, weight, color: col, spacing: sp + (1 - k) * 18, alpha: k, split: 1.5 * (1 - k) * 6 });
    x += widths[i] + gapW;
  });
}
function waveform(c, t, y, amp, a) {
  const pts = 220, x0 = 120, x1 = W - 120;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [lw, al, col] of [[10, 0.18, COL.blue2], [3, 0.9, COL.cyan]]) {
    c.strokeStyle = col; c.lineWidth = lw; c.globalAlpha = a * al; c.beginPath();
    for (let i = 0; i <= pts; i++) {
      const u = i / pts, x = lerp(x0, x1, u), win = Math.sin(u * Math.PI) ** 1.5;
      const e = vo(t - Math.abs(u - 0.5) * 0.25);
      const v = Math.sin(u * 46 + t * 13) * 0.55 + Math.sin(u * 113 - t * 21) * 0.3 + Math.sin(u * 9 + t * 3) * 0.4;
      const yy = y + v * win * (amp * (0.15 + 1.4 * e));
      i ? c.lineTo(x, yy) : c.moveTo(x, yy);
    }
    c.stroke();
  }
  c.restore();
}
function breakdown(c, t) {
  const lt = t - BREAK, build = seg(t, BARS(10), CUT), push = 1 + 0.08 * easeIn(build);
  c.fillStyle = '#010309'; c.fillRect(-60, -60, W + 120, H + 120);
  c.save(); c.translate(W / 2, H / 2); c.scale(push, push); c.translate(-W / 2, -H / 2);
  radialGlow(c, W / 2, H / 2, 900, rgba(COL.deep, 1), 0.5 + 0.5 * build);
  dataRain(c, t, 0.05 + 0.1 * build, 0.4 + 2 * build);
  dust(c, t, 0.35 + 0.3 * build);
  gridFloor(c, t, 0.45 * easeIn(build), 0.4 + 3 * build, 900);
  // the dragon starts tracing itself behind the words: the hit is coming
  const dr = seg(t, BARS(10) + 0.1, CUT - 0.05);
  if (dr > 0) {
    const s = 1.65, cx = W / 2, cy = H / 2 + 10, [bx, by, bw, bh] = KALI_LOGO.dragon.box;
    c.save(); c.translate(cx, cy); c.scale(s, s); c.translate(-(bx + bw / 2), -(by + bh / 2));
    c.strokeStyle = COL.blue2; c.lineWidth = 2.2 / s * 1.6; c.globalAlpha = 0.12 + 0.4 * easeIn(dr);
    c.setLineDash([KALI_LOGO.dragon.len * easeOut(dr), KALI_LOGO.dragon.len]); c.stroke(DRAGON); c.restore();
  }
  waveform(c, t, 560, 70 + 120 * easeIn(build), 0.9);
  const W1 = ['THE', 'QUIETER', 'YOU', 'BECOME,'].map((w, i) => [w, CUES.words.filter(x => x.line === 'vo4')[i].t]);
  const W2 = ['THE', 'MORE', 'YOU', 'ARE', 'ABLE', 'TO', 'HEAR.'].map((w, i) => [w, CUES.words.filter(x => x.line === 'vo4')[i + 4].t]);
  c.save(); c.globalAlpha = lerp(1, 0.45, seg(t, W2[0][1], W2[0][1] + 0.6));
  wordsLine(c, t, W1, 390, 64, COL.white, 16);
  c.restore();
  wordsLine(c, t, W2, 735, 64, COL.ice, 16);
  c.restore();
  // tension: brightening at the edges right before the cut
  if (build > 0.7) radialGlow(c, W / 2, H / 2, 1300, rgba(COL.blue2, 1), (build - 0.7) * 0.8);
}

// ---------- 20.63 silence ----------
function silence(c, t) {
  c.fillStyle = '#000'; c.fillRect(-60, -60, W + 120, H + 120);
  if (t < CUT + 0.24) { c.fillStyle = COL.ice; c.fillRect(W / 2 - 14, H / 2 - 30, 28, 60); }
}

// ---------- 21.09 the hit: logo ----------
function logo(c, t) {
  const lt = t - HIT, s = 1.32 * (1 + 0.025 * lt) * lerp(1.12, 1, expoOut(lt / 0.45));
  backdrop(c, t, 0.9, COL.deep);
  radialGlow(c, W / 2 - 260, 470, 900, rgba(COL.blue, 1), 0.55 + 0.4 * spike(t, HIT, 2) + 0.06 * Math.sin(t * 3));
  dataRain(c, t, 0.07, 0.6);
  gridFloor(c, t, 0.3, 0.6, 930);
  dust(c, t, 0.4);
  rays(c, t, 0.28 * spike(t, HIT, 1.6), 64, t * 0.05, COL.blue2, W / 2 - 260, 470);
  shockwave(c, t, HIT, W / 2 - 260, 470, 1800, COL.ice);
  burst(c, t, HIT, 220, W / 2 - 260, 470, 1.4);
  const cx = W / 2, cy = 470, vx = 480.5, vy = 224.6;
  c.save(); c.translate(cx, cy); c.scale(s, s); c.translate(-vx, -vy);
  // dragon: on with the hit, with an electric flicker for a few frames
  const flick = lt < 0.16 ? (hash(Math.floor(t * 30)) > 0.3 ? 1 : 0.25) : 1;
  c.globalAlpha = flick; c.fillStyle = COL.white; c.fill(DRAGON);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.8 * spike(t, HIT, 4.5); c.strokeStyle = COL.cyan; c.lineWidth = 4; c.stroke(DRAGON);
  c.globalCompositeOperation = 'source-over';
  // wordmark: the box draws itself on "Kali", then fills
  const tk = word('KALI'), d = seg(t, tk - 0.06, tk + 0.24);
  if (d > 0) {
    c.globalAlpha = 1; c.strokeStyle = COL.cyan; c.lineWidth = 2.5; c.setLineDash([KALI_LOGO.word.len * easeOut(d), KALI_LOGO.word.len]); c.stroke(WORD); c.setLineDash([]);
    const fk = seg(t, tk + 0.12, tk + 0.3);
    if (fk > 0) { c.globalAlpha = fk * (fk < 1 && hash(Math.floor(t * 30) + 3) < 0.35 ? 0.3 : 1); c.fillStyle = COL.white; c.fill(WORD, 'evenodd'); }
  }
  c.restore();
  // LINUX under the box, on "Linux"
  const tl = word('LINUX'), bx = cx + (750.8 - vx) * s, by = cy + (330 - vy) * s;
  text(c, decode('LINUX', t, tl, 0.28, 17), bx, by + 50, { fam: F.label, size: 64, weight: 700, color: COL.ice, spacing: 46, split: 2 + 14 * spike(t, tl, 8) });
  text(c, decode('THE MOST ADVANCED PENETRATION TESTING DISTRIBUTION', t, tl + 0.45, 0.6, 31), W / 2, 880, { fam: F.label, size: 32, weight: 500, color: COL.blue2, spacing: 8, alpha: 0.95 });
  text(c, decode('KALI.ORG', t, tl + 0.8, 0.3, 41), W / 2, 940, { fam: F.mono, size: 26, weight: 700, color: COL.ice, spacing: 10 });
}

// ---------- assembly ----------
const SHOTS = [[0, intro], [DROP, drop600], [BARS(3), tools], [BARS(4), lineage], [BARS(5), debian], [BARS(6), platforms],
  [BARS(7), free], [16.2, montage], [BREAK, breakdown], [CUT, silence], [HIT, logo]];
function shake(t) {
  const amp = 22 * spike(t, DROP, 6) + 30 * spike(t, HIT, 4) + (GROOVE(t) ? 5 * kickPulse(t, 14) : 0) + 12 * spike(t, word('FREE'), 8)
    + 10 * seg(t, 15.94, BREAK) * (t < BREAK) + 6 * spike(t, word('GRANTED'), 10) + 8 * easeIn(seg(t, 20.1, CUT)) * (t < CUT);
  const f = Math.floor(t * 30);
  return [(hash(f * 1.7) - 0.5) * 2 * amp, (hash(f * 2.3 + 9) - 0.5) * 2 * amp];
}
function drawFrame(c, t) {
  let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++;
  const [sx, sy] = shake(t);
  c.save(); c.translate(sx, sy);
  SHOTS[i][1](c, t);
  c.restore();
  const hudA = t < DROP ? 0.55 * seg(t, 0.4, 1.0) : t < BREAK ? 1 : t >= HIT ? 0.35 * seg(t, HIT + 0.6, HIT + 1.2) : 0;
  hud(c, t, hudA);
}
function fxAt(t) {
  let g = 0.015;
  g += 0.9 * spike(t, word('GRANTED'), 7) + 1.1 * spike(t, DROP, 5) + 0.5 * spike(t, word('FREE'), 8);
  for (const b of [3, 4, 5, 6, 7]) g += 0.7 * spike(t, BARS(b), 10);
  for (const b of CUES.blips) g += 0.28 * spike(t, b, 16);
  if (t >= 16.2 && t < BREAK) g += 0.3 + 0.5 * hash(Math.floor(t * 40));
  g += 0.8 * spike(t, BREAK, 4) + (t < CUT ? 0.7 * easeIn(seg(t, 19.7, CUT)) : 0) + 1.2 * spike(t, HIT, 4.5);
  if (GROOVE(t) && hash(Math.floor(t * 15) + 0.5) > 0.94) g += 0.3;
  const groove = GROOVE(t) ? 1 : 0;
  return {
    glitch: clamp(g, 0, 1.4), ca: 0.4 + 2.4 * g + 0.6 * kickPulse(t, 10) * groove,
    flash: 0.6 * spike(t, DROP, 13) + 0.95 * spike(t, HIT, 10) + 0.3 * spike(t, word('GRANTED'), 12) + 0.25 * spike(t, word('FREE'), 12) + 0.35 * spike(t, BREAK, 12),
    flashCol: t >= HIT ? '#C9E0FF' : '#FFFFFF',
    bloom: 0.75 + 0.3 * spike(t, DROP, 5) + 0.5 * spike(t, HIT, 3) + 0.25 * kickPulse(t) * groove,
    scan: 0.14, grain: 0.05, vig: 0.85, warp: 0.07, seed: hash(Math.floor(t * 30) + 0.37),
    fade: Math.min(clamp(t / 0.15), 1 - seg(t, DUR - 0.7, DUR - 0.05)),
  };
}
