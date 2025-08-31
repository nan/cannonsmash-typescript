import time
from playwright.sync_api import sync_playwright, Page, expect

def run_test(page: Page):
    """
    This script performs a serve and takes a screenshot mid-flight
    to see if the trajectory arc with the clamped velocity is reasonable.
    """
    page.goto("http://localhost:5173/")

    canvas = page.locator("canvas")
    expect(canvas).to_be_visible(timeout=10000)
    time.sleep(2)

    # Click to initiate the serve.
    canvas.click(button='left', position={'x': 400, 'y': 300})

    # Wait for a short period to capture the ball in the air after being struck.
    # A wait of 0.8 seconds should show the peak of the arc.
    time.sleep(0.8)

    screenshot_path = "jules-scratch/verification/clamped_serve_test.png"
    page.screenshot(path=screenshot_path)
    print(f"Screenshot saved to {screenshot_path}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        run_test(page)
        browser.close()

if __name__ == "__main__":
    main()
