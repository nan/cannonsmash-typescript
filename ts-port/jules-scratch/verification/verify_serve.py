import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Capture console messages
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))

        try:
            await page.goto("http://localhost:5173/")
            canvas = page.locator("canvas")
            await expect(canvas).to_be_visible(timeout=10000)

            await page.wait_for_timeout(1000)

            await canvas.click(position={'x': 400, 'y': 300})
            await page.wait_for_timeout(500) # Give time for the serve logic to run

            await page.screenshot(path="ts-port/jules-scratch/verification/verification.png")
            print("Screenshot taken successfully.")

            # Keep the script alive for a bit to see if more logs come in
            await page.wait_for_timeout(2000)

        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
