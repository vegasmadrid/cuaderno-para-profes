import os
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    page.goto("https://cuadernodeprofe.com/cuaderno/", wait_until="networkidle")

    # Click the "Acceso" link
    acceso_link = page.get_by_role("link", name="Acceso")
    acceso_link.click()
    page.wait_for_load_state("networkidle")

    # Fill in the credentials
    page.locator("#iump_login_username").fill("vegasmadrid")
    page.locator("#iump_login_password").fill("dkxve7cs88")

    # Click the login button
    page.get_by_role("button", name="Iniciar Sesión").click()
    page.wait_for_load_state("networkidle")

    # Wait for modals to appear and try to close them
    page.wait_for_timeout(3000) # wait for 3 seconds

    # A more robust way would be to wait for the modal selectors, but since I don't know them, I'll try a more generic approach.
    # I'll look for any button that has an 'x' or 'close' in its name or text.
    close_buttons = page.locator('button:has-text("x"), button:has-text("Close"), [aria-label*="lose"], [aria-label*="lose"] > *')

    count = close_buttons.count()
    if count > 0:
        for i in range(count):
            try:
                button = close_buttons.nth(i)
                if button.is_visible():
                    button.click()
                    page.wait_for_timeout(500) # wait for animation
            except Exception as e:
                print(f"Could not close button {i}: {e}")

    # Read the local CSS file
    with open("assets/css/frontend.css", "r") as f:
        css_to_inject = f.read()

    # Inject the CSS into the page
    page.add_style_tag(content=css_to_inject)

    # Wait for a moment to ensure styles are applied
    page.wait_for_timeout(1000)

    # Take a screenshot of the page with the injected CSS
    page.screenshot(path="jules-scratch/verification/final_verification_no_modals.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
