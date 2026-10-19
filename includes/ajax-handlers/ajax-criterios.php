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

    // Filtrar "Sin categoría"
    $criterios = array_filter($criterios, function($c) {
        return strtolower($c['nombre']) !== 'sin categoría';
    });

    wp_send_json_success(['criterios' => array_values($criterios)]);
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
    $new_criterio_id = isset($_POST['new_criterio_id']) ? intval($_POST['new_criterio_id']) : null;

    if (empty($criterio_id)) {
        wp_send_json_error(['message' => 'ID de criterio no proporcionado.']);
        return;
    }

    $res = cpp_eliminar_criterio_global($criterio_id, $user_id, $new_criterio_id);
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

    // Filtrar "Sin categoría"
    $criterios_asignados = array_filter($criterios_asignados, function($c) {
        return strtolower($c['nombre']) !== 'sin categoría';
    });
    $criterios_globales = array_filter($criterios_globales, function($c) {
        return strtolower($c['nombre']) !== 'sin categoría';
    });

    global $wpdb;
    $eval_row = $wpdb->get_row($wpdb->prepare("SELECT clase_id, calculo_nota FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d AND user_id = %d", $evaluacion_id, $user_id));
    $metodo_calculo = $eval_row ? $eval_row->calculo_nota : 'total';
    $clase_actual_id = $eval_row ? intval($eval_row->clase_id) : 0;

    $clases_importar = cpp_obtener_clases_para_importar_evaluaciones(0, $user_id);
    $clases_activas = isset($clases_importar['activas']) ? $clases_importar['activas'] : [];
    $clases_archivadas = isset($clases_importar['archivadas']) ? $clases_importar['archivadas'] : [];

    $evaluaciones_clase_actual = cpp_obtener_evaluaciones_por_clase($clase_actual_id, $user_id);

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
                <ul class="cpp-assigned-criteria-ul">
                    <?php
                    $total_p = 0;
                    foreach ($criterios_asignados as $crit):
                        $total_p += $crit['porcentaje'];
                        ?>
                        <li data-original-criterio-id="<?php echo esc_attr($crit['criterio_id']); ?>">
                            <span class="cpp-category-color-indicator" style="background-color: <?php echo esc_attr($crit['color']); ?>;"></span>
                            <select class="cpp-criterio-swap-select">
                                <?php foreach ($criterios_globales as $cg): ?>
                                    <option value="<?php echo esc_attr($cg['id']); ?>" <?php selected($cg['id'], $crit['criterio_id']); ?> data-color="<?php echo esc_attr($cg['color']); ?>">
                                        <?php echo esc_html($cg['nombre']); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                            <span class="cpp-separator">:</span>
                            <div class="cpp-peso-input-wrapper">
                                <input type="number" class="cpp-criterio-peso-input" value="<?php echo esc_attr($crit['porcentaje']); ?>" min="0" max="100">
                                <span class="cpp-percent-symbol">%</span>
                            </div>
                            <button type="button" class="cpp-btn-icon-minimal cpp-btn-eliminar-criterio-eval" data-criterio-id="<?php echo esc_attr($crit['criterio_id']); ?>" title="Quitar de esta evaluación">
                                <span class="dashicons dashicons-dismiss"></span>
                            </button>
                        </li>
                    <?php endforeach; ?>
                </ul>
                <div class="cpp-criterios-footer">
                    <p><strong>Total: <span id="cpp-total-porcentaje-display"><?php echo $total_p; ?></span>%</strong></p>
                    <button type="button" class="cpp-btn cpp-btn-primary" id="cpp-guardar-pesos-criterios-btn">Guardar Ponderaciones</button>
                </div>
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

    <!-- SECCIÓN PARA CLONAR PONDERACIONES DE OTRA EVALUACIÓN -->
    <hr style="margin: 25px 0 15px 0; border: 0; border-top: 1px solid #eee;">
    <div class="cpp-clonar-ponderaciones-section" style="background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
        <h4 style="margin-top:0; margin-bottom: 8px; font-size: 15px; color: #2c3e50;">
            <span class="dashicons dashicons-admin-page" style="vertical-align: text-bottom; margin-right: 4px;"></span>
            Clonar ponderaciones de otra evaluación
        </h4>
        <p style="font-size: 13px; color: #666; margin-bottom: 12px;">Copia los criterios y porcentajes de otra evaluación a la evaluación actual.</p>

        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end;">
            <div class="cpp-form-group" style="margin-bottom:0; flex: 1; min-width: 180px;">
                <label style="display:block; font-weight:600; font-size:12px; margin-bottom:4px;">Clase de origen:</label>
                <select id="cpp-clone-source-class-select" class="cpp-evaluacion-selector" style="width: 100%;" data-target-clase-id="<?php echo esc_attr($clase_actual_id); ?>" data-target-eval-id="<?php echo esc_attr($evaluacion_id); ?>">
                    <option value="<?php echo esc_attr($clase_actual_id); ?>">Esta clase (actual)</option>
                    <?php if (!empty($clases_activas)): ?>
                        <optgroup label="Otras clases activas">
                            <?php foreach ($clases_activas as $c): ?>
                                <?php if (intval($c['id']) !== $clase_actual_id): ?>
                                    <option value="<?php echo esc_attr($c['id']); ?>"><?php echo esc_html($c['nombre']); ?></option>
                                <?php endif; ?>
                            <?php endforeach; ?>
                        </optgroup>
                    <?php endif; ?>
                    <?php if (!empty($clases_archivadas)): ?>
                        <optgroup label="Clases archivadas">
                            <?php foreach ($clases_archivadas as $c): ?>
                                <?php if (intval($c['id']) !== $clase_actual_id): ?>
                                    <option value="<?php echo esc_attr($c['id']); ?>"><?php echo esc_html($c['nombre']); ?> (Archivada)</option>
                                <?php endif; ?>
                            <?php endforeach; ?>
                        </optgroup>
                    <?php endif; ?>
                </select>
            </div>

            <div class="cpp-form-group" style="margin-bottom:0; flex: 1; min-width: 180px;">
                <label style="display:block; font-weight:600; font-size:12px; margin-bottom:4px;">Evaluación de origen:</label>
                <select id="cpp-clone-source-eval-select" class="cpp-evaluacion-selector" style="width: 100%;">
                    <option value="">-- Selecciona una evaluación --</option>
                    <?php foreach ($evaluaciones_clase_actual as $ev_origen): ?>
                        <?php if (intval($ev_origen['id']) !== $evaluacion_id): ?>
                            <option value="<?php echo esc_attr($ev_origen['id']); ?>"><?php echo esc_html($ev_origen['nombre_evaluacion']); ?></option>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </select>
            </div>

            <button type="button" id="cpp-btn-clonar-ponderaciones-submit" class="cpp-btn cpp-btn-secondary" style="height: 38px;">
                <span class="dashicons dashicons-database-import" style="vertical-align: text-bottom; font-size: 16px;"></span> Clonar Ponderaciones
            </button>
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

    if (!$evaluacion_id) {
        wp_send_json_error(['message' => 'Error: No se ha identificado la evaluación.']);
        return;
    }

    if (empty($pesos)) {
        wp_send_json_error(['message' => 'Error: No se han recibido ponderaciones para guardar.']);
        return;
    }

    $total = 0;
    foreach ($pesos as $original_crit_id => $data) {
        $total += intval($data['peso']);
    }
    if ($total > 100) {
        wp_send_json_error(['message' => 'La suma de porcentajes no puede superar el 100%.']);
        return;
    }

    foreach ($pesos as $original_crit_id => $data) {
        $new_crit_id = isset($data['new_id']) ? intval($data['new_id']) : intval($original_crit_id);
        $porcentaje = intval($data['peso']);
        cpp_actualizar_peso_criterio_evaluacion($evaluacion_id, intval($original_crit_id), $porcentaje, $user_id, $new_crit_id);
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
    $new_criterio_id = isset($_POST['new_criterio_id']) ? intval($_POST['new_criterio_id']) : null;

    if (!$evaluacion_id || !$criterio_id) {
        wp_send_json_error(['message' => 'Datos incompletos.']);
        return;
    }

    $res = cpp_desasignar_criterio_de_evaluacion($evaluacion_id, $criterio_id, $user_id, $new_criterio_id);
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

add_action('wp_ajax_cpp_check_target_eval_activities_criteria', 'cpp_ajax_check_target_eval_activities_criteria');
function cpp_ajax_check_target_eval_activities_criteria() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $target_eval_id = isset($_POST['target_eval_id']) ? intval($_POST['target_eval_id']) : 0;
    $source_eval_id = isset($_POST['source_eval_id']) ? intval($_POST['source_eval_id']) : 0;

    if (!$target_eval_id || !$source_eval_id) {
        wp_send_json_error(['message' => 'Parámetros incompletos.']);
        return;
    }

    if ($target_eval_id === $source_eval_id) {
        wp_send_json_error(['message' => 'La evaluación de origen y de destino no pueden ser la misma.']);
        return;
    }

    $result = cpp_check_target_eval_activities_criteria($target_eval_id, $source_eval_id, $user_id);

    if ($result['success']) {
        wp_send_json_success($result);
    } else {
        wp_send_json_error(['message' => $result['message']]);
    }
}

add_action('wp_ajax_cpp_clonar_ponderaciones_evaluacion', 'cpp_ajax_clonar_ponderaciones_evaluacion');
function cpp_ajax_clonar_ponderaciones_evaluacion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $target_eval_id = isset($_POST['target_eval_id']) ? intval($_POST['target_eval_id']) : 0;
    $source_eval_id = isset($_POST['source_eval_id']) ? intval($_POST['source_eval_id']) : 0;
    $remapping = isset($_POST['remapping']) && is_array($_POST['remapping']) ? $_POST['remapping'] : [];

    if (!$target_eval_id || !$source_eval_id) {
        wp_send_json_error(['message' => 'Parámetros incompletos.']);
        return;
    }

    if ($target_eval_id === $source_eval_id) {
        wp_send_json_error(['message' => 'La evaluación de origen y de destino no pueden ser la misma.']);
        return;
    }

    $result = cpp_clonar_criterios_evaluacion($target_eval_id, $source_eval_id, $remapping, $user_id);

    if ($result['success']) {
        wp_send_json_success(['message' => $result['message']]);
    } else {
        wp_send_json_error(['message' => $result['message']]);
    }
}
