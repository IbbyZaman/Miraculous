#!/usr/bin/env python3
"""Fill missing Season 4 stills from TVmaze by episode TITLE, never by ordering.
Preexisting thumbnails supplied by MiraculousHub take precedence.
Runs at APK build time; gracefully retains bundled catalogue if offline.
"""
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

def normal(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())

aliases = {
    "verite": "truth",
    "mensonge": "lies",
    "legangdessecrets": "gangofsecrets",
    "furieuxfu": "furiousfu",
    "psychomedian": "psycomedian",
    "culpabysse": "guiltrip",
}
def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "MiraculousHub-Build/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=12) as response:
        return json.load(response)

def main(filename):
    path = Path(filename)
    entries = json.loads(path.read_text(encoding="utf-8"))
    try:
        remote = get_json("https://api.tvmaze.com/shows/5557/episodes")
    except Exception as exc:
        print("TVmaze S4 image lookup unavailable:", type(exc).__name__)
        return
    names = {}
    for ep in remote:
        if ep.get("season") != 4:
            continue
        image = (ep.get("image") or {}).get("medium") or (ep.get("image") or {}).get("original")
        if image and image.startswith("https://"):
            title = normal(ep.get("name"))
            names[title] = image
            names[aliases.get(title, title)] = image
    count = 0
    for ep in entries:
        if ep.get("season") != 4 or ep.get("thumbnail"):
            continue
        key = normal(ep.get("title"))
        value = names.get(key) or names.get(aliases.get(key))
        if value:
            ep["thumbnail"] = value
            count += 1
    if count:
        path.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Season 4: applied {count} title-matched stills from TVmaze; other episode artwork unchanged.")

if __name__ == "__main__":
    for filename in sys.argv[1:]:
        main(filename)
