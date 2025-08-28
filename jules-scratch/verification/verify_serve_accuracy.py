import time
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    console_messages = []
    page.on("console", lambda msg: console_messages.append(msg.text))

    page.goto("http://localhost:5173/")

    canvas = page.locator("#c")
    expect(canvas).to_be_visible()

    time.sleep(2)

    print("--- Setting target to center by pressing '5' ---")
    page.press('body', '5')
    time.sleep(0.5) # Give time for target to update

    print("--- Dispatching mousedown event to serve ---")
    canvas.dispatch_event('mousedown', { 'button': 0 })

    time.sleep(4) # Wait for serve to complete

    canvas.dispatch_event('mouseup', { 'button': 0 })

    page.screenshot(path="jules-scratch/verification/serve_accuracy.png")

    browser.close()

    print("--- Captured Console Logs ---")
    for msg in console_messages:
        print(msg)
    print("-----------------------------")

with sync_playwright() as playwright:
    run(playwright)
