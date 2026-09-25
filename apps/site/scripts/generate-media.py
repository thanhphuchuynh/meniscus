"""Render the original music and the plate film used by Plate VII.

Run with Python 3, Pillow and ffmpeg from the repository root. The film drifts
across the site's own public-domain Opticks plates, in print and lantern
duotones; no recording or third-party music is used.
"""

from array import array
from datetime import datetime, timezone
import json
import subprocess
from math import exp, pi, sin
from pathlib import Path
from subprocess import run
from tempfile import TemporaryDirectory
import wave

RATE = 22_050
BEAT = 0.625
BARS = 8
DURATION = BARS * 4 * BEAT
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public/media/prism-etude.m4a"
W, H, FPS = 1280, 720, 25
FADE = 1.0
POSTER_AT = 1.5
# Crops in plate pixels (the plates are 1200 px wide): center x, center y, width.
SHOTS = [
    {"plate": "opticks-plate-4", "start": 0.0, "end": 10.0, "from": (640, 540, 920), "to": (840, 800, 700)},
    {"plate": "opticks-plate-2", "start": 10.0, "end": DURATION, "from": (560, 1760, 1000), "to": (600, 1800, 780)},
]


def tone(buffer: list[float], start: float, frequency: float, length: float, gain: float) -> None:
    first = round(start * RATE)
    count = min(round(length * RATE), len(buffer) - first)
    for i in range(count):
        t = i / RATE
        # A soft struck-glass voice: bright attack, a slower fundamental decay.
        envelope = (1 - exp(-65 * t)) * exp(-3.2 * t / length)
        phase = 2 * pi * frequency * t
        sample = sin(phase) + 0.22 * sin(2.01 * phase) + 0.09 * sin(3.98 * phase)
        buffer[first + i] += gain * envelope * sample


def main() -> None:
    samples = [0.0] * round(DURATION * RATE)
    chords = [
        (220.00, 261.63, 329.63),  # A minor
        (174.61, 220.00, 261.63),  # F major
        (196.00, 261.63, 329.63),  # C major
        (196.00, 246.94, 293.66),  # G major
    ]
    melody = [329.63, 392.00, 440.00, 392.00, 349.23, 329.63, 261.63, 293.66]
    for bar in range(BARS):
        base, third, fifth = chords[bar % len(chords)]
        at = bar * 4 * BEAT
        tone(samples, at, base / 2, 2.4, 0.18)
        tone(samples, at, base, 2.1, 0.11)
        tone(samples, at, third, 1.7, 0.085)
        tone(samples, at, fifth, 1.9, 0.08)
        for step in range(4):
            pitch = (base, third, fifth, melody[bar])[step]
            tone(samples, at + step * BEAT, pitch * 2, 0.56, 0.13)

    # One quiet echo gives the plucks space; fade both loop edges cleanly.
    echo = round(0.29 * RATE)
    for i in range(echo, len(samples)):
        samples[i] += samples[i - echo] * 0.13
    peak = max(abs(value) for value in samples)
    pcm = array("h")
    for i, value in enumerate(samples):
        edge = min(1, i / (RATE * 0.03), (len(samples) - i) / (RATE * 0.35))
        pcm.append(round(value / peak * edge * 24500))

    DEST.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as temp:
        wav = Path(temp) / "prism-etude.wav"
        with wave.open(str(wav), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(RATE)
            output.writeframes(pcm.tobytes())
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav), "-c:a", "aac", "-b:a", "96k", str(DEST)], check=True)
    for theme in ("", "-lantern"):
        render_film(theme)


def ease(t: float) -> float:
    """Smoothstep: the camera starts and settles without a jolt."""
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def crop_at(shot: dict, t: float) -> tuple[float, float, float]:
    """Center x, center y and width of the shot's crop at progress t."""
    (x0, y0, w0), (x1, y1, w1) = shot["from"], shot["to"]
    k = ease(t)
    return x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, w0 + (w1 - w0) * k


def frame(plate, center_x: float, center_y: float, width: float):
    """One film frame: a sub-pixel crop of the plate, so slow drifts stay smooth."""
    from PIL import Image

    height = width * H / W
    # Clamped, so no frame ever samples past the edge of the plate.
    left = max(0.0, min(plate.width - width, center_x - width / 2))
    top = max(0.0, min(plate.height - height, center_y - height / 2))
    return plate.transform((W, H), Image.Transform.AFFINE, (width / W, 0, left, 0, height / H, top), resample=Image.Resampling.BICUBIC)


def render_film(theme: str) -> None:
    from PIL import Image

    plates = {name: Image.open(ROOT / f"public/plates/{name}{theme}.webp").convert("RGB") for name in ("opticks-plate-4", "opticks-plate-2")}
    film = ROOT / f"public/media/opticks-film{theme}.mp4"
    poster = ROOT / f"public/media/opticks-film{theme}.webp"
    encoder = subprocess.Popen(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
            "-i", str(DEST),
            "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-pix_fmt", "yuv420p",
            "-c:a", "copy", "-shortest", "-movflags", "+faststart", str(film),
        ],
        stdin=subprocess.PIPE,
    )
    count = round(DURATION * FPS)
    for i in range(count):
        at = i / FPS
        # Each shot runs its own drift; the two overlap for one crossfade.
        images = []
        for shot in SHOTS:
            if shot["start"] - FADE / 2 <= at <= shot["end"] + FADE / 2:
                t = (at - shot["start"]) / (shot["end"] - shot["start"])
                images.append((shot, frame(plates[shot["plate"]], *crop_at(shot, t))))
        if len(images) == 2:
            (first, a), (_, b) = images
            mix = ease((at - (first["end"] - FADE / 2)) / FADE)
            picture = Image.blend(a, b, mix)
        else:
            picture = images[0][1]
        if i == round(POSTER_AT * FPS):
            picture.save(poster, "WEBP", quality=82)
        encoder.stdin.write(picture.tobytes())
    encoder.stdin.close()
    if encoder.wait() != 0:
        raise SystemExit(f"ffmpeg failed on {film.name}")
    note = (
        "ORIGIN (sourced, not generated): Isaac Newton, Opticks (London, 1704), Book I, Plates IV and II, public domain, "
        "from the site's own duotoned scans (Internet Archive item optickstreatise00newta). Processing: two slow camera drifts "
        f"rendered by scripts/generate-media.py — Plate IV from Fig. 18 to Fig. 20, then Plate II's Fig. 12 — {W}x{H} at {FPS} fps, "
        f"{DURATION:g} s, a {FADE:g} s crossfade, H.264 CRF 25, scored with the original Prism etude from the same script."
    )
    film.with_name(film.name + ".json").write_text(json.dumps({"prompt": note, "createdAt": datetime.now(timezone.utc).isoformat()}, indent=2) + "\n")

if __name__ == "__main__":
    main()
