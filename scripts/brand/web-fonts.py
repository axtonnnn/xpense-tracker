"""Makes the website's fonts (worker/public/fonts/*.woff2) from the app's font packages.

Latin only, so the whole set stays small. Needs fontTools and brotli:
    python3 -m pip install fonttools brotli && python3 scripts/brand/web-fonts.py
"""
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / "node_modules" / "@expo-google-fonts"
OUT = ROOT / "worker" / "public" / "fonts"

FILES = {
    "instrument-serif.woff2": "instrument-serif/400Regular/InstrumentSerif_400Regular.ttf",
    "instrument-serif-italic.woff2": "instrument-serif/400Regular_Italic/InstrumentSerif_400Regular_Italic.ttf",
    "inter-400.woff2": "inter/400Regular/Inter_400Regular.ttf",
    "inter-600.woff2": "inter/600SemiBold/Inter_600SemiBold.ttf",
    "caveat-500.woff2": "caveat/500Medium/Caveat_500Medium.ttf",
}
# Basic Latin and Latin-1, dashes, curly quotes, bullet, ellipsis, euro, arrows, minus, times, check mark.
UNICODES = "U+0000-00FF,U+2013-2014,U+2018-201D,U+2022,U+2026,U+20AC,U+2190-2193,U+2212,U+00D7,U+2713"

OUT.mkdir(parents=True, exist_ok=True)
for name, src in FILES.items():
    subset.main([str(FONTS / src), f"--unicodes={UNICODES}", "--flavor=woff2", "--layout-features=kern,liga,tnum", f"--output-file={OUT / name}"])
    print(f"worker/public/fonts/{name}  {(OUT / name).stat().st_size // 1024} KB")
