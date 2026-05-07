<?php
// /includes/admin-settings.php

defined('ABSPATH') or die('Acceso no permitido');

add_action('admin_menu', 'cpp_register_admin_settings_page');
function cpp_register_admin_settings_page() {
    add_menu_page(
        'Cuaderno Profe',
        'Cuaderno Profe',
        'manage_options',
        'cpp-settings',
        'cpp_render_admin_settings_page',
        'dashicons-book-alt',
        30
    );
}

function cpp_render_admin_settings_page() {
    if (!current_user_can('manage_options')) return;

    if (isset($_POST['cpp_save_settings'])) {
        check_admin_referer('cpp_save_settings_nonce');
        $share_url = sanitize_text_field($_POST['cpp_share_page_url']);
        update_option('cpp_share_page_url', $share_url);
        echo '<div class="updated"><p>Ajustes guardados.</p></div>';
    }

    $share_url = get_option('cpp_share_page_url', '');
    ?>
    <div class="wrap">
        <h1>Ajustes del Cuaderno de Profe</h1>
        <form method="post" action="">
            <?php wp_nonce_field('cpp_save_settings_nonce'); ?>
            <table class="form-table">
                <tr>
                    <th scope="row"><label for="cpp_share_page_url">URL de la página compartida</label></th>
                    <td>
                        <input name="cpp_share_page_url" type="url" id="cpp_share_page_url" value="<?php echo esc_url($share_url); ?>" class="regular-text">
                        <p class="description">Introduce la URL de la página donde has insertado el shortcode <code>[semana_compartida]</code>. Esta página será la que se use para generar los enlaces públicos.</p>
                    </td>
                </tr>
            </table>
            <p class="submit">
                <input type="submit" name="cpp_save_settings" id="submit" class="button button-primary" value="Guardar ajustes">
            </p>
        </form>
    </div>
    <?php
}
