<?php
// /includes/programador/ajax-programador.php

defined('ABSPATH') or die('Acceso no permitido');

// --- Registro de Handlers AJAX ---
add_action('wp_ajax_cpp_get_programador_all_data', 'cpp_ajax_get_programador_all_data');
add_action('wp_ajax_cpp_save_programador_horario', 'cpp_ajax_save_programador_horario');
add_action('wp_ajax_cpp_save_programador_sesion', 'cpp_ajax_save_programador_sesion');
add_action('wp_ajax_cpp_add_inline_sesion', 'cpp_ajax_add_inline_sesion');
add_action('wp_ajax_cpp_delete_programador_sesion', 'cpp_ajax_delete_programador_sesion');
add_action('wp_ajax_cpp_save_sesiones_order', 'cpp_ajax_save_sesiones_order');
add_action('wp_ajax_cpp_save_start_date', 'cpp_ajax_save_start_date');
add_action('wp_ajax_cpp_create_programador_example_data', 'cpp_ajax_create_programador_example_data');
add_action('wp_ajax_cpp_save_programador_config', 'cpp_ajax_save_programador_config');

// Handlers para Actividades
add_action('wp_ajax_cpp_get_programador_actividades', 'cpp_ajax_get_programador_actividades');
add_action('wp_ajax_cpp_save_programador_actividad', 'cpp_ajax_save_programador_actividad');
add_action('wp_ajax_cpp_delete_programador_actividad', 'cpp_ajax_delete_programador_actividad');
add_action('wp_ajax_cpp_save_programador_actividades_order', 'cpp_ajax_save_programador_actividades_order');
add_action('wp_ajax_cpp_toggle_actividad_evaluable', 'cpp_ajax_toggle_actividad_evaluable');


// --- Implementación de Handlers ---

function cpp_ajax_save_programador_config() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $user_id = get_current_user_id();
    $calendar_config = isset($_POST['calendar_config']) ? json_decode(stripslashes($_POST['calendar_config']), true) : null;

    if (is_null($calendar_config)) {
        wp_send_json_error(['message' => 'Datos de configuración no válidos.']);
        return;
    }

    // Aquí podrías añadir validación extra para el formato de calendar_config si es necesario

    cpp_programador_save_config_value($user_id, 'calendar_config', $calendar_config);
    wp_send_json_success(['message' => 'Configuración del calendario guardada correctamente.']);
}

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

function cpp_ajax_add_inline_sesion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $sesion_data = isset($_POST['sesion']) ? json_decode(stripslashes($_POST['sesion']), true) : null;
    $after_sesion_id = isset($_POST['after_sesion_id']) ? intval($_POST['after_sesion_id']) : 0;

    if (empty($sesion_data) || !isset($sesion_data['evaluacion_id']) || empty($after_sesion_id)) {
        wp_send_json_error(['message' => 'Datos de sesión no válidos.']);
        return;
    }

    $sesion_data['user_id'] = $user_id;

    $result = cpp_programador_add_sesion_inline($sesion_data, $after_sesion_id, $user_id);

    if ($result) {
        wp_send_json_success(['message' => 'Sesión añadida.']);
    } else {
        wp_send_json_error(['message' => 'Error al añadir la sesión.']);
    }
}

// --- Handlers de Actividades ---

function cpp_ajax_get_programador_actividades() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $sesion_id = isset($_POST['sesion_id']) ? intval($_POST['sesion_id']) : 0;
    if (empty($sesion_id)) { wp_send_json_error(['message' => 'ID de sesión no válido.']); return; }

    $actividades = cpp_programador_get_actividades_by_sesion_id($sesion_id, $user_id);

    if ($actividades === false) {
        wp_send_json_error(['message' => 'No tienes permiso para ver estas actividades.']);
    } else {
        wp_send_json_success($actividades);
    }
}

function cpp_ajax_save_programador_actividad() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $actividad_data = isset($_POST['actividad']) ? json_decode(stripslashes($_POST['actividad']), true) : null;
    if (empty($actividad_data)) { wp_send_json_error(['message' => 'Datos de actividad no válidos.']); return; }

    $result = cpp_programador_save_actividad($actividad_data, $user_id);

    if ($result) {
        global $wpdb;
        $tabla_actividades = $wpdb->prefix . 'cpp_programador_actividades';
        $actividad_guardada = $wpdb->get_row($wpdb->prepare("SELECT * FROM $tabla_actividades WHERE id = %d", $result), ARRAY_A);
        wp_send_json_success(['message' => 'Actividad guardada.', 'actividad' => $actividad_guardada]);
    } else {
        wp_send_json_error(['message' => 'Error al guardar la actividad.']);
    }
}

function cpp_ajax_delete_programador_actividad() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $actividad_id = isset($_POST['actividad_id']) ? intval($_POST['actividad_id']) : 0;
    if (empty($actividad_id)) { wp_send_json_error(['message' => 'ID de actividad no válido.']); return; }

    if (cpp_programador_delete_actividad($actividad_id, $user_id)) {
        wp_send_json_success(['message' => 'Actividad eliminada.']);
    } else {
        wp_send_json_error(['message' => 'Error al eliminar la actividad.']);
    }
}

function cpp_ajax_save_programador_actividades_order() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $sesion_id = isset($_POST['sesion_id']) ? intval($_POST['sesion_id']) : 0;
    $orden = isset($_POST['orden']) ? json_decode(stripslashes($_POST['orden'])) : [];
    if (empty($sesion_id) || !is_array($orden)) { wp_send_json_error(['message' => 'Faltan datos para reordenar.']); return; }

    if (cpp_programador_save_actividades_order($sesion_id, $orden, $user_id)) {
        wp_send_json_success(['message' => 'Orden guardado.']);
    } else {
        wp_send_json_error(['message' => 'Error al guardar el orden.']);
    }
}

function cpp_ajax_toggle_actividad_evaluable() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $actividad_id = isset($_POST['actividad_id']) ? intval($_POST['actividad_id']) : 0;
    $es_evaluable = isset($_POST['es_evaluable']) ? intval($_POST['es_evaluable']) : 0;
    $categoria_id = isset($_POST['categoria_id']) ? intval($_POST['categoria_id']) : null;

    if (empty($actividad_id)) {
        wp_send_json_error(['message' => 'ID de actividad no válido.']);
        return;
    }

    global $wpdb;
    $tabla_programador_actividades = $wpdb->prefix . 'cpp_programador_actividades';
    $actividad_prog = $wpdb->get_row($wpdb->prepare("SELECT * FROM $tabla_programador_actividades WHERE id = %d", $actividad_id));

    if (!$actividad_prog) {
        wp_send_json_error(['message' => 'Actividad no encontrada.']);
        return;
    }

    // Security Check
    $sesion_owner_id = cpp_programador_get_sesion_owner($actividad_prog->sesion_id);
    if ($sesion_owner_id != $user_id) {
        wp_send_json_error(['message' => 'Permiso denegado.']);
        return;
    }

    if ($es_evaluable) {
        // --- Marcar como EVALUABLE ---
        $fecha_actividad = cpp_programador_calculate_activity_date($actividad_prog->sesion_id, $user_id);
        if (!$fecha_actividad) {
            wp_send_json_error(['message' => 'No se pudo calcular la fecha. Asegúrate de que la evaluación tenga una fecha de inicio y la clase tenga horario asignado.']);
            return;
        }

        $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
        $sesion_info = $wpdb->get_row($wpdb->prepare("SELECT clase_id, evaluacion_id FROM $tabla_sesiones WHERE id = %d", $actividad_prog->sesion_id));

        if (!$categoria_id) {
            $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
            $categoria_id = $wpdb->get_var($wpdb->prepare("SELECT id FROM $tabla_categorias WHERE evaluacion_id = %d ORDER BY id ASC LIMIT 1", $sesion_info->evaluacion_id));
            if (!$categoria_id) {
                wp_send_json_error(['message' => 'No se encontró una categoría por defecto para esta evaluación.']);
                return;
            }
        }

        $datos_actividad_calificable = [
            'id' => $actividad_prog->actividad_calificable_id, // Puede ser null si es nueva
            'clase_id' => $sesion_info->clase_id,
            'evaluacion_id' => $sesion_info->evaluacion_id,
            'categoria_id' => $categoria_id,
            'nombre_actividad' => $actividad_prog->titulo,
            'fecha_actividad' => $fecha_actividad,
            'user_id' => $user_id,
        ];

        $actividad_calificable_id = cpp_guardar_actividad_evaluable($datos_actividad_calificable);

        if (!$actividad_calificable_id) {
            wp_send_json_error(['message' => 'Error al crear la actividad en el cuaderno.']);
            return;
        }

        // Actualizar la actividad del programador con el ID de la actividad calificable
        $update_data = [
            'es_evaluable' => 1,
            'actividad_calificable_id' => $actividad_calificable_id,
        ];
        $wpdb->update($tabla_programador_actividades, $update_data, ['id' => $actividad_id]);

    } else {
        // --- Marcar como NO EVALUABLE ---
        $actividad_calificable_id = $actividad_prog->actividad_calificable_id;
        if ($actividad_calificable_id) {
            cpp_eliminar_actividad_y_calificaciones($actividad_calificable_id, $user_id);
        }

        // Actualizar la actividad del programador
        $update_data = [
            'es_evaluable' => 0,
            'actividad_calificable_id' => null,
        ];
        $wpdb->update($tabla_programador_actividades, $update_data, ['id' => $actividad_id]);
    }

    $actividad_actualizada = $wpdb->get_row($wpdb->prepare("SELECT * FROM $tabla_programador_actividades WHERE id = %d", $actividad_id), ARRAY_A);

    if ($actividad_actualizada) {
        // FIX: Devolver la categoría ID para que el frontend pueda renderizar el selector correctamente.
        // Si se está marcando como evaluable, $categoria_id tendrá un valor. Si no, será null, lo cual es correcto.
        $actividad_actualizada['categoria_id'] = $categoria_id;
    }

    wp_send_json_success(['message' => 'Estado actualizado.', 'actividad' => $actividad_actualizada]);
}


function cpp_programador_calculate_activity_date($sesion_id, $user_id) {
    global $wpdb;
    $all_data = cpp_programador_get_all_data($user_id);
    $sesion_target = null;
    $sesiones_en_evaluacion = [];

    // Encontrar la sesión objetivo y su evaluación
    foreach ($all_data['sesiones'] as $s) {
        if ($s->id == $sesion_id) {
            $sesion_target = $s;
            break;
        }
    }

    if (!$sesion_target) { return null; }

    // Filtrar sesiones de la misma evaluación y clase
    foreach ($all_data['sesiones'] as $s) {
        if ($s->clase_id == $sesion_target->clase_id && $s->evaluacion_id == $sesion_target->evaluacion_id) {
            $sesiones_en_evaluacion[] = $s;
        }
    }

    // Obtener la configuración del calendario y el horario
    $horario = $all_data['config']['horario'];
    $calendar_config = $all_data['config']['calendar_config'];
    $day_mapping = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    // Encontrar la fecha de inicio de la evaluación
    $start_date_str = null;
    foreach ($all_data['clases'] as $clase) {
        if ($clase['id'] == $sesion_target->clase_id) {
            foreach ($clase['evaluaciones'] as $eval) {
                if ($eval['id'] == $sesion_target->evaluacion_id) {
                    $start_date_str = $eval['start_date'];
                    break 2;
                }
            }
        }
    }

    if (!$start_date_str) { return null; }

    // Comprobar que la clase tiene al menos un hueco en el horario
    $clase_tiene_horario = false;
    foreach ($horario as $day => $slots) {
        foreach ($slots as $slot => $clase_id) {
            if ($clase_id == $sesion_target->clase_id) {
                $clase_tiene_horario = true;
                break 2;
            }
        }
    }
    if (!$clase_tiene_horario) { return null; }

    $current_date = new DateTime($start_date_str . 'T12:00:00Z');
    $session_index = 0;
    $safety_counter = 0;
    $max_iterations = 365 * 5; // 5 años de margen

    while ($session_index < count($sesiones_en_evaluacion) && $safety_counter < $max_iterations) {
        $day_key = $day_mapping[$current_date->format('w')];
        $ymd = $current_date->format('Y-m-d');

        $is_working_day = in_array($day_key, $calendar_config['working_days']);
        $is_holiday = in_array($ymd, $calendar_config['holidays']);
        $is_vacation = false;
        foreach ($calendar_config['vacations'] as $v) {
            if ($ymd >= $v['start'] && $ymd <= $v['end']) {
                $is_vacation = true;
                break;
            }
        }

        if ($is_working_day && !$is_holiday && !$is_vacation && isset($horario[$day_key])) {
            $slots_del_dia = $horario[$day_key];
            ksort($slots_del_dia); // Ordenar por hora

            foreach ($slots_del_dia as $slot => $clase_id_en_slot) {
                if ($clase_id_en_slot == $sesion_target->clase_id) {
                    if ($sesiones_en_evaluacion[$session_index]->id == $sesion_id) {
                        return $ymd; // Fecha encontrada
                    }
                    $session_index++;
                    if ($session_index >= count($sesiones_en_evaluacion)) {
                        break;
                    }
                }
            }
        }
        $current_date->add(new DateInterval('P1D'));
        $safety_counter++;
    }

    return null; // No se encontró la fecha
}
