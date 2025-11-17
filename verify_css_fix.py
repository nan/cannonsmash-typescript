import asyncio
from playwright.async_api import async_playwright
import time

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Add a delay to ensure the server is ready
        time.sleep(15)

        await page.goto("http://localhost:5173/")

        # Wait for the demo screen to be visible
        await page.wait_for_selector('#demo-screen', state='visible')

        await page.screenshot(path="demo_screen_no_overlay.png")
        await browser.close()

asyncio.run(main())
