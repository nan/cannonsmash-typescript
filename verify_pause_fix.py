import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    try:
        page.goto("http://localhost:5173/")
        time.sleep(5)  # Wait for the demo to load

        # 1. Click to start the game
        page.locator("#demo-screen").click()
        time.sleep(1)

        # 2. Press ESC to pause
        page.keyboard.press("Escape")
        time.sleep(1)

        # 3. Press ESC again to return to demo
        page.keyboard.press("Escape")
        time.sleep(1)

        # 4. Take a screenshot to verify the fix
        page.screenshot(path="verify_pause_fix.png")
        print("Screenshot taken.")

        # Check if pause screen is hidden
        pause_screen_is_hidden = page.locator("#pause-screen").is_hidden()
        if pause_screen_is_hidden:
            print("SUCCESS: Pause screen is hidden.")
        else:
            print("FAILURE: Pause screen is still visible.")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
