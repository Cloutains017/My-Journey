"""Vendor Xiaomi's original MiSans WOFF2 slices without altering glyphs."""

from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import time
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public/fonts/misans"
SERVICE = "https://hr.xiaomi.com/website/assets/fonts/global.css"


def fetch(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                return response.read()
        except (OSError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def vendor(item):
    url, relative = item
    target = DEST / relative
    data = target.read_bytes() if target.exists() else fetch(url)
    if not data.startswith(b"wOF2"):
        raise ValueError(f"Not a WOFF2 font: {url}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return {"file": relative, "source": url, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    rules, assets = [], []
    for family in ("MiSans VF",):
        css = fetch(SERVICE).decode("utf-8")
        jobs = []
        for block in re.findall(r"@font-face\s*\{([^}]+)\}", css):
            url = re.search(r'url\(["\']([^"\']+\.woff2)["\']\)', block).group(1)
            if not url.startswith("https://cdn-file.hyperos.mi.com/mi-font-service/misans_vf/VF/"):
                raise ValueError(f"Unexpected font origin: {url}")
            unicode_range = re.sub(r"\s+", "", re.search(r"unicode-range:\s*([^;]+);", block).group(1))
            relative = f"VF/{url.rsplit('/', 1)[1]}"
            jobs.append((url, relative))
            rules.append(
                "@font-face{font-family:MiSans;font-style:normal;"
                "font-weight:150 700;font-display:swap;"
                f"src:url('/fonts/misans/{relative}') format('woff2');"
                f"unicode-range:{unicode_range};}}"
            )
        if not jobs:
            raise ValueError(f"No font slices for {family}")
        with ThreadPoolExecutor(max_workers=6) as pool:
            assets.extend(pool.map(vendor, jobs))
        print(f"{family}: {len(jobs)} original font slices", flush=True)
    (DEST / "fonts.css").write_text("\n".join(rules) + "\n", encoding="utf-8")
    (DEST / "manifest.json").write_text(json.dumps({
        "family": "MiSans", "weight_axis": [150, 700],
        "service": SERVICE,
        "license": "https://hyperos.mi.com/font/zh/faq/",
        "assets": assets,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Total: {len(assets)} slices, {sum(item['bytes'] for item in assets):,} bytes", flush=True)


if __name__ == "__main__":
    main()
