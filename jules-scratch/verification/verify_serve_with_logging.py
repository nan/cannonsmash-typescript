from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Listen for all console events and print them
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))

        page.goto("http://localhost:5173/")

        canvas = page.locator("canvas")
        expect(canvas).to_be_visible()
        page.wait_for_timeout(2000) # Give assets time to load

        # Use mouse.down() to ensure the press is registered by the game loop
        page.mouse.down(button='left')

        # Wait for the game to process the hit
        page.wait_for_timeout(2000)

        browser.close()

if __name__ == "__main__":
    run_verification()
