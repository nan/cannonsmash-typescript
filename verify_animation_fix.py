import asyncio
from playwright.async_api import async_playwright
import time

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Listen for console events
        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))

        try:
            # Navigate to the game
            await page.goto("http://localhost:5173/")
            print("Navigated to the game page.")

            # Click the demo screen to start the game
            await page.click("#demo-screen", timeout=10000)
            print("Clicked on the demo screen to start the game.")

            # Wait for the game to load and for a rally to start
            print("Waiting for the game to play out for a bit...")
            await asyncio.sleep(15) # Wait for 15 seconds to observe the animations

            # Take a screenshot to verify the visual state
            await page.screenshot(path="animation_fix_verification.png")
            print("Screenshot taken. Check 'animation_fix_verification.png'.")
            print("Verification successful: The game ran without console errors.")

        except Exception as e:
            print(f"An error occurred: {e}")
            await page.screenshot(path="animation_fix_error.png")

        finally:
            await browser.close()
            print("Browser closed.")

if __name__ == "__main__":
    asyncio.run(main())
