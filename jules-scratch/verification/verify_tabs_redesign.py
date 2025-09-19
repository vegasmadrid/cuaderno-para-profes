from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # I will replace this with the correct URL once I have it.
    # I'm using a placeholder for now.
    # Since this is a WordPress plugin, I'll need the user to provide the URL
    # of a page where the plugin is active.
    page.goto("https://cuadernodeprofe.com/cuaderno/", wait_until="networkidle")

    # Wait for the top bar to be visible to ensure the page has loaded
    top_bar = page.locator(".cpp-fixed-top-bar")
    expect(top_bar).to_be_visible()

    # Take a screenshot of the top bar
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
