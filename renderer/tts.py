"""Step 3 prototype: script-final.json -> one MP3 per beat + word timings (edge-tts) -> src/timeline.json.

Usage: VIDEO_WORKDIR=<dir> [VIDEO_VARIANT=short] python tts.py [voice]
  (reads <dir>/script-final.json or script-short.json, writes <dir>/public/audio and <dir>/timeline.json or timeline-short.json)
"""
import asyncio, datetime, json, os, shutil, subprocess, sys
from pathlib import Path

import edge_tts

VOICE = sys.argv[1] if len(sys.argv) > 1 else "en-US-AndrewMultilingualNeural"
W = Path(os.environ.get("VIDEO_WORKDIR", "work"))
VARIANT = os.environ.get("VIDEO_VARIANT", "")
IN = "script-short.json" if VARIANT == "short" else "script-final.json"
TIMELINE = f"timeline-{VARIANT}.json" if VARIANT else "timeline.json"
PREFIX = f"{VARIANT}-" if VARIANT else ""
OUT = W / "public" / "audio"; OUT.mkdir(parents=True, exist_ok=True)
SHORT = VARIANT == "short"
BEAT_GAP = 0.1 if SHORT else 0.25   # pause between beats inside a scene (a Short keeps moving)
SCENE_GAP = 0.3 if SHORT else 0.7   # pause between scenes
RATE = "+10%" if SHORT else "+4%"


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


async def speak(name: str, text: str):
    # The service sometimes answers with no audio; try again before failing the video.
    # The service throttles bursts: wait longer each time (5, 10, 20, 40 s) before giving up.
    for attempt in range(5):
        try:
            return await speak_once(name, text)
        except edge_tts.exceptions.NoAudioReceived:
            if attempt == 4:
                raise
            print(f"{name}: no audio, retrying")
            await asyncio.sleep(5 * 2 ** attempt)


async def speak_once(name: str, text: str):
    path = OUT / f"{name}.mp3"
    words = []
    comm = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    with open(path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({"text": chunk["text"], "start": round(chunk["offset"] / 1e7, 3),
                              "end": round((chunk["offset"] + chunk["duration"]) / 1e7, 3)})
    return path, words


async def main():
    script = json.loads((W / IN).read_text())
    t = 0.0
    scenes = []
    for si, s in enumerate(script["scenes"]):
        scene_start = t
        beats = []
        for bi, b in enumerate(s["beats"]):
            path, words = await speak(f"{PREFIX}s{si:02d}b{bi:02d}", b["narration"])
            d = duration(path)
            gap = SCENE_GAP if bi == len(s["beats"]) - 1 else BEAT_GAP
            beats.append({**b, "audio": f"audio/{path.name}", "start": round(t - scene_start, 3), "duration": round(d + gap, 3), "words": words})
            t += d + gap
        scenes.append({k: s[k] for k in ("kind", "kicker", "headline")} | {"start": round(scene_start, 3), "duration": round(t - scene_start, 3), "beats": beats})
        print(f"scene {si}: {t - scene_start:5.1f}s, {len(beats)} beats")
    # Optional music bed: VIDEO_MUSIC, else the first track in renderer/music/ (e.g. from the YouTube Audio Library).
    music = os.environ.get("VIDEO_MUSIC") or next((str(p) for p in sorted(Path("music").glob("*.mp3"))), None)
    if music and Path(music).exists():
        shutil.copy(music, W / "public" / "music.mp3")
    timeline = {"title": script["title"], "thumbnail_text": script.get("thumbnail_text"), "voice": VOICE, "total": round(t, 3), "scenes": scenes, "sources": script["sources"],
                "music": "music.mp3" if music and Path(music).exists() else None,
                "date": datetime.date.today().strftime("%b %-d, %Y")}
    (W / TIMELINE).write_text(json.dumps(timeline, indent=2))
    print(f"total {t:.1f}s")
    print("RESULT " + json.dumps({"duration": round(t, 1)}))


asyncio.run(main())
