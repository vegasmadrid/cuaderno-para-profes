from playwright.sync_api import sync_playwright, Page, expect

def run(page: Page):
    """
    This script verifies the fixes for the 'Horario' tab redesign:
    1. Title is removed.
    2. Delete and edit functionalities are restored.
    3. Scrolling issue is fixed (implicitly verified by taking a full page screenshot).
    """
    # Go to the page where the shortcode is active
    page.goto("http://localhost:8000/cuaderno-de-notas-2", wait_until="networkidle")

    # Wait for the app to load
    expect(page.locator("#cpp-cuaderno-nombre-clase-activa-a1")).not_to_be_empty()

    # Click on the 'Horario' tab
    horario_tab_button = page.locator('.cpp-main-tab-link[data-tab="horario"]')
    horario_tab_button.click()

    # 1. Verify the title is gone
    horario_header = page.locator(".cpp-horario-header")
    expect(horario_header.locator("h2")).not_to_be_visible()

    # 2. Verify functionality is restored
    # Check for the delete button in the first row
    first_row = page.locator("#cpp-horario-table tbody tr").first
    expect(first_row.locator(".cpp-delete-slot-btn")).to_be_visible()

    # Check if the time slot cell is editable
    first_time_slot = first_row.locator(".cpp-horario-td-hora").first
    expect(first_time_slot).to_have_attribute("contenteditable", "true")

    # 3. Take a screenshot to verify UI and scrolling padding
    screenshot_path = "jules-scratch/verification/horario_fixes.png"
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
