from playwright.sync_api import sync_playwright, Page, expect

def run(page: Page):
    """
    This script verifies the final layout touches for the 'Horario' tab.
    """
    # Go to the page where the shortcode is active
    page.goto("http://localhost:8000/cuaderno-de-notas-2", wait_until="networkidle")

    # Wait for the app to load
    expect(page.locator("#cpp-cuaderno-nombre-clase-activa-a1")).not_to_be_empty()

    # Click on the 'Horario' tab
    horario_tab_button = page.locator('.cpp-main-tab-link[data-tab="horario"]')
    horario_tab_button.click()

    # Wait for the table to be rendered
    expect(page.locator("#cpp-horario-table")).to_be_visible()

    # Take a screenshot to verify the final layout
    screenshot_path = "jules-scratch/verification/horario_final_touches.png"
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"Screenshot saved to {screenshot_path}")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        run(page)
        browser.close()

if __name__ == "__main__":
    main()
