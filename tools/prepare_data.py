"""Crop three TEMPO L2 granules to the area over Austin and write compact JSON
for the 3D viewer. Usage: python prepare_data.py HCHO.nc NO2.nc O3PROF.nc out.json"""
import json, sys, datetime as dt
import numpy as np, netCDF4

hcho_p, no2_p, o3_p, out_p = sys.argv[1:5]
H, N, O = (netCDF4.Dataset(p) for p in (hcho_p, no2_p, o3_p))
EPOCH = dt.datetime(1980, 1, 6, tzinfo=dt.timezone.utc)

def arr(v):
    return np.ma.filled(np.ma.asarray(v[:]).astype(float), np.nan)

def r(x, sig=4):
    return None if not np.isfinite(x) else float(f"{x:.{sig}g}")

def angle(ds, name):
    return float(np.nanmedian(arr(ds["geolocation"][name])))

# --- HCHO grid: defines the fine pixels (with corner outlines) --------------------
hm, hx = H["mirror_step"][:], H["xtrack"][:]
lat, lon = arr(H["geolocation/latitude"]), arr(H["geolocation/longitude"])
latb, lonb = arr(H["geolocation/latitude_bounds"]), arr(H["geolocation/longitude_bounds"])
htime = arr(H["geolocation/time"])
hv, hu = arr(H["product/vertical_column"]), arr(H["product/vertical_column_uncertainty"])
hq = arr(H["product/main_data_quality_flag"])
cf, pbl = arr(H["support_data/eff_cloud_fraction"]), arr(H["support_data/pbl_height"])
sza = arr(H["geolocation/solar_zenith_angle"])

# NO2 on the same grid (verified identical geolocation): index by mirror_step / xtrack
nm, nx = N["mirror_step"][:].tolist(), N["xtrack"][:].tolist()
nrow, ncol = {m: i for i, m in enumerate(nm)}, {x: j for j, x in enumerate(nx)}
ntrop, nstrat = arr(N["product/vertical_column_troposphere"]), arr(N["product/vertical_column_stratosphere"])
ntot, nunc = arr(N["support_data/vertical_column_total"]), arr(N["product/vertical_column_troposphere_uncertainty"])
nq = arr(N["product/main_data_quality_flag"])

pixels = []
for i, j in zip(*np.nonzero(np.isfinite(lat))):
    a, b = nrow[int(hm[i])], ncol[int(hx[j])]
    pixels.append({
        "c": [[r(latb[i, j, k], 7), r(lonb[i, j, k], 7)] for k in range(4)],
        "lat": r(lat[i, j], 7), "lon": r(lon[i, j], 7),
        "t": r(htime[i], 12),
        "hcho": r(hv[i, j]), "hcho_unc": r(hu[i, j]), "hcho_q": int(hq[i, j]),
        "no2_trop": r(ntrop[a, b]), "no2_trop_unc": r(nunc[a, b]), "no2_strat": r(nstrat[a, b]),
        "no2_total": r(ntot[a, b]), "no2_q": None if not np.isfinite(nq[a, b]) else int(nq[a, b]),
        "cloud": r(cf[i, j], 3), "pbl": r(pbl[i, j], 4), "sza": r(sza[i, j], 4),
    })

# --- O3 profiles (coarser pixels, 24 layers each) ---------------------------------
olat = arr(O["geolocation/latitude"])
olatb, olonb = arr(O["geolocation/latitude_bounds"]), arr(O["geolocation/longitude_bounds"])
prof = arr(O["product/ozone_profile"])
altb = arr(O["support_data/ozone_profile_altitude_bounds"])
tot, trop, strat = (arr(O[f"product/{v}"]) for v in ("total_ozone_column", "troposphere_ozone_column",
                                                        "stratosphere_ozone_column"))
ozone = []
for i, j in zip(*np.nonzero(np.isfinite(olat))):
    if not np.isfinite(prof[i, j]).all():
        continue
    layers = []
    for k in range(prof.shape[2]):
        lo, hi = sorted((altb[i, j, k, 0], altb[i, j, k, 1]))
        layers.append([r(lo, 4), r(hi, 4), r(prof[i, j, k], 4)])
    ozone.append({
        "c": [[r(olatb[i, j, k], 7), r(olonb[i, j, k], 7)] for k in range(4)],
        "layers": layers, "total": r(tot[i, j]), "trop": r(trop[i, j]), "strat": r(strat[i, j]),
    })

t0, t1 = np.nanmin(htime), np.nanmax(htime)
meta = {
    "granule_start": H.time_coverage_start, "granule_end": H.time_coverage_end,
    "austin_start_utc": (EPOCH + dt.timedelta(seconds=float(t0))).isoformat(),
    "austin_end_utc": (EPOCH + dt.timedelta(seconds=float(t1))).isoformat(),
    "bounds": {"lat": [float(np.nanmin(latb)), float(np.nanmax(latb))],
               "lon": [float(np.nanmin(lonb)), float(np.nanmax(lonb))]},
    "angles": {"sza": angle(H, "solar_zenith_angle"), "saa": angle(H, "solar_azimuth_angle"),
               "vza": angle(H, "viewing_zenith_angle"), "vaa": angle(H, "viewing_azimuth_angle")},
    "pandora": {"name": "St. Edward's University (Pandora 257, AustinTX)", "lat": 30.2285, "lon": -97.7544,
                "alt_m": 205},
    "files": [H.local_granule_id if "local_granule_id" in H.ncattrs() else hcho_p,
              N.local_granule_id if "local_granule_id" in N.ncattrs() else no2_p,
              O.local_granule_id if "local_granule_id" in O.ncattrs() else o3_p],
}
json.dump({"meta": meta, "pixels": pixels, "ozone": ozone}, open(out_p, "w"), separators=(",", ":"))
print(f"{len(pixels)} pixels, {len(ozone)} ozone profiles -> {out_p}")
print(json.dumps(meta, indent=1))
