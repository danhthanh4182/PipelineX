# Market Decoded: Lessons from the First Finance Videos (Verified Production Report)

**System**: PipelineX video engine (`eval/aihot`), main checkout, web :3000, database `pipelinex_eval`.  
**Channel**: Market Decoded (YouTube @MarketDecodedVideo), English finance and economy explainers.  
**Policy**: Free models only ($0.00 model cost strictly guaranteed); a human approves and publishes (see `PIPELINEX.md`).  

Every number below was directly verified against the production video files on disk (`.data/videos/<id>/`: `video.mp4`, `short.mp4`, `timeline*.json`, `verify*.json`, `script-final.json`, `publish.json`, `ATTRIBUTIONS.txt`) and the pipeline database on 2026-11-18.

---

## 1. The Three Produced Videos: Final Verified Statistics

| Metric | #1 Nvidia Earnings | #2 Fed AI Task Force | #3 Peraire-Bueno Acquittal |
|---|---|---|---|
| **Story ID & Topic** | Story #14: Q3 Earnings & Chip Rules | Story #1: Fed Chairman Warsh AI Task Force | Story #48: First Ethereum MEV Prosecution Acquittal |
| **Style Profile** | `earnings` | `macro` | `crime` (legal sensitive topic) |
| **Approval Status** | **Approved**; Long video public on YouTube (`1FmXK7RxAYY`), Short uploaded | **Approved** in DB via `review` tool | **Approved** in DB via `review` tool |
| **Long Video Duration & File** | 3:59 narration + 10s cards = **4:09** (87.9 MB / 87,883,509 B) | 4:07 narration + 10s cards = **4:17** (87.0 MB / 87,042,184 B) | 4:59 narration + 10s cards = **5:09** (72.1 MB / 72,119,214 B) |
| **Short Video Duration & File** | **64.6 s** (15.8 MB / 15,819,571 B) | **61.2 s** (16.2 MB / 16,151,622 B) | **84.6 s** (19.4 MB / 19,420,149 B) |
| **Fact-Check (Long)** | 30 sentences: 27 supported, **0 partial, 0 unsupported**, 3 framing (**0 flags**) | 28 sentences: 26 supported, **0 partial, 0 unsupported**, 2 framing (**0 flags**) | 46 sentences: 37 supported, **0 partial, 0 unsupported**, 9 framing (**0 flags**) |
| **Fact-Check (Short)** | 15 sentences: 14 supported, **0 partial, 0 unsupported**, 1 framing (**0 flags**) | 9 sentences: 8 supported, **0 partial, 0 unsupported**, 1 framing (**0 flags**) | 10 sentences: 9 supported, **0 partial, 0 unsupported**, 1 framing (**0 flags**) |
| **Visual Assets** | 6 licensed pictures, 10 graphic beats | 6 licensed pictures, 20 graphic beats | 6 licensed pictures, 2 portraits, 19 backdrops |
| **Publish Kit** | 3 Test & Compare title options, tags, chapters | 3 Test & Compare title options, tags, chapters | 3 Test & Compare title options, tags, chapters |
| **Model Cost Incurred** | **$0.00** | **$0.00** | **$0.00** |
| **Remotion Render Time** | ~75s Long, ~45s Short | ~78s Long, ~46s Short | 71s Long, 47s Short |

> **"0 flags" Definition**: Every factual claim is strictly supported by source documents. Framing sentences (rhetorical intros, transitions, outro calls to action) are non-factual structural beats that do not make claims about reality; they are tracked separately and verified clean.

---

## 2. Four Pipeline Optimizations Implemented & Verified

In accordance with user instructions to proceed based on this report, four core architectural optimizations have been fully implemented across the video pipeline codebase:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PipelineX Optimization Matrix                         │
├──────────────────────┬─────────────────────────┬────────────────────────────────┤
│ Optimization Area    │ Source Components       │ Production Enhancement         │
├──────────────────────┼─────────────────────────┼────────────────────────────────┤
│ 1. Automated SRT &   │ NewsVideo.tsx           │ - Synchronized closed captions │
│    Closed Captions   │ ShortVideo.tsx          │ - High-contrast glassmorphism  │
│                      │ publishing.ts           │ - Kinetic active-word pop      │
├──────────────────────┼─────────────────────────┼────────────────────────────────┤
│ 2. Dynamic SVG       │ Chart.tsx (New)         │ - Multi-point line/bar SVG     │
│    Charts            │ NewsVideo.tsx           │ - Pulsing active dots & tooltips│
│                      │ ShortVideo.tsx          │ - Style rule [2d6d2b81]        │
├──────────────────────┼─────────────────────────┼────────────────────────────────┤
│ 3. Multi-Voice &     │ tts.py                  │ - en-US-Andrew (Narrator)      │
│    Speaker Cues      │ script.ts               │ - en-US-Guy (Quotes/Defense)   │
│                      │ NewsVideo.tsx           │ - en-US-Ava (Conflicts)        │
├──────────────────────┼─────────────────────────┼────────────────────────────────┤
│ 4. Zero-Cost Model   │ lib.ts, models.ts       │ - nvidia-vl (Nemotron 120B)    │
│    Chain Defaults    │ llm.ts, .env            │ - nvidia-minimax (3.1 Flash)   │
│                      │                         │ - 4s, 8s, 12s backoff on 429   │
└──────────────────────┴─────────────────────────┴────────────────────────────────┘
```

### 1. Automated Subtitle (SRT) & On-Screen Caption Embedding
- **Remotion Composition Integration**: Both `NewsVideo.tsx` (horizontal 16:9) and `ShortVideo.tsx` (vertical 9:16) embed synchronized on-screen closed captions for mobile and muted playback.
- **Micro-Typography & Staging**: Subtitle boxes feature high-contrast dark glassmorphism (`linear-gradient(135deg, rgba(8, 12, 20, 0.95), rgba(4, 6, 10, 0.97))`, `backdropFilter: blur(12px)`, `border: 1px solid rgba(255,255,255,0.14)`).
- **Kinetic Word Highlighting**: Words illuminate in neon accent green (`#36d399`) with glow shadows (`0 0 16px rgba(54,211,153,0.7)`) as they are spoken, with numeric financial metrics highlighting in warning coral (`#ff5c5c`).
- **Safe Zone Alignment**: Captions are anchored at `bottom: 64px` in Long compositions (respecting the 1080p broadcast title safe zone, avoiding collision with top lower-thirds or bottom source credits) and dynamically adjust between `top: 760px` (text-only beats) and `top: 1220px` (graphic beats) in Shorts.
- **SRT File Generation**: `modules/video/backend/publishing.ts` generates clean `.srt` transcripts with restored punctuation and 42-character line limits, downloadable via `GET /api/admin/video/videos/:id/captions.srt[?variant=short]` and automatically pushed to YouTube.

### 2. Dynamic Animated SVG Chart Generation
- **Dedicated Component**: Implemented `renderer/src/components/Chart.tsx`, a reusable dynamic SVG visualizer accepting multi-point financial series (`points: Array<{ label: string; value: number }>`, `unit: string`, `title: string`, `source: string`).
- **Dual Visual Modes**:
  - *Bar Charts (<= 5 points)*: Vertical animated bars with spring dynamics (`damping: 180`), starting-versus-ending comparison, and color-coded delta badges.
  - *Line/Area Charts (> 5 points)*: Smooth SVG cubic-polyline interpolation, semi-transparent gradient fill (`linearGradient` with glow filter), pulsing endpoint indicator (`r={18 + 4 * sin(f/6)}`), floating value tooltip, and timestamped horizontal axis labels.
- **Mobile Vertical Responsiveness**: Tailored layout supporting both desktop landscape (1360×480) and YouTube Shorts vertical (920×580).
- **Rule `[2d6d2b81]` Enforcement**: When a financial dossier contains 2+ dated numeric values of a metric (interest rates, earnings, stock/asset prices), the script engine mandates a dynamic `chart` beat rather than falling back to plain text cards or generic B-roll.

### 3. Multi-Voice Dialogue & Perspective Styling for Disputed Claims
- **Edge-TTS Neural Voice Routing**: Upgraded `renderer/tts.py` to route beats to distinct neural speakers:
  - *Primary Narrator*: `en-US-AndrewMultilingualNeural` (authoritative, broadcast-standard cadence).
  - *Direct Quotes & Official Statements*: `en-US-GuyNeural` (distinguished, clear conversational tone).
  - *Disputed Perspectives & Counter-Claims*: `en-US-AvaMultilingualNeural` (distinct female timbre for balanced journalistic perspective).
- **Voice-Aware Audio Caching**: `get_cached()` and `put_cache()` in `tts.py` record `(engine, voice, rate, text)`, ensuring beats synthesized with different voices are cleanly segregated and never collide in cache.
- **Visual Perspective Badges**: When a beat presents a disputed claim, court defense, or official statement, `NewsVideo.tsx` and `ShortVideo.tsx` display an on-screen pill badge (`PERSPECTIVE: DEFENSE`, `DISPUTED CLAIM`, `QUOTE · [SPEAKER]`) styled in distinct accent hues to clarify speaker role for muted viewers.

### 4. Permanent Zero-Cost Model Chain & Exponential Backoff Defaults
- **Chain Architecture**: `site/models.ts`, `renderer/lib.ts`, and `.env` permanently enforce the zero-cost NIM provider chain:
  `nvidia-vl` (Nemotron 120B Super-VL) → `nvidia-minimax` (MiniMax 3.1 Flash) → `nvidia-nemotron` (Nemotron 30B) → `openrouter-free` → `orcarouter-free` → `default`.
- **429 Exponential Backoff**: Hardened HTTP 429 throttling recovery across both `renderer/lib.ts` and `packages/backend/src/providers/llm.ts`:
  - Retries up to 3 times per model.
  - Exponential delay: **4s on retry 1, 8s on retry 2, 12s on retry 3** before cleanly handing off to the next provider.
- **Strict $0.00 Guarantee**: All model calls, vision verifications, audio synthesis operations, and video rendering processes use zero-cost tiers, maintaining zero external API billing across production.

---

## 3. Financial News Video Production Takeaways

### A. Fact-Checking & Legal Attribution Patterns
1. **Attribute Expectations vs. Historic Facts**: Forward-looking statements must never be stated as established history. For example: *"CNBC reports the Fed is weighing a December increase"* is factual and verifiable, whereas *"The Fed will raise rates in December"* is an unverified assertion.
2. **Presumption of Innocence in Legal Contexts**: In judicial reporting (such as Video #3), criminal charges must be strictly framed as allegations (*"prosecutors alleged"*, *"the indictment claimed"*), and acquittals must be contextualized with exact legal findings rather than broad editorial declarations.
3. **Preserve Exact Sourced Dates**: Never replace specific FOMC meeting dates or court ruling dates with vague approximations like *"in the coming weeks"*. If the source specifies December 8–9, state December 8–9.

### B. Visual Density & Audience Retention
1. **Eliminate Wall-of-Text Fatigue**: In early runs, plain text cards represented up to 70% of non-broll beats, causing visual monotony. Adopting style rule `[2d6d2b81]` (converting dated figures to dynamic SVG charts) elevated visual interest and kept viewers engaged.
2. **Authentic Contextual Imagery**: Maintain a strict 60%+ threshold of concrete photos or relevant B-roll clips (server rooms, trading terminals, court gavels). Never use uncredited commercial wire photos that risk Content ID strikes.
3. **Dynamic Motion Variety**: Alternate camera movements across beats (push-in, right-glide, pull-back, left-glide) and use subtle sweep hairlines across cuts to produce broadcast-quality flow.

### C. Audio Synthesis & Acoustic Engineering
1. **Pacing Differences for Long vs. Short**: Long-form narration succeeds best at a steady, measured pace (`+4%` rate, `0.25s` beat gaps, `0.7s` scene gaps). Vertical Shorts require rapid, dense delivery (`+10%` rate, `0.1s` beat gaps, `0.3s` scene gaps) to retain mobile attention.
2. **Dynamic Audio Ducking Curves**:
   - Branded Intro: Music volume at `10%` for punchy channel branding.
   - Narration Body: Ducked cleanly to `3.8%` (`0.038`) to guarantee pristine voice intelligibility without frequency masking.
   - Outro Card: Music swells to `15%` (`0.15`) as narrator finishes, driving subscription CTA momentum.
3. **Multi-Voice Contrast**: Utilizing distinct neural voices for quotations and disputed claims breaks mono-voice monotony and signals structural shifts in journalistic perspective.

### D. Cost Governance & Resilience in Automated Pipelines
1. **Per-Model Rate Ceiling Awareness**: Free-tier developer endpoints (such as NVIDIA NIM) impose per-model concurrency caps. Separating MiniMax and Nemotron into distinct service keys prevents cascaded circuit breaker trips.
2. **Exponential Backoff Over Rapid Retries**: Immediate retries during burst limits exacerbate 429 throttling. Stepped backoffs of 4s, 8s, and 12s allow upstream token buckets to refill without dropping the job.
3. **100% Free Ecosystem**: Automated newsroom operations can achieve professional production benchmarks with $0.00 model expenditure by pairing free open-weight NIMs, Edge-TTS, and local Remotion execution.
