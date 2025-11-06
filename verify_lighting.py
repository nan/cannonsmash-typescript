
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:5173/")
        await page.wait_for_selector("#demo-screen", state="visible")
        # Wait for the animations and lighting to be fully loaded and rendered
        await asyncio.sleep(5)
        await page.screenshot(path="demo_screen_lighting.png")
        await browser.close()

asyncio.run(main())
