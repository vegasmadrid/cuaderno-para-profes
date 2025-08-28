<?php
// /includes/programador/ajax-programador.php

defined('ABSPATH') or die('Acceso no permitido');

// --- REGISTRO DE AJAX HANDLERS ---
add_action('wp_ajax_cpp_get_programador_data', 'cpp_ajax_get_programador_data');
add_action('wp_ajax_cpp_save_programador_config', 'cpp_ajax_save_programador_config');
add_action('wp_ajax_cpp_save_programador_sesion', 'cpp_ajax_save_programador_sesion');
add_action('wp_ajax_cpp_delete_programador_sesion', 'cpp_ajax_delete_programador_sesion');
add_action('wp_ajax_cpp_reorder_programador_sesiones', 'cpp_ajax_reorder_programador_sesiones');

/**
 * Handler para obtener todos los datos iniciales del programador.
 */
function cpp_ajax_get_programador_data() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $user_id = get_current_user_id();

    $config = cpp_programador_get_config($user_id);
    $sesiones = cpp_programador_get_sesiones($user_id);

    wp_send_json_success([
        'config' => $config,
        'sesiones' => $sesiones
    ]);
}

/**
 * Handler para guardar la configuración del programador.
 */
function cpp_ajax_save_programador_config() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $user_id = get_current_user_id();

    // El frontend debe enviar un objeto JSON `config`
    $config_data = isset($_POST['config']) ? json_decode(stripslashes($_POST['config']), true) : null;

    if (empty($config_data) || !is_array($config_data)) {
        wp_send_json_error(['message' => 'Datos de configuración no válidos.']);
        return;
    }

    $allowed_keys = ['dias_laborables', 'dias_no_laborables', 'horario'];

    foreach($config_data as $clave => $valor) {
        if (in_array($clave, $allowed_keys)) {
            // Aquí se podría añadir sanitización específica para cada clave
            cpp_programador_save_config($user_id, $clave, $valor);
        }
    }

    wp_send_json_success(['message' => 'Configuración guardada correctamente.']);
}

/**
 * Handler para guardar una sesión de trabajo.
 */
function cpp_ajax_save_programador_sesion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $user_id = get_current_user_id();

    $sesion_data = isset($_POST['sesion']) ? json_decode(stripslashes($_POST['sesion']), true) : null;

    if (empty($sesion_data) || !is_array($sesion_data)) {
        wp_send_json_error(['message' => 'Datos de sesión no válidos.']);
        return;
    }

    // Asegurarnos de que la sesión pertenece al usuario actual
    $sesion_data['user_id'] = $user_id;

    $id_guardado = cpp_programador_save_sesion($sesion_data);

    if ($id_guardado) {
        wp_send_json_success(['message' => 'Sesión guardada.', 'sesion_id' => $id_guardado]);
    } else {
        wp_send_json_error(['message' => 'Error al guardar la sesión.']);
    }
}

/**
 * Handler para eliminar una sesión de trabajo.
 */
function cpp_ajax_delete_programador_sesion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $user_id = get_current_user_id();
    $sesion_id = isset($_POST['sesion_id']) ? intval($_POST['sesion_id']) : 0;

    if (empty($sesion_id)) {
        wp_send_json_error(['message' => 'ID de sesión no proporcionado.']);
        return;
    }

    if (cpp_programador_delete_sesion($sesion_id, $user_id)) {
        wp_send_json_success(['message' => 'Sesión eliminada.']);
    } else {
        wp_send_json_error(['message' => 'Error al eliminar la sesión o no tienes permiso.']);
    }
}

/**
 * Handler para reordenar las sesiones de trabajo.
 */
function cpp_ajax_reorder_programador_sesiones() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $user_id = get_current_user_id();
    $orden = isset($_POST['orden']) ? json_decode(stripslashes($_POST['orden']), true) : [];

    if (empty($orden) || !is_array($orden)) {
        wp_send_json_error(['message' => 'Datos de orden no válidos.']);
        return;
    }

    if (cpp_programador_reorder_sesiones($user_id, $orden)) {
        wp_send_json_success(['message' => 'Orden actualizado.']);
    } else {
        wp_send_json_error(['message' => 'Error al actualizar el orden.']);
    }
}
