<?php
// /includes/ajax-handlers/ajax-clases.php

defined('ABSPATH') or die('Acceso no permitido');

// --- ACCIONES AJAX PARA CLASES ---

add_action('wp_ajax_cpp_obtener_datos_clase_completa', 'cpp_ajax_obtener_datos_clase_completa');
function cpp_ajax_obtener_datos_clase_completa() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    if (empty($clase_id)) { wp_send_json_error(['message' => 'ID de clase no proporcionado.']); return; }
    $clase_data = cpp_obtener_clase_completa_por_id($clase_id, $user_id);
    if ($clase_data) {
        if (isset($clase_data['base_nota_final'])) {
            $clase_data['base_nota_final'] = number_format(floatval($clase_data['base_nota_final']), 2, '.', '');
        }
        if (isset($clase_data['nota_aprobado'])) {
            $clase_data['nota_aprobado'] = number_format(floatval($clase_data['nota_aprobado']), 2, '.', '');
        }
        wp_send_json_success(['clase' => $clase_data]);
    } else {
        wp_send_json_error(['message' => 'Clase no encontrada o no tienes permiso.']);
    }
}

add_action('wp_ajax_cpp_crear_clase', 'cpp_ajax_crear_clase');
function cpp_ajax_crear_clase() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado']); return; }
    
    $user_id = get_current_user_id();
    $clase_id_editar = isset($_POST['clase_id_editar']) ? intval($_POST['clase_id_editar']) : 0;
    $nombre_clase = isset($_POST['nombre_clase']) ? sanitize_text_field(trim($_POST['nombre_clase'])) : '';
    $nombre_clase_limitado = substr($nombre_clase, 0, 100);
    $datos = [
        'nombre'              => $nombre_clase_limitado,
        'color'               => isset($_POST['color_clase']) ? sanitize_hex_color($_POST['color_clase']) : '#2962FF',
        'base_nota_final'     => isset($_POST['base_nota_final_clase']) ? $_POST['base_nota_final_clase'] : '100',
        'nota_aprobado'       => isset($_POST['nota_aprobado_clase']) ? $_POST['nota_aprobado_clase'] : '50'
    ];
    if (empty($datos['nombre'])) {
        wp_send_json_error(['message' => 'El nombre de la clase es obligatorio.']);
        return;
    }
    $base_nota_sanitizada = str_replace(',', '.', $datos['base_nota_final']);
    if (!is_numeric($base_nota_sanitizada) || floatval($base_nota_sanitizada) <= 0) {
        wp_send_json_error(['message' => 'La base de la nota debe ser un número positivo.']);
        return;
    }
    $datos['base_nota_final'] = floatval($base_nota_sanitizada);

    $nota_aprobado_sanitizada = str_replace(',', '.', $datos['nota_aprobado']);
    if (!is_numeric($nota_aprobado_sanitizada) || floatval($nota_aprobado_sanitizada) < 0) {
        wp_send_json_error(['message' => 'La nota para aprobar debe ser un número positivo.']);
        return;
    }
    $datos['nota_aprobado'] = floatval($nota_aprobado_sanitizada);

    if ($datos['nota_aprobado'] >= $datos['base_nota_final']) {
        wp_send_json_error(['message' => 'La nota para aprobar debe ser menor que la base de la nota final.']);
        return;
    }

    if ($clase_id_editar > 0) {
        $resultado = cpp_actualizar_clase_completa($clase_id_editar, $user_id, $datos);
        if ($resultado !== false) {
            wp_send_json_success(['message' => 'Clase actualizada correctamente.']);
        } else {
            global $wpdb;
            wp_send_json_error(['message' => 'Error al actualizar la clase.', 'debug_db_error' => $wpdb->last_error, 'debug_data_sent' => $datos]);
        }
    } else {
        $nueva_clase_id = cpp_guardar_clase($user_id, $datos);
        if ($nueva_clase_id) {
            $nueva_clase_data = cpp_obtener_clase_completa_por_id($nueva_clase_id, $user_id);
            wp_send_json_success(['message' => 'Clase guardada correctamente.', 'clase' => $nueva_clase_data]);
        } else {
            global $wpdb;
            wp_send_json_error(['message' => 'Error al guardar la clase.', 'debug_db_error' => $wpdb->last_error, 'debug_data_sent' => $datos]);
        }
    }
}

add_action('wp_ajax_cpp_eliminar_clase', 'cpp_ajax_eliminar_clase');
function cpp_ajax_eliminar_clase() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    $user_id = get_current_user_id();
    if (empty($clase_id)) { wp_send_json_error(['message' => 'ID de clase no proporcionado.']); return; }
    $resultado = cpp_eliminar_clase_y_alumnos($clase_id, $user_id);
    if (false === $resultado) { wp_send_json_error(['message' => 'Error al eliminar la clase o no tienes permiso.']); }
    elseif (0 === $resultado) { wp_send_json_error(['message' => 'No se encontró la clase para eliminar o ya fue eliminada.']); }
    else { wp_send_json_success(['message' => 'Clase eliminada. La página se recargará.']); }
}

add_action('wp_ajax_cpp_guardar_orden_clases', 'cpp_ajax_guardar_orden_clases');
function cpp_ajax_guardar_orden_clases() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $user_id = get_current_user_id();
    $orden_clases_raw = isset($_POST['orden_clases']) ? $_POST['orden_clases'] : [];

    $clases_ids_ordenadas = [];
    if (is_array($orden_clases_raw)) {
        foreach($orden_clases_raw as $clase_id_item) {
            $clases_ids_ordenadas[] = intval($clase_id_item);
        }
    }
    
    $resultado = cpp_actualizar_orden_clases($user_id, $clases_ids_ordenadas);

    if ($resultado) {
        wp_send_json_success(['message' => 'Orden de las clases guardado correctamente.']);
    } else {
        wp_send_json_error(['message' => 'Error al guardar el orden de las clases.']);
    }
}

add_action('wp_ajax_cpp_crear_clase_ejemplo', 'cpp_ajax_crear_clase_ejemplo');
function cpp_ajax_crear_clase_ejemplo() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $user_id = get_current_user_id();
    $nombre_clase = isset($_POST['nombre_clase']) ? sanitize_text_field(trim($_POST['nombre_clase'])) : 'Clase Ejemplo';
    if (empty($nombre_clase)) {
        $nombre_clase = 'Clase Ejemplo';
    }
    $color_clase = isset($_POST['color_clase']) ? sanitize_hex_color($_POST['color_clase']) : '#cd18be';

    $nueva_clase_id = cpp_crear_clase_de_ejemplo_completa($user_id, $nombre_clase, $color_clase);
    if ($nueva_clase_id) {
        $nueva_clase_data = cpp_obtener_clase_completa_por_id($nueva_clase_id, $user_id);
        wp_send_json_success(['message' => 'Clase de ejemplo creada correctamente.', 'clase' => $nueva_clase_data]);
    } else {
        wp_send_json_error(['message' => 'Error al crear la clase de ejemplo.']);
    }
}

add_action('wp_ajax_cpp_guardar_orden_alumnos', 'cpp_ajax_guardar_orden_alumnos');
function cpp_ajax_guardar_orden_alumnos() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }

    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    $orden = isset($_POST['orden']) ? sanitize_text_field($_POST['orden']) : '';

    if (empty($clase_id) || !in_array($orden, ['nombre', 'apellidos'])) {
        wp_send_json_error(['message' => 'Datos no válidos proporcionados.']);
        return;
    }

    $resultado = cpp_actualizar_clase_completa($clase_id, $user_id, ['orden_alumnos_predeterminado' => $orden]);

    $debug_msg = "DEBUG GUARDADO:\n";
    $debug_msg .= "1. Intentando guardar '{$orden}' para la clase_id {$clase_id}.\n";
    $debug_msg .= "2. Resultado de la actualización (filas afectadas): " . var_export($resultado, true) . "\n";

    if ($resultado !== false) {
        wp_send_json_success([
            'message' => 'Preferencia de orden guardada.',
            'debug_save_message' => $debug_msg
        ]);
    } else {
        global $wpdb;
        $debug_msg .= "3. Último error de la BD: " . $wpdb->last_error;
        wp_send_json_error([
            'message' => 'Error al guardar la preferencia.',
            'debug_save_message' => $debug_msg
        ]);
    }
}
