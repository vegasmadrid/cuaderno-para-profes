<?php
// /includes/ajax-handlers/ajax-evaluaciones.php

defined('ABSPATH') or die('Acceso no permitido');

// --- ACCIONES AJAX PARA EVALUACIONES ---

add_action('wp_ajax_cpp_obtener_evaluaciones', 'cpp_ajax_obtener_evaluaciones');
function cpp_ajax_obtener_evaluaciones() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    if (empty($clase_id)) { wp_send_json_error(['message' => 'ID de clase no proporcionado.']); return; }
    $evaluaciones = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
    wp_send_json_success(['evaluaciones' => $evaluaciones]);
}

add_action('wp_ajax_cpp_crear_evaluacion', 'cpp_ajax_crear_evaluacion');
function cpp_ajax_crear_evaluacion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    $nombre_evaluacion = isset($_POST['nombre_evaluacion']) ? sanitize_text_field(trim($_POST['nombre_evaluacion'])) : '';
    $id_origen_copia = isset($_POST['source_eval_id']) ? intval($_POST['source_eval_id']) : 0;

    if (empty($clase_id) || empty($nombre_evaluacion)) { wp_send_json_error(['message' => 'Faltan datos para crear la evaluación.']); return; }
    
    $nueva_evaluacion_id = cpp_crear_evaluacion($clase_id, $user_id, $nombre_evaluacion);
    
    if ($nueva_evaluacion_id) {
        if ($id_origen_copia > 0) {
            cpp_copiar_categorias_de_evaluacion($id_origen_copia, $nueva_evaluacion_id, $user_id);
            global $wpdb;
            $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
            $wpdb->update($tabla_evaluaciones, ['calculo_nota' => 'ponderada'], ['id' => $nueva_evaluacion_id]);
        }
        wp_send_json_success(['message' => 'Evaluación creada.', 'evaluacion_id' => $nueva_evaluacion_id]);
    } else {
        wp_send_json_error(['message' => 'Error al crear la evaluación.']);
    }
}

add_action('wp_ajax_cpp_actualizar_evaluacion', 'cpp_ajax_actualizar_evaluacion');
function cpp_ajax_actualizar_evaluacion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $nuevo_nombre = isset($_POST['nombre_evaluacion']) ? sanitize_text_field(trim($_POST['nombre_evaluacion'])) : '';
    if (empty($evaluacion_id) || empty($nuevo_nombre)) { wp_send_json_error(['message' => 'Faltan datos para actualizar la evaluación.']); return; }
    
    if (cpp_actualizar_evaluacion($evaluacion_id, $user_id, $nuevo_nombre)) {
        wp_send_json_success(['message' => 'Evaluación actualizada.']);
    } else {
        wp_send_json_error(['message' => 'Error al actualizar la evaluación o no tienes permiso.']);
    }
}

add_action('wp_ajax_cpp_eliminar_evaluacion', 'cpp_ajax_eliminar_evaluacion');
function cpp_ajax_eliminar_evaluacion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    if (empty($evaluacion_id)) { wp_send_json_error(['message' => 'ID de evaluación no proporcionado.']); return; }

    if (cpp_eliminar_evaluacion_y_dependencias($evaluacion_id, $user_id)) {
        wp_send_json_success(['message' => 'Evaluación eliminada correctamente.']);
    } else {
        wp_send_json_error(['message' => 'Error al eliminar la evaluación o no tienes permiso.']);
    }
}

add_action('wp_ajax_cpp_guardar_orden_evaluaciones', 'cpp_ajax_guardar_orden_evaluaciones');
function cpp_ajax_guardar_orden_evaluaciones() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $orden_evaluaciones = isset($_POST['orden_evaluaciones']) && is_array($_POST['orden_evaluaciones']) ? $_POST['orden_evaluaciones'] : [];
    $orden_sanitizado = array_map('intval', $orden_evaluaciones);

    if (cpp_actualizar_orden_evaluaciones($user_id, $orden_sanitizado)) {
        wp_send_json_success(['message' => 'Orden guardado.']);
    } else {
        wp_send_json_error(['message' => 'Error al guardar el orden.']);
    }
}

add_action('wp_ajax_cpp_guardar_metodo_calculo', 'cpp_ajax_guardar_metodo_calculo');
function cpp_ajax_guardar_metodo_calculo() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $metodo = isset($_POST['metodo']) ? sanitize_text_field($_POST['metodo']) : '';

    if (empty($evaluacion_id) || !in_array($metodo, ['total', 'ponderada'])) {
        wp_send_json_error(['message' => 'Datos inválidos.']);
        return;
    }

    global $wpdb;
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';

    $owner_check = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_evaluaciones WHERE id = %d", $evaluacion_id));
    if ($owner_check != $user_id) {
        wp_send_json_error(['message' => 'No tienes permiso para modificar esta evaluación.']);
        return;
    }

    $resultado = $wpdb->update(
        $tabla_evaluaciones,
        ['calculo_nota' => $metodo],
        ['id' => $evaluacion_id],
        ['%s'],
        ['%d']
    );

    if ($resultado === false) {
        wp_send_json_error(['message' => 'Error al guardar el método de cálculo.']);
        return;
    }

    // ====================================================================
    // --- INICIO DE LA MODIFICACIÓN ---
    // Si el usuario cambia a modo ponderado, buscamos actividades huérfanas
    // y las asignamos a una categoría por defecto.
    // ====================================================================
    if ($metodo === 'ponderada') {
        cpp_asignar_actividades_huerfanas_a_categoria_por_defecto($evaluacion_id, $user_id);
    }
    // ====================================================================
    // --- FIN DE LA MODIFICACIÓN ---
    // ====================================================================

    wp_send_json_success(['message' => 'Método de cálculo guardado.']);
}

add_action('wp_ajax_cpp_get_final_grade_evals_config', 'cpp_ajax_get_final_grade_evals_config');
function cpp_ajax_get_final_grade_evals_config() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    if (empty($clase_id)) { wp_send_json_error(['message' => 'ID de clase no proporcionado.']); return; }

    // Obtener todas las evaluaciones reales (no la final)
    $todas_las_evaluaciones = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
    // Obtener las evaluaciones que están actualmente seleccionadas para la media
    $evaluaciones_seleccionadas_ids = cpp_get_evaluaciones_para_media($clase_id, $user_id);

    ob_start();
    ?>
    <form id="cpp-form-final-grade-evals">
        <input type="hidden" name="clase_id" value="<?php echo esc_attr($clase_id); ?>">
        <p>Selecciona las evaluaciones que se incluirán en el cálculo de la nota final media.</p>
        <div class="cpp-evaluaciones-toggle-list">
            <?php if (empty($todas_las_evaluaciones)): ?>
                <p>No hay evaluaciones en esta clase para configurar.</p>
            <?php else: ?>
                <?php foreach ($todas_las_evaluaciones as $evaluacion): ?>
                    <?php $is_checked = in_array($evaluacion['id'], $evaluaciones_seleccionadas_ids); ?>
                    <div class="cpp-toggle-item">
                        <span class="cpp-toggle-label-text"><?php echo esc_html($evaluacion['nombre_evaluacion']); ?></span>
                        <label class="cpp-toggle-switch">
                            <input type="checkbox"
                                   name="evaluaciones_seleccionadas[]"
                                   value="<?php echo esc_attr($evaluacion['id']); ?>"
                                   <?php checked($is_checked, true); ?>>
                            <span class="cpp-toggle-slider"></span>
                        </label>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </form>
    <?php
    $html = ob_get_clean();
    wp_send_json_success(['html' => $html]);
}

add_action('wp_ajax_cpp_save_final_grade_evals_config', 'cpp_ajax_save_final_grade_evals_config');
function cpp_ajax_save_final_grade_evals_config() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    $evaluaciones_ids = isset($_POST['evaluaciones_seleccionadas']) && is_array($_POST['evaluaciones_seleccionadas']) ? array_map('intval', $_POST['evaluaciones_seleccionadas']) : [];

    if (empty($clase_id)) {
        wp_send_json_error(['message' => 'ID de clase no proporcionado.']);
        return;
    }

    $resultado = cpp_save_evaluaciones_para_media($clase_id, $user_id, $evaluaciones_ids);

    if ($resultado) {
        wp_send_json_success(['message' => 'Configuración guardada correctamente.']);
    } else {
        wp_send_json_error(['message' => 'Error al guardar la configuración.']);
    }
}