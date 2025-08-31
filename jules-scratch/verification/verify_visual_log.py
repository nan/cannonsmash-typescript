import time
from playwright.sync_api import sync_playwright, Page, expect

def run_test(page: Page):
    """
    This script performs a serve and takes a screenshot to capture
    the visual DOM logger's output.
    """
    page.goto("http://localhost:5173/")

    canvas = page.locator("canvas")
    expect(canvas).to_be_visible(timeout=10000)
    time.sleep(2)

    # Click to initiate the serve.
    # The debug text will update rapidly during the calculation.
    # We just need to capture it at some point.
    canvas.click(button='left', position={'x': 400, 'y': 300})

    # Wait for the calculation to run.
    time.sleep(1)

    screenshot_path = "jules-scratch/verification/visual_log_test.png"
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
