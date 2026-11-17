"""Interactive play-test: load the game, start it with Enter, steal the car with E,
drive with W, and confirm the player is actually driving with no page errors."""
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = 8903

def main():
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
            page.goto(f"http://127.0.0.1:{PORT}/index.html")
            page.wait_for_timeout(1200)
            state0 = page.evaluate("window.__gameState ? window.__gameState() : null")
            print("before Enter:", state0)
            page.keyboard.press("Enter")
            page.wait_for_timeout(600)
            state1 = page.evaluate("window.__gameState ? window.__gameState() : null")
            print("after Enter:", state1)
            # E to steal the parked sport car by the spawn.
            page.keyboard.press("KeyE")
            page.wait_for_timeout(300)
            state2 = page.evaluate("window.__gameState ? window.__gameState() : null")
            print("after E:", state2)
            # Drive forward for 3 seconds.
            page.keyboard.down("KeyW")
            page.wait_for_timeout(3000)
            page.keyboard.up("KeyW")
            state3 = page.evaluate("window.__gameState ? window.__gameState() : null")
            print("after driving 3s:", state3)
            # Pause and resume.
            page.keyboard.press("KeyP")
            page.wait_for_timeout(300)
            state4 = page.evaluate("window.__gameState ? window.__gameState() : null")
            print("after P (paused):", state4)
            page.keyboard.press("KeyP")
            page.wait_for_timeout(300)
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
