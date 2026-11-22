"""One VieNeu-TTS v3 synthesis, run with the renderer's .venv-vieneu python:
  .venv-vieneu\\Scripts\\python.exe vieneu_synth.py "<text>" "<voice preset>" <out.wav>

Writes a 48 kHz WAV of the preset voice reading the text. The model loads on every
call: tts.py runs one helper process per beat, the same shape as its relay calls.
"""
import os, sys

# The HF cache on Windows links snapshot files to a shared blob store; ONNX Runtime refuses a
# model's external .data file once it resolves outside the model folder ("External data path
# validation failed", seen with the MOSS codec). Symlinks off makes downloads land as real files
# inside the snapshot. Must be set before vieneu (and huggingface_hub) is imported.
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")

# Same guard as tts.py: a Windows console otherwise uses a legacy code page and
# printing the Vietnamese preset name could fail after the WAV is written.
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")


def main() -> None:
    text, voice, out = sys.argv[1], sys.argv[2], sys.argv[3]
    from vieneu import Vieneu
    import soundfile as sf

    audio = Vieneu().infer(text, voice=voice)
    sf.write(out, audio, 48000)
    print("ok", voice, out)


if __name__ == "__main__":
    main()
