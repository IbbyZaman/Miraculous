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
    # A shared series cover is better than a blank tile if a specific episode
    # has no matching still or no image in the public metadata.
    remainder = [ep for ep in entries if ep.get("season") == 4 and not ep.get("thumbnail")]
    fallback_count = 0
    if remainder:
        try:
            show = get_json("https://api.tvmaze.com/shows/5557")
            cover = (show.get("image") or {}).get("original") or (show.get("image") or {}).get("medium")
            if isinstance(cover, str) and cover.startswith("https://"):
                for ep in remainder:
                    ep["thumbnail"] = cover
                    fallback_count += 1
        except Exception as exc:
            print("Season 4 series-cover fallback unavailable:", type(exc).__name__)
    if count or fallback_count:
        path.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    unmatched = [ep.get("title") for ep in entries if ep.get("season") == 4 and not ep.get("thumbnail")]
    print(f"Season 4: {count} episode stills, {fallback_count} series-cover fallbacks, missing: {unmatched}")

if __name__ == "__main__":
    for filename in sys.argv[1:]:
        main(filename)
