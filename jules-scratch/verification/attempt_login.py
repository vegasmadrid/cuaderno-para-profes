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
    page.get_by_label("Nombre de usuario o Email").fill("admin")
    page.get_by_label("Contraseña").fill("password")

    # Click the login button
    page.get_by_role("button", name="Iniciar Sesión").click()
    page.wait_for_load_state("networkidle")

    # Take a screenshot of the page after login attempt
    page.screenshot(path="jules-scratch/verification/after_login_attempt.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
