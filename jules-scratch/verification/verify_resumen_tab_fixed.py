
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. Login
        page.goto("https://cuadernodeprofe.com/wp-admin/")
        page.fill('input[name="log"]', "jules")
        page.fill('input[name="pwd"]', "jules_password")
        page.click('input[name="wp-submit"]')
        page.wait_for_load_state("networkidle")

        # 2. Handle Popups
        try:
            cookie_button = page.locator('button:has-text("Aceptar todo")')
            cookie_button.click(timeout=10000)
        except Exception:
            pass

        try:
            welcome_close_button = page.locator('button[aria-label="Cerrar diálogo"]')
            welcome_close_button.click(timeout=10000)
        except Exception:
            pass

        try:
            php_dismiss_button = page.locator('button.notice-dismiss')
            php_dismiss_button.click(timeout=10000)
        except Exception:
            pass

        # 3. Navigate to the "Cuaderno" page
        page.goto("https://cuadernodeprofe.com/cuaderno/")
        page.wait_for_selector('#cpp-cuaderno-app-container', state='visible')

        # 4. Click the "Resumen" tab
        resumen_tab = page.locator('a.cpp-main-tab-link[data-tab="resumen"]')
        resumen_tab.click()

        page.wait_for_selector('.cpp-resumen-container', state='visible')

        # 5. Take a screenshot
        page.screenshot(path="jules-scratch/verification/resumen_tab_fixed.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
