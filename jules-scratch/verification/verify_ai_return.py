import time
from playwright.sync_api import sync_playwright, Page, expect

def run_verification(page: Page):
    """
    This script verifies the AI player's ability to return a serve.
    It also captures console logs for debugging.
    """
    # Define a handler for console messages
    def log_console_message(msg):
        print(f"Browser console: {msg.type} '{msg.text}'")

    # Listen for all console events
    page.on("console", log_console_message)

    # 1. Navigate to the game.
    print("Navigating to http://localhost:5173/...")
    page.goto("http://localhost:5173/")

    # 2. Wait for the assets to load and the game to stabilize.
    print("Waiting for game to load...")
    time.sleep(3)

    # 3. Find the canvas to interact with the game.
    print("Looking for canvas...")
    canvas = page.locator('canvas')
    expect(canvas).to_be_visible()
    print("Canvas found.")

    # 4. Click the canvas to initiate a serve from the human player.
    print("Clicking canvas to serve...")
    canvas.click(button='middle', position={'x': 400, 'y': 300})

    # 5. Wait just a moment for the action to register.
    print("Waiting for serve to start...")
    time.sleep(2)

    # 6. Take a screenshot for visual verification.
    print("Taking screenshot...")
    page.screenshot(path="jules-scratch/verification/ai_rally_attempt.png")
    print("Screenshot saved to jules-scratch/verification/ai_rally_attempt.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        run_verification(page)
        browser.close()

if __name__ == "__main__":
    main()
