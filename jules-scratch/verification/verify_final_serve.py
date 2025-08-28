import time
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))

    page.goto("http://localhost:5173/")

    canvas = page.locator("#c")
    expect(canvas).to_be_visible()

    time.sleep(3) # Wait for game to initialize

    print("--- Serving from standard position ---")
    canvas.dispatch_event('mousedown', { 'button': 0 })
    time.sleep(0.1)
    canvas.dispatch_event('mouseup', { 'button': 0 })

    time.sleep(3) # Wait for serve to complete

    page.screenshot(path="jules-scratch/verification/final_serve.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
