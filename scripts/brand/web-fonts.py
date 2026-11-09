"""Makes the website's fonts (worker/public/fonts/*.woff2) from the app's font packages: Geist, Geist Mono,
and Instrument Serif Italic for the wordmark.

Latin only, so the whole set stays small. Needs fontTools and brotli:
    python3 -m pip install fonttools brotli && python3 scripts/brand/web-fonts.py
"""
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / "node_modules" / "@expo-google-fonts"
OUT = ROOT / "worker" / "public" / "fonts"

FILES = {
    "geist-200.woff2": "geist/200ExtraLight/Geist_200ExtraLight.ttf",
    "geist-300.woff2": "geist/300Light/Geist_300Light.ttf",
    "geist-400.woff2": "geist/400Regular/Geist_400Regular.ttf",
    "geist-500.woff2": "geist/500Medium/Geist_500Medium.ttf",
    "geist-mono-400.woff2": "geist-mono/400Regular/GeistMono_400Regular.ttf",
    "instrument-serif-italic.woff2": "instrument-serif/400Regular_Italic/InstrumentSerif_400Regular_Italic.ttf",
}
# Basic Latin and Latin-1, dashes, curly quotes, bullet, ellipsis, euro, arrows, minus, times, check mark.
UNICODES = "U+0000-00FF,U+2013-2014,U+2018-201D,U+2022,U+2026,U+20AC,U+2190-2193,U+2212,U+00D7,U+2713"

OUT.mkdir(parents=True, exist_ok=True)
for name, src in FILES.items():
    subset.main([str(FONTS / src), f"--unicodes={UNICODES}", "--flavor=woff2", "--layout-features=kern,liga,tnum", f"--output-file={OUT / name}"])
    print(f"worker/public/fonts/{name}  {(OUT / name).stat().st_size // 1024} KB")
