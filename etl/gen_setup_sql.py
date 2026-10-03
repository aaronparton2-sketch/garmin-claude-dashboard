#!/usr/bin/env python3
"""
Generate a single self-contained SQL file: schema (garmin_ tables + RLS + views)
followed by INSERT ... ON CONFLICT DO NOTHING for every parsed row.

Paste the output (sql/garmin_setup.sql) into the Supabase SQL editor once: it
creates the tables and seeds all historical data from data/*.json (the files
load_export.py writes from YOUR export). Re-runnable (idempotent). The output
file is gitignored because it contains your data.

    python etl/gen_setup_sql.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SCHEMA = os.path.join(ROOT, "sql", "schema.sql")
OUT = os.path.join(ROOT, "sql", "garmin_setup.sql")

# column order per table (matches schema.sql; created_at defaults)
COLS = {
    "garmin_weigh_ins": ["measured_at", "measured_date", "weight_kg", "bmi", "body_fat_pct",
                         "body_water_pct", "muscle_mass_kg", "bone_mass_kg", "raw_impedance", "source"],
    "garmin_activities": ["activity_id", "activity_date", "started_at", "activity_type", "name",
                          "duration_s", "distance_m", "avg_hr", "max_hr", "calories", "elevation_gain_m",
                          "aerobic_te", "anaerobic_te", "training_load", "moderate_min", "vigorous_min"],
    "garmin_sleep": ["sleep_date", "started_at", "ended_at", "total_sleep_s", "deep_s", "light_s",
                     "rem_s", "awake_s", "sleep_score", "avg_respiration", "avg_stress"],
    "garmin_daily_summary": ["summary_date", "total_steps", "step_goal", "distance_m", "total_calories",
                             "active_calories", "resting_hr", "min_hr", "max_hr", "moderate_min",
                             "vigorous_min", "floors_ascended"],
}
# data file (without garmin_ prefix) -> table
SRC = {
    "garmin_weigh_ins": "weigh_ins",
    "garmin_activities": "activities",
    "garmin_sleep": "sleep",
    "garmin_daily_summary": "daily_summary",
}
PK = {
    "garmin_weigh_ins": "measured_at", "garmin_activities": "activity_id",
    "garmin_sleep": "sleep_date", "garmin_daily_summary": "summary_date",
}

def sqlval(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"

def main():
    parts = [open(SCHEMA, encoding="utf-8").read(),
             "\n\n-- ============================ SEED DATA ============================\n"]
    for table, cols in COLS.items():
        rows = json.load(open(os.path.join(DATA, f"{SRC[table]}.json"), encoding="utf-8"))
        parts.append(f"\n-- {table}: {len(rows)} rows\n")
        collist = ", ".join(cols)
        # batch into multi-row inserts of 200
        for i in range(0, len(rows), 200):
            chunk = rows[i:i + 200]
            values = ",\n  ".join("(" + ", ".join(sqlval(r.get(c)) for c in cols) + ")" for r in chunk)
            parts.append(
                f"insert into {table} ({collist}) values\n  {values}\n"
                f"on conflict ({PK[table]}) do nothing;\n"
            )
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("".join(parts))
    size = os.path.getsize(OUT)
    print(f"Wrote {OUT}  ({size/1024:.0f} KB)")

if __name__ == "__main__":
    main()
