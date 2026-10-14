#!/usr/bin/env python3
"""Soundtrack for the Kali Linux promo.

Synthesizes a 128 BPM darksynth track in F minor and mixes the ElevenLabs voice-over and sound effects
(audio/elevenlabs/*.mp3) onto the same beat grid, so every hit lands on a frame the visuals know about.

    python3 projects/kali/audio/music.py          ->  out/kali/mix.wav  +  projects/kali/cues.js

cues.js holds the timeline (bars, hits, VO word times) that the scene code reads, so audio and picture
share one source of truth. Needs numpy, scipy and ffmpeg.
"""
import json, os, subprocess
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
EL = os.path.join(HERE, 'elevenlabs')
OUT_DIR = os.path.join(ROOT, 'out', 'kali')

SR = 48000
BPM = 128
BEAT = 60 / BPM
BAR = 4 * BEAT
S16 = BEAT / 4
DROP = 2 * BAR                  # 3.75 s: the beat drops on "600+"
BREAK = 9 * BAR                 # 16.875 s: breakdown under the motto
CUT = 11 * BAR                  # 20.625 s: everything stops dead
HIT = 11 * BAR + BEAT           # 21.094 s: final hit, logo
DUR = 24.5
N = int(DUR * SR)
rng = np.random.default_rng(1337)

# bar -> chord. i - VI - III - VII in F minor, the darksynth staple.
CHORDS = {
    'Fm': dict(root=41, pad=[53, 56, 60, 65], arp=[65, 68, 72, 77]),
    'Db': dict(root=37, pad=[53, 56, 61, 65], arp=[61, 65, 68, 73]),
    'Ab': dict(root=44, pad=[51, 56, 60, 63], arp=[68, 72, 75, 80]),
    'Eb': dict(root=39, pad=[51, 55, 58, 63], arp=[63, 67, 70, 75]),
}
SONG = {0: 'Fm', 1: 'Fm', 2: 'Fm', 3: 'Db', 4: 'Ab', 5: 'Eb', 6: 'Fm', 7: 'Db', 8: 'Eb', 9: 'Db', 10: 'Eb', 11: 'Fm', 12: 'Fm'}
GROOVE_BARS = range(2, 9)       # full beat
VO_RMS = -17                    # dBFS RMS each voice line is leveled to
MUSIC_GAIN = -11                # music bed against the voice (dB)
VO_TRIM = {'vo1': 0, 'vo2': 4, 'vo3': 3, 'vo4': 1, 'vo5': 5}   # whispers sit on a quiet bed; the rest fight the full beat


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def ts(n):
    return np.arange(n) / SR


def sec(s):
    return int(round(s * SR))


def stereo():
    return np.zeros((N, 2))


def add(bus, sig, t, gain=1.0, pan=0.0):
    """Mix sig (mono or stereo) into bus at time t (s), equal-power pan -1..1."""
    i0 = sec(t)
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], 1)
    if i0 < 0:
        sig, i0 = sig[-i0:], 0
    n = min(len(sig), N - i0)
    if n > 0:
        bus[i0:i0 + n] += sig[:n] * gain


# ---------- DSP ----------
def svf(x, fc, q=0.707, mode='lp'):
    """Zavalishin TPT state-variable filter; fc may vary per sample."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    xs, A1, A2, A3 = x.tolist(), a1.tolist(), a2.tolist(), a3.tolist()
    out = [0.0] * len(xs)
    ic1 = ic2 = 0.0
    for i in range(len(xs)):
        v3 = xs[i] - ic2
        v1 = A1[i] * ic1 + A2[i] * v3
        v2 = ic2 + A2[i] * ic1 + A3[i] * v3
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        out[i] = v2 if mode == 'lp' else v1 if mode == 'bp' else xs[i] - k * v1 - v2
    return np.array(out)


def butter(x, fc, kind='low', order=2):
    sos = signal.butter(order, fc, kind, fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0)


def blep(p, dt):
    out = np.zeros_like(p)
    a = p < dt
    t = p[a] / dt[a] if np.ndim(dt) else p[a] / dt
    out[a] = 2 * t - t * t - 1
    b = p > 1 - (dt if np.ndim(dt) == 0 else dt)
    if np.ndim(dt):
        t = (p[b] - 1) / dt[b]
    else:
        t = (p[b] - 1) / dt
    out[b] = t * t + 2 * t + 1
    return out


def saw(f, n, phase=0.0):
    """Band-limited (polyBLEP) saw; f scalar or per-sample array."""
    f = np.broadcast_to(np.asarray(f, float), (n,))
    dt = f / SR
    p = (phase + np.cumsum(dt)) % 1.0
    return 2 * p - 1 - blep(p, dt)


def square(f, n, phase=0.0):
    f = np.broadcast_to(np.asarray(f, float), (n,))
    dt = f / SR
    p = (phase + np.cumsum(dt)) % 1.0
    q = (p + 0.5) % 1.0
    return np.where(p < 0.5, 1.0, -1.0) + blep(p, dt) - blep(q, dt)


def sine_sweep(f, n):
    f = np.broadcast_to(np.asarray(f, float), (n,))
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def adsr(n, a=0.005, d=0.1, s=0.0, r=0.05, hold=None):
    t = ts(n)
    hold = (n / SR - r) if hold is None else hold
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = np.clip((t - hold) / max(r, 1e-6), 0, 1)
    return e * (1 - rel)


def supersaw(m, n, detune=0.22, voices=7, width=0.9):
    """Detuned saw stack, returned stereo."""
    out = np.zeros((n, 2))
    for v in range(voices):
        k = v / (voices - 1) * 2 - 1
        f = mtof(m + k * detune)
        s = saw(f, n, rng.random())
        a = (k * width + 1) * np.pi / 4
        out[:, 0] += s * np.cos(a)
        out[:, 1] += s * np.sin(a)
    return out / np.sqrt(voices)


def reverb_ir(rt60=2.2, pre=0.012, damp=4500):
    n = sec(rt60 * 1.2)
    t = ts(n)
    ir = rng.standard_normal((n, 2)) * np.exp(-6.91 * t / rt60)[:, None]
    ir = butter(ir, damp, 'low', 1)
    ir[:sec(pre)] = 0
    return ir / np.sqrt((ir ** 2).sum(0, keepdims=True))


def reverb(x, rt60=2.2, damp=4500):
    ir = reverb_ir(rt60, damp=damp)
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:N] for c in range(2)], 1)
    return y


def pingpong(x, delay, fb=0.45, taps=6):
    y = np.zeros_like(x)
    d = sec(delay)
    for k in range(1, taps + 1):
        g = fb ** k
        src = x[:, 0] + x[:, 1]
        ch = k % 2
        y[d * k:, ch] += src[:N - d * k] * g * 0.5
    return y


def load(name):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(EL, name), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def atempo(name, rate):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(EL, name), '-af', f'atempo={rate}', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def fade(x, fin=0.0, fout=0.0):
    x = x.copy()
    if fin:
        k = sec(fin)
        x[:k] *= np.linspace(0, 1, k)[:, None] if x.ndim == 2 else np.linspace(0, 1, k)
    if fout:
        k = sec(fout)
        x[-k:] *= np.linspace(1, 0, k)[:, None] if x.ndim == 2 else np.linspace(1, 0, k)
    return x


def db(g):
    return 10 ** (g / 20)


# ---------- instruments ----------
def kick(big=False):
    n = sec(1.6 if big else 0.42)
    t = ts(n)
    f = 44 + 120 * np.exp(-t * 30) + (30 * np.exp(-t * 5) if big else 0)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (2.2 if big else 7.5))
    click = butter(rng.standard_normal(n), 2500, 'high') * np.exp(-t * 400) * 0.35
    k = np.tanh(2.2 * (body + click)) / np.tanh(2.2)
    return k * np.minimum(1, t / 0.0015)


def clap():
    n = sec(0.45)
    t = ts(n)
    noise = butter(rng.standard_normal(n), [900, 4200], 'band')
    env = sum(np.exp(-np.clip(t - o, 0, None) * (160 if o < 0.02 else 13)) * (t >= o) for o in (0, 0.009, 0.019))
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 28) * 0.5
    return (noise * env * 0.9 + body) * 0.8


def hat(open_=False):
    n = sec(0.35 if open_ else 0.06)
    t = ts(n)
    metal = sum(square(f, n, rng.random()) for f in (3150, 4160, 5300, 6240, 7900, 9100)) / 6
    x = butter(metal * 0.6 + rng.standard_normal(n) * 0.6, 7200, 'high')
    return x * np.exp(-t * (9 if open_ else 70))


def crash(len_=2.4):
    n = sec(len_)
    t = ts(n)
    x = butter(rng.standard_normal((n, 2)), 3800, 'high')
    x += butter(sum(square(f, n, rng.random()) for f in (3800, 5210, 6430, 8120))[:, None] * 0.15, 3000, 'high')
    return x * np.exp(-t * 2.4)[:, None] * 0.6


def snare_hit(pitch=1.0):
    n = sec(0.16)
    t = ts(n)
    noise = butter(rng.standard_normal(n), [1500 * pitch, 7000], 'band')
    tone = np.sin(2 * np.pi * 200 * pitch * t) * 0.5
    return (noise + tone) * np.exp(-t * 26)


def bass_note(m, dur, bright=1.0):
    n = sec(dur)
    t = ts(n)
    f = mtof(m)
    x = saw(f, n) * 0.7 + saw(f * 1.006, n, 0.3) * 0.5 + square(f / 2, n) * 0.45
    fc = 140 + 1700 * bright * np.exp(-t / 0.045)
    y = svf(x, fc, q=1.4)
    return np.tanh(1.6 * y) * adsr(n, a=0.002, d=0.08, s=0.55, r=0.015)


def pluck(m, dur, cutoff, res=1.6):
    n = sec(dur)
    t = ts(n)
    f = mtof(m)
    x = saw(f, n) * 0.6 + square(f * 1.003, n, 0.25) * 0.4
    y = svf(x, cutoff * (0.35 + 0.65 * np.exp(-t / 0.05)), q=res)
    return y * adsr(n, a=0.002, d=0.07, s=0.15, r=0.02)


def stab(notes, dur, bright=4200, decay=0.12):
    n = sec(dur)
    t = ts(n)
    x = sum(supersaw(m, n) for m in notes) / len(notes)
    fc = 500 + bright * np.exp(-t / decay)
    y = np.stack([svf(x[:, c], fc, q=0.9) for c in range(2)], 1)
    return y * adsr(n, a=0.003, d=decay * 2, s=0.35, r=0.04)[:, None]


def pad(notes, dur, fc=1100, attack=0.6, release=0.8):
    n = sec(dur)
    x = sum(supersaw(m, n, detune=0.12) for m in notes) / len(notes)
    y = butter(x, fc, 'low', 2)
    return y * adsr(n, a=attack, d=1, s=1, r=release)[:, None]


def blip(m, dur=0.07):
    n = sec(dur)
    t = ts(n)
    f = mtof(m) * (1 + 1.2 * np.exp(-t * 90))
    return square(f, n) * np.exp(-t * 38) * 0.6


def noise_sweep(dur, f0, f1, q=2.5, curve=2.0, rising=True):
    n = sec(dur)
    k = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** (k ** curve if rising else k)
    x = rng.standard_normal(n)
    y = svf(x, fc, q=q, mode='bp')
    amp = (k ** 1.6) if rising else (1 - k) ** 1.4
    return y * amp


def build():
    drums, bass, synth, fx, vo = stereo(), stereo(), stereo(), stereo(), stereo()
    sends = stereo()                                # reverb send
    kicks = []

    def bar_t(b, step=0):
        return b * BAR + step * S16

    # ---- intro: bars 0-1 ----
    drone = np.zeros(N)
    nd = sec(CUT)
    drone[:nd] = (np.sin(2 * np.pi * mtof(29) * ts(nd)) * 0.5 + butter(saw(mtof(41), nd), 260, 'low') * 0.4)
    drone_env = np.clip(ts(N) / 1.5, 0, 1) * (ts(N) < DROP) + (ts(N) >= BREAK) * (ts(N) < CUT) * 0.9
    add(bass, drone * drone_env, 0, 0.55)

    # arp: 16ths across the whole song, filter opens through the intro, tucked under the groove, dark in the breakdown
    for i in range(int(CUT / S16)):
        t = i * S16
        b = int(t // BAR)
        ch = CHORDS[SONG[b]]
        seq = [0, 1, 2, 3, 2, 1, 2, 3][i % 8]
        m = ch['arp'][seq] + (12 if (i // 8) % 4 == 3 and b >= 2 else 0)
        if t < DROP:
            cut, g = 350 * (9 ** (t / DROP)), 0.22 + 0.25 * t / DROP
            if t > DROP - BEAT / 2:
                continue
        elif t < BREAK:
            cut, g = 2600, 0.20
        else:
            cut, g = 700 + 1800 * ((t - BREAK) / (CUT - BREAK)) ** 2, 0.22
        p = pluck(m, S16 * 0.95, cut)
        add(synth, p, t, g, pan=0.35 * np.sin(i * 0.7))
        add(sends, p, t, g * 0.4)

    # filtered kick heartbeat in bar 1, 16th hats climbing
    for k in range(4):
        add(drums, butter(kick(), 260, 'low', 2), bar_t(1, 4 * k), 0.55)
    for i in range(14):
        add(drums, hat(), bar_t(1, i), 0.10 + 0.25 * i / 14, pan=0.25)

    # ---- groove: bars 2-8 ----
    for b in GROOVE_BARS:
        ch = CHORDS[SONG[b]]
        for beat in range(4):
            t = bar_t(b, beat * 4)
            if not (b == 8 and beat == 3):
                add(drums, kick(), t, 1.0)
                kicks.append(t)
            if beat in (1, 3):
                c = clap()
                add(drums, c, t, 0.55)
                add(sends, c, t, 0.25)
            add(drums, hat(True), t + 2 * S16, 0.22, pan=-0.2)
            for s in (1, 3):
                add(drums, hat(), t + s * S16, 0.12 if s == 1 else 0.16, pan=0.3)
            # rolling bass on the three 16ths after each kick
            for s in (1, 2, 3):
                m = ch['root'] + (12 if s == 3 and beat % 2 else 0)
                add(bass, bass_note(m, S16 * 0.92, bright=1.0 if s == 1 else 0.7), t + s * S16, 0.42)
        # stabs: syncopated, lighter under the voice-over bars
        loud = b in (4, 5, 6)
        for step in ([0, 3, 6, 10, 14] if loud else [0, 6, 10]):
            st = stab(ch['pad'], S16 * (2.5 if step == 14 else 1.6), bright=5200 if loud else 3200)
            add(synth, st, bar_t(b, step), 0.26 if loud else 0.16)
            add(sends, st, bar_t(b, step), 0.14)
        # soft pad bed
        pd = pad(ch['pad'], BAR + 0.3, fc=900, attack=0.05, release=0.3)
        add(synth, pd, bar_t(b), 0.10)

    # tool-name barrage (bar 3): a zap on every 8th, one per name on screen
    blips = []
    for i in range(8):
        t = bar_t(3, 2 * i)
        m = [77, 84, 80, 89, 82, 87, 79, 91][i]
        add(fx, blip(m), t, 0.22, pan=[-0.6, 0.6][i % 2])
        add(sends, blip(m), t, 0.12)
        blips.append(t)

    # crashes on section starts
    for b in (2, 4, 6):
        add(drums, crash(), bar_t(b), 0.5)

    # bar 8: snare roll into the breakdown
    roll = [bar_t(8, 8 + k) for k in range(8)] + [bar_t(8, 12) + k * S16 / 2 for k in range(8)]
    for j, t in enumerate(roll):
        add(drums, snare_hit(1 + j / 30), t, 0.12 + 0.4 * j / len(roll), pan=0.15 * (-1) ** j)
    add(fx, noise_sweep(BAR / 2, 400, 9000), bar_t(8, 8), 0.16)

    # ---- breakdown: bars 9-10 ----
    add(fx, noise_sweep(1.6, 9000, 120, rising=False), BREAK, 0.18)                    # downlifter
    nsub = sec(1.8)
    add(bass, sine_sweep(80 * np.exp(-ts(nsub) * 1.2) + 28, nsub) * np.exp(-ts(nsub) * 2.2), BREAK, 0.8)
    for b in (9, 10):
        pd = pad(CHORDS[SONG[b]]['pad'], BAR + 0.2, fc=1400 if b == 9 else 2200, attack=0.4, release=0.2)
        add(synth, pd, bar_t(b), 0.22)
        add(sends, pd, bar_t(b), 0.3)
    # bar 10: build. 8ths -> 16ths -> 32nds, hard stop at CUT
    roll = [bar_t(10, 2 * k) for k in range(4)] + [bar_t(10, 8 + k) for k in range(4)] + [bar_t(10, 12) + k * S16 / 2 for k in range(8)]
    for j, t in enumerate(roll):
        add(drums, snare_hit(1 + j / 22), t, 0.06 + 0.42 * (j / len(roll)) ** 1.5)
    sw = noise_sweep(BAR, 300, 11000, q=3, curve=1.6)
    add(fx, sw, bar_t(10), 0.22)

    # ---- the hit ----
    add(drums, kick(big=True), HIT, 1.1)
    nb = sec(3.2)
    boom = sine_sweep(55 * np.exp(-ts(nb) * 0.5) + 6, nb) * np.exp(-ts(nb) * 1.1)
    add(bass, np.tanh(1.5 * boom), HIT, 0.9)
    add(drums, crash(3.2), HIT, 0.65)
    big = stab([41, 48, 53, 56, 60, 65, 68, 72], 3.2, bright=6000, decay=0.35)
    add(synth, big, HIT, 0.38)
    add(sends, big, HIT, 0.5)
    tail = pad(CHORDS['Fm']['pad'] + [72], DUR - HIT - 0.2, fc=1600, attack=0.02, release=2.0)
    add(synth, tail, HIT, 0.16)
    add(sends, tail, HIT, 0.2)

    # ---- ElevenLabs layers ----
    def put(bus, name, t, g, fin=0.0, fout=0.0, src=None):
        x = load(name) if src is None else src
        add(bus, fade(x, fin, fout), t, g)

    put(fx, 'sfx_typing_1.mp3', 0.1, db(-9), fin=0.05, fout=0.25)
    riser = load('sfx_riser_1.mp3')[:sec(3.40)]
    put(fx, '', DROP - 3.40, db(-7), fin=1.2, src=riser)
    put(fx, 'sfx_impact_3.mp3', DROP, db(-3), fout=0.3)
    put(fx, 'sfx_glitch_3.mp3', 2.23, db(-14), fout=0.2)                           # "granted"
    put(fx, 'sfx_whoosh_0.mp3', bar_t(4) - 0.18, db(-8))
    put(fx, 'sfx_whoosh_1.mp3', bar_t(5) - 0.18, db(-8))
    put(fx, 'sfx_whoosh_0.mp3', bar_t(6) - 0.18, db(-8))
    put(fx, 'sfx_glitch_0.mp3', bar_t(7) - 0.05, db(-13), fout=0.4)
    put(fx, 'sfx_glitch_2.mp3', BREAK - 0.12, db(-11), fout=0.2)
    put(fx, '', CUT - (3.40 - 1.35), db(-6), fin=0.4, src=riser[sec(1.35):])          # second riser, ends dead on the cut
    put(fx, 'sfx_impact_0.mp3', HIT, db(-1), fout=0.6)

    # voice-over: (file, start, tempo); word times come from ElevenLabs Scribe transcripts of these exact takes
    VO = [
        ('vo1_root_0.mp3', 0.55, 1.0, [('ROOT', 0.16), ('ACCESS', 0.56), ('GRANTED', 1.68)], 2.56),
        ('vo2_tools_0.mp3', DROP + 0.05, 1.0, [('OVER', 0.16), ('600', 0.72), ('TOOLS', 1.84)], 2.72),
        ('vo3_free_1.mp3', 13.125 - 0.24 + 0.03, 1.0, [('FREE', 0.24), ('AND', 1.36), ('ALWAYS', 1.68), ('WILL', 2.32), ('BE', 2.64)], 3.28),
        ('vo4_quieter_0.mp3', BREAK - 0.08, 1.06, [('THE', 0.16), ('QUIETER', 0.32), ('YOU', 0.96), ('BECOME', 1.12), ('THE', 2.32),
                                                    ('MORE', 2.64), ('YOU', 2.88), ('ARE', 3.04), ('ABLE', 3.2), ('TO', 3.52), ('HEAR', 3.88)], 4.48),
        ('vo5_kali_0.mp3', HIT + 0.3, 1.0, [('KALI', 0.16), ('LINUX', 0.8)], 1.84),
    ]
    words = []
    for name, t0, rate, ws, length in VO:
        x = atempo(name, rate) if rate != 1 else load(name)
        x = butter(x, 90, 'high', 2)
        if name.startswith('vo4'):
            x = fade(x, fout=0.25)
        # level every line to the same speech RMS, then trim by what it has to cut through
        e = np.abs(x).max(1)
        act = e > e.max() * db(-30)
        x *= db(VO_RMS + VO_TRIM[name[:3]]) / np.sqrt(np.mean(x[act] ** 2))
        add(vo, x, t0)
        for w, s in ws:
            words.append({'w': w, 't': round(t0 + s / rate, 3), 'line': name[:3]})
    vo_wet = reverb(vo, rt60=1.4, damp=6000) * 0.12

    # ---- mix ----
    tt = ts(N)
    sc = np.ones(N)
    for k in kicks:                                  # sidechain pump from every groove kick
        d = tt - k
        m = d >= 0
        sc[m] = np.minimum(sc[m], 1 - 0.65 * np.exp(-d[m] / 0.075) * np.minimum(1, d[m] / 0.004 + 0.3))
    v_env = np.abs(vo).max(1)
    v_env = signal.lfilter([1 - np.exp(-1 / (0.12 * SR))], [1, -np.exp(-1 / (0.12 * SR))], np.minimum(v_env * 6, 1))
    duck = 1 - 0.55 * np.clip(v_env, 0, 1)            # ~ -7 dB under the voice

    wet = reverb(sends, rt60=2.4, damp=5000)
    wet += pingpong(synth * 0.5, 3 * S16, fb=0.35) * 0.35
    music = drums * duck[:, None] ** 0.5 + (bass + synth + wet) * (sc * duck)[:, None] + fx * duck[:, None] ** 0.3
    music[sec(CUT):sec(HIT)] *= 0.0                  # the silence before the hit
    # section levels: a dark, quiet intro and breakdown make the drop and the hit land
    lvl = np.where(tt < DROP, db(-6), np.where((tt >= BREAK) & (tt < CUT), db(-5), 1.0))
    lvl = signal.lfilter([0.002], [1, -0.998], lvl, zi=[lvl[0] * 0.998])[0]   # ~10 ms glide between levels
    music *= (lvl * db(MUSIC_GAIN))[:, None]
    mix = music + vo + vo_wet
    mix = butter(mix, 28, 'high', 2)
    mix = np.tanh(mix * 1.1) / 1.1                   # gentle glue
    mix *= db(-1) / np.abs(mix).max()
    mix *= np.clip((DUR - tt) / 0.6, 0, 1)[:, None]  # end fade

    os.makedirs(OUT_DIR, exist_ok=True)
    from scipy.io import wavfile
    pre = os.path.join(OUT_DIR, 'mix_pre.wav')
    wavfile.write(pre, SR, mix.astype(np.float32))
    if os.environ.get('STEMS'):
        for name, x in (('vo', vo), ('music', music)):
            wavfile.write(os.path.join(OUT_DIR, f'stem_{name}.wav'), SR, x.astype(np.float32))
    # static gain to -12 LUFS, then a brickwall limiter: keeps the intro/drop contrast that loudnorm's dynamic mode squashes
    meas = subprocess.run(['ffmpeg', '-nostats', '-i', pre, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    lufs = float(meas.rsplit('I:', 1)[1].split('LUFS')[0])
    final = os.path.join(OUT_DIR, 'mix.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', pre, '-af',
                    f'volume={-12 - lufs:.2f}dB,alimiter=limit=0.8:attack=3:release=60:level=disabled', '-c:a', 'pcm_s16le', final], check=True)
    print(f'pre-master {lufs:.1f} LUFS -> gain {-12 - lufs:+.1f} dB')

    def env60(x, tau=0.03):
        e = np.abs(x).max(1)
        e = signal.lfilter([1 - np.exp(-1 / (tau * SR))], [1, -np.exp(-1 / (tau * SR))], e)
        e = e[::SR // 60][:int(DUR * 60)]
        return [round(float(v), 3) for v in e / (e.max() + 1e-9)]

    cues = {
        'voEnv': env60(vo), 'mixEnv': env60(mix, 0.05),
        'bpm': BPM, 'beat': BEAT, 'bar': BAR, 'drop': DROP, 'breakdown': BREAK, 'cut': CUT, 'hit': HIT, 'duration': DUR,
        'kicks': [round(k, 4) for k in kicks], 'blips': [round(b, 4) for b in blips], 'words': words,
    }
    with open(os.path.join(HERE, '..', 'cues.js'), 'w') as f:
        f.write('// Generated by audio/music.py: the soundtrack\'s timeline, so picture and sound share one clock.\n')
        f.write('const CUES = {\n' + ',\n'.join(f'  {k}: {json.dumps(v)}' for k, v in cues.items()) + '\n};\n')
    print('wrote', final)


if __name__ == '__main__':
    build()
