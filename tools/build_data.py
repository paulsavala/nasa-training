"""Combine the TEMPO extract and the city geometry into data/tempo-data.js.

Run from this folder after prepare_data.py and make_city.py:
    python3 prepare_data.py HCHO.nc NO2.nc O3PROF.nc tempo_austin.json
    python3 make_city.py            # austin_osm.txt -> city.json
    python3 build_data.py           # -> ../data/tempo-data.js
"""
import json, pathlib

here = pathlib.Path(__file__).parent
data = json.loads((here / "tempo_austin.json").read_text())
data["city"] = json.loads((here / "city.json").read_text())
out = here.parent / "data" / "tempo-data.js"
out.write_text("/* TEMPO L2 pixels and ozone profiles over Austin (built by tools/build_data.py) plus OpenStreetMap city geometry "
               "(© OpenStreetMap contributors, ODbL). */\nwindow.TEMPO_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB)")
