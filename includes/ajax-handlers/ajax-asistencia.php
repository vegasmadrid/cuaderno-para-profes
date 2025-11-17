<?php
// /includes/ajax-handlers/ajax-asistencia.php

defined('ABSPATH') or die('Acceso no permitido');

// --- ACCIONES AJAX PARA ASISTENCIA ---

add_action('wp_ajax_cpp_obtener_alumnos_para_asistencia', 'cpp_ajax_obtener_alumnos_para_asistencia_handler');
function cpp_ajax_obtener_alumnos_para_asistencia_handler() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }

    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    if (empty($clase_id)) {
        wp_send_json_error(['message' => 'ID de clase no proporcionado.']);
        return;
    }
    $alumnos = cpp_obtener_alumnos_clase($clase_id, '', 'apellidos');

    if (is_array($alumnos)) {
        wp_send_json_success(['alumnos' => $alumnos]);
    } else {
        wp_send_json_error(['message' => 'Error al obtener la lista de alumnos.']);
    }
}

add_action('wp_ajax_cpp_guardar_asistencia_clase', 'cpp_ajax_guardar_asistencia_clase');
function cpp_ajax_guardar_asistencia_clase() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }

    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    $fecha_asistencia = isset($_POST['fecha_asistencia']) ? sanitize_text_field($_POST['fecha_asistencia']) : '';
    $asistencias_alumnos_raw = isset($_POST['asistencias']) && is_array($_POST['asistencias']) ? $_POST['asistencias'] : [];

    if (empty($clase_id) || empty($fecha_asistencia) || empty($asistencias_alumnos_raw)) {
        wp_send_json_error(['message' => 'Faltan datos necesarios para guardar la asistencia.']);
        return;
    }
    
    if (!preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $fecha_asistencia)) {
        wp_send_json_error(['message' => 'Formato de fecha inválido.']);
        return;
    }

    $asistencias_alumnos_saneadas = [];
    foreach($asistencias_alumnos_raw as $asistencia_raw) {
        if (isset($asistencia_raw['alumno_id']) && isset($asistencia_raw['estado'])) {
            $asistencia_saneada = [
                'alumno_id' => intval($asistencia_raw['alumno_id']),
                'estado' => sanitize_text_field($asistencia_raw['estado'])
            ];
            if (isset($asistencia_raw['observaciones'])) {
                $asistencia_saneada['observaciones'] = sanitize_textarea_field($asistencia_raw['observaciones']);
            } else {
                $asistencia_saneada['observaciones'] = null;
            }
            $asistencias_alumnos_saneadas[] = $asistencia_saneada;
        }
    }

    if (empty($asistencias_alumnos_saneadas)) {
       wp_send_json_error(['message' => 'No hay datos de asistencia válidos para guardar.']);
        return;
    }

    $resultado = cpp_guardar_asistencia_multiple($user_id, $clase_id, $fecha_asistencia, $asistencias_alumnos_saneadas);

    if ($resultado) {
        wp_send_json_success(['message' => 'Asistencia guardada correctamente.']);
    } else {
        wp_send_json_error(['message' => 'Error al guardar la asistencia.']);
    }
}

add_action('wp_ajax_cpp_obtener_asistencia_clase_fecha', 'cpp_ajax_obtener_asistencia_clase_fecha');
function cpp_ajax_obtener_asistencia_clase_fecha() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }

    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    $fecha_asistencia = isset($_POST['fecha_asistencia']) ? sanitize_text_field($_POST['fecha_asistencia']) : '';

    if (empty($clase_id) || empty($fecha_asistencia)) {
        wp_send_json_error(['message' => 'Faltan datos para obtener la asistencia. (Clase ID: ' . $clase_id . ', Fecha: ' . $fecha_asistencia . ')']);
        return;
    }

    if (!preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $fecha_asistencia)) {
        wp_send_json_error(['message' => 'Formato de fecha inválido: ' . $fecha_asistencia]);
        return;
    }

    if (!function_exists('cpp_obtener_asistencia_por_fecha')) {
        error_log('Error: cpp_obtener_asistencia_por_fecha function does not exist.');
        wp_send_json_error(['message' => 'Error interno del servidor (func_not_exist).']);
        return;
    }

    $asistencia_data = cpp_obtener_asistencia_por_fecha($user_id, $clase_id, $fecha_asistencia);
    wp_send_json_success(['asistencia' => $asistencia_data]);
}