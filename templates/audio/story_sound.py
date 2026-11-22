# Sound design and mix for any story, from a small JSON file. Needs numpy only (no scipy, no paid tools, no sample files).
#
# Usage: python story_sound.py <audio.json> <out.wav> [--voice-dir <folder with <id>.wav>] [--seed 7]
#
# audio.json (see templates/cinematic/stories/fiveSecondsAudio.json):
#   duration     seconds
#   narration    [{ id, start, text }]    <voice-dir>/<id>.wav is placed at `start` (mono or stereo WAV, 16 bit, any rate)
#   beds         [{ type, from, to, gain_db, ... }]   long sounds: roomtone, tick (period), drone, pad
#   cues         [{ t, type, gain_db, dur? }]         one-shot sounds: glow, chime, sting, door, footsteps, rattle, whoosh, crash
# Gains are relative to the narration (0 dB = same level as the voice). The output is 48 kHz, stereo, 16 bit.
# Every sound is made in code with a fixed seed, so the same file always gives the same audio.
import json, sys, wave
import numpy as np

SR = 48000

def rng_for(name, seed): return np.random.default_rng(sum(map(ord, name)) * 7919 + seed)  # fixed seed per sound: same input, same audio
def db(x): return 10 ** (x / 20)
def t_axis(d): return np.arange(int(d * SR)) / SR
def env(n, a=0.005, r=0.05):
    e = np.ones(n); na, nr = max(int(a * SR), 1), max(int(r * SR), 1)
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def lowpass(x, fc):  # brick-wall by FFT: simple and fine for sound design
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X[f > fc] = 0; return np.fft.irfft(X, len(x))
def highpass(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X[f < fc] = 0; return np.fft.irfft(X, len(x))
def bandpass(x, lo, hi): return highpass(lowpass(x, hi), lo)
def noise(n, rng): return rng.standard_normal(n)
def norm(x, peak=1.0): m = np.max(np.abs(x)) or 1; return x / m * peak

# ---------- sounds: each returns a mono array ----------
def s_roomtone(d, rng, **_):
    n = int(d * SR); x = lowpass(noise(n, rng), 300) * 1.0 + highpass(lowpass(noise(n, rng), 3000), 800) * 0.05
    return norm(x * (1 + 0.15 * np.sin(2 * np.pi * 0.11 * t_axis(d))))
def s_tick(d, rng, period=1.6, **_):
    out = np.zeros(int(d * SR)); k = 0; t = 0.2
    while t < d - 0.1:
        f = 1900 if k % 2 == 0 else 1350
        n = int(0.06 * SR); tt = np.arange(n) / SR
        click = (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 90) + 0.5 * bandpass(noise(n, rng), 2500, 7000) * np.exp(-tt * 140))
        i = int(t * SR); out[i:i + n] += click[: len(out) - i] * (1 if k % 2 == 0 else 0.75)
        t += period / 2; k += 1
    return out
def s_drone(d, rng, **_):
    tt = t_axis(d); x = sum(np.sin(2 * np.pi * f * tt + p) * a for f, p, a in [(55, 0, 1), (82.5, 1, 0.5), (110, 2, 0.35), (58, 3, 0.6)])
    x *= 1 + 0.25 * np.sin(2 * np.pi * 0.17 * tt); x = np.tanh(x * 0.8)
    return norm(x) * env(len(tt), 3.0, 2.5)
def s_pad(d, rng, **_):
    tt = t_axis(d); x = sum(np.sin(2 * np.pi * f * tt + i) * a * (1 + 0.1 * np.sin(2 * np.pi * (0.2 + 0.03 * i) * tt)) for i, (f, a) in enumerate([(110, 1), (164.8, 0.7), (220, 0.6), (277.2, 0.35), (329.6, 0.25)]))
    return norm(x) * env(len(tt), 2.5, min(2.5, d * 0.5))
def s_glow(d, rng, **_):
    tt = t_axis(d); rise = (tt / d) ** 1.6
    x = sum(np.sin(2 * np.pi * f * tt * (1 + 0.04 * rise) + k) * (0.5 ** i) for i, (f, k) in enumerate([(440, 0), (660, 1), (880, 2), (1320, 3), (1760, 4)]))
    x += 0.2 * bandpass(noise(len(tt), rng), 3000, 9000) * rise
    return norm(x * rise * (1 + 0.2 * np.sin(2 * np.pi * 6 * tt))) * env(len(tt), 0.05, 0.6)
def s_chime(d, rng, **_):
    d = 2.2; tt = t_axis(d)
    x = sum(np.sin(2 * np.pi * f * tt) * a * np.exp(-tt * k) for f, a, k in [(880, 1, 2.2), (1318.5, 0.6, 2.8), (1760, 0.4, 3.5), (2637, 0.15, 5)])
    return norm(x) * env(len(tt), 0.002, 0.2)
def s_sting(d, rng, **_):
    d = 1.4; tt = t_axis(d); x = np.sin(2 * np.pi * 98 * tt) + 0.6 * np.sin(2 * np.pi * 146.8 * tt) + 0.4 * np.sin(2 * np.pi * 207 * tt)
    x = np.tanh(x * 1.5) * np.exp(-tt * 2.2) * np.minimum(tt / 0.04, 1) + 0.3 * lowpass(noise(len(tt), rng), 900) * np.exp(-tt * 6)
    return norm(x) * env(len(tt), 0.005, 0.3)
def s_door(d, rng, **_):
    d = 1.1; tt = t_axis(d); f = 190 + 70 * np.sin(np.pi * tt / d) ** 2 + 6 * np.sin(2 * np.pi * 31 * tt)
    ph = 2 * np.pi * np.cumsum(f) / SR; saw = (ph / np.pi % 2) - 1
    x = lowpass(saw, 1800) * (0.5 + 0.5 * np.sin(2 * np.pi * 12 * tt) ** 2) * np.sin(np.pi * tt / d) ** 0.6
    x += 0.3 * bandpass(noise(len(tt), rng), 300, 1500) * np.sin(np.pi * tt / d)
    thud = np.zeros(len(tt)); n = int(0.18 * SR); th = np.arange(n) / SR; thud[-n:] = np.sin(2 * np.pi * 70 * th) * np.exp(-th * 22) * 1.2
    return norm(x * 0.7 + thud) * env(len(tt), 0.02, 0.02)
def s_footsteps(d, rng, **_):
    out = np.zeros(int(d * SR)); t = 0.05; k = 0
    while t < d - 0.2:
        n = int(0.16 * SR); tt = np.arange(n) / SR
        step = (np.sin(2 * np.pi * (95 + 12 * (k % 2)) * tt) * np.exp(-tt * 30) + 0.5 * bandpass(noise(n, rng), 200, 1200) * np.exp(-tt * 45))
        i = int(t * SR); out[i:i + n] += step[: len(out) - i] * (0.9 + 0.2 * rng.random())
        t += 0.54; k += 1
    return out
def s_rattle(d, rng, **_):
    out = np.zeros(int(d * SR)); t = 0.0; gap = 0.16
    while t < d - 0.1:
        n = int(0.05 * SR); tt = np.arange(n) / SR
        i = int(t * SR); out[i:i + n] += (np.sin(2 * np.pi * (1500 + 400 * rng.random()) * tt) * np.exp(-tt * 110))[: len(out) - i] * (t / d + 0.2)
        t += gap; gap = max(gap * 0.85, 0.05)
    return out
def s_whoosh(d, rng, **_):
    d = 0.7; n = int(d * SR); x = noise(n, rng); tt = t_axis(d); out = np.zeros(n)
    for lo in np.linspace(300, 3000, 6): out += bandpass(x, lo, lo * 1.6) * np.exp(-((tt - (0.15 + 0.5 * lo / 3000 * 0.6)) ** 2) / 0.02)
    return norm(out) * env(n, 0.03, 0.25)
def s_crash(d, rng, **_):
    d = 2.2; n = int(d * SR); tt = t_axis(d)
    thump = np.sin(2 * np.pi * 62 * tt) * np.exp(-tt * 14) * 1.3
    burst = highpass(noise(n, rng), 1200) * np.exp(-tt * 38)
    glass = sum(np.sin(2 * np.pi * rng.uniform(2200, 9000) * tt + rng.uniform(0, 6)) * np.exp(-tt * rng.uniform(5, 18)) * rng.uniform(0.2, 0.7) for _ in range(40)) * 0.18
    gears = sum(np.sin(2 * np.pi * rng.uniform(900, 2500) * (tt - t0)) * np.exp(-(tt - t0) * 30) * (tt > t0) * 0.25 for t0 in (0.12, 0.2, 0.33, 0.47, 0.7))
    return norm(thump + burst * 0.7 + glass + gears) * env(n, 0.001, 0.4)

SOUNDS = {"roomtone": s_roomtone, "tick": s_tick, "drone": s_drone, "pad": s_pad, "glow": s_glow, "chime": s_chime, "sting": s_sting, "door": s_door,
          "footsteps": s_footsteps, "rattle": s_rattle, "whoosh": s_whoosh, "crash": s_crash}

def read_wav(path):
    w = wave.open(path, "rb"); ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes(); raw = w.readframes(n); w.close()
    if sw != 2: raise SystemExit(f"{path}: need 16-bit WAV")
    x = np.frombuffer(raw, "<i2").astype(np.float64) / 32768
    if ch > 1: x = x.reshape(-1, ch).mean(axis=1)
    if sr != SR: x = np.interp(np.arange(int(len(x) * SR / sr)) / SR, np.arange(len(x)) / sr, x)
    return x

def main():
    a = sys.argv[1:]
    if len(a) < 2: raise SystemExit(__doc__)
    spec, out = json.load(open(a[0], encoding="utf8")), a[1]
    voice_dir = a[a.index("--voice-dir") + 1] if "--voice-dir" in a else None
    seed = int(a[a.index("--seed") + 1]) if "--seed" in a else 7
    total = int(spec["duration"] * SR); mix = np.zeros(total); voice = np.zeros(total)
    def place(track, x, t, g):
        i = int(t * SR); x = x[: max(total - i, 0)]; track[i:i + len(x)] += x * g
    if voice_dir:
        for n in spec.get("narration", []):
            try: place(voice, read_wav(f"{voice_dir}/{n['id']}.wav"), n["start"], 1.0)
            except FileNotFoundError: print(f"warning: no voice file for {n['id']} (silent)")
    else:
        print("note: no --voice-dir, so no narration in the mix")
    vpeak = np.max(np.abs(voice)) or 1; voice = voice / vpeak * 0.55       # narration peaks at about -5 dBFS; the rest is set relative to it
    ref = 0.55
    for b in spec.get("beds", []):
        d = b["to"] - b["from"]; x = SOUNDS[b["type"]](d, rng_for(b["type"], seed), **{k: v for k, v in b.items() if k not in ("type", "from", "to", "gain_db")})
        place(mix, x * 0.5, b["from"], ref * db(b.get("gain_db", -24)))
    for c in spec.get("cues", []):
        x = SOUNDS[c["type"]](c.get("dur", 1.0), rng_for(c["type"] + str(c["t"]), seed), **{k: v for k, v in c.items() if k not in ("type", "t", "gain_db", "note")})
        place(mix, x, c["t"], ref * db(c.get("gain_db", -18)))
    # gentle ducking: bring music and effects down 4 dB while the narration speaks
    k = int(0.25 * SR); cs = np.cumsum(np.concatenate([np.zeros(k), np.abs(voice)])); sm = (cs[k:] - cs[:-k]) / k; sm = np.roll(sm, -k // 2); duck = 1 - (1 - db(-4)) * np.minimum(sm / 0.05, 1)
    final = mix * duck + voice
    final *= env(total, 0.01, 1.2)                                          # fade out the last 1.2 s
    final = np.tanh(final * 1.1) / np.tanh(1.1)                              # soft safety limiter
    peak = np.max(np.abs(final)); final = final / peak * 0.89 if peak > 0.89 else final
    st = np.stack([final, final], axis=1); w = wave.open(out, "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes()); w.close()
    rms = 20 * np.log10(np.sqrt(np.mean(final ** 2)) + 1e-9)
    print(f"wrote {out}: {spec['duration']} s, peak {20 * np.log10(np.max(np.abs(final)) + 1e-9):.1f} dBFS, RMS {rms:.1f} dBFS")

if __name__ == "__main__":
    main()
