from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # The base URL needs to be provided
    base_url = "http://localhost:8000"

    # Log in
    page.goto(f"{base_url}/wp-login.php")
    page.fill('input[name="log"]', "admin")
    page.fill('input[name="pwd"]', "admin")
    page.click('input[name="wp-submit"]')
    page.wait_for_load_state("networkidle")

    # Go to the plugin page
    page.goto(f"{base_url}/wp-admin/admin.php?page=cuaderno-para-profes")
    page.wait_for_load_state("networkidle")

    # Click on the first class to open the settings
    page.click('.cpp-sidebar-clase-item')
    page.wait_for_load_state("networkidle")

    # Click on the settings button for the first class
    page.click('.cpp-sidebar-clase-settings-btn')
    page.wait_for_load_state("networkidle")

    # Click on the "Evaluaciones" tab
    page.click('a[data-config-tab="evaluaciones"]')
    page.wait_for_load_state("networkidle")

    # Take a screenshot
    screenshot_path = "jules-scratch/verification/verification.png"
    page.screenshot(path=screenshot_path)

    print(f"Screenshot saved to {screenshot_path}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
