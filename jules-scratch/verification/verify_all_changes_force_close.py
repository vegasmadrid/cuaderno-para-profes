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

    # Wait for modals to appear
    page.wait_for_timeout(10000) # wait for 10 seconds

    # Forcefully remove all modals from the DOM using JavaScript
    page.evaluate("() => { document.querySelectorAll('.cpp-modal').forEach(el => el.remove()); }")
    page.evaluate("() => { document.querySelectorAll('.cpp-sidebar-overlay').forEach(el => el.remove()); }")


    # Read the local CSS file
    with open("assets/css/frontend.css", "r") as f:
        css_to_inject = f.read()

    # Inject the CSS into the page
    page.add_style_tag(content=css_to_inject)

    # Wait for a moment to ensure styles are applied
    page.wait_for_timeout(1000)

    # Take a screenshot of the main view
    page.screenshot(path="jules-scratch/verification/main_view.png")

    # Navigate to the "Semana" view
    semana_tab = page.get_by_role("button", name="Semana")
    semana_tab.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000) # wait for content to load

    # Take a screenshot of the week view
    page.screenshot(path="jules-scratch/verification/semana_view.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
