
import re
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. Navigate to the WordPress admin login page.
        page.goto("https://cuadernodeprofe.com/wp-admin")

        # 2. Log in with the provided credentials.
        page.fill('input[name="log"]', "vegasmadrid")
        page.fill('input[name="pwd"]', "dkxve7cs88")
        page.click('input[name="wp-submit"]')

        # 3. Wait for a reliable element on the dashboard to confirm login.
        page.wait_for_selector('#wpadminbar', state='visible', timeout=60000)

        # 4. Handle the "Required PHP Update" notice.
        try:
            php_update_dismiss_button = page.locator('a.wp-element-button:has-text("Dismiss")')
            php_update_dismiss_button.wait_for(state='visible', timeout=10000)
            php_update_dismiss_button.click()
        except Exception as e:
            print("PHP Update notice not found or could not be dismissed, continuing...")

        # 5. Handle the "Welcome to WordPress" popup.
        try:
            welcome_dismiss_button = page.locator('button[aria-label="Descartar este panel"]')
            welcome_dismiss_button.wait_for(state='visible', timeout=10000)
            welcome_dismiss_button.click()
        except Exception as e:
            print("Welcome popup not found or could not be dismissed, continuing...")

        # 6. Handle the Cookie Consent Banner.
        try:
            cookie_accept_button = page.locator('button:has-text("Aceptar")').first
            cookie_accept_button.wait_for(state='visible', timeout=10000)
            cookie_accept_button.click()
        except Exception as e:
            print("Cookie banner not found or could not be clicked, continuing...")


        # 7. Navigate to the "Cuaderno" page.
        page.click('div.wp-menu-name:has-text("Cuaderno")')
        page.wait_for_url(re.compile(r".*/wp-admin/admin\.php\?page=cpp-cuaderno-profesor"), timeout=60000)

        # Wait for the main content to load
        page.wait_for_selector('#cpp-main-content-cuaderno', timeout=60000)

        # 8. Switch to the "Programación" tab.
        page.click('button#cpp-main-tab-programacion')
        page.wait_for_selector('#cpp-programador-panel', state='visible')

        # 9. Click on an evaluable activity to open the modal.
        activity_locator = page.locator('.cpp-programador-actividad-item[data-tipo="evaluable"]').first
        activity_locator.wait_for(state='visible', timeout=15000)
        activity_locator.click()

        # Wait for the modal to appear
        page.wait_for_selector('#cpp-modal-crear-actividad', state='visible')

        # 10. Assert that the modal is for editing an activity.
        expect(page.locator('#cpp-modal-crear-actividad-titulo')).to_contain_text('Editar Actividad')

        # 11. Assert that the date field is displayed correctly as non-editable text.
        date_display_locator = page.locator('#cpp-fecha-actividad-display')
        date_input_locator = page.locator('#fecha_actividad')

        # The display div should be visible, and the input hidden.
        expect(date_display_locator).to_be_visible()
        expect(date_input_locator).to_be_hidden()
        # Check that the date display contains text matching a date format.
        expect(date_display_locator.locator('.cpp-modal-info-value')).to_contain_text(re.compile(r'\w{3}\., \d{1,2} \w{3}\. \d{4}'))

        # 12. Take a screenshot for verification.
        page.screenshot(path="jules-scratch/verification/verification.png")

        print("Verification script completed successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
