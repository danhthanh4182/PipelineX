"""One NVIDIA Magpie-TTS synthesis via Riva gRPC, run with the renderer's .venv-nvidia python:

    .venv-nvidia\\Scripts\\python.exe nvidia_synth.py "<text>" "<voice name>" <out.wav>

The API key comes from NVIDIA_API_KEY in the environment (the channel's own key) — it is never an
argument, never written to a file and never printed. Output is 16-bit mono WAV at 44.1 kHz
(LINEAR_PCM from the ai-magpie-tts-multilingual function); tts.py converts it to MP3.
Hosted-API terms: NVIDIA API Trial (development/testing); commercial production needs AI Enterprise.
"""
import os
import sys
import wave

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

FUNCTION_ID = "877104f7-e885-42b9-8de8-f6e4c6303969"  # ai-magpie-tts-multilingual


def main() -> int:
    text, voice, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    key = os.environ.get("NVIDIA_API_KEY", "")
    if not key:
        raise SystemExit("NVIDIA_API_KEY is not set in the environment")
    import riva.client
    from riva.client.proto.riva_audio_pb2 import AudioEncoding

    auth = riva.client.Auth(
        uri="grpc.nvcf.nvidia.com:443",
        use_ssl=True,
        metadata_args=[["function-id", FUNCTION_ID], ["authorization", f"Bearer {key}"]],
    )
    service = riva.client.SpeechSynthesisService(auth)
    response = service.synthesize(
        text,
        voice_name=voice,
        language_code="vi-VN",
        encoding=AudioEncoding.LINEAR_PCM,
        sample_rate_hz=44100,
    )
    pcm = response.audio
    if not pcm:
        raise SystemExit("NVIDIA returned no audio")
    with wave.open(out_path, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(44100)
        wav.writeframes(pcm)
    print(f"nvidia_synth: {len(pcm)} pcm bytes -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
