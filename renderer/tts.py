"""Step "voice": the script -> one MP3 per beat + word timings -> timeline.json.

Voice: Azure AI Speech when AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are set (licensed for commercial use; free tier
500,000 characters a month), else edge-tts (the Edge browser's read-aloud service: no commercial licence, throttles).
Both speak the same neural voice, so a beat Azure fails on can fall back to edge-tts without a change of voice.
VIDEO_TTS=edge forces edge-tts.

VIDEO_TTS=relay forces the channel owner's TTS relay instead (a Cloudflare Worker in front of the same Edge
read-aloud service, Vietnamese voices only): it takes RELAY_SECRET from the environment — never hard-code it,
never log it — and returns plain MP3 with NO word timings, so a relay beat's timeline entry carries an empty
word list, exactly like an edge-tts beat whose boundary events never arrived: the burned-in captions skip
such a beat and the SRT caption track gets no cues from it (see FORK_CHANGES.md). With RELAY_SECRET unset the
relay counts as unavailable and beats fall back to Azure/edge-tts as usual. The relay speaks at a fixed +0%
rate (the VIDEO_TTS rate does not apply) and only knows vi-VN-HoaiMyNeural and vi-VN-NamMinhNeural.

VIDEO_TTS=vieneu selects the technews channel's three-leg voice chain (the Studio's self-host order):
VieNeu-TTS v3 Turbo first (self-hosted on CPU: renderer/.venv-vieneu running vieneu_synth.py, preset
voice VIDEO_VIENEU_VOICE, default "Hải Đăng"), then this relay (HoaiMy; only when RELAY_SECRET is set),
then Piper vi_VN-vais1000-medium (self-hosted: renderer/.venv-piper, model in renderer/models/piper).
All three legs return plain audio with NO word timings, like the relay. A beat no leg can speak fails
the video: in this mode Azure and edge-tts are never used.

Usage: VIDEO_WORKDIR=<dir> [VIDEO_VARIANT=short] python tts.py [voice]
  (reads <dir>/script-final.json or script-short.json, writes <dir>/public/audio and <dir>/timeline.json or timeline-short.json)
"""
import asyncio, datetime, json, os, re, shutil, subprocess, sys, time, urllib.error, urllib.request
from pathlib import Path

try:
    import edge_tts
    import aiohttp
except ImportError:
    raise SystemExit("edge-tts is not installed: run `npm run video:setup` in the project root")

# The pipeline reads this program's output as UTF-8; a Windows console otherwise uses a legacy code page.
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).resolve().parent

AZURE_KEY = os.environ.get("AZURE_SPEECH_KEY", "")
AZURE_REGION = os.environ.get("AZURE_SPEECH_REGION", "")
USE_AZURE = bool(AZURE_KEY and AZURE_REGION) and os.environ.get("VIDEO_TTS", "") != "edge"

# The owner's TTS relay (Cloudflare Worker): the secret comes from the environment only — it is never
# hard-coded, never written to a file and never printed (error messages below carry status codes only).
RELAY_SECRET = os.environ.get("RELAY_SECRET", "")
RELAY_URL = os.environ.get("RELAY_URL", "https://tts.danhthanh.dev").rstrip("/")
USE_RELAY = os.environ.get("VIDEO_TTS", "") == "relay" and bool(RELAY_SECRET)
if os.environ.get("VIDEO_TTS", "") == "relay" and not RELAY_SECRET:
    print("VIDEO_TTS=relay but RELAY_SECRET is not set: the relay is unavailable, falling back to Azure/edge-tts")

# VIDEO_TTS=vieneu: the three-leg chain (see the module docstring). The two self-host legs run in their
# own venvs next to this file; both python paths can be overridden (the chain's fall-through is tested
# by pointing VIDEO_VIENEU_PYTHON at a missing file).
USE_VIENEU_CHAIN = os.environ.get("VIDEO_TTS", "") == "vieneu"
VIENEU_PYTHON = os.environ.get("VIDEO_VIENEU_PYTHON") or str(HERE / ".venv-vieneu" / "Scripts" / "python.exe")
VIENEU_VOICE = os.environ.get("VIDEO_VIENEU_VOICE", "Hải Đăng")
PIPER_PYTHON = os.environ.get("VIDEO_PIPER_PYTHON") or str(HERE / ".venv-piper" / "Scripts" / "python.exe")
PIPER_MODEL = os.environ.get("VIDEO_PIPER_MODEL") or str(HERE / "models" / "piper" / "vi_VN-vais1000-medium.onnx")

# The default voices follow the script's language; they are chosen below, once the script is located.
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
PRESET = json.loads((W / "style-preset.json").read_text(encoding="utf-8")) if (W / "style-preset.json").exists() else None
# The channel's brand for the title cards (industry/channel.json of the checkout that runs the pipeline).
INDUSTRY = Path(os.environ.get("VIDEO_INDUSTRY_DIR") or HERE.parent / "industry")
CHANNEL = json.loads((INDUSTRY / "channel.json").read_text(encoding="utf-8"))
RATE = (PRESET["voice"]["shortRate"] if SHORT else PRESET["voice"]["rate"]) if PRESET else ("+10%" if SHORT else "+4%")

# The script's own language picks the default voices: script.ts writes it (from the channel profile) into the
# script; a script without one predates that and is English, like every script written before. An explicit
# voice argument, or the VIDEO_ALT_VOICE_* settings, still wins over the language defaults.
SCRIPT_LANGUAGE = "English"
try:
    SCRIPT_LANGUAGE = json.loads((W / IN).read_text(encoding="utf-8")).get("language") or "English"
except Exception:
    pass
LANGUAGE_VOICES = {
    "English": ("en-US-AndrewMultilingualNeural", "en-US-GuyNeural", "en-US-AvaMultilingualNeural"),
    "Vietnamese": ("vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural", "vi-VN-NamMinhNeural"),
}
_lang_voices = LANGUAGE_VOICES.get(SCRIPT_LANGUAGE, LANGUAGE_VOICES["English"])
VOICE = sys.argv[1] if len(sys.argv) > 1 else _lang_voices[0]
ALT_VOICE_QUOTE = os.environ.get("VIDEO_ALT_VOICE_QUOTE", _lang_voices[1])
ALT_VOICE_CONFLICT = os.environ.get("VIDEO_ALT_VOICE_CONFLICT", _lang_voices[2])

# The pronunciation dictionary (industry/lexicon.json, materialized by the video admin API from the
# pronunciation_lexicon table: enabled entries only). Applied to the READING text of each beat —
# never to the display text, the title or the captions — and only for Vietnamese scripts, because
# the readings are Vietnamese. Longest match first, case-insensitive, on word boundaries; an entry
# applies when its category_scope is "all" or matches the channel's content category. A missing or
# unreadable file simply means no dictionary for this run.
_LEXICON_CACHE: dict = {"mtime": None, "entries": []}


def _content_category() -> str:
    t = str(CHANNEL.get("type") or "")
    return "finance" if "finance" in t else "tech" if t else "all"


def load_lexicon() -> list:
    path = INDUSTRY / "lexicon.json"
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return []
    if _LEXICON_CACHE["mtime"] != mtime:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            raw_entries = data.get("entries", []) if isinstance(data, dict) else data
            entries = [e for e in raw_entries if isinstance(e, dict) and e.get("term") and e.get("reading")]
        except Exception:
            entries = []
        entries.sort(key=lambda e: len(str(e["term"])), reverse=True)
        _LEXICON_CACHE.update(mtime=mtime, entries=entries)
    return _LEXICON_CACHE["entries"]


def apply_lexicon(text: str):
    """(spoken text, replacements): the dictionary applied to one beat's reading text."""
    if SCRIPT_LANGUAGE != "Vietnamese":
        return text, 0
    category = _content_category()
    entries = [e for e in load_lexicon() if str(e.get("category_scope", "all")) in ("all", category)]
    if not entries:
        return text, 0
    by_lower = {str(e["term"]).lower(): str(e["reading"]) for e in entries}
    pattern = re.compile(
        r"(?<![A-Za-z0-9])(" + "|".join(re.escape(str(e["term"])) for e in entries) + r")(?![A-Za-z0-9])",
        re.IGNORECASE,
    )
    hits = 0

    def repl(m):
        nonlocal hits
        hits += 1
        return by_lower[m.group(1).lower()]

    return pattern.sub(repl, text), hits


# industry/voice-config.json (written from the admin Voice page) is the channel's voice contract:
# the fallback chain + each engine's voice and enabled flag. When the file exists and VIDEO_TTS does
# not force a single engine, its chain rules. The env still wins where it always did: VIDEO_TTS=edge /
# relay keeps the legacy single-engine modes, VIDEO_TTS=nvidia forces the NVIDIA leg alone, and
# VIDEO_VIENEU_VOICE / VIDEO_PIPER_MODEL keep priority over the file. Without the file, behavior is
# exactly the legacy behavior.
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_PYTHON = os.environ.get("VIDEO_NVIDIA_PYTHON") or str(HERE / ".venv-nvidia" / "Scripts" / "python.exe")
NVIDIA_VOICE = "Magpie-Multilingual.VI-VN.Long"
VOICE_CONFIG = None
try:
    _vc_data = json.loads((INDUSTRY / "voice-config.json").read_text(encoding="utf-8"))
    if isinstance(_vc_data, dict) and isinstance(_vc_data.get("engines"), dict):
        VOICE_CONFIG = _vc_data
except Exception:
    VOICE_CONFIG = None


def _cfg_engine(name: str) -> dict:
    engines = (VOICE_CONFIG or {}).get("engines") or {}
    entry = engines.get(name)
    return entry if isinstance(entry, dict) else {}


def _cfg_voice(name: str):
    value = _cfg_engine(name).get("voice")
    return value if isinstance(value, str) and value else None


if VOICE_CONFIG:
    if not os.environ.get("VIDEO_VIENEU_VOICE") and _cfg_voice("vieneu"):
        VIENEU_VOICE = _cfg_voice("vieneu")
    if _cfg_voice("nvidia"):
        NVIDIA_VOICE = _cfg_voice("nvidia")
    _piper_cfg_voice = _cfg_voice("piper")
    if _piper_cfg_voice and not os.environ.get("VIDEO_PIPER_MODEL"):
        _piper_model = HERE / "models" / "piper" / f"{_piper_cfg_voice}.onnx"
        if _piper_model.exists():
            PIPER_MODEL = str(_piper_model)
    if len(sys.argv) <= 1:  # no explicit voice argument: the config's API voices win for this language
        for _api_engine in ("edge", "azure"):
            _api_voice = _cfg_voice(_api_engine)
            if _api_voice and ((SCRIPT_LANGUAGE == "Vietnamese" and _api_voice.startswith("vi-")) or (SCRIPT_LANGUAGE != "Vietnamese" and not _api_voice.startswith("vi-"))):
                VOICE = _api_voice
                break

_FORCED_TTS = os.environ.get("VIDEO_TTS", "")
CONFIG_CHAIN: list = []
if VOICE_CONFIG and _FORCED_TTS in ("", "vieneu"):
    for _engine_name in VOICE_CONFIG.get("chain") or []:
        if _engine_name in ("vieneu", "relay", "nvidia", "piper", "azure", "edge") and _cfg_engine(_engine_name).get("enabled", True):
            CONFIG_CHAIN.append(_engine_name)
USE_CONFIG_CHAIN = bool(CONFIG_CHAIN)


def duration(path: Path) -> float:
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                             capture_output=True, text=True, encoding="utf-8", errors="replace", check=True).stdout
    except FileNotFoundError:
        raise SystemExit("ffprobe not found on PATH: install FFmpeg (it includes ffprobe), then open a new terminal")
    return float(out.strip())


ENGINES: dict = {"azure": 0, "edge": 0, "relay": 0, "vieneu": 0, "piper": 0, "nvidia": 0, "cached": 0}


PREFERRED = CONFIG_CHAIN[0] if USE_CONFIG_CHAIN else "nvidia" if _FORCED_TTS == "nvidia" else "vieneu" if USE_VIENEU_CHAIN else "relay" if USE_RELAY else "azure" if USE_AZURE else "edge"


def resolve_beat_voice(b: dict) -> str:
    """Multi-voice dialogue: alternate Edge-TTS neural voices for quotes, conflicts, or distinct speakers."""
    if b.get("voice"):
        return b["voice"]
    vis = b.get("visual") or {}
    if vis.get("type") == "quote" or vis.get("speaker"):
        return ALT_VOICE_QUOTE
    if vis.get("conflict") or b.get("conflict") or vis.get("perspective"):
        return ALT_VOICE_CONFLICT
    return VOICE


def get_cached(name: str, text: str, voice: str = VOICE):
    """A beat recorded before with the same words, voice, rate and engine is reused (remakes from 'voice' after an
    edit_script re-record only the edited beats). A beat that fell back to edge-tts is recorded again once Azure works."""
    path, meta_path = OUT / f"{name}.mp3", OUT / f"{name}.meta.json"
    if not (path.exists() and path.stat().st_size > 0 and meta_path.exists()):
        return None
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except ValueError:
        return None
    if (meta.get("engine"), meta.get("voice"), meta.get("rate"), meta.get("text")) != (PREFERRED, voice, RATE, text):
        return None
    return path, meta.get("words", []), meta.get("duration")


def put_cache(name: str, text: str, engine: str, words: list, d: float, voice: str = VOICE):
    (OUT / f"{name}.meta.json").write_text(json.dumps({"engine": engine, "voice": voice, "rate": RATE, "text": text, "words": words, "duration": d}), encoding="utf-8")


def speak_azure(name: str, text: str, voice: str = VOICE):
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
    ssml = (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{voice[:5]}"><voice name="{voice}">'
            f'<prosody rate="{RATE}">{escape(text)}</prosody></voice></speak>')
    result = synth.speak_ssml_async(ssml).get()
    if result.reason != sdk.ResultReason.SynthesizingAudioCompleted:
        detail = result.cancellation_details
        raise RuntimeError(f"Azure TTS {result.reason}: {getattr(detail, 'reason', '')} {getattr(detail, 'error_details', '')}".strip())
    del synth  # closes the output file
    return path, words


RELAY_VOICES = {"HoaiMy": "vi-VN-HoaiMyNeural", "NamMinh": "vi-VN-NamMinhNeural"}


def relay_voice(voice: str) -> str:
    """The relay only serves the two Vietnamese Azure voices; any other requested voice (the English
    defaults, a quote/conflict alternate) maps to NamMinh when its name says so, else to HoaiMy."""
    for short, full in RELAY_VOICES.items():
        if short in voice:
            return full
    return RELAY_VOICES["HoaiMy"]


def relay_chunks(text: str, limit: int = 470) -> list:
    """Split a beat into ~300–470 character pieces at sentence boundaries (the relay's operational sweet
    spot: one short request per piece, retried on its own). A single over-long sentence is cut at spaces."""
    pieces = [p.strip() for p in re.split(r"(?<=[.!?…])\s+", text.strip()) if p.strip()]
    chunks, cur = [], ""
    for piece in pieces:
        while len(piece) > limit:
            cut = piece.rfind(" ", 0, limit)
            if cut < 1:
                cut = limit
            head, piece = piece[:cut].strip(), piece[cut:].strip()
            if cur:
                chunks.append(cur)
                cur = ""
            if head:
                chunks.append(head)
        if cur and len(cur) + 1 + len(piece) > limit:
            chunks.append(cur)
            cur = piece
        else:
            cur = f"{cur} {piece}" if cur else piece
    if cur:
        chunks.append(cur)
    return chunks


def relay_synthesize(text: str, voice: str) -> bytes:
    """One relay request: POST {text, voice} as JSON with the Bearer secret; the answer is raw MP3.
    The relay answers transient 502s, so retry with growing pauses (5, 10, 15 s) before giving up."""
    body = json.dumps({"text": text, "voice": voice}).encode()
    last = "no answer"
    for attempt in range(4):
        req = urllib.request.Request(f"{RELAY_URL}/synthesize", data=body, method="POST",
                                     headers={"Authorization": f"Bearer {RELAY_SECRET}",
                                              "Content-Type": "application/json",
                                              # Cloudflare blocks urllib's default UA with a 403;
                                              # a browser UA passes (measured from THANH-PC).
                                              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"})
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                data = res.read()
            if data:
                return data
            last = "empty audio"
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
        except Exception as e:  # network error: same retry treatment, and never the request (it holds the secret)
            last = type(e).__name__
        if attempt < 3:
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"relay synthesis failed ({last})")


def speak_relay(name: str, text: str, voice: str = VOICE):
    """The owner's relay: same MP3-per-beat contract as the other engines, but the word list is empty —
    the relay returns no word timings (see the module docstring for what that means for captions)."""
    path = OUT / f"{name}.mp3"
    azure_voice = relay_voice(voice)
    audio = b"".join(relay_synthesize(chunk, azure_voice) for chunk in relay_chunks(text))
    path.write_bytes(audio)
    return path, []


def _run_checked(cmd: list, **kw) -> None:
    """subprocess.run(check=True) whose failure keeps the child's stderr tail: a bare CalledProcessError
    would hide why a self-host leg died (missing venv, missing model, bad preset voice)."""
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"{Path(cmd[0]).name}: {(e.stderr or '').strip()[-200:]}") from e


def _wav_to_mp3(wav: Path, path: Path) -> None:
    """The self-host legs write WAV; the beat contract is MP3, converted with the ffmpeg on PATH."""
    _run_checked(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-q:a", "2", str(path)])


def speak_vieneu(name: str, text: str, voice: str = VOICE):
    """Chain leg 1: VieNeu-TTS v3 Turbo in its own venv (renderer/.venv-vieneu + vieneu_synth.py).
    The preset voice is VIDEO_VIENEU_VOICE, not the beat's Azure-style voice name. No word timings —
    the same empty word list as the relay."""
    path = OUT / f"{name}.mp3"
    wav = OUT / f"{name}.vieneu.wav"
    try:
        # HF_HUB_DISABLE_SYMLINKS: the Windows HF cache's symlinks make ONNX Runtime reject the
        # MOSS codec's external .data file; vieneu_synth.py sets it too, before importing vieneu.
        _run_checked([VIENEU_PYTHON, str(HERE / "vieneu_synth.py"), text, VIENEU_VOICE, str(wav)],
                     timeout=900, env={**os.environ, "HF_HUB_DISABLE_SYMLINKS": "1"})
        _wav_to_mp3(wav, path)
    finally:
        wav.unlink(missing_ok=True)
    return path, []


def speak_piper(name: str, text: str, voice: str = VOICE):
    """Chain leg 3: Piper vi_VN-vais1000-medium in its own venv (renderer/.venv-piper, model in
    renderer/models/piper). One fixed voice; no word timings, like the other legs."""
    path = OUT / f"{name}.mp3"
    wav = OUT / f"{name}.piper.wav"
    try:
        # PYTHONUTF8: piper reads the text from stdin; without it the child decodes stdin with the
        # Windows locale codepage, mangles the Vietnamese diacritics and synthesizes nothing
        # (wave.Error "# channels not specified" on close — found by the Part C chain tests).
        _run_checked([PIPER_PYTHON, "-m", "piper", "--model", PIPER_MODEL, "--output_file", str(wav)],
                     input=text, timeout=300, env={**os.environ, "PYTHONUTF8": "1"})
        _wav_to_mp3(wav, path)
    finally:
        wav.unlink(missing_ok=True)
    return path, []


def speak_nvidia(name: str, text: str, voice: str = VOICE):
    """One beat via NVIDIA Magpie-TTS (Riva gRPC) in the .venv-nvidia subprocess. The API key rides
    in the environment (NVIDIA_API_KEY) — never an argument, never printed. No word timings: the
    beat's words list is empty and subtitles fall back to the ASR pass, like vieneu/piper."""
    path = OUT / f"{name}.mp3"
    wav = OUT / f"{name}.nvidia.wav"
    try:
        result = subprocess.run(
            [NVIDIA_PYTHON, str(HERE / "nvidia_synth.py"), text, NVIDIA_VOICE, str(wav)],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300,
        )
        if result.returncode != 0:
            tail = (result.stderr or result.stdout or "").strip().splitlines()
            raise RuntimeError(f"nvidia_synth rc={result.returncode}: {tail[-1][:200] if tail else 'no output'}")
        _wav_to_mp3(wav, path)
    finally:
        wav.unlink(missing_ok=True)
    return path, []


async def _speak_config_leg(leg: str, name: str, text: str, voice: str):
    """One leg of the voice-config chain. Raises when the leg cannot speak the beat."""
    if leg == "vieneu":
        last = "not tried"
        for attempt in range(2):
            try:
                return await asyncio.to_thread(speak_vieneu, name, text, voice)
            except Exception as error:
                last = str(error)[:160]
                if attempt < 1:
                    await asyncio.sleep(3)
        raise RuntimeError(last)
    if leg == "relay":
        if not RELAY_SECRET:
            raise RuntimeError("RELAY_SECRET not set")
        return await asyncio.to_thread(speak_relay, name, text, voice)
    if leg == "nvidia":
        if not NVIDIA_API_KEY:
            raise RuntimeError("NVIDIA_API_KEY not set")
        return await asyncio.to_thread(speak_nvidia, name, text, voice)
    if leg == "piper":
        return await asyncio.to_thread(speak_piper, name, text, voice)
    if leg == "azure":
        if not USE_AZURE:
            raise RuntimeError("Azure Speech is not configured")
        return await asyncio.to_thread(speak_azure, name, text, voice)
    return await speak_edge(name, text, voice)


async def speak(name: str, text: str, voice: str = VOICE):
    if USE_CONFIG_CHAIN or _FORCED_TTS == "nvidia":
        # The channel's configured chain (industry/voice-config.json), or the forced NVIDIA leg.
        legs = CONFIG_CHAIN if USE_CONFIG_CHAIN else ["nvidia"]
        errors = []
        for leg in legs:
            try:
                path, words = await _speak_config_leg(leg, name, text, voice)
                ENGINES[leg] += 1
                return path, words, leg
            except Exception as error:
                errors.append(f"{leg}: {str(error)[:140]}")
                print(f"{name}: {leg} leg failed ({str(error)[:140]}), trying the next leg of the voice chain")
        raise RuntimeError(f"{name}: every leg of the voice chain failed ({'; '.join(errors)})")
    if USE_VIENEU_CHAIN:
        # The technews chain: VieNeu -> relay (HoaiMy, only with RELAY_SECRET) -> Piper. No Azure/edge
        # fallback in this mode: a beat no leg can speak fails the video, loudly, instead of quietly
        # changing to a different kind of voice.
        vieneu_error = "not tried"
        for attempt in range(2):
            try:
                path, words = await asyncio.to_thread(speak_vieneu, name, text, voice)
                ENGINES["vieneu"] += 1
                return path, words, "vieneu"
            except Exception as error:
                vieneu_error = str(error)[:160]
                print(f"{name}: vieneu failed ({vieneu_error}), {'retrying' if attempt < 1 else 'falling to the relay leg'}")
                if attempt < 1:
                    await asyncio.sleep(3)
        relay_error = "RELAY_SECRET not set"
        if RELAY_SECRET:
            try:
                path, words = await asyncio.to_thread(speak_relay, name, text, voice)
                ENGINES["relay"] += 1
                return path, words, "relay"
            except Exception as error:
                relay_error = str(error)[:160]
                print(f"{name}: relay leg failed ({relay_error}), falling to the Piper leg")
        try:
            path, words = await asyncio.to_thread(speak_piper, name, text, voice)
            ENGINES["piper"] += 1
            return path, words, "piper"
        except Exception as error:
            raise RuntimeError(f"{name}: every leg of the vieneu chain failed "
                               f"(vieneu: {vieneu_error}; relay: {relay_error}; piper: {str(error)[:160]})")
    if USE_RELAY:
        for attempt in range(3):
            try:
                path, words = await asyncio.to_thread(speak_relay, name, text, voice)
                ENGINES["relay"] += 1
                return path, words, "relay"
            except Exception as error:  # a dead relay must not kill the video: retry, then the usual chain
                print(f"{name}: relay failed ({str(error)[:160]}), {'retrying' if attempt < 2 else 'using Azure/edge-tts for this beat'}")
                if attempt < 2:
                    await asyncio.sleep(3 * (attempt + 1))
    if USE_AZURE:
        for attempt in range(3):
            try:
                path, words = await asyncio.to_thread(speak_azure, name, text, voice)
                ENGINES["azure"] += 1
                return path, words, "azure"
            except Exception as error:  # throttling (429) or a network error: wait, then try again
                print(f"{name}: Azure failed ({str(error)[:160]}), {'retrying' if attempt < 2 else 'using edge-tts for this beat'}")
                if attempt < 2:
                    await asyncio.sleep(3 * (attempt + 1))
    ENGINES["edge"] += 1
    path, words = await speak_edge(name, text, voice)
    return path, words, "edge"


async def speak_edge(name: str, text: str, voice: str = VOICE):
    # The service sometimes answers with no audio; try again before failing the video.
    # The service throttles bursts: wait longer each time (5, 10, 20, 40 s) before giving up.
    for attempt in range(5):
        try:
            return await speak_once(name, text, voice)
        except (edge_tts.exceptions.EdgeTTSException, aiohttp.ClientError, TimeoutError):
            if attempt == 4:
                raise
            print(f"{name}: no audio, retrying")
            await asyncio.sleep(5 * 2 ** attempt)


async def speak_once(name: str, text: str, voice: str = VOICE):
    path = OUT / f"{name}.mp3"
    words = []
    comm = edge_tts.Communicate(text, voice, rate=RATE, boundary="WordBoundary")
    with open(path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({"text": chunk["text"], "start": round(chunk["offset"] / 1e7, 3),
                              "end": round((chunk["offset"] + chunk["duration"]) / 1e7, 3)})
    return path, words


def brand() -> dict:
    """The channel's brand for the cards; its mark (brand.mark in channel.json, relative to the industry folder) is
    copied into the video's public folder so the renderer can draw it."""
    b = dict(CHANNEL["brand"])
    mark = INDUSTRY / b["mark"] if b.get("mark") else None
    if mark and mark.exists():
        shutil.copy(mark, W / "public" / "brand-mark.svg")
        b["mark"] = "brand-mark.svg"
    else:
        b.pop("mark", None)
    return b


async def main():
    script = json.loads((W / IN).read_text(encoding="utf-8"))
    t = 0.0
    scenes = []
    for si, s in enumerate(script["scenes"]):
        scene_start = t
        beats = []
        for bi, b in enumerate(s["beats"]):
            beat_name = f"{PREFIX}s{si:02d}b{bi:02d}"
            beat_voice = resolve_beat_voice(b)
            spoken, lexicon_hits = apply_lexicon(b["narration"])
            cached = get_cached(beat_name, spoken, beat_voice)
            if cached:
                path, words, d = cached
                ENGINES["cached"] += 1
                if d is None:
                    d = duration(path)
            else:
                path, words, engine = await speak(beat_name, spoken, beat_voice)
                d = duration(path)
                put_cache(beat_name, spoken, engine, words, d, beat_voice)
            gap = SCENE_GAP if bi == len(s["beats"]) - 1 else BEAT_GAP
            beats.append({**b, "voice": beat_voice, "audio": f"audio/{path.name}", "start": round(t - scene_start, 3), "duration": round(d + gap, 3), "words": words, "lexicon_applied": lexicon_hits})
            t += d + gap
        scenes.append({k: s[k] for k in ("kind", "kicker", "headline")} | {"start": round(scene_start, 3), "duration": round(t - scene_start, 3), "beats": beats})
        print(f"scene {si}: {t - scene_start:5.1f}s, {len(beats)} beats")
    # Optional music bed: VIDEO_MUSIC, else the first track in renderer/music/ (e.g. from the YouTube Audio Library).
    music_dir = HERE / "music"
    mood_tracks = sorted((music_dir / PRESET["music"]).glob("*.mp3")) if PRESET else []
    music = os.environ.get("VIDEO_MUSIC") or next((str(p) for p in mood_tracks), None) or next((str(p) for p in sorted(music_dir.glob("*.mp3"))), None)
    if music and Path(music).exists() and str(Path(music).resolve()) != str((W / "public" / "music.mp3").resolve()):
        shutil.copy(music, W / "public" / "music.mp3")
    today = datetime.date.today()
    timeline = {"title": script["title"], "thumbnail_text": script.get("thumbnail_text"), "voice": VOICE, "total": round(t, 3), "scenes": scenes, "sources": script["sources"],
                "mainTitle": script.get("mainTitle"),
                "mainVideo": script.get("mainVideo"),
                "music": "music.mp3" if music and Path(music).exists() else None,
                "date": f"{today:%b} {today.day}, {today.year}",
                "style": PRESET["key"] if PRESET else "news", "palette": PRESET["visual"] if PRESET else None,
                "brand": brand()}
    (W / TIMELINE).write_text(json.dumps(timeline, indent=2), encoding="utf-8")
    print(f"total {t:.1f}s")
    chars = sum(len(b["narration"]) for s in script["scenes"] for b in s["beats"])
    used = [k for k in ("azure", "edge", "relay", "vieneu", "piper", "nvidia") if ENGINES[k]]
    engine = used[0] if len(used) == 1 else "mixed" if used else "cached"
    print("RESULT " + json.dumps({"duration": round(t, 1), "engine": engine,
                                  "beats": ENGINES, "characters": chars}))


asyncio.run(main())
