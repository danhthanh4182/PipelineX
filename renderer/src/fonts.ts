import { staticFile, delayRender, continueRender } from "remotion";

// Bundled Vietnamese-capable fonts. The voice step (renderer/tts.py) copies
// renderer/fonts/*.ttf into each video's public folder as fonts/<file>, and the
// compositions register them here before any frame renders, so text never falls
// back to system fonts (whose Vietnamese marks render in a mismatched weight).
const FACES: Array<{ family: string; file: string; weight: number }> = [
  { family: "Be Vietnam Pro", file: "BeVietnamPro-Regular.ttf", weight: 400 },
  { family: "Be Vietnam Pro", file: "BeVietnamPro-Medium.ttf", weight: 500 },
  { family: "Be Vietnam Pro", file: "BeVietnamPro-SemiBold.ttf", weight: 600 },
  { family: "Be Vietnam Pro", file: "BeVietnamPro-Bold.ttf", weight: 700 },
  { family: "Be Vietnam Pro", file: "BeVietnamPro-ExtraBold.ttf", weight: 800 },
  { family: "Be Vietnam Pro", file: "BeVietnamPro-Black.ttf", weight: 900 },
  { family: "Noto Serif", file: "NotoSerif-Regular.ttf", weight: 400 },
  { family: "Noto Serif", file: "NotoSerif-SemiBold.ttf", weight: 600 },
  { family: "Noto Serif", file: "NotoSerif-Bold.ttf", weight: 700 },
  { family: "Noto Serif", file: "NotoSerif-Black.ttf", weight: 900 },
];

const handle = delayRender("Loading bundled fonts");
Promise.all(
  FACES.map(async ({ family, file, weight }) => {
    const face = new FontFace(family, `url("${staticFile(`fonts/${file}`)}")`, {
      weight: String(weight),
      style: "normal",
    });
    await face.load();
    document.fonts.add(face);
  }),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    // Never block a render on fonts: log and continue with the fallback stack.
    console.error("Bundled font load failed", err);
    continueRender(handle);
  });
