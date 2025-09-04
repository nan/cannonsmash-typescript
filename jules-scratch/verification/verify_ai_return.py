import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # 1. Navigate to the game
        await page.goto("http://localhost:5173/")

        # Give the game a moment to load assets
        await page.wait_for_timeout(2000)

        # 2. Find the canvas
        canvas = page.locator('canvas')
        await expect(canvas).to_be_visible()

        # 3. Serve the ball to the AI
        # We click near the bottom-center of the canvas to serve
        # Using the middle button for a high toss to make it easier for the AI
        bounding_box = await canvas.bounding_box()
        if bounding_box:
            await page.mouse.click(
                bounding_box['x'] + bounding_box['width'] / 2,
                bounding_box['y'] + bounding_box['height'] * 0.8,
                button='middle'
            )

        # 4. Wait for the AI to return the ball
        # This gives the AI time to run its prediction and for the ball to travel
        await page.wait_for_timeout(3000)

        # 5. Take a screenshot
        screenshot_path = 'jules-scratch/verification/ai_return_verification.png'
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
