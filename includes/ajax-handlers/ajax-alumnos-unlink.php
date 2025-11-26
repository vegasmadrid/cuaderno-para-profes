<?php
// /includes/ajax-handlers/ajax-alumnos-unlink.php

defined('ABSPATH') or die('Acceso no permitido');

// Dependencias directas
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-alumnos.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-clases.php';
require_once CPP_PLUGIN_DIR . 'includes/utils.php';

add_action('wp_ajax_cpp_unlink_alumno_from_clase', 'cpp_ajax_unlink_alumno_from_clase_handler');

function cpp_ajax_unlink_alumno_from_clase_handler() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');

    $user_id = get_current_user_id();
    $alumno_id = isset($_POST['alumno_id']) ? intval($_POST['alumno_id']) : 0;
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;

    if (empty($user_id) || empty($alumno_id) || empty($clase_id)) {
        wp_send_json_error(['message' => 'Faltan datos requeridos.']);
        return;
    }

    // Comprobación de seguridad: ¿Es el usuario propietario de la clase?
    if (!cpp_es_propietario_clase($clase_id, $user_id)) {
        wp_send_json_error(['message' => 'No tienes permiso sobre esta clase.']);
        return;
    }

    // Comprobación de seguridad: ¿Es el usuario propietario del alumno?
    // Aunque la comprobación de la clase ya es una buena medida, esta añade una capa extra.
    if (!cpp_es_propietario_alumno($user_id, $alumno_id)) {
        wp_send_json_error(['message' => 'No tienes permiso sobre este alumno.']);
        return;
    }

    $result = cpp_desvincular_alumno_de_clase($alumno_id, $clase_id, $user_id);

    if ($result) {
        wp_send_json_success(['message' => 'Alumno quitado de la clase correctamente.']);
    } else {
        // El error puede ser por un fallo de la BD o porque la fila no existía.
        wp_send_json_error(['message' => 'No se pudo quitar al alumno de la clase. Es posible que ya haya sido eliminado.']);
    }
}
