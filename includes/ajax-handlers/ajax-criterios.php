<?php
// /includes/ajax-handlers/ajax-criterios.php

defined('ABSPATH') or die('Acceso no permitido');

// --- MANEJADORES PARA CRITERIOS GLOBALES ---

add_action('wp_ajax_cpp_obtener_criterios_globales', 'cpp_ajax_obtener_criterios_globales');
function cpp_ajax_obtener_criterios_globales() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $criterios = cpp_obtener_criterios_globales($user_id);

    wp_send_json_success(['criterios' => $criterios]);
}

add_action('wp_ajax_cpp_guardar_o_actualizar_criterio_global', 'cpp_ajax_guardar_o_actualizar_criterio_global');
function cpp_ajax_guardar_o_actualizar_criterio_global() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $criterio_id = isset($_POST['criterio_id']) ? intval($_POST['criterio_id']) : 0;
    $nombre = isset($_POST['nombre']) ? sanitize_text_field(trim($_POST['nombre'])) : '';
    $color = isset($_POST['color']) ? sanitize_hex_color($_POST['color']) : '#FFFFFF';

    if (empty($nombre)) {
        wp_send_json_error(['message' => 'El nombre del criterio es obligatorio.']);
        return;
    }

    if ($criterio_id > 0) {
        $res = cpp_actualizar_criterio_global($criterio_id, $user_id, ['nombre' => $nombre, 'color' => $color]);
        if ($res !== false) wp_send_json_success(['message' => 'Criterio actualizado correctamente.']);
        else wp_send_json_error(['message' => 'Error al actualizar el criterio.']);
    } else {
        $res = cpp_guardar_criterio_global($user_id, $nombre, $color);
        if ($res) wp_send_json_success(['message' => 'Criterio creado correctamente.']);
        else wp_send_json_error(['message' => 'Error al crear el criterio.']);
    }
}

add_action('wp_ajax_cpp_eliminar_criterio_global', 'cpp_ajax_eliminar_criterio_global');
function cpp_ajax_eliminar_criterio_global() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $criterio_id = isset($_POST['criterio_id']) ? intval($_POST['criterio_id']) : 0;

    if (empty($criterio_id)) {
        wp_send_json_error(['message' => 'ID de criterio no proporcionado.']);
        return;
    }

    $res = cpp_eliminar_criterio_global($criterio_id, $user_id);
    if ($res) wp_send_json_success(['message' => 'Criterio eliminado globalmente.']);
    else wp_send_json_error(['message' => 'Error al eliminar el criterio.']);
}

// --- MANEJADORES PARA ASIGNACIÓN DE CRITERIOS A EVALUACIONES ---

add_action('wp_ajax_cpp_obtener_criterios_evaluacion', 'cpp_ajax_obtener_criterios_evaluacion');
function cpp_ajax_obtener_criterios_evaluacion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;

    if (empty($evaluacion_id)) {
        wp_send_json_error(['message' => 'ID de evaluación no proporcionado.']);
        return;
    }

    $criterios_asignados = cpp_obtener_criterios_por_evaluacion($evaluacion_id, $user_id);
    $criterios_globales = cpp_obtener_criterios_globales($user_id);

    global $wpdb;
    $metodo_calculo = $wpdb->get_var($wpdb->prepare("SELECT calculo_nota FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d AND user_id = %d", $evaluacion_id, $user_id));

    ob_start();
    ?>
    <div class="cpp-form-group">
        <label>Método de Cálculo de la Nota Final</label>
        <div class="cpp-radio-group">
            <label>
                <input type="radio" name="metodo_calculo_evaluacion" value="total" <?php checked($metodo_calculo, 'total'); ?>>
                Puntuación total (media simple de todas las actividades)
            </label>
            <label>
                <input type="radio" name="metodo_calculo_evaluacion" value="ponderada" <?php checked($metodo_calculo, 'ponderada'); ?>>
                Ponderada por criterios
            </label>
        </div>
    </div>

    <div id="cpp-gestion-criterios-wrapper" style="<?php echo $metodo_calculo === 'total' ? 'display:none;' : ''; ?>">
        <hr style="margin: 20px 0;">
        <div class="cpp-criterios-list">
            <h4>Criterios asignados a esta evaluación</h4>
            <?php if (empty($criterios_asignados)): ?>
                <p>No hay criterios asignados.</p>
            <?php else: ?>
                <ul>
                    <?php
                    $total_p = 0;
                    foreach ($criterios_asignados as $crit):
                        $total_p += $crit['porcentaje'];
                        ?>
                        <li data-criterio-id="<?php echo esc_attr($crit['criterio_id']); ?>">
                            <span class="cpp-category-color-indicator" style="background-color: <?php echo esc_attr($crit['color']); ?>;"></span>
                            <span class="cpp-criterio-nombre-listado"><?php echo esc_html($crit['nombre']); ?></span>:
                            <input type="number" class="cpp-criterio-peso-input" value="<?php echo esc_attr($crit['porcentaje']); ?>" min="0" max="100" style="width: 60px; display: inline-block;"> %
                            <button type="button" class="cpp-btn cpp-btn-icon cpp-btn-eliminar-criterio-eval" data-criterio-id="<?php echo esc_attr($crit['criterio_id']); ?>" title="Quitar de esta evaluación"><span class="dashicons dashicons-dismiss"></span></button>
                        </li>
                    <?php endforeach; ?>
                </ul>
                <p><strong>Total: <span id="cpp-total-porcentaje-display"><?php echo $total_p; ?></span>%</strong></p>
                <button type="button" class="cpp-btn cpp-btn-primary" id="cpp-guardar-pesos-criterios-btn">Guardar Ponderaciones</button>
            <?php endif; ?>
        </div>

        <div class="cpp-form-asignar-criterio">
            <h4>Asignar nuevo criterio</h4>
            <div class="cpp-form-group">
                <select id="cpp-select-criterio-global">
                    <option value="">-- Seleccionar criterio --</option>
                    <?php
                    $asignados_ids = wp_list_pluck($criterios_asignados, 'criterio_id');
                    foreach ($criterios_globales as $cg):
                        if (in_array($cg['id'], $asignados_ids)) continue;
                        ?>
                        <option value="<?php echo esc_attr($cg['id']); ?>"><?php echo esc_html($cg['nombre']); ?></option>
                    <?php endforeach; ?>
                </select>
                <button type="button" class="cpp-btn cpp-btn-secondary" id="cpp-btn-asignar-criterio-eval">Asignar</button>
            </div>
            <p class="description">Si no encuentras el criterio, créalo primero en la pestaña <strong>Configuración > Criterios Globales</strong>.</p>
        </div>
    </div>
    <?php
    $html = ob_get_clean();
    wp_send_json_success(['html' => $html, 'metodo_calculo' => $metodo_calculo]);
}

add_action('wp_ajax_cpp_asignar_criterio_evaluacion', 'cpp_ajax_asignar_criterio_evaluacion');
function cpp_ajax_asignar_criterio_evaluacion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $criterio_id = isset($_POST['criterio_id']) ? intval($_POST['criterio_id']) : 0;

    if (!$evaluacion_id || !$criterio_id) {
        wp_send_json_error(['message' => 'Datos incompletos.']);
        return;
    }

    $res = cpp_asignar_criterio_a_evaluacion($evaluacion_id, $criterio_id, 0, $user_id);
    if ($res) wp_send_json_success(['message' => 'Criterio asignado.']);
    else wp_send_json_error(['message' => 'Error al asignar el criterio.']);
}

add_action('wp_ajax_cpp_guardar_pesos_criterios', 'cpp_ajax_guardar_pesos_criterios');
function cpp_ajax_guardar_pesos_criterios() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $pesos = isset($_POST['pesos']) ? $_POST['pesos'] : []; // Array de [criterio_id => porcentaje]

    if (!$evaluacion_id || empty($pesos)) {
        wp_send_json_error(['message' => 'Datos incompletos.']);
        return;
    }

    $total = 0;
    foreach ($pesos as $p) $total += intval($p);
    if ($total > 100) {
        wp_send_json_error(['message' => 'La suma de porcentajes no puede superar el 100%.']);
        return;
    }

    foreach ($pesos as $crit_id => $porcentaje) {
        cpp_actualizar_peso_criterio_evaluacion($evaluacion_id, intval($crit_id), intval($porcentaje), $user_id);
    }

    wp_send_json_success(['message' => 'Ponderaciones guardadas correctamente.']);
}

add_action('wp_ajax_cpp_desasignar_criterio_evaluacion', 'cpp_ajax_desasignar_criterio_evaluacion');
function cpp_ajax_desasignar_criterio_evaluacion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $criterio_id = isset($_POST['criterio_id']) ? intval($_POST['criterio_id']) : 0;

    if (!$evaluacion_id || !$criterio_id) {
        wp_send_json_error(['message' => 'Datos incompletos.']);
        return;
    }

    $res = cpp_desasignar_criterio_de_evaluacion($evaluacion_id, $criterio_id, $user_id);
    if ($res) wp_send_json_success(['message' => 'Criterio desasignado.']);
    else wp_send_json_error(['message' => 'Error al desasignar.']);
}

add_action('wp_ajax_cpp_obtener_criterios_evaluacion_json', 'cpp_ajax_obtener_criterios_evaluacion_json');
function cpp_ajax_obtener_criterios_evaluacion_json() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    if (empty($evaluacion_id)) { wp_send_json_error(['message' => 'ID de evaluación no proporcionado.']); return; }
    $criterios = cpp_obtener_criterios_por_evaluacion($evaluacion_id, $user_id);
    wp_send_json_success(['criterios' => $criterios]);
}
