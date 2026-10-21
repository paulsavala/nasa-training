"""Decode austin_osm.txt (OpenStreetMap extract, (c) OpenStreetMap contributors, ODbL)
into city.json for the viewer. Coordinates are base-36 integers in 1e-5 degrees,
offset from (29.5 N, -98.5 E); each line carries a checksum."""
import json
def dec(pts):
    out = []
    for p in pts.split(" "):
        a, b = p.split(".")
        out.append([round(int(a, 36) / 1e5 + 29.5, 5), round(int(b, 36) / 1e5 - 98.5, 5)])
    return out
city = {"downtown": [], "campus_buildings": [], "campus": None, "river": []}
for line in open("austin_osm.txt"):
    line = line.rstrip("\n")
    if not line: continue
    kind, name, h, ck, pts = line.split("|", 4)
    g = dec(pts)
    if kind == "D": city["downtown"].append({"n": name, "h": float(h), "g": g})
    elif kind == "S": city["campus_buildings"].append({"n": name, "h": float(h) if h else None, "g": g})
    elif kind == "C": city["campus"] = {"n": name, "g": g}
    elif kind == "R": city["river"].append(g)
json.dump(city, open("city.json", "w"), separators=(",", ":"))
print({k: (len(v) if isinstance(v, list) else 1) for k, v in city.items()}, "tallest:", max(city["downtown"], key=lambda b: b["h"])["n"])
