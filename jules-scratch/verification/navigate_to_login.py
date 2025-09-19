from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    page.goto("https://cuadernodeprofe.com/cuaderno/", wait_until="networkidle")

    # Click the "Acceso" link
    acceso_link = page.get_by_role("link", name="Acceso")
    acceso_link.click()

    # Wait for navigation to complete
    page.wait_for_load_state("networkidle")

    # Take a screenshot of the login page
    page.screenshot(path="jules-scratch/verification/login_page.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
