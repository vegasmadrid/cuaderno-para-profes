from playwright.sync_api import sync_playwright, Page, expect

def run(page: Page):
    """
    This script verifies the final layout and functionality of the 'Horario' tab.
    """
    # Go to the page where the shortcode is active
    page.goto("http://localhost:8000/cuaderno-de-notas-2", wait_until="networkidle")

    # Wait for the app to load
    expect(page.locator("#cpp-cuaderno-nombre-clase-activa-a1")).not_to_be_empty()

    # Click on the 'Horario' tab
    horario_tab_button = page.locator('.cpp-main-tab-link[data-tab="horario"]')
    horario_tab_button.click()

    # Verify the new layout
    # 1. Check that the "Añadir Tramo" button is in the second header cell
    add_slot_button = page.locator("#cpp-horario-table thead .cpp-horario-th-hora .cpp-btn-add-slot-header")
    expect(add_slot_button).to_be_visible()

    # 2. Check that the delete button is in the first cell of the first body row
    first_row_first_cell = page.locator("#cpp-horario-table tbody tr").first.locator("td").first
    expect(first_row_first_cell.locator(".cpp-delete-slot-btn")).to_be_visible()

    # Take a screenshot to verify UI
    screenshot_path = "jules-scratch/verification/horario_final_layout.png"
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
