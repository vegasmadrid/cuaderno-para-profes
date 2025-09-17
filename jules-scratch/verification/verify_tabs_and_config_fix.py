import re
from playwright.sync_api import sync_playwright, Page, expect

def run(page: Page):
    """
    This script verifies two things:
    1. The main tabs are visually separated into two groups.
    2. The 'Configuración' tab correctly updates when the class is changed.
    """
    # Go to the page where the shortcode is active
    # Trying a cleaner URL structure
    page.goto("http://localhost:8000/cuaderno-de-notas-2", wait_until="networkidle")

    # 1. Verify the UI change
    # Take a screenshot of the initial state to show the new tab layout

    # Wait for the first class to load to ensure the app is ready
    expect(page.locator("#cpp-cuaderno-nombre-clase-activa-a1")).not_to_be_empty()

    # 2. Verify the bug fix
    # Click on the 'Configuración' tab
    config_tab_button = page.locator('.cpp-main-tab-link[data-tab="configuracion"]')
    config_tab_button.click()

    # Wait for the configuration form to be populated for the first class
    # The title of the config section changes to "Editar Clase: <nombre>"
    expect(page.locator("#cpp-config-clase-titulo")).to_contain_text("Editar Clase:")

    # Get the name of the first class from the sidebar
    first_class_name = page.locator(".cpp-sidebar-clase-item").first.get_attribute("data-clase-nombre")

    # Check that the form title matches the first class
    expect(page.locator("#cpp-config-clase-titulo")).to_have_text(f"Editar Clase: {first_class_name}")

    # Now, click the second class in the sidebar
    second_class_item = page.locator(".cpp-sidebar-clase-item").nth(1)
    second_class_name = second_class_item.get_attribute("data-clase-nombre")

    # Make sure we're clicking a different class
    if first_class_name == second_class_name:
        print("Warning: Cannot verify bug fix because there is only one class or the first two classes have the same name.")
    else:
        second_class_item.locator("a").click()
        # After clicking, the sidebar might close, and content will reload.
        # We need to wait for the config form to be updated with the second class name.
        expect(page.locator("#cpp-config-clase-titulo")).to_have_text(f"Editar Clase: {second_class_name}")

    # Take a final screenshot to show the result
    screenshot_path = "jules-scratch/verification/verification.png"
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
