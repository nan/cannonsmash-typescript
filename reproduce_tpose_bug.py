import asyncio
import time
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True) # Run in headless mode
        context = await browser.new_context()
        page = await context.new_page()

        # Capture all console messages
        console_messages = []
        page.on("console", lambda msg: console_messages.append(msg.text))

        try:
            # Go to the game page
            await page.goto("http://localhost:5173/", timeout=60000)
            print("Successfully navigated to the page.")

            # Click the demo screen to start the game
            await page.locator("#demo-screen").click()
            print("Clicked demo screen to start the game.")

            # Wait for the game to load and the AI to serve
            await asyncio.sleep(5)
            print("Waited for AI to serve.")

            # Click repeatedly to try and trigger the bug during a rally
            print("Starting rapid clicking to trigger the forward swing from a backswing...")
            for i in range(20):
                await page.mouse.click(page.viewport_size['width'] / 2, page.viewport_size['height'] / 2)
                await asyncio.sleep(0.2) # Click 5 times per second

            print("Finished clicking.")

            # Wait a moment for the pose to freeze
            await asyncio.sleep(2)

            # Take a screenshot to verify the T-pose
            screenshot_path = "tpose_bug_reproduction.png"
            await page.screenshot(path=screenshot_path)
            print(f"Screenshot taken: {screenshot_path}")

        except Exception as e:
            print(f"An error occurred: {e}")
            # Take a screenshot even if an error occurs
            await page.screenshot(path="tpose_error_screenshot.png")

        finally:
            # Print captured console messages
            print("\n--- Console Messages ---")
            has_errors = False
            if console_messages:
                for msg in console_messages:
                    print(msg)
                    if "error" in msg.lower():
                        has_errors = True
            else:
                print("No console messages captured.")
            print("------------------------\n")

            if has_errors:
                print("Potential errors found in console log.")
            else:
                print("No obvious errors found in console log.")

            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
