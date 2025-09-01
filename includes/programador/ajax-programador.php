<?php
// /includes/programador/ajax-programador.php

defined('ABSPATH') or die('Acceso no permitido');

// --- Registro de Handlers AJAX ---
add_action('wp_ajax_cpp_get_programador_all_data', 'cpp_ajax_get_programador_all_data');
add_action('wp_ajax_cpp_save_programador_horario', 'cpp_ajax_save_programador_horario');
add_action('wp_ajax_cpp_save_programador_sesion', 'cpp_ajax_save_programador_sesion');
add_action('wp_ajax_cpp_delete_programador_sesion', 'cpp_ajax_delete_programador_sesion');
add_action('wp_ajax_cpp_save_sesiones_order', 'cpp_ajax_save_sesiones_order');
add_action('wp_ajax_cpp_save_start_date', 'cpp_ajax_save_start_date');
add_action('wp_ajax_cpp_create_programador_example_data', 'cpp_ajax_create_programador_example_data');

// --- Implementación de Handlers ---

function cpp_ajax_get_programador_all_data() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $data = cpp_programador_get_all_data($user_id);
    wp_send_json_success($data);
}

function cpp_ajax_save_programador_horario() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $horario = isset($_POST['horario']) ? json_decode(stripslashes($_POST['horario']), true) : null;
    $time_slots = isset($_POST['time_slots']) ? json_decode(stripslashes($_POST['time_slots']), true) : null;
    if (is_null($horario) || is_null($time_slots)) { wp_send_json_error(['message' => 'Datos de horario no válidos.']); return; }
    cpp_programador_save_config_value($user_id, 'horario', $horario);
    cpp_programador_save_config_value($user_id, 'time_slots', $time_slots);
    wp_send_json_success(['message' => 'Horario guardado correctamente.']);
}

function cpp_ajax_save_programador_sesion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $sesion_data = isset($_POST['sesion']) ? json_decode(stripslashes($_POST['sesion']), true) : null;
    if (empty($sesion_data) || !isset($sesion_data['evaluacion_id'])) { wp_send_json_error(['message' => 'Datos de sesión no válidos.']); return; }
    $sesion_data['user_id'] = get_current_user_id();
    $result = cpp_programador_save_sesion($sesion_data);
    if ($result) { wp_send_json_success(['message' => 'Sesión guardada.', 'sesion_id' => $result]); }
    else { wp_send_json_error(['message' => 'Error al guardar la sesión.']); }
}

function cpp_ajax_delete_programador_sesion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $sesion_id = isset($_POST['sesion_id']) ? intval($_POST['sesion_id']) : 0;
    if (empty($sesion_id)) { wp_send_json_error(['message' => 'ID de sesión no proporcionado.']); return; }
    $user_id = get_current_user_id();
    if (cpp_programador_delete_sesion($sesion_id, $user_id)) { wp_send_json_success(['message' => 'Sesión eliminada.']); }
    else { wp_send_json_error(['message' => 'Error al eliminar la sesión.']); }
}

function cpp_ajax_save_sesiones_order() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $orden = isset($_POST['orden']) ? json_decode(stripslashes($_POST['orden'])) : [];
    if (empty($clase_id) || empty($evaluacion_id) || !is_array($orden)) { wp_send_json_error(['message' => 'Faltan datos para reordenar.']); return; }
    if (cpp_programador_save_sesiones_order($user_id, $clase_id, $evaluacion_id, $orden)) { wp_send_json_success(['message' => 'Orden guardado.']); }
    else { wp_send_json_error(['message' => 'Error al guardar el orden.']); }
}

function cpp_ajax_save_start_date() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $start_date = isset($_POST['start_date']) ? sanitize_text_field($_POST['start_date']) : null; // Aceptar null si está vacío

    if (empty($evaluacion_id)) {
        wp_send_json_error(['message' => 'Falta ID de evaluación.']);
        return;
    }

    // Si la fecha está vacía, la guardamos como NULL en la BBDD
    if (cpp_programador_save_start_date($user_id, $evaluacion_id, $start_date)) {
        wp_send_json_success(['message' => 'Fecha de inicio guardada.']);
    }
    else { wp_send_json_error(['message' => 'Error al guardar la fecha.']); }
}

function cpp_ajax_create_programador_example_data() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    if (cpp_programador_create_example_data($user_id)) { wp_send_json_success(['message' => 'Datos de ejemplo creados.']); }
    else { wp_send_json_error(['message' => 'No se pudieron crear los datos. Asegúrate de tener clases creadas.']); }
}
