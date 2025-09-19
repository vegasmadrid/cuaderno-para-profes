from playwright.sync_api import sync_playwright

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
    page.wait_for_timeout(3000)

    # Print the page source
    print(page.content())

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
