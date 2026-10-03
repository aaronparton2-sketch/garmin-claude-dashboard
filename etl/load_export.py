#!/usr/bin/env python3
"""
Garmin GDPR export -> clean datasets -> (optional) Supabase.

Usage:
    python etl/load_export.py --export "C:/path/to/extracted-export"            # parse + dump JSON to ../data
    python etl/load_export.py --export "..." --supabase                         # also upsert to Supabase
    python etl/load_export.py --export "..." --supabase --only weigh_ins        # one table only

Supabase creds are read from env (or a .env in the project root):
    GARMIN_SUPABASE_URL              e.g. https://abcd.supabase.co
    GARMIN_SUPABASE_SERVICE_ROLE_KEY service_role key (server-side only)

Units are normalised here so the DB columns are human-readable:
    weight / muscle / bone : grams -> kg
    activity duration      : ms -> seconds
    epoch ms timestamps    : -> ISO-8601 UTC
"""
import argparse, glob, json, os, sys
from datetime import datetime, timezone

# ---------------------------------------------------------------- helpers
def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def epoch_ms_to_iso(ms):
    if ms in (None, "", 0):
        return None
    try:
        return datetime.fromtimestamp(float(ms) / 1000, tz=timezone.utc).isoformat()
    except Exception:
        return None

def g_to_kg(v):
    return round(v / 1000.0, 2) if isinstance(v, (int, float)) else None

def rnd(v, n=1):
    return round(v, n) if isinstance(v, (int, float)) else None

def nz(v):
    # 0 from the scale = a failed impedance reading (impossible 0% fat / 0kg muscle) -> null
    return v if isinstance(v, (int, float)) and v != 0 else None

# ---------------------------------------------------------------- parsers
def parse_weigh_ins(root):
    """INDEX_SCALE entries from userBioMetrics.json — full body composition."""
    out = {}
    for path in glob.glob(os.path.join(root, "**", "*userBioMetrics.json"), recursive=True):
        for rec in load_json(path):
            w = rec.get("weight")
            if not isinstance(w, dict) or w.get("sourceType") != "INDEX_SCALE":
                continue
            ts = epoch_ms_to_iso(_ts_ms(w.get("timestampGMT")))
            if not ts:
                continue
            out[ts] = {
                "measured_at": ts,
                "measured_date": ts[:10],
                "weight_kg": g_to_kg(w.get("weight")),
                "bmi": rnd(nz(w.get("bmi"))),
                "body_fat_pct": rnd(nz(w.get("bodyFat"))),
                "body_water_pct": rnd(nz(w.get("bodyWater"))),
                "muscle_mass_kg": g_to_kg(nz(w.get("muscleMass"))),
                "bone_mass_kg": g_to_kg(nz(w.get("boneMass"))),
                "raw_impedance": nz(w.get("rawImpedance")),
                "source": "INDEX_SCALE",
            }
    return list(out.values())

def _ts_ms(v):
    """timestampGMT can be epoch ms OR an ISO string; normalise to epoch ms."""
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, str):
        try:
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
            if dt.tzinfo is None:                  # naive GMT string -> treat as UTC
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.timestamp() * 1000
        except Exception:
            return None
    return None

def parse_activities(root):
    out = {}
    for path in glob.glob(os.path.join(root, "**", "*summarizedActivities*.json"), recursive=True):
        blob = load_json(path)
        arr = blob[0].get("summarizedActivitiesExport", []) if isinstance(blob, list) else blob.get("summarizedActivitiesExport", [])
        for a in arr:
            aid = a.get("activityId")
            if aid is None:
                continue
            started = epoch_ms_to_iso(a.get("startTimeGmt") or a.get("beginTimestamp"))
            atype = a.get("activityType")
            if isinstance(atype, dict):
                atype = atype.get("typeKey")
            out[aid] = {
                "activity_id": aid,
                "activity_date": (started or "")[:10] or None,
                "started_at": started,
                "activity_type": atype,
                "name": a.get("name"),
                "duration_s": int(a["duration"] / 1000) if isinstance(a.get("duration"), (int, float)) else None,
                "distance_m": rnd(a.get("distance"), 2),
                "avg_hr": a.get("avgHr"),
                "max_hr": a.get("maxHr"),
                "calories": int(a["calories"]) if isinstance(a.get("calories"), (int, float)) else None,
                "elevation_gain_m": rnd(a.get("elevationGain"), 2),
                "aerobic_te": rnd(a.get("aerobicTrainingEffect")),
                "anaerobic_te": rnd(a.get("anaerobicTrainingEffect")),
                "training_load": rnd(a.get("activityTrainingLoad"), 2),
                "moderate_min": a.get("moderateIntensityMinutes"),
                "vigorous_min": a.get("vigorousIntensityMinutes"),
            }
    return [v for v in out.values() if v["activity_date"]]

def parse_sleep(root):
    out = {}
    for path in sorted(glob.glob(os.path.join(root, "**", "*sleepData.json"), recursive=True)):
        for s in load_json(path):
            date = s.get("calendarDate")
            if not date:
                continue
            score = None
            sc = s.get("sleepScores")
            if isinstance(sc, dict):
                ov = sc.get("overall")
                score = ov.get("value") if isinstance(ov, dict) else None
            deep = s.get("deepSleepSeconds") or 0
            light = s.get("lightSleepSeconds") or 0
            rem = s.get("remSleepSeconds") or 0
            awake = s.get("awakeSleepSeconds") or 0
            out[date] = {
                "sleep_date": date,
                "started_at": epoch_ms_to_iso(s.get("sleepStartTimestampGMT")),
                "ended_at": epoch_ms_to_iso(s.get("sleepEndTimestampGMT")),
                "total_sleep_s": deep + light + rem,
                "deep_s": deep, "light_s": light, "rem_s": rem, "awake_s": awake,
                "sleep_score": score,
                "avg_respiration": rnd(s.get("averageRespiration")),
                "avg_stress": s.get("avgSleepStress") if isinstance(s.get("avgSleepStress"), int) else (
                    int(s["avgSleepStress"]) if isinstance(s.get("avgSleepStress"), float) else None),
            }
    return list(out.values())

def parse_daily(root):
    out = {}
    for path in sorted(glob.glob(os.path.join(root, "**", "UDSFile_*.json"), recursive=True)):
        for u in load_json(path):
            date = u.get("calendarDate")
            if not date:
                continue
            out[date] = {
                "summary_date": date,
                "total_steps": u.get("totalSteps"),
                "step_goal": u.get("dailyStepGoal"),
                "distance_m": rnd(u.get("totalDistanceMeters"), 2),
                "total_calories": u.get("totalKilocalories"),
                "active_calories": u.get("activeKilocalories"),
                "resting_hr": u.get("restingHeartRate"),
                "min_hr": u.get("minHeartRate"),
                "max_hr": u.get("maxHeartRate"),
                "moderate_min": u.get("moderateIntensityMinutes"),
                "vigorous_min": u.get("vigorousIntensityMinutes"),
                "floors_ascended": rnd(u.get("floorsAscendedInMeters"), 2),
            }
    return list(out.values())

PARSERS = {
    "weigh_ins": parse_weigh_ins,
    "activities": parse_activities,
    "sleep": parse_sleep,
    "daily_summary": parse_daily,
}
CONFLICT = {
    "weigh_ins": "measured_at",
    "activities": "activity_id",
    "sleep": "sleep_date",
    "daily_summary": "summary_date",
}

# ---------------------------------------------------------------- supabase
def upsert(table, rows, url, key):
    import requests
    if not rows:
        return 0
    endpoint = f"{url.rstrip('/')}/rest/v1/garmin_{table}?on_conflict={CONFLICT[table]}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    sent = 0
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        r = requests.post(endpoint, headers=headers, data=json.dumps(chunk))
        if r.status_code >= 300:
            sys.exit(f"  ! {table}: HTTP {r.status_code} {r.text[:300]}")
        sent += len(chunk)
    return sent

def load_dotenv(path):
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", required=True, help="path to extracted GDPR export folder")
    ap.add_argument("--supabase", action="store_true", help="upsert to Supabase")
    ap.add_argument("--only", help="comma-separated subset of tables")
    args = ap.parse_args()

    proj_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(proj_root, ".env"))
    data_dir = os.path.join(proj_root, "data")
    os.makedirs(data_dir, exist_ok=True)

    tables = args.only.split(",") if args.only else list(PARSERS)
    results = {}
    for t in tables:
        rows = PARSERS[t](args.export)
        rows.sort(key=lambda r: r.get(CONFLICT[t]) or "")
        results[t] = rows
        with open(os.path.join(data_dir, f"{t}.json"), "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2)
        print(f"  {t:14s} {len(rows):5d} rows -> data/{t}.json")

    # quick body-comp readout (the headline)
    wi = results.get("weigh_ins") or []
    if wi:
        first, last = wi[0], wi[-1]
        print(f"\n  Body comp: {first['measured_date']} -> {last['measured_date']}")
        print(f"    weight    {first['weight_kg']} -> {last['weight_kg']} kg")
        print(f"    body fat  {first['body_fat_pct']} -> {last['body_fat_pct']} %")
        print(f"    muscle    {first['muscle_mass_kg']} -> {last['muscle_mass_kg']} kg")

    if args.supabase:
        url = os.environ.get("GARMIN_SUPABASE_URL")
        key = os.environ.get("GARMIN_SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            sys.exit("\n! Set GARMIN_SUPABASE_URL + GARMIN_SUPABASE_SERVICE_ROLE_KEY (env or project .env)")
        print("\n  Upserting to Supabase...")
        for t in tables:
            n = upsert(t, results[t], url, key)
            print(f"    {t:14s} {n:5d} upserted")

    print("\nDone.")

if __name__ == "__main__":
    main()
