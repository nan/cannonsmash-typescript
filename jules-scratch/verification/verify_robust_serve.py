import time
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))

    page.goto("http://localhost:5173/")

    canvas = page.locator("#c")
    expect(canvas).to_be_visible()

    time.sleep(3) # Wait longer for game to initialize

    # Check if game object is on window
    game_exists = page.evaluate("typeof window.game !== 'undefined'")
    print(f"--- Is window.game available? {game_exists} ---")
    if not game_exists:
        browser.close()
        return

    positions_to_test = {
        "standard": 1.57,
        "close": 1.4,
        "far": 2.0
    }

    for name, z_pos in positions_to_test.items():
        print(f"--- Testing serve from position: {name} (z={z_pos}) ---")

        try:
            page.evaluate(f"window.game.player1.debug_setPosition(0, 0.77, {z_pos})")
        except Exception as e:
            print(f"Error setting position: {e}")
            continue

        time.sleep(0.5)

        canvas.dispatch_event('mousedown', { 'button': 0 })
        time.sleep(0.1)
        canvas.dispatch_event('mouseup', { 'button': 0 })

        time.sleep(3)
        print(f"--- Finished test for position: {name} ---\n")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
