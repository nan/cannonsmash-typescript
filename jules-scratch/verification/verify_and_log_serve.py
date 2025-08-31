import time
from playwright.sync_api import sync_playwright, Page, expect

def run_test(page: Page):
    """
    This script verifies the serve targeting logic and logs the ball's trajectory.
    It performs one serve and captures all console output.
    """
    # Attach a listener to the console event
    page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))

    page.goto("http://localhost:5173/")

    # The canvas is where all the game action happens.
    canvas = page.locator("canvas")

    # Wait for the game to load by expecting the canvas to be visible.
    expect(canvas).to_be_visible(timeout=10000)

    # Give the game a moment to initialize everything after load.
    time.sleep(2)

    # --- Test Serve (target doesn't matter as much as logging) ---
    print("Testing serve and logging trajectory...")
    # Press 'a' to set the target to the far left of the opponent's side.
    page.keyboard.press('a')
    time.sleep(0.5) # Wait for target indicator to move

    # Left-click on the canvas to initiate the serve.
    canvas.click(button='left', position={'x': 400, 'y': 300})

    # Wait long enough for the entire serve and bounce sequence to complete.
    print("Waiting for serve to complete...")
    time.sleep(8)

    print("Test complete. Check logs for trajectory data.")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        run_test(page)
        browser.close()

if __name__ == "__main__":
    main()
