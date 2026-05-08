<?php
// /includes/admin-settings.php

defined('ABSPATH') or die('Acceso no permitido');

add_action('admin_menu', 'cpp_register_admin_settings_page');
function cpp_register_admin_settings_page() {
    $page = add_menu_page(
        'Cuaderno Profe',
        'Cuaderno Profe',
        'manage_options',
        'cpp-settings',
        'cpp_render_admin_settings_page',
        'dashicons-book-alt',
        30
    );
    add_action('admin_print_scripts-' . $page, 'cpp_enqueue_admin_media_scripts');
}

function cpp_enqueue_admin_media_scripts() {
    wp_enqueue_media();
}

function cpp_render_admin_settings_page() {
    if (!current_user_can('manage_options')) return;

    if (isset($_POST['cpp_save_settings'])) {
        check_admin_referer('cpp_save_settings_nonce');
        update_option('cpp_share_page_url', sanitize_text_field($_POST['cpp_share_page_url']));
        update_option('cpp_share_logo_url', sanitize_text_field($_POST['cpp_share_logo_url']));
        update_option('cpp_share_logo_width', intval($_POST['cpp_share_logo_width']));
        echo '<div class="updated"><p>Ajustes guardados.</p></div>';
    }

    $share_url = get_option('cpp_share_page_url', '');
    $logo_url = get_option('cpp_share_logo_url', '');
    $logo_width = get_option('cpp_share_logo_width', '150');
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
                <tr>
                    <th scope="row">Logo para compartir</th>
                    <td>
                        <div id="cpp-logo-preview" style="margin-bottom: 10px;">
                            <?php if ($logo_url): ?>
                                <img src="<?php echo esc_url($logo_url); ?>" style="max-width: 200px; height: auto;">
                            <?php endif; ?>
                        </div>
                        <input type="hidden" name="cpp_share_logo_url" id="cpp_share_logo_url" value="<?php echo esc_url($logo_url); ?>">
                        <button type="button" class="button" id="cpp-select-logo-btn">Seleccionar Logo</button>
                        <button type="button" class="button" id="cpp-remove-logo-btn" <?php echo !$logo_url ? 'style="display:none;"' : ''; ?>>Eliminar</button>
                        <p class="description">El logo que se mostrará en la cabecera de la programación compartida.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="cpp_share_logo_width">Ancho del Logo (px)</label></th>
                    <td>
                        <input name="cpp_share_logo_width" type="number" id="cpp_share_logo_width" value="<?php echo esc_attr($logo_width); ?>" class="small-text"> px
                    </td>
                </tr>
            </table>
            <p class="submit">
                <input type="submit" name="cpp_save_settings" id="submit" class="button button-primary" value="Guardar ajustes">
            </p>
        </form>
    </div>

    <script>
    jQuery(document).ready(function($) {
        var frame;
        $('#cpp-select-logo-btn').on('click', function(e) {
            e.preventDefault();
            if (frame) { frame.open(); return; }
            frame = wp.media({
                title: 'Seleccionar Logo',
                button: { text: 'Usar este logo' },
                multiple: false
            });
            frame.on('select', function() {
                var attachment = frame.state().get('selection').first().toJSON();
                $('#cpp_share_logo_url').val(attachment.url);
                $('#cpp-logo-preview').html('<img src="' + attachment.url + '" style="max-width: 200px; height: auto;">');
                $('#cpp-remove-logo-btn').show();
            });
            frame.open();
        });
        $('#cpp-remove-logo-btn').on('click', function() {
            $('#cpp_share_logo_url').val('');
            $('#cpp-logo-preview').empty();
            $(this).hide();
        });
    });
    </script>
    <?php
}
