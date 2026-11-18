"""Step "voice": the script -> one MP3 per beat + word timings -> timeline.json.

Voice: Azure AI Speech when AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are set (licensed for commercial use; free tier
500,000 characters a month), else edge-tts (the Edge browser's read-aloud service: no commercial licence, throttles).
Both speak the same neural voice, so a beat Azure fails on can fall back to edge-tts without a change of voice.
VIDEO_TTS=edge forces edge-tts.

Usage: VIDEO_WORKDIR=<dir> [VIDEO_VARIANT=short] python tts.py [voice]
  (reads <dir>/script-final.json or script-short.json, writes <dir>/public/audio and <dir>/timeline.json or timeline-short.json)
"""
import asyncio, datetime, json, os, shutil, subprocess, sys
from pathlib import Path

import edge_tts

AZURE_KEY = os.environ.get("AZURE_SPEECH_KEY", "")
AZURE_REGION = os.environ.get("AZURE_SPEECH_REGION", "")
USE_AZURE = bool(AZURE_KEY and AZURE_REGION) and os.environ.get("VIDEO_TTS", "") != "edge"

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
# The video's style (style-preset.json, written by the pipeline) sets the pace and the music's mood.
PRESET = json.loads((W / "style-preset.json").read_text()) if (W / "style-preset.json").exists() else None
RATE = (PRESET["voice"]["shortRate"] if SHORT else PRESET["voice"]["rate"]) if PRESET else ("+10%" if SHORT else "+4%")


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


ENGINES: dict = {"azure": 0, "edge": 0}


def speak_azure(name: str, text: str):
    """Azure AI Speech: SSML with the same voice and rate; word timings from its word-boundary events."""
    import azure.cognitiveservices.speech as sdk
    from xml.sax.saxutils import escape
    path = OUT / f"{name}.mp3"
    cfg = sdk.SpeechConfig(subscription=AZURE_KEY, region=AZURE_REGION)
    cfg.set_speech_synthesis_output_format(sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3)
    synth = sdk.SpeechSynthesizer(speech_config=cfg, audio_config=sdk.audio.AudioOutputConfig(filename=str(path)))
    words = []

    def boundary(evt):
        if evt.boundary_type == sdk.SpeechSynthesisBoundaryType.Word:
            start = evt.audio_offset / 1e7
            words.append({"text": evt.text, "start": round(start, 3), "end": round(start + evt.duration.total_seconds(), 3)})
    synth.synthesis_word_boundary.connect(boundary)
    ssml = (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="{VOICE}">'
            f'<prosody rate="{RATE}">{escape(text)}</prosody></voice></speak>')
    result = synth.speak_ssml_async(ssml).get()
    if result.reason != sdk.ResultReason.SynthesizingAudioCompleted:
        detail = result.cancellation_details
        raise RuntimeError(f"Azure TTS {result.reason}: {getattr(detail, 'reason', '')} {getattr(detail, 'error_details', '')}".strip())
    del synth  # closes the output file
    return path, words


async def speak(name: str, text: str):
    if USE_AZURE:
        for attempt in range(3):
            try:
                out = await asyncio.to_thread(speak_azure, name, text)
                ENGINES["azure"] += 1
                return out
            except Exception as error:  # throttling (429) or a network error: wait, then try again
                print(f"{name}: Azure failed ({str(error)[:160]}), {'retrying' if attempt < 2 else 'using edge-tts for this beat'}")
                if attempt < 2:
                    await asyncio.sleep(3 * (attempt + 1))
    ENGINES["edge"] += 1
    return await speak_edge(name, text)


async def speak_edge(name: str, text: str):
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
    mood_tracks = sorted((Path("music") / PRESET["music"]).glob("*.mp3")) if PRESET else []
    music = os.environ.get("VIDEO_MUSIC") or next((str(p) for p in mood_tracks), None) or next((str(p) for p in sorted(Path("music").glob("*.mp3"))), None)
    if music and Path(music).exists():
        shutil.copy(music, W / "public" / "music.mp3")
    timeline = {"title": script["title"], "thumbnail_text": script.get("thumbnail_text"), "voice": VOICE, "total": round(t, 3), "scenes": scenes, "sources": script["sources"],
                "music": "music.mp3" if music and Path(music).exists() else None,
                "date": datetime.date.today().strftime("%b %-d, %Y"),
                "style": PRESET["key"] if PRESET else "news", "palette": PRESET["visual"] if PRESET else None}
    (W / TIMELINE).write_text(json.dumps(timeline, indent=2))
    print(f"total {t:.1f}s")
    chars = sum(len(b["narration"]) for s in script["scenes"] for b in s["beats"])
    print("RESULT " + json.dumps({"duration": round(t, 1), "engine": "azure" if ENGINES["azure"] and not ENGINES["edge"] else "edge" if not ENGINES["azure"] else "mixed",
                                  "beats": ENGINES, "characters": chars}))


asyncio.run(main())
