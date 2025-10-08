import re
from playwright.sync_api import Page, expect

def test_verifications(page: Page):
    # 1. Log in
    page.goto("http://localhost:8080/wp-login.php")
    page.get_by_label("Username or Email Address").fill("admin")
    page.get_by_label("Password").fill("password")
    page.get_by_role("button", name="Log In").click()
    expect(page).to_have_url(re.compile(".*wp-admin.*"))

    # 2. Go to the page with the shortcode
    page.goto("http://localhost:8080/")

    # 3. Navigate to the scheduler
    # Wait for the sidebar to be ready and click the first class
    expect(page.locator(".cpp-sidebar-clase-item a").first).to_be_visible()
    page.locator(".cpp-sidebar-clase-item a").first.click()

    # Click the 'Programación' tab
    programacion_tab = page.get_by_role("button", name="Programación")
    expect(programacion_tab).to_be_visible()
    programacion_tab.click()

    # Wait for the session list to appear
    first_session = page.locator(".cpp-sesion-list-item").first
    expect(first_session).to_be_visible()

    # 4. Verify the scroll-on-click fix
    # Click the second session to trigger the selection change
    second_session = page.locator(".cpp-sesion-list-item:nth-child(2)")
    if (second_session.is_visible()):
        second_session.click()
        # Expect the right column to update, indicating the click was processed
        expect(page.locator("#cpp-programacion-right-col h3")).to_be_visible()
        # Take a screenshot to show the view is stable
        page.screenshot(path="jules-scratch/verification/scroll_fix_verification.png")

    # 5. Verify the symbol modal styling
    # The second session should still be selected. Click the symbol button.
    symbol_button = page.locator("#cpp-simbolo-sesion-toolbar-btn")
    expect(symbol_button).to_be_enabled()
    symbol_button.click()

    # Wait for the new palette to appear and take a screenshot
    symbol_palette = page.locator(".cpp-programador-symbol-palette")
    expect(symbol_palette).to_be_visible()
    page.screenshot(path="jules-scratch/verification/symbol_modal_verification.png")