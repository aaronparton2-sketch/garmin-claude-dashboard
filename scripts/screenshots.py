#!/usr/bin/env python3
"""
Screenshot every page of the dashboard at desktop (1440) and phone (390) width.

    python scripts/screenshots.py                       # live demo -> docs/screenshots/
    python scripts/screenshots.py --base http://localhost:5173 --out /tmp/shots

Needs: pip install playwright && python -m playwright install chromium
Also fails loudly on any browser console error, so it doubles as a smoke test.
"""
import argparse, os, sys
from playwright.sync_api import sync_playwright

ROUTES = [
    ("overview", "/"),
    ("health", "/#/health"),
    ("body", "/#/body"),
    ("bloods", "/#/bloods"),
    ("cycling", "/#/activity/cycling"),
    ("running", "/#/activity/running"),
    ("swimming", "/#/activity/swimming"),
    ("steps", "/#/activity/walking"),
    ("weights", "/#/activity/weights"),
    ("sleep", "/#/sleep"),
    ("recovery", "/#/recovery"),
    ("race", "/#/race"),
    ("plan", "/#/plan"),
]
SIZES = {"desktop": (1440, 900), "mobile": (390, 844)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://garmin-claude-dashboard.vercel.app")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "screenshots"))
    ap.add_argument("--full", action="store_true", help="full-page captures (default: viewport only)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            for size, (w, h) in SIZES.items():
                ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
                page = ctx.new_page()
                page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
                for name, route in ROUTES:
                    page.goto(a.base + route, wait_until="networkidle")
                    page.wait_for_timeout(700)  # charts settle
                    path = os.path.join(a.out, f"{name}-{size}.png")
                    page.screenshot(path=path, full_page=a.full)
                    print(f"  {path}")
                ctx.close()
        finally:
            browser.close()

    if errors:
        print("\nConsole errors:", file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
        sys.exit(1)
    print("\nNo console errors.")


if __name__ == "__main__":
    main()
