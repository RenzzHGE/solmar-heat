"""Take the game's screenshots: serve game/ and capture each scene in shots.json."""
import json
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
GAME = HERE / "game"
SHOTS = HERE / "screenshots"
PORT = 8902

def main():
    with open(HERE / "shots.json") as f:
        shots = json.load(f)
    server = subprocess.Popen(
        ["node", "serve.ts", "--port", str(PORT)],
        cwd=str(HERE), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(2.0)
    try:
        from playwright.sync_api import sync_playwright
        errors = []
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            for shot in shots:
                url = f"http://127.0.0.1:{PORT}/index.html{shot['query']}"
                page.goto(url)
                try:
                    page.wait_for_function("window.__shotReady === true", timeout=20000)
                except Exception as e:
                    print(f"TIMEOUT {shot['name']}: {e}")
                    continue
                time.sleep(0.3)
                out = SHOTS / shot["name"]
                page.screenshot(path=str(out))
                print(f"shot {shot['name']}: {out.stat().st_size} bytes")
            browser.close()
        if errors:
            print("PAGE ERRORS:")
            for e in errors[:10]:
                print("  ", e)
        else:
            print("no page errors")
    finally:
        server.terminate()

if __name__ == "__main__":
    main()
