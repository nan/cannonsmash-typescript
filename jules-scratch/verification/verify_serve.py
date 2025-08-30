from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto("http://localhost:5173/")

        # The game canvas is the main element
        canvas = page.locator("canvas")

        # Wait for the game to load
        expect(canvas).to_be_visible()
        page.wait_for_timeout(2000)

        # Click to trigger a serve
        canvas.click(button='left', position={'x': 300, 'y': 300})

        # Let the serve animation play out
        page.wait_for_timeout(1500)

        # Take a screenshot
        # Note: The path needs to be relative to where the script is run from.
        # The bash session CWD is /app/ts-port/, so the script path is ../jules-scratch/verification/verify_serve.py
        # The screenshot path should be relative to the CWD.
        page.screenshot(path="jules-scratch/verification/verification.png")

        browser.close()

if __name__ == "__main__":
    run_verification()
