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
add_action('wp_ajax_cpp_check_schedule_conflict', 'cpp_ajax_check_schedule_conflict_handler');
add_action('wp_ajax_cpp_copy_multiple_sesiones', 'cpp_ajax_copy_sessions');
add_action('wp_ajax_cpp_delete_multiple_sesiones', 'cpp_ajax_delete_multiple_sesiones');
add_action('wp_ajax_cpp_get_fechas_evaluacion', 'cpp_ajax_get_fechas_evaluacion');
add_action('wp_ajax_cpp_toggle_sesion_fijada', 'cpp_ajax_toggle_sesion_fijada');


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
    cpp_clear_programador_cache($user_id);
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
    cpp_clear_programador_cache($user_id);
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
    cpp_clear_programador_cache(get_current_user_id());
    $sesion_data = isset($_POST['sesion']) ? json_decode(stripslashes($_POST['sesion']), true) : null;
    if (empty($sesion_data) || !isset($sesion_data['evaluacion_id'])) { wp_send_json_error(['message' => 'Datos de sesión no válidos.']); return; }

    // --- AÑADIDO: Validar el simbolo_id ---
    if (isset($sesion_data['simbolo_id'])) {
        $default_symbols = cpp_get_default_programador_simbolos();
        if (!array_key_exists($sesion_data['simbolo_id'], $default_symbols)) {
            // Si el símbolo no es válido, se establece a null para evitar datos corruptos.
            $sesion_data['simbolo_id'] = null;
        }
    }

    $sesion_data['user_id'] = get_current_user_id();
    $result = cpp_programador_save_sesion($sesion_data);
    if ($result) {
        // --- FIX: Devolver la sesión completa en lugar de recargar todo ---
        $sesion_completa = cpp_programador_get_sesion_by_id($result, get_current_user_id());
        if ($sesion_completa) {
            wp_send_json_success(['message' => 'Sesión guardada.', 'sesion' => $sesion_completa]);
        } else {
            // Fallback por si algo falla al recuperar la sesión
            wp_send_json_success(['message' => 'Sesión guardada, pero se necesita recargar.', 'sesion_id' => $result, 'needs_reload' => true]);
        }
    } else { wp_send_json_error(['message' => 'Error al guardar la sesión.']); }
}

function cpp_ajax_delete_programador_sesion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    cpp_clear_programador_cache(get_current_user_id());
    $sesion_id = isset($_POST['sesion_id']) ? intval($_POST['sesion_id']) : 0;
    $delete_activities = isset($_POST['delete_activities']) && $_POST['delete_activities'] === 'true'; // El 'true' viene como string
    if (empty($sesion_id)) { wp_send_json_error(['message' => 'ID de sesión no proporcionado.']); return; }
    $user_id = get_current_user_id();

    // --- AÑADIDO: Obtener info de la sesión ANTES de borrarla ---
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    $sesion_info = $wpdb->get_row($wpdb->prepare("SELECT clase_id, evaluacion_id FROM $tabla_sesiones WHERE id = %d AND user_id = %d", $sesion_id, $user_id));

    if (cpp_programador_delete_sesion($sesion_id, $user_id, $delete_activities)) {
        wp_send_json_success(['message' => 'Sesión eliminada.', 'needs_gradebook_reload' => true]);
    } else {
        wp_send_json_error(['message' => 'Error al eliminar la sesión.']);
    }
}

function cpp_ajax_save_sesiones_order() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    cpp_clear_programador_cache($user_id);
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $orden = isset($_POST['orden']) ? json_decode(stripslashes($_POST['orden'])) : [];
    if (empty($clase_id) || empty($evaluacion_id) || !is_array($orden)) { wp_send_json_error(['message' => 'Faltan datos para reordenar.']); return; }
    if (cpp_programador_save_sesiones_order($user_id, $clase_id, $evaluacion_id, $orden)) {
        wp_send_json_success(['message' => 'Orden guardado.', 'needs_gradebook_reload' => true]);
    } else {
        wp_send_json_error(['message' => 'Error al guardar el orden.']);
    }
}

function cpp_ajax_save_start_date() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    cpp_clear_programador_cache($user_id);
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $start_date = isset($_POST['start_date']) ? sanitize_text_field($_POST['start_date']) : null; // Aceptar null si está vacío

    if (empty($evaluacion_id)) {
        wp_send_json_error(['message' => 'Falta ID de evaluación.']);
        return;
    }

    // Si la fecha está vacía, la guardamos como NULL en la BBDD
    if (!empty($start_date)) {
        if (cpp_programador_check_schedule_conflict($user_id, $evaluacion_id, $start_date)) {
            wp_send_json_error(['message' => 'La fecha de inicio seleccionada crea un conflicto de horario con otra evaluación. Por favor, elige una fecha diferente.']);
            return;
        }
    }

    if (cpp_programador_save_start_date($user_id, $evaluacion_id, $start_date)) {
        wp_send_json_success(['message' => 'Fecha de inicio guardada.', 'needs_gradebook_reload' => true]);
    } else {
        wp_send_json_error(['message' => 'Error al guardar la fecha.']);
    }
}

function cpp_ajax_create_programador_example_data() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    cpp_clear_programador_cache($user_id);
    if (cpp_programador_create_example_data($user_id)) { wp_send_json_success(['message' => 'Datos de ejemplo creados.']); }
    else { wp_send_json_error(['message' => 'No se pudieron crear los datos. Asegúrate de tener clases creadas.']); }
}

function cpp_ajax_add_inline_sesion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    cpp_clear_programador_cache($user_id);
    $sesion_data = isset($_POST['sesion']) ? json_decode(stripslashes($_POST['sesion']), true) : null;
    $after_sesion_id = isset($_POST['after_sesion_id']) ? intval($_POST['after_sesion_id']) : 0;

    if (empty($sesion_data) || !isset($sesion_data['evaluacion_id']) || empty($after_sesion_id)) {
        wp_send_json_error(['message' => 'Datos de sesión no válidos.']);
        return;
    }

    $sesion_data['user_id'] = $user_id;

    $result = cpp_programador_add_sesion_inline($sesion_data, $after_sesion_id, $user_id);

    if ($result) {
        // --- FIX: Devolver la sesión completa en lugar de recargar todo ---
        $sesion_completa = cpp_programador_get_sesion_by_id($result, $user_id);

        wp_send_json_success(['message' => 'Sesión añadida.', 'sesion' => $sesion_completa, 'after_sesion_id' => $after_sesion_id, 'needs_gradebook_reload' => true]);
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
    cpp_clear_programador_cache(get_current_user_id());
    $user_id = get_current_user_id();
    $actividad_data = isset($_POST['actividad']) ? json_decode(stripslashes($_POST['actividad']), true) : null;
    if (empty($actividad_data)) { wp_send_json_error(['message' => 'Datos de actividad no válidos.']); return; }

    // Guardar la actividad de programación
    $result_id = cpp_programador_save_actividad($actividad_data, $user_id);

    if ($result_id) {
        // Si la actividad es evaluable y tiene un ID de actividad del cuaderno vinculado,
        // actualizamos también el nombre en la tabla de actividades evaluables para mantener la sincronización.
        if (isset($actividad_data['es_evaluable']) && $actividad_data['es_evaluable'] == 1 && isset($actividad_data['actividad_calificable_id']) && !empty($actividad_data['actividad_calificable_id'])) {

            $datos_para_cuaderno = [
                'user_id' => $user_id,
                'nombre_actividad' => $actividad_data['titulo']
            ];

            cpp_actualizar_actividad_evaluable($actividad_data['actividad_calificable_id'], $datos_para_cuaderno);

            // Forzar recarga del cuaderno para que se vea el cambio de nombre
            // El frontend tiene que escuchar este evento.
            // wp_send_json_success se encargará de enviar la respuesta, pero podemos añadir un flag.
        }

        global $wpdb;
        $tabla_actividades = $wpdb->prefix . 'cpp_programador_actividades';
        $actividad_guardada = $wpdb->get_row($wpdb->prepare("SELECT * FROM $tabla_actividades WHERE id = %d", $result_id), ARRAY_A);

        if ($actividad_guardada) {
            $actividad_guardada['tipo'] = 'no_evaluable';
        }

        wp_send_json_success(['message' => 'Actividad guardada.', 'actividad' => $actividad_guardada, 'needs_gradebook_reload' => true]);

    } else {
        wp_send_json_error(['message' => 'Error al guardar la actividad.']);
    }
}

function cpp_ajax_delete_programador_actividad() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    cpp_clear_programador_cache(get_current_user_id());
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
    cpp_clear_programador_cache(get_current_user_id());
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
    cpp_clear_programador_cache(get_current_user_id());
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
        // La fecha ya no se calcula aquí. Se guardará como NULL y se hidratará al leer.
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
            // 'fecha_actividad' ya no se pasa, se guardará como NULL por defecto
            'user_id' => $user_id,
            'sesion_id' => $actividad_prog->sesion_id, // Pasar el ID de la sesión
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

function cpp_ajax_check_schedule_conflict_handler() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    if (!$user_id) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $start_date = isset($_POST['start_date']) ? sanitize_text_field($_POST['start_date']) : '';

    if (empty($evaluacion_id) || empty($start_date)) {
        wp_send_json_error(['message' => 'Datos insuficientes.']);
        return;
    }

    $has_conflict = cpp_programador_check_schedule_conflict($user_id, $evaluacion_id, $start_date);

    wp_send_json_success(['conflict' => $has_conflict]);
}

function cpp_ajax_copy_sessions() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $user_id = get_current_user_id();
    cpp_clear_programador_cache($user_id);
    $session_ids = isset($_POST['session_ids']) ? json_decode(stripslashes($_POST['session_ids']), true) : null;
    $destination_clase_id = isset($_POST['destination_clase_id']) ? intval($_POST['destination_clase_id']) : 0;
    $destination_evaluacion_id = isset($_POST['destination_evaluacion_id']) ? intval($_POST['destination_evaluacion_id']) : 0;

    if (empty($session_ids) || empty($destination_clase_id) || empty($destination_evaluacion_id)) {
        wp_send_json_error(['message' => 'Faltan datos para realizar la copia.']);
        return;
    }

    $result = cpp_copy_sessions_to_class($session_ids, $destination_clase_id, $destination_evaluacion_id, $user_id);

    if ($result) {
        // --- FIX: Devolver las nuevas fechas para actualizar la UI del destino ---
        $fechas_actualizadas = cpp_programador_get_fechas_for_evaluacion($user_id, $destination_clase_id, $destination_evaluacion_id);
        wp_send_json_success([
            'message' => 'Sesiones copiadas correctamente.',
            'needs_gradebook_reload' => true,
            'fechas' => $fechas_actualizadas
        ]);
    } else {
        wp_send_json_error(['message' => 'Ocurrió un error al copiar las sesiones.']);
    }
}

function cpp_ajax_delete_multiple_sesiones() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $user_id = get_current_user_id();
    cpp_clear_programador_cache($user_id);
    $session_ids = isset($_POST['session_ids']) ? json_decode(stripslashes($_POST['session_ids']), true) : null;
    $delete_activities = isset($_POST['delete_activities']) && $_POST['delete_activities'] === 'true';

    if (empty($session_ids) || !is_array($session_ids)) {
        wp_send_json_error(['message' => 'No se han proporcionado IDs de sesión válidos.']);
        return;
    }

    // --- AÑADIDO: Obtener info de TODAS las sesiones ANTES de borrarlas ---
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    $placeholders = implode(',', array_fill(0, count($session_ids), '%d'));
    $query = $wpdb->prepare(
        "SELECT DISTINCT clase_id, evaluacion_id FROM $tabla_sesiones WHERE id IN ($placeholders) AND user_id = %d",
        array_merge($session_ids, [$user_id])
    );
    $affected_evaluations = $wpdb->get_results($query);

    $result = cpp_programador_delete_multiple_sesiones($session_ids, $user_id, $delete_activities);

    if ($result) {
        wp_send_json_success(['message' => 'Sesiones eliminadas correctamente.', 'needs_gradebook_reload' => true]);
    } else {
        wp_send_json_error(['message' => 'Ocurrió un error al eliminar una o más de las sesiones seleccionadas.']);
    }
}

function cpp_ajax_get_fechas_evaluacion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;

    if (empty($evaluacion_id) || empty($clase_id)) {
        wp_send_json_error(['message' => 'Faltan datos para calcular las fechas.']);
        return;
    }

    $fechas = cpp_programador_get_fechas_for_evaluacion($user_id, $clase_id, $evaluacion_id);
    wp_send_json_success(['fechas' => $fechas]);
}

function cpp_ajax_toggle_sesion_fijada() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }

    $user_id = get_current_user_id();
    cpp_clear_programador_cache($user_id);
    $session_ids = isset($_POST['session_ids']) ? json_decode(stripslashes($_POST['session_ids']), true) : null;
    $fijar = isset($_POST['fijar']) ? ($_POST['fijar'] === 'true') : false; // 'true' o 'false' como string

    if (empty($session_ids) || !is_array($session_ids)) {
        wp_send_json_error(['message' => 'No se han proporcionado IDs de sesión válidos.']);
        return;
    }

    // Obtener la información de la primera sesión para saber a qué evaluación pertenece
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    $first_sesion_id = intval($session_ids[0]);
    $sesion_info = $wpdb->get_row($wpdb->prepare(
        "SELECT clase_id, evaluacion_id FROM $tabla_sesiones WHERE id = %d AND user_id = %d",
        $first_sesion_id, $user_id
    ));

    if (!$sesion_info) {
        wp_send_json_error(['message' => 'No se encontró la sesión o no tienes permisos.']);
        return;
    }

    $result = cpp_programador_toggle_sesion_fijada($session_ids, $fijar, $user_id);

    if ($result) {
        // Devolver las nuevas fechas para actualizar la UI
        $fechas_actualizadas = cpp_programador_get_fechas_for_evaluacion($user_id, $sesion_info->clase_id, $sesion_info->evaluacion_id);

        wp_send_json_success([
            'message' => 'Estado de fijación actualizado.',
            'needs_gradebook_reload' => true,
            'fechas' => $fechas_actualizadas
        ]);
    } else {
        wp_send_json_error(['message' => 'Error al actualizar el estado de fijación.']);
    }
}


function cpp_programador_get_sesion_by_id($sesion_id, $user_id) {
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';

    // Verificar que el usuario tiene permiso sobre la sesión
    $owner_id = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_sesiones WHERE id = %d", $sesion_id));
    if (!$owner_id || $owner_id != $user_id) {
        return null;
    }

    $sesion = $wpdb->get_row($wpdb->prepare("SELECT * FROM $tabla_sesiones WHERE id = %d", $sesion_id));

    if ($sesion) {
        // Convertir tipos de datos para consistencia con el resto de la app
        $sesion->id = intval($sesion->id);
        $sesion->actividades_programadas = cpp_programador_get_actividades_by_sesion_id($sesion_id, $user_id) ?: [];
        $sesion->fecha_calculada = cpp_programador_calculate_activity_date($sesion_id, $user_id);
    }

    return $sesion;
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
        foreach ($slots as $slot => $data) {
            if ($data['claseId'] == $sesion_target->clase_id) {
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

            foreach ($slots_del_dia as $slot => $data) {
                if ($data['claseId'] == $sesion_target->clase_id) {
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

function cpp_programador_get_fechas_for_evaluacion($user_id, $clase_id, $evaluacion_id) {
    global $wpdb;

    // 1. Obtener datos básicos
    $all_data = cpp_programador_get_all_data($user_id);
    $horario = $all_data['config']['horario'];
    $calendar_config = $all_data['config']['calendar_config'];

    $start_date_str = null;
    foreach ($all_data['clases'] as $clase) {
        if ($clase['id'] == $clase_id) {
            foreach ($clase['evaluaciones'] as $eval) {
                if ($eval['id'] == $evaluacion_id) {
                    $start_date_str = $eval['start_date'];
                    break 2;
                }
            }
        }
    }

    $sesiones_en_evaluacion = array_filter($all_data['sesiones'], function($s) use ($clase_id, $evaluacion_id) {
        return $s->clase_id == $clase_id && $s->evaluacion_id == $evaluacion_id;
    });
    $sesiones_en_evaluacion = array_values($sesiones_en_evaluacion);

    if (empty($sesiones_en_evaluacion) || !$start_date_str) {
        return [];
    }

    // 2. Separar sesiones fijadas y no fijadas, y registrar fechas ocupadas
    $sesiones_fijadas = [];
    $sesiones_no_fijadas = [];
    $fechas_ocupadas = [];
    $resultados = [];

    foreach ($sesiones_en_evaluacion as $sesion) {
        if (!empty($sesion->fecha_fijada)) {
            $sesiones_fijadas[] = $sesion;
            $fechas_ocupadas[] = $sesion->fecha_fijada;
        } else {
            $sesiones_no_fijadas[] = $sesion;
        }
    }

    // 3. Calcular fechas para sesiones NO fijadas
    try {
        $current_date = new DateTime($start_date_str . 'T12:00:00Z');
    } catch (Exception $e) {
        return [];
    }

    $session_index = 0;
    $safety_counter = 0;
    $max_iterations = 365 * 5; // 5 años de margen

    while ($session_index < count($sesiones_no_fijadas) && $safety_counter < $max_iterations) {
        $day_key = strtolower($current_date->format('D'));
        $ymd = $current_date->format('Y-m-d');

        $is_working_day = in_array($day_key, $calendar_config['working_days']);
        $is_holiday = in_array($ymd, $calendar_config['holidays']);
        $is_vacation = false;
        if (!empty($calendar_config['vacations'])) {
            foreach ($calendar_config['vacations'] as $v) {
                if ($ymd >= $v['start'] && $ymd <= $v['end']) {
                    $is_vacation = true;
                    break;
                }
            }
        }
        $is_occupied = in_array($ymd, $fechas_ocupadas);

        if ($is_working_day && !$is_holiday && !$is_vacation && !$is_occupied && isset($horario[$day_key])) {
            $slots_del_dia = $horario[$day_key];
            ksort($slots_del_dia);

            foreach ($slots_del_dia as $slot => $data) {
                if ($data['claseId'] == $clase_id) {
                    if (isset($sesiones_no_fijadas[$session_index])) {
                        $sesion_actual = $sesiones_no_fijadas[$session_index];
                        $resultados[$sesion_actual->id] = [
                            'fecha' => $ymd,
                            'notas' => !empty($data['notas']) ? $data['notas'] : ''
                        ];
                        $session_index++;
                    }
                }
            }
        }
        $current_date->add(new DateInterval('P1D'));
        $safety_counter++;
    }

    // 4. Añadir las sesiones fijadas al resultado
    foreach ($sesiones_fijadas as $sesion_fijada) {
        $day_key_fijado = strtolower((new DateTime($sesion_fijada->fecha_fijada))->format('D'));
        $notas = '';
        if (isset($horario[$day_key_fijado])) {
             $slots_del_dia_fijado = $horario[$day_key_fijado];
             ksort($slots_del_dia_fijado);
             foreach($slots_del_dia_fijado as $slot => $data) {
                 if ($data['claseId'] == $clase_id) {
                     $notas = !empty($data['notas']) ? $data['notas'] : '';
                     break;
                 }
             }
        }
        $resultados[$sesion_fijada->id] = [
            'fecha' => $sesion_fijada->fecha_fijada,
            'notas' => $notas
        ];
    }

    return $resultados;
}

// --- Nuevas acciones para los símbolos ---
add_action('wp_ajax_cpp_get_programador_simbolos', 'cpp_ajax_get_programador_simbolos');
add_action('wp_ajax_cpp_save_programador_simbolos_leyendas', 'cpp_ajax_save_programador_simbolos_leyendas');

function cpp_get_default_programador_simbolos() {
    return [
        'examen' => ['simbolo' => '📝', 'leyenda' => 'Examen / Prueba'],
        'proyecto' => ['simbolo' => '🏗️', 'leyenda' => 'Entrega de proyecto'],
        'presentacion' => ['simbolo' => '🗣️', 'leyenda' => 'Presentación oral'],
        'debate' => ['simbolo' => '⚖️', 'leyenda' => 'Debate'],
        'laboratorio' => ['simbolo' => '🔬', 'leyenda' => 'Práctica de laboratorio'],
        'salida' => ['simbolo' => '🚌', 'leyenda' => 'Salida / Excursión'],
        'repaso' => ['simbolo' => '🔄', 'leyenda' => 'Sesión de repaso'],
        'fiesta' => ['simbolo' => '🎉', 'leyenda' => 'Celebración / Evento especial']
    ];
}

function cpp_ajax_get_programador_simbolos() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }
    $user_id = get_current_user_id();
    $leyendas_guardadas = get_user_meta($user_id, 'cpp_programador_simbolos_leyendas', true);
    if (!is_array($leyendas_guardadas)) {
        $leyendas_guardadas = [];
    }

    $simbolos_default = cpp_get_default_programador_simbolos();
    $resultado = [];
    foreach ($simbolos_default as $id => $data) {
        $resultado[$id] = [
            'simbolo' => $data['simbolo'],
            'leyenda' => isset($leyendas_guardadas[$id]) ? esc_html($leyendas_guardadas[$id]) : $data['leyenda'],
        ];
    }

    wp_send_json_success(['simbolos' => $resultado]);
}

function cpp_ajax_save_programador_simbolos_leyendas() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }

    if (!isset($_POST['leyendas']) || !is_string($_POST['leyendas'])) {
        wp_send_json_error(['message' => 'Datos de leyendas no válidos.'], 400);
        return;
    }

    $leyendas_json = stripslashes($_POST['leyendas']);
    $leyendas = json_decode($leyendas_json, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error(['message' => 'Formato de leyendas no válido.'], 400);
        return;
    }

    $user_id = get_current_user_id();
    $simbolos_default = cpp_get_default_programador_simbolos();
    $leyendas_sanitizadas = [];

    foreach ($simbolos_default as $id => $data) {
        if (isset($leyendas[$id])) {
            $leyendas_sanitizadas[$id] = sanitize_text_field($leyendas[$id]);
        }
    }

    update_user_meta($user_id, 'cpp_programador_simbolos_leyendas', $leyendas_sanitizadas);

    wp_send_json_success(['message' => 'Leyendas guardadas con éxito.']);
}
