<?php
// /includes/programador/ajax-programador.php

defined('ABSPATH') or die('Acceso no permitido');

// --- Registro de Handlers AJAX ---
add_action('wp_ajax_cpp_get_programador_all_data', 'cpp_ajax_get_programador_all_data');
add_action('wp_ajax_cpp_save_programador_horario', 'cpp_ajax_save_programador_horario');
add_action('wp_ajax_cpp_save_programador_leccion', 'cpp_ajax_save_programador_leccion');
add_action('wp_ajax_cpp_delete_programador_leccion', 'cpp_ajax_delete_programador_leccion');
add_action('wp_ajax_cpp_save_programador_evento', 'cpp_ajax_save_programador_evento');
add_action('wp_ajax_cpp_delete_programador_evento', 'cpp_ajax_delete_programador_evento');
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

function cpp_ajax_save_programador_leccion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $leccion_data = isset($_POST['leccion']) ? json_decode(stripslashes($_POST['leccion']), true) : null;
    if (empty($leccion_data)) { wp_send_json_error(['message' => 'Datos de lección no válidos.']); return; }
    $leccion_data['user_id'] = get_current_user_id();
    $result = cpp_programador_save_leccion($leccion_data);
    if ($result) { wp_send_json_success(['message' => 'Lección guardada.', 'leccion_id' => $result]); }
    else { wp_send_json_error(['message' => 'Error al guardar la lección.']); }
}

function cpp_ajax_delete_programador_leccion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $leccion_id = isset($_POST['leccion_id']) ? intval($_POST['leccion_id']) : 0;
    if (empty($leccion_id)) { wp_send_json_error(['message' => 'ID de lección no proporcionado.']); return; }
    $user_id = get_current_user_id();
    if (cpp_programador_delete_leccion($leccion_id, $user_id)) { wp_send_json_success(['message' => 'Lección eliminada.']); }
    else { wp_send_json_error(['message' => 'Error al eliminar la lección.']); }
}

function cpp_ajax_save_programador_evento() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $evento_data = isset($_POST['evento']) ? json_decode(stripslashes($_POST['evento']), true) : null;
    if (empty($evento_data)) { wp_send_json_error(['message' => 'Datos de evento no válidos.']); return; }
    $evento_data['user_id'] = get_current_user_id();
    if (cpp_programador_save_evento($evento_data)) { wp_send_json_success(['message' => 'Evento guardado.']); }
    else { wp_send_json_error(['message' => 'Error al guardar el evento.']); }
}

function cpp_ajax_delete_programador_evento() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $evento_id = isset($_POST['evento_id']) ? intval($_POST['evento_id']) : 0;
    if (empty($evento_id)) { wp_send_json_error(['message' => 'ID de evento no proporcionado.']); return; }
    $user_id = get_current_user_id();
    if (cpp_programador_delete_evento($evento_id, $user_id)) { wp_send_json_success(['message' => 'Evento eliminado.']); }
    else { wp_send_json_error(['message' => 'Error al eliminar el evento.']); }
}

function cpp_ajax_create_programador_example_data() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    if (cpp_programador_create_example_data($user_id)) {
        wp_send_json_success(['message' => 'Datos de ejemplo creados correctamente.']);
    } else {
        wp_send_json_error(['message' => 'No se pudieron crear los datos de ejemplo. Asegúrate de tener al menos una clase creada en el cuaderno.']);
    }
}
