<?php
// /includes/admin-settings.php

defined('ABSPATH') or die('Acceso no permitido');

add_action('admin_menu', 'cpp_register_admin_settings_page');
function cpp_register_admin_settings_page() {
    $main_page = add_menu_page(
        'Cuaderno Profe',
        'Cuaderno Profe',
        'manage_options',
        'cpp-settings',
        'cpp_render_admin_settings_page',
        'dashicons-book-alt',
        30
    );

    $settings_page = add_submenu_page(
        'cpp-settings',
        'Ajustes',
        'Ajustes',
        'manage_options',
        'cpp-settings',
        'cpp_render_admin_settings_page'
    );

    $stats_page = add_submenu_page(
        'cpp-settings',
        'Estadísticas',
        'Estadísticas',
        'manage_options',
        'cpp-statistics',
        'cpp_render_admin_statistics_page'
    );

    add_action('admin_print_scripts-' . $main_page, 'cpp_enqueue_admin_media_scripts');
    add_action('admin_print_scripts-' . $settings_page, 'cpp_enqueue_admin_media_scripts');
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

function cpp_render_admin_statistics_page() {
    if (!current_user_can('manage_options')) return;

    global $wpdb;

    // Obtener todos los usuarios de WordPress excluyendo administradores
    $users = get_users([
        'role__not_in' => ['administrator'],
        'orderby'      => 'registered',
        'order'        => 'DESC'
    ]);

    // Consultas agrupadas por user_id para máxima eficiencia
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    $tabla_asistencia = $wpdb->prefix . 'cpp_asistencia';

    // Clases por usuario
    $raw_clases = $wpdb->get_results("
        SELECT user_id,
               COUNT(*) as total,
               SUM(CASE WHEN archivada = 0 THEN 1 ELSE 0 END) as activas,
               SUM(CASE WHEN archivada = 1 THEN 1 ELSE 0 END) as archivadas
        FROM {$tabla_clases}
        GROUP BY user_id
    ");
    $stats_clases = [];
    foreach ($raw_clases as $r) {
        $stats_clases[$r->user_id] = $r;
    }

    // Alumnos por usuario
    $raw_alumnos = $wpdb->get_results("SELECT user_id, COUNT(*) as total FROM {$tabla_alumnos} GROUP BY user_id");
    $stats_alumnos = wp_list_pluck($raw_alumnos, 'total', 'user_id');

    // Evaluaciones por usuario
    $raw_evaluaciones = $wpdb->get_results("SELECT user_id, COUNT(*) as total FROM {$tabla_evaluaciones} GROUP BY user_id");
    $stats_evaluaciones = wp_list_pluck($raw_evaluaciones, 'total', 'user_id');

    // Actividades por usuario
    $raw_actividades = $wpdb->get_results("SELECT user_id, COUNT(*) as total FROM {$tabla_actividades} GROUP BY user_id");
    $stats_actividades = wp_list_pluck($raw_actividades, 'total', 'user_id');

    // Calificaciones por usuario
    $raw_calificaciones = $wpdb->get_results("
        SELECT a.user_id, COUNT(c.id) as total
        FROM {$tabla_calificaciones} c
        INNER JOIN {$tabla_actividades} a ON c.actividad_id = a.id
        GROUP BY a.user_id
    ");
    $stats_calificaciones = wp_list_pluck($raw_calificaciones, 'total', 'user_id');

    // Sesiones de programación por usuario
    $raw_sesiones = $wpdb->get_results("SELECT user_id, COUNT(*) as total FROM {$tabla_sesiones} GROUP BY user_id");
    $stats_sesiones = wp_list_pluck($raw_sesiones, 'total', 'user_id');

    // Asistencia por usuario
    $raw_asistencia = $wpdb->get_results("SELECT user_id, COUNT(*) as total FROM {$tabla_asistencia} GROUP BY user_id");
    $stats_asistencia = wp_list_pluck($raw_asistencia, 'total', 'user_id');

    // Totales globales
    $totales = [
        'profesores'      => count($users),
        'clases_activas'  => 0,
        'clases_archivadas'=> 0,
        'alumnos'         => 0,
        'actividades'     => 0,
        'calificaciones'  => 0,
        'sesiones'        => 0,
        'asistencia'      => 0,
    ];

    foreach ($stats_clases as $c) {
        $totales['clases_activas'] += intval($c->activas);
        $totales['clases_archivadas'] += intval($c->archivadas);
    }
    foreach ($stats_alumnos as $val) { $totales['alumnos'] += intval($val); }
    foreach ($stats_actividades as $val) { $totales['actividades'] += intval($val); }
    foreach ($stats_calificaciones as $val) { $totales['calificaciones'] += intval($val); }
    foreach ($stats_sesiones as $val) { $totales['sesiones'] += intval($val); }
    foreach ($stats_asistencia as $val) { $totales['asistencia'] += intval($val); }

    ?>
    <div class="wrap">
        <h1>Estadísticas de Uso del Cuaderno</h1>
        <p class="description" style="margin-bottom: 20px;">Seguimiento y métricas de uso de los profesores inscritos en la plataforma.</p>

        <!-- Tarjetas de resumen global -->
        <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 30px;">
            <div style="flex: 1; min-width: 180px; background: #fff; border: 1px solid #ccd0d4; border-left: 4px solid #2962FF; border-radius: 4px; padding: 15px; box-shadow: 0 1px 1px rgba(0,0,0,.04);">
                <div style="font-size: 13px; color: #50575e; font-weight: 600; text-transform: uppercase;">Profesores</div>
                <div style="font-size: 28px; font-weight: bold; color: #1d2327; margin-top: 5px;"><?php echo esc_html(number_format_i18n($totales['profesores'])); ?></div>
            </div>

            <div style="flex: 1; min-width: 180px; background: #fff; border: 1px solid #ccd0d4; border-left: 4px solid #00a32a; border-radius: 4px; padding: 15px; box-shadow: 0 1px 1px rgba(0,0,0,.04);">
                <div style="font-size: 13px; color: #50575e; font-weight: 600; text-transform: uppercase;">Clases Creadas</div>
                <div style="font-size: 28px; font-weight: bold; color: #1d2327; margin-top: 5px;"><?php echo esc_html(number_format_i18n($totales['clases_activas'] + $totales['clases_archivadas'])); ?></div>
                <div style="font-size: 12px; color: #646970; margin-top: 2px;">
                    <?php echo esc_html($totales['clases_activas']); ?> activas | <?php echo esc_html($totales['clases_archivadas']); ?> archivadas
                </div>
            </div>

            <div style="flex: 1; min-width: 180px; background: #fff; border: 1px solid #ccd0d4; border-left: 4px solid #722ed1; border-radius: 4px; padding: 15px; box-shadow: 0 1px 1px rgba(0,0,0,.04);">
                <div style="font-size: 13px; color: #50575e; font-weight: 600; text-transform: uppercase;">Alumnos Totales</div>
                <div style="font-size: 28px; font-weight: bold; color: #1d2327; margin-top: 5px;"><?php echo esc_html(number_format_i18n($totales['alumnos'])); ?></div>
            </div>

            <div style="flex: 1; min-width: 180px; background: #fff; border: 1px solid #ccd0d4; border-left: 4px solid #dba617; border-radius: 4px; padding: 15px; box-shadow: 0 1px 1px rgba(0,0,0,.04);">
                <div style="font-size: 13px; color: #50575e; font-weight: 600; text-transform: uppercase;">Actividades / Notas</div>
                <div style="font-size: 28px; font-weight: bold; color: #1d2327; margin-top: 5px;"><?php echo esc_html(number_format_i18n($totales['actividades'])); ?></div>
                <div style="font-size: 12px; color: #646970; margin-top: 2px;">
                    <?php echo esc_html(number_format_i18n($totales['calificaciones'])); ?> notas introducidas
                </div>
            </div>

            <div style="flex: 1; min-width: 180px; background: #fff; border: 1px solid #ccd0d4; border-left: 4px solid #d63638; border-radius: 4px; padding: 15px; box-shadow: 0 1px 1px rgba(0,0,0,.04);">
                <div style="font-size: 13px; color: #50575e; font-weight: 600; text-transform: uppercase;">Sesiones Programadas</div>
                <div style="font-size: 28px; font-weight: bold; color: #1d2327; margin-top: 5px;"><?php echo esc_html(number_format_i18n($totales['sesiones'])); ?></div>
            </div>
        </div>

        <!-- Tabla detallada por usuario -->
        <h2>Detalle por Usuario</h2>
        <table class="wp-list-table widefat fixed striped table-view-list" style="margin-top: 10px;">
            <thead>
                <tr>
                    <th scope="col" style="width: 200px;">Usuario / Nombre</th>
                    <th scope="col" style="width: 220px;">Email</th>
                    <th scope="col" style="width: 120px;">Registro</th>
                    <th scope="col" style="text-align: center;">Clases (Act./Arch.)</th>
                    <th scope="col" style="text-align: center;">Alumnos</th>
                    <th scope="col" style="text-align: center;">Evaluaciones</th>
                    <th scope="col" style="text-align: center;">Actividades</th>
                    <th scope="col" style="text-align: center;">Calificaciones</th>
                    <th scope="col" style="text-align: center;">Sesiones Prog.</th>
                    <th scope="col" style="text-align: center;">Asistencias</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($users)): ?>
                    <tr>
                        <td colspan="10">No hay usuarios registrados (excluyendo administradores).</td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($users as $user):
                        $uid = $user->ID;
                        $clases_info = isset($stats_clases[$uid]) ? $stats_clases[$uid] : null;
                        $c_activas = $clases_info ? intval($clases_info->activas) : 0;
                        $c_arch = $clases_info ? intval($clases_info->archivadas) : 0;
                        $num_alumnos = isset($stats_alumnos[$uid]) ? intval($stats_alumnos[$uid]) : 0;
                        $num_evals = isset($stats_evaluaciones[$uid]) ? intval($stats_evaluaciones[$uid]) : 0;
                        $num_acts = isset($stats_actividades[$uid]) ? intval($stats_actividades[$uid]) : 0;
                        $num_califs = isset($stats_calificaciones[$uid]) ? intval($stats_calificaciones[$uid]) : 0;
                        $num_sesiones = isset($stats_sesiones[$uid]) ? intval($stats_sesiones[$uid]) : 0;
                        $num_asist = isset($stats_asistencia[$uid]) ? intval($stats_asistencia[$uid]) : 0;
                        $registered_date = date_i18n(get_option('date_format'), strtotime($user->user_registered));
                    ?>
                        <tr>
                            <td>
                                <strong><?php echo esc_html($user->display_name); ?></strong><br>
                                <span style="font-size: 11px; color: #646970;">@<?php echo esc_html($user->user_login); ?></span>
                            </td>
                            <td>
                                <a href="mailto:<?php echo esc_attr($user->user_email); ?>"><?php echo esc_html($user->user_email); ?></a>
                            </td>
                            <td><?php echo esc_html($registered_date); ?></td>
                            <td style="text-align: center;">
                                <strong><?php echo esc_html($c_activas + $c_arch); ?></strong>
                                <span style="font-size: 11px; color: #646970;">(<?php echo esc_html($c_activas); ?> / <?php echo esc_html($c_arch); ?>)</span>
                            </td>
                            <td style="text-align: center;"><?php echo esc_html($num_alumnos); ?></td>
                            <td style="text-align: center;"><?php echo esc_html($num_evals); ?></td>
                            <td style="text-align: center;"><?php echo esc_html($num_acts); ?></td>
                            <td style="text-align: center;"><?php echo esc_html($num_califs); ?></td>
                            <td style="text-align: center;"><?php echo esc_html($num_sesiones); ?></td>
                            <td style="text-align: center;"><?php echo esc_html($num_asist); ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
    <?php
}
