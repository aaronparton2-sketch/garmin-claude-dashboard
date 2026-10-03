#!/usr/bin/env python3
"""
Generate the SAMPLE dataset the demo dashboard runs on.

Everything in data/sample/ is produced by this script for a fictional athlete
("Sam", training towards a sample half-distance triathlon). None of it is real
Garmin data. The point is to render every page of the dashboard with plausible
numbers and trends so you can see what your own data will look like before you
wire anything up.

The JSON shapes match the tables the real pipeline writes (see sql/schema.sql
and the garmin-claude-coach pull), so swapping sample -> live is a config
change, not a code change.

    python scripts/generate_sample_data.py            # writes data/sample/*.json
    python scripts/generate_sample_data.py --end 2026-10-02 --days 730

Deterministic: same seed, same output.
"""
import argparse, json, math, os, random
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "sample")

HEIGHT_M = 1.78


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def iso(d: date, hh=6, mm=0) -> str:
    return datetime(d.year, d.month, d.day, hh, mm, tzinfo=timezone.utc).isoformat()


def created(d: date) -> str:
    """When a daily pull would have written the row: the next morning."""
    return iso(d + timedelta(days=1), 5, 40)


# ---------------------------------------------------------------- activities
# A weekly template per phase. Each entry: (weekday, type, name, base_minutes, intensity 0..1)
# weekday: 0 = Monday. intensity drives HR, TE and load.
BASE_WEEK = [
    (0, "strength_training", "Strength", 50, 0.45),
    (1, "running", "Easy Run", 40, 0.45),
    (2, "lap_swimming", "Pool Swim", 40, 0.5),
    (3, "running", "Tempo Run", 45, 0.75),
    (4, "strength_training", "Strength", 45, 0.45),
    (5, "road_biking", "Long Ride", 95, 0.55),
    (6, "running", "Long Run", 65, 0.5),
]
BUILD_WEEK = [
    (0, "lap_swimming", "Pool Swim", 45, 0.5),
    (0, "strength_training", "Strength", 40, 0.4),
    (1, "running", "Intervals", 50, 0.85),
    (2, "indoor_cycling", "Trainer Intervals", 60, 0.8),
    (3, "lap_swimming", "Pool Swim", 50, 0.55),
    (3, "running", "Easy Run", 35, 0.4),
    (4, "strength_training", "Strength", 40, 0.4),
    (5, "road_biking", "Long Ride", 140, 0.6),
    (5, "running", "Brick Run", 20, 0.7),
    (6, "running", "Long Run", 80, 0.55),
    (6, "open_water_swimming", "Open Water Swim", 40, 0.5),
]
DOWN_WEEK = [
    (0, "lap_swimming", "Easy Swim", 35, 0.4),
    (1, "running", "Easy Run", 35, 0.4),
    (2, "road_biking", "Easy Spin", 50, 0.4),
    (4, "strength_training", "Strength", 35, 0.35),
    (5, "road_biking", "Long Ride", 90, 0.5),
    (6, "running", "Long Run", 50, 0.45),
]


def phase_for(d: date, end: date):
    """Last 16 weeks = structured build (every 4th week down). Before that = base."""
    weeks_out = (end - d).days // 7
    if weeks_out >= 16:
        return "base"
    wk = 16 - weeks_out  # 1..16
    return "down" if wk % 4 == 0 else "build"


def fitness(d: date, start: date, end: date) -> float:
    """0 at start -> 1 at end, slightly s-shaped. Drives pace/speed/RHR trends."""
    t = (d - start).days / max(1, (end - start).days)
    return 1 / (1 + math.exp(-6 * (t - 0.5)))


def gen_activities(rng, start, end):
    rows = []
    aid = 10_000_000_001
    d = start
    while d <= end:
        ph = phase_for(d, end)
        week = {"base": BASE_WEEK, "build": BUILD_WEEK, "down": DOWN_WEEK}[ph]
        f = fitness(d, start, end)
        for (wd, atype, name, mins, inten) in week:
            if d.weekday() != wd:
                continue
            # life happens: skip ~12% of sessions
            if rng.random() < 0.12:
                continue
            dur = mins * rng.uniform(0.85, 1.15) * 60
            hr_max = 188
            avg_hr = round(118 + inten * 48 + rng.uniform(-5, 5))
            max_hr = round(clamp(avg_hr + 18 + inten * 14 + rng.uniform(-4, 6), avg_hr + 8, hr_max))
            dist = 0.0
            elev = None
            if atype in ("running", "trail_running"):
                # pace improves 5:55 -> 5:05 /km; tempo/intervals faster
                pace = (355 - 50 * f) * (0.9 if inten > 0.7 else 1.0) * rng.uniform(0.97, 1.03)
                dist = dur / pace * 1000
                elev = round(dist / 1000 * rng.uniform(4, 14), 1)
            elif atype == "road_biking":
                speed = (25.5 + 4.5 * f) * rng.uniform(0.95, 1.05)  # km/h
                dist = speed * dur / 3600 * 1000
                elev = round(dist / 1000 * rng.uniform(5, 11), 1)
            elif atype == "indoor_cycling":
                dist = 0.0  # trainer: time only, no distance (the dashboard handles this)
            elif atype in ("lap_swimming", "open_water_swimming"):
                per100 = (138 - 22 * f) * rng.uniform(0.96, 1.04)  # s per 100 m
                dist = dur / per100 * 100
                dist = round(dist / 50) * 50 if atype == "lap_swimming" else dist
            cal = round(dur / 60 * (7.5 + inten * 7) * rng.uniform(0.92, 1.08))
            aerobic = round(clamp(1.4 + inten * 2.6 + (dur / 3600) * 0.5 + rng.uniform(-0.3, 0.3), 0.5, 5.0), 1)
            anaer = round(clamp((inten - 0.6) * 5 + rng.uniform(-0.2, 0.4), 0.0, 3.5), 1) if inten > 0.6 else 0.0
            load = round(dur / 60 * (0.55 + inten * 1.9) * rng.uniform(0.9, 1.1), 2)
            mod = round(dur / 60 * (0.75 if inten < 0.6 else 0.35))
            vig = round(dur / 60 * (0.1 if inten < 0.6 else 0.55))
            hh = 6 if wd < 5 else 7
            if name in ("Strength", "Tempo Run", "Easy Run") and rng.random() < 0.4:
                hh = 17
            rows.append({
                "activity_id": aid,
                "activity_date": d.isoformat(),
                # stored in UTC; a 6am local (UTC+8) start is 22:00 the previous day
                "started_at": iso(d - timedelta(days=1), hh + 16, rng.randrange(0, 59)) if hh < 8 else iso(d, hh - 8, rng.randrange(0, 59)),
                "activity_type": atype,
                "name": name,
                "duration_s": int(dur),
                "distance_m": round(dist, 2),
                "avg_hr": float(avg_hr),
                "max_hr": float(max_hr),
                "calories": cal,
                "elevation_gain_m": elev,
                "aerobic_te": aerobic,
                "anaerobic_te": anaer,
                "training_load": load,
                "moderate_min": mod,
                "vigorous_min": vig,
                "created_at": created(d),
            })
            aid += 1
        d += timedelta(days=1)
    return rows


# ---------------------------------------------------------------- daily + sleep
def gen_daily_and_sleep(rng, start, end, activities):
    by_day = {}
    for a in activities:
        by_day.setdefault(a["activity_date"], []).append(a)

    daily, sleep = [], []
    d = start
    rhr_drift = 0.0
    while d <= end:
        f = fitness(d, start, end)
        acts = by_day.get(d.isoformat(), [])
        load_today = sum(a["training_load"] for a in acts)
        hard = load_today > 90

        # ---- sleep for the night ending this morning
        base_h = 7.3 + rng.gauss(0, 0.55) - (0.35 if d.weekday() in (3, 4) else 0) + (0.4 if d.weekday() in (5, 6) else 0)
        total_h = clamp(base_h, 4.9, 9.1)
        total = int(total_h * 3600)
        deep = int(total * clamp(rng.gauss(0.19, 0.03), 0.10, 0.27))
        rem = int(total * clamp(rng.gauss(0.22, 0.035), 0.12, 0.30))
        light = total - deep - rem
        awake = int(clamp(rng.gauss(14, 7), 2, 45) * 60)
        resp = round(clamp(rng.gauss(14.2, 0.5), 12.5, 16.5), 1)
        stress = int(clamp(rng.gauss(22 - 6 * f, 6) + (6 if hard else 0), 6, 48))
        # Garmin's own score exists for the last ~14 months; before that the
        # dashboard derives one from the stages (both paths get exercised).
        score = None
        if (end - d).days < 430:
            dur_pts = clamp((total_h - 4) / 4, 0, 1) * 55
            deep_pts = clamp(deep / total / 0.18, 0, 1) * 20
            rem_pts = clamp(rem / total / 0.22, 0, 1) * 20
            awake_pts = clamp(1 - awake / total / 0.15, 0, 1) * 5
            score = int(clamp(dur_pts + deep_pts + rem_pts + awake_pts + rng.gauss(0, 3), 35, 98))
        if rng.random() > 0.015:  # the odd night the watch was off charge
            sleep.append({
                "sleep_date": d.isoformat(),
                "started_at": iso(d - timedelta(days=1), 14, rng.randrange(10, 59)),
                "ended_at": iso(d - timedelta(days=1), 22, rng.randrange(0, 59)),
                "total_sleep_s": total,
                "deep_s": deep, "light_s": light, "rem_s": rem, "awake_s": awake,
                "sleep_score": score,
                "avg_respiration": resp,
                "avg_stress": stress,
                "created_at": created(d),
            })

        # ---- daily summary
        rhr_drift = clamp(rhr_drift * 0.7 + rng.gauss(0, 0.9), -4, 4)
        rhr = int(round(55 - 7 * f + rhr_drift + (2.5 if hard else 0) + (1.5 if total_h < 6.3 else 0)))
        weekend = d.weekday() >= 5
        steps_mu = 9200 if not weekend else 8200
        steps = int(clamp(rng.lognormvariate(math.log(steps_mu), 0.32), 1800, 24000))
        if any(a["activity_type"].startswith("running") for a in acts):
            steps += int(sum(a["distance_m"] for a in acts if a["activity_type"] == "running") / 0.95)
        goal = 8000 if (end - d).days > 400 else 10000
        max_hr_day = max([a["max_hr"] for a in acts], default=rng.uniform(96, 122))
        total_cal = int(2250 + sum(a["calories"] for a in acts) * 0.9 + rng.gauss(0, 90))
        active_cal = int(sum(a["calories"] for a in acts) * 0.9 + steps * 0.03)
        daily.append({
            "summary_date": d.isoformat(),
            "total_steps": steps,
            "step_goal": goal,
            "distance_m": round(steps * 0.78, 2),
            "total_calories": total_cal,
            "active_calories": active_cal,
            "resting_hr": rhr,
            "min_hr": rhr - rng.randrange(4, 9),
            "max_hr": int(max_hr_day),
            "moderate_min": sum(a["moderate_min"] for a in acts) + rng.randrange(0, 12),
            "vigorous_min": sum(a["vigorous_min"] for a in acts),
            "floors_ascended": round(clamp(rng.gauss(11, 6), 0, 40), 1),
            "created_at": created(d),
        })
        d += timedelta(days=1)
    return daily, sleep


# ---------------------------------------------------------------- weigh-ins (Index S2)
def gen_weigh_ins(rng, start, end):
    """Weighs in most mornings for the last 14 months, sporadically before that.
    Weight 78.4 -> 74.3 kg, body fat 20.1 -> 15.6 %, muscle 34.3 -> 35.1 kg."""
    rows = []
    d = start
    while d <= end:
        f = fitness(d, start, end)
        recent = (end - d).days < 430
        p = 0.72 if recent else 0.12
        if rng.random() < p:
            weight = 78.4 - 4.1 * f + rng.gauss(0, 0.45) + (0.6 if d.weekday() == 0 else 0)  # Monday after the weekend
            fat = 20.1 - 4.5 * f + rng.gauss(0, 0.5)
            muscle = 34.3 + 0.8 * f + rng.gauss(0, 0.25)
            water = 57.5 + 3.2 * f + rng.gauss(0, 0.6)
            bone = 3.42 + 0.03 * f + rng.gauss(0, 0.04)
            rows.append({
                "measured_at": iso(d - timedelta(days=1), 22, rng.randrange(0, 59)),  # ~6am local, stored UTC
                "measured_date": d.isoformat(),
                "weight_kg": round(weight, 2),
                "bmi": round(weight / (HEIGHT_M ** 2), 1),
                "body_fat_pct": round(fat, 1),
                "body_water_pct": round(water, 1),
                "muscle_mass_kg": round(muscle, 2),
                "bone_mass_kg": round(bone, 2),
                "raw_impedance": int(clamp(rng.gauss(500 - 25 * f, 9), 430, 560)),
                "source": "INDEX_SCALE",
                "created_at": created(d),
            })
        d += timedelta(days=1)
    return rows


# ---------------------------------------------------------------- DEXA (reference scans)
def gen_dexa(end):
    s1 = end - timedelta(days=320)
    s2 = end - timedelta(days=135)
    def scan(d, fat_pct, weight, lean, asm_, z, vat):
        fat_mass = round(weight * fat_pct / 100, 2)
        bmc = 3.05
        return {
            "scan_date": d.isoformat(),
            "provider": "Sample DEXA clinic",
            "weight_kg": weight,
            "body_fat_pct": fat_pct,
            "fat_mass_kg": fat_mass,
            "lean_mass_kg": lean,
            "fat_free_mass_kg": round(lean + bmc, 2),
            "bone_mineral_content_kg": bmc,
            "bmi": round(weight / HEIGHT_M ** 2, 1),
            "asm_kg": asm_,
            "asm_height2": round(asm_ / HEIGHT_M ** 2, 2),
            "bmd_total": 1.192,
            "t_score": -0.3,
            "z_score": z,
            "vat_area_cm2": vat,
            "vat_mass_g": round(vat * 4.1),
            "sat_mass_g": round(vat * 11.5),
            "ag_ratio": 0.92,
            "regional": {
                "arms": {"lean_g": round(lean * 1000 * 0.115), "fat_g": round(fat_mass * 1000 * 0.10)},
                "legs": {"lean_g": round(lean * 1000 * 0.355), "fat_g": round(fat_mass * 1000 * 0.33)},
                "trunk": {"lean_g": round(lean * 1000 * 0.47), "fat_g": round(fat_mass * 1000 * 0.50)},
            },
            "notes": "Sample scan. Fictional values for the demo.",
        }
    return [
        scan(s1, 17.9, 76.9, 60.1, 26.4, -0.4, 52),
        scan(s2, 15.2, 75.1, 60.6, 26.9, -0.3, 44),
    ]


# ---------------------------------------------------------------- bloods (fictional)
def marker(key, group, name, value, unit, rng_, flag=None, op=None, note=None):
    m = {"key": key, "group": group, "name": name, "value": value, "unit": unit, "range": rng_, "flag": flag}
    if op:
        m["op"] = op
    if note:
        m["note"] = note
    return m


def between(lo, hi):
    return {"type": "between", "low": lo, "high": hi}


def below(hi):
    return {"type": "below", "high": hi}


def above(lo):
    return {"type": "above", "low": lo}


def gen_bloods(end):
    p1 = end - timedelta(days=325)
    p2 = end - timedelta(days=140)

    def panel(d, v, flags):
        """v = dict key -> value. flags = dict key -> 'H'/'L'."""
        G = {
            "iron": "Iron studies", "vit": "Vitamins", "inf": "Inflammation", "mus": "Muscle",
            "kid": "Kidneys & electrolytes", "bone": "Bone & minerals", "liv": "Liver",
            "thy": "Thyroid", "lip": "Lipids", "met": "Metabolic", "fbc": "Blood count",
        }
        fl = lambda k: flags.get(k)
        ms = [
            marker("iron", G["iron"], "Iron", v["iron"], "umol/L", between(10, 30), fl("iron")),
            marker("transferrin", G["iron"], "Transferrin", v["transferrin"], "g/L", between(2.0, 3.6), fl("transferrin")),
            marker("transferrin_sat", G["iron"], "Transferrin saturation", v["transferrin_sat"], "%", between(15, 45), fl("transferrin_sat")),
            marker("ferritin", G["iron"], "Ferritin", v["ferritin"], "ug/L", between(30, 300), fl("ferritin")),
            marker("folate", G["vit"], "Folate", v["folate"], "nmol/L", above(7), fl("folate")),
            marker("vitamin_d", G["vit"], "Vitamin D", v["vitamin_d"], "nmol/L", above(50), fl("vitamin_d")),
            marker("b12", G["vit"], "Vitamin B12", v["b12"], "pmol/L", between(150, 700), fl("b12")),
            marker("crp", G["inf"], "CRP", v["crp"], "mg/L", below(5), fl("crp"), op="<" if v["crp"] == 1 else None),
            marker("ck", G["mus"], "CK", v["ck"], "U/L", between(45, 250), fl("ck")),
            marker("urea", G["kid"], "Urea", v["urea"], "mmol/L", between(3.0, 8.0), fl("urea")),
            marker("creatinine", G["kid"], "Creatinine", v["creatinine"], "umol/L", between(60, 110), fl("creatinine")),
            marker("egfr", G["kid"], "eGFR", v["egfr"], "mL/min/1.73m2", above(90), fl("egfr"), op=">" if v["egfr"] == 90 else None),
            marker("sodium", G["kid"], "Sodium", v["sodium"], "mmol/L", between(135, 145), fl("sodium")),
            marker("potassium", G["kid"], "Potassium", v["potassium"], "mmol/L", between(3.5, 5.2), fl("potassium")),
            marker("chloride", G["kid"], "Chloride", v["chloride"], "mmol/L", between(95, 110), fl("chloride")),
            marker("bicarbonate", G["kid"], "Bicarbonate", v["bicarbonate"], "mmol/L", between(22, 32), fl("bicarbonate")),
            marker("magnesium", G["bone"], "Magnesium", v["magnesium"], "mmol/L", between(0.70, 1.10), fl("magnesium")),
            marker("corrected_calcium", G["bone"], "Corrected calcium", v["corrected_calcium"], "mmol/L", between(2.10, 2.60), fl("corrected_calcium")),
            marker("phosphate", G["bone"], "Phosphate", v["phosphate"], "mmol/L", between(0.75, 1.50), fl("phosphate")),
            marker("ast", G["liv"], "AST", v["ast"], "U/L", below(40), fl("ast")),
            marker("alt", G["liv"], "ALT", v["alt"], "U/L", below(40), fl("alt")),
            marker("alp", G["liv"], "ALP", v["alp"], "U/L", between(30, 110), fl("alp")),
            marker("ggt", G["liv"], "GGT", v["ggt"], "U/L", below(60), fl("ggt")),
            marker("bilirubin", G["liv"], "Bilirubin", v["bilirubin"], "umol/L", below(20), fl("bilirubin")),
            marker("albumin", G["liv"], "Albumin", v["albumin"], "g/L", between(35, 50), fl("albumin")),
            marker("tsh", G["thy"], "TSH", v["tsh"], "mIU/L", between(0.4, 4.0), fl("tsh")),
            marker("cholesterol", G["lip"], "Total cholesterol", v["cholesterol"], "mmol/L", below(5.5), fl("cholesterol")),
            marker("triglycerides", G["lip"], "Triglycerides", v["triglycerides"], "mmol/L", below(2.0), fl("triglycerides")),
            marker("hdl", G["lip"], "HDL", v["hdl"], "mmol/L", above(1.0), fl("hdl")),
            marker("ldl", G["lip"], "LDL", v["ldl"], "mmol/L", below(3.5), fl("ldl")),
            marker("chol_hdl_ratio", G["lip"], "Chol / HDL ratio", v["chol_hdl_ratio"], "", below(4.5), fl("chol_hdl_ratio")),
            marker("glucose", G["met"], "Glucose (fasting)", v["glucose"], "mmol/L", between(3.6, 6.0), fl("glucose")),
            marker("hba1c_pct", G["met"], "HbA1c", v["hba1c_pct"], "%", below(6.0), fl("hba1c_pct")),
            marker("uric_acid", G["met"], "Uric acid", v["uric_acid"], "mmol/L", between(0.20, 0.45), fl("uric_acid")),
            marker("haemoglobin", G["fbc"], "Haemoglobin", v["haemoglobin"], "g/L", between(130, 180), fl("haemoglobin")),
            marker("haematocrit", G["fbc"], "Haematocrit", v["haematocrit"], "L/L", between(0.40, 0.54), fl("haematocrit")),
            marker("mcv", G["fbc"], "MCV", v["mcv"], "fL", between(80, 100), fl("mcv")),
            marker("rdw", G["fbc"], "RDW", v["rdw"], "%", between(11.5, 14.5), fl("rdw")),
            marker("wcc", G["fbc"], "White cell count", v["wcc"], "x10^9/L", between(4.0, 11.0), fl("wcc")),
            marker("neutrophils", G["fbc"], "Neutrophils", v["neutrophils"], "x10^9/L", between(2.0, 7.5), fl("neutrophils")),
            marker("lymphocytes", G["fbc"], "Lymphocytes", v["lymphocytes"], "x10^9/L", between(1.0, 4.0), fl("lymphocytes")),
            marker("platelets", G["fbc"], "Platelets", v["platelets"], "x10^9/L", between(150, 400), fl("platelets")),
        ]
        return {
            "panel_date": d.isoformat(),
            "lab": "Sample Pathology",
            "lab_id": None,
            "referrer": None,
            "clinical_notes": "Routine review. Endurance training.",
            "fasting": True,
            "markers": ms,
            "lab_comments": [
                "SAMPLE DATA. These results are fictional and exist only to demonstrate the dashboard.",
                "Reference intervals shown are illustrative and vary between laboratories.",
            ],
            "created_at": created(d),
        }

    v1 = dict(iron=14, transferrin=2.9, transferrin_sat=19, ferritin=26, folate=24, vitamin_d=61, b12=310,
              crp=1, ck=312, urea=6.1, creatinine=88, egfr=90, sodium=140, potassium=4.3, chloride=103,
              bicarbonate=26, magnesium=0.84, corrected_calcium=2.34, phosphate=1.12, ast=38, alt=27, alp=68,
              ggt=19, bilirubin=12, albumin=44, tsh=1.9, cholesterol=4.6, triglycerides=0.9, hdl=1.5, ldl=2.7,
              chol_hdl_ratio=3.1, glucose=5.0, hba1c_pct=5.2, uric_acid=0.33, haemoglobin=146, haematocrit=0.43,
              mcv=88, rdw=13.1, wcc=5.4, neutrophils=2.9, lymphocytes=1.8, platelets=228)
    v2 = dict(iron=19, transferrin=2.7, transferrin_sat=27, ferritin=58, folate=27, vitamin_d=84, b12=345,
              crp=1, ck=176, urea=5.6, creatinine=86, egfr=90, sodium=141, potassium=4.4, chloride=104,
              bicarbonate=27, magnesium=0.86, corrected_calcium=2.36, phosphate=1.08, ast=29, alt=24, alp=64,
              ggt=17, bilirubin=11, albumin=43, tsh=2.1, cholesterol=4.3, triglycerides=0.8, hdl=1.6, ldl=2.4,
              chol_hdl_ratio=2.7, glucose=4.9, hba1c_pct=5.1, uric_acid=0.31, haemoglobin=151, haematocrit=0.45,
              mcv=89, rdw=12.8, wcc=5.1, neutrophils=2.7, lymphocytes=1.9, platelets=236)
    return [panel(p1, v1, {"ferritin": "L", "ck": "H"}), panel(p2, v2, {})]


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--end", default="2026-10-02", help="last day of data (yyyy-mm-dd)")
    ap.add_argument("--days", type=int, default=730, help="how many days back")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    end = date.fromisoformat(args.end)
    start = end - timedelta(days=args.days - 1)

    activities = gen_activities(rng, start, end)
    daily, sleep = gen_daily_and_sleep(rng, start, end, activities)
    weigh_ins = gen_weigh_ins(rng, start, end)
    dexa = gen_dexa(end)
    bloods = gen_bloods(end)

    os.makedirs(OUT, exist_ok=True)
    files = {
        "activities": activities, "daily_summary": daily, "sleep": sleep,
        "weigh_ins": weigh_ins, "dexa_scans": dexa, "blood_panels": bloods,
    }
    for name, rows in files.items():
        path = os.path.join(OUT, f"{name}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=1)
        print(f"  {name:14s} {len(rows):5d} rows -> data/sample/{name}.json")
    w0, w1 = weigh_ins[0], weigh_ins[-1]
    print(f"\n  Sample athlete {start} -> {end}")
    print(f"    weight    {w0['weight_kg']} -> {w1['weight_kg']} kg")
    print(f"    body fat  {w0['body_fat_pct']} -> {w1['body_fat_pct']} %")
    print(f"    muscle    {w0['muscle_mass_kg']} -> {w1['muscle_mass_kg']} kg")


if __name__ == "__main__":
    main()
