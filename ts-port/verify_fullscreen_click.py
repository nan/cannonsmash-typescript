from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # We need to capture the console logs to check for the toss message
        console_logs = []
        page.on("console", lambda msg: console_logs.append(msg.text))

        page.goto("http://localhost:5173/")

        canvas = page.locator("#c")
        canvas.wait_for(state="visible")
        page.wait_for_timeout(3000)

        # Enter fullscreen
        page.evaluate("() => document.body.requestFullscreen()")
        page.wait_for_timeout(1000)

        # Click at the very top of the screen
        print("Clicking at the top of the screen (y=1)...")
        page.mouse.click(x=page.viewport_size['width'] / 2, y=1)
        page.wait_for_timeout(2000)

        # Check if the serve was initiated
        toss_log_found = any("Tossing ball" in log for log in console_logs)

        if toss_log_found:
            print("SUCCESS: Click at the top of the screen was registered and serve was initiated.")
        else:
            print("FAILURE: Click at the top of the screen did not initiate a serve.")
            print("\n--- All Browser Console Logs ---")
            for log in console_logs:
                print(log)
            print("---------------------------------")
            raise AssertionError("Fullscreen click verification failed.")

        page.screenshot(path="final_fullscreen_click_verification.png")
        print("Screenshot taken.")

        browser.close()

if __name__ == "__main__":
    run_verification()
