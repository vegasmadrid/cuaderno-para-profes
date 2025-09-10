<?php
// /includes/programador/db-programador.php

defined('ABSPATH') or die('Acceso no permitido');

function cpp_programador_save_config_value($user_id, $clave, $valor) {
    global $wpdb;
    $tabla_config = $wpdb->prefix . 'cpp_programador_config';
    $data = ['user_id' => $user_id, 'clave' => $clave, 'valor' => is_array($valor) || is_object($valor) ? wp_json_encode($valor) : $valor];
    return $wpdb->replace($tabla_config, $data, ['%d', '%s', '%s']) !== false;
}

function cpp_programador_get_all_data($user_id) {
    global $wpdb;
    $tabla_config = $wpdb->prefix . 'cpp_programador_config';
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    $tabla_actividades = $wpdb->prefix . 'cpp_programador_actividades';

    $clases = cpp_obtener_clases_usuario($user_id);

    if (!empty($clases)) {
        for ($i = 0; $i < count($clases); $i++) {
            $clases[$i]['evaluaciones'] = cpp_obtener_evaluaciones_por_clase($clases[$i]['id'], $user_id);
        }
    }

    $config_results = $wpdb->get_results($wpdb->prepare("SELECT clave, valor FROM $tabla_config WHERE user_id = %d", $user_id), ARRAY_A);
    $config = [];
    foreach ($config_results as $resultado) {
        $valor = json_decode($resultado['valor'], true);
        $config[$resultado['clave']] = (json_last_error() === JSON_ERROR_NONE) ? $valor : $resultado['valor'];
    }

    $defaults = [
        'time_slots' => ['09:00', '10:00', '11:00', '12:00'],
        'horario' => new stdClass(),
        'calendar_config' => [
            'working_days' => ['mon', 'tue', 'wed', 'thu', 'fri'],
            'holidays' => [],
            'vacations' => []
        ]
    ];
    $config = array_merge($defaults, $config);

    // Asegurarse de que las subclaves de calendar_config existan
    if (isset($config['calendar_config'])) {
        $config['calendar_config'] = array_merge($defaults['calendar_config'], $config['calendar_config']);
    }

    $sesiones = $wpdb->get_results($wpdb->prepare("SELECT * FROM $tabla_sesiones WHERE user_id = %d ORDER BY clase_id, evaluacion_id, orden ASC", $user_id));
    $actividades = $wpdb->get_results($wpdb->prepare("SELECT * FROM $tabla_actividades WHERE user_id = %d ORDER BY sesion_id, orden ASC", $user_id));

    // Anidar actividades en sus sesiones
    $actividades_por_sesion = [];
    foreach ($actividades as $actividad) {
        $actividades_por_sesion[$actividad->sesion_id][] = $actividad;
    }

    foreach ($sesiones as $sesion) {
        $sesion->actividades_programadas = isset($actividades_por_sesion[$sesion->id]) ? $actividades_por_sesion[$sesion->id] : [];
    }

    return ['clases' => $clases, 'config' => $config, 'sesiones' => $sesiones];
}

function cpp_programador_save_sesion($data) {
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    $sesion_id = isset($data['id']) ? intval($data['id']) : 0;
    $user_id = isset($data['user_id']) ? intval($data['user_id']) : 0;
    if (empty($user_id)) return false;
    $datos_a_guardar = [
        'user_id' => $user_id,
        'clase_id' => isset($data['clase_id']) ? intval($data['clase_id']) : 0,
        'evaluacion_id' => isset($data['evaluacion_id']) ? intval($data['evaluacion_id']) : 0,
        'titulo' => isset($data['titulo']) ? sanitize_text_field($data['titulo']) : '',
        'descripcion' => isset($data['descripcion']) ? wp_kses_post($data['descripcion']) : '',
        'objetivos' => isset($data['objetivos']) ? wp_kses_post($data['objetivos']) : '',
        'recursos' => isset($data['recursos']) ? wp_kses_post($data['recursos']) : '',
        'actividades' => isset($data['actividades']) ? wp_kses_post($data['actividades']) : '',
        'seguimiento' => isset($data['seguimiento']) ? wp_kses_post($data['seguimiento']) : '',
    ];
    $format = ['%d', '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s'];
    if ($sesion_id > 0) {
        $resultado = $wpdb->update($tabla_sesiones, $datos_a_guardar, ['id' => $sesion_id, 'user_id' => $user_id], $format, ['%d', '%d']);
        return $resultado !== false ? $sesion_id : false;
    } else {
        $max_orden = $wpdb->get_var($wpdb->prepare("SELECT MAX(orden) FROM $tabla_sesiones WHERE user_id = %d AND clase_id = %d AND evaluacion_id = %d", $user_id, $datos_a_guardar['clase_id'], $datos_a_guardar['evaluacion_id']));
        $datos_a_guardar['orden'] = is_null($max_orden) ? 0 : $max_orden + 1;
        $format[] = '%d';
        $resultado = $wpdb->insert($tabla_sesiones, $datos_a_guardar, $format);
        return $resultado ? $wpdb->insert_id : false;
    }
}

function cpp_programador_delete_sesion($sesion_id, $user_id) {
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    return $wpdb->delete($tabla_sesiones, ['id' => $sesion_id, 'user_id' => $user_id], ['%d', '%d']) !== false;
}

function cpp_programador_save_sesiones_order($user_id, $clase_id, $evaluacion_id, $orden_sesiones) {
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    if (!is_array($orden_sesiones)) return false;
    $wpdb->query('START TRANSACTION');
    foreach ($orden_sesiones as $index => $sesion_id) {
        $resultado = $wpdb->update($tabla_sesiones, ['orden' => $index], ['id' => intval($sesion_id), 'user_id' => $user_id, 'clase_id' => $clase_id, 'evaluacion_id' => $evaluacion_id]);
        if ($resultado === false) { $wpdb->query('ROLLBACK'); return false; }
    }
    $wpdb->query('COMMIT');
    return true;
}

function cpp_programador_save_start_date($user_id, $evaluacion_id, $start_date) {
    global $wpdb;
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $owner_check = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_evaluaciones WHERE id = %d", $evaluacion_id));
    if ($owner_check != $user_id) return false;
    return $wpdb->update($tabla_evaluaciones, ['start_date' => $start_date], ['id' => $evaluacion_id], ['%s'], ['%d']) !== false;
}

function cpp_programador_create_example_data($user_id) {
    // ... (función existente, se podría actualizar para añadir start_date a la evaluación de ejemplo)
}

function cpp_programador_add_sesion_inline($sesion_data, $after_sesion_id, $user_id) {
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';

    $wpdb->query('START TRANSACTION');

    // 1. Get the order of the session to insert after
    $after_orden = $wpdb->get_var($wpdb->prepare(
        "SELECT orden FROM $tabla_sesiones WHERE id = %d AND user_id = %d",
        $after_sesion_id,
        $user_id
    ));

    if ($after_orden === null) {
        $wpdb->query('ROLLBACK');
        return false; // The 'after' session doesn't exist or doesn't belong to the user
    }

    $nuevo_orden = $after_orden + 1;
    $evaluacion_id = $sesion_data['evaluacion_id'];

    // 2. Increment the order of subsequent sessions
    $wpdb->query($wpdb->prepare(
        "UPDATE $tabla_sesiones SET orden = orden + 1 WHERE evaluacion_id = %d AND orden >= %d AND user_id = %d",
        $evaluacion_id,
        $nuevo_orden,
        $user_id
    ));

    // 3. Insert the new session
    $insert_data = [
        'clase_id' => $sesion_data['clase_id'],
        'evaluacion_id' => $evaluacion_id,
        'user_id' => $user_id,
        'titulo' => $sesion_data['titulo'],
        'orden' => $nuevo_orden
    ];

    $insert_result = $wpdb->insert($tabla_sesiones, $insert_data);

    if ($insert_result === false) {
        $wpdb->query('ROLLBACK');
        return false;
    }

    $wpdb->query('COMMIT');
    return $wpdb->insert_id;
}

function cpp_programador_save_actividad($data) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_programador_actividades';
    $actividad_id = isset($data['id']) ? intval($data['id']) : 0;
    $user_id = isset($data['user_id']) ? intval($data['user_id']) : 0;

    if (empty($user_id) || empty($data['sesion_id'])) {
        return false;
    }

    $datos_a_guardar = [
        'user_id' => $user_id,
        'sesion_id' => intval($data['sesion_id']),
        'titulo' => sanitize_text_field($data['titulo']),
        'es_evaluable' => isset($data['es_evaluable']) ? intval($data['es_evaluable']) : 0,
        'categoria_id' => isset($data['categoria_id']) ? intval($data['categoria_id']) : null,
        'actividad_cuaderno_id' => isset($data['actividad_cuaderno_id']) ? intval($data['actividad_cuaderno_id']) : null,
    ];

    $format = ['%d', '%d', '%s', '%d', '%d', '%d'];

    if ($actividad_id > 0) {
        $resultado = $wpdb->update($tabla_actividades, $datos_a_guardar, ['id' => $actividad_id, 'user_id' => $user_id], $format, ['%d', '%d']);
        return $resultado !== false ? $actividad_id : false;
    } else {
        $max_orden = $wpdb->get_var($wpdb->prepare("SELECT MAX(orden) FROM $tabla_actividades WHERE user_id = %d AND sesion_id = %d", $user_id, $datos_a_guardar['sesion_id']));
        $datos_a_guardar['orden'] = is_null($max_orden) ? 0 : $max_orden + 1;
        $format[] = '%d';
        $resultado = $wpdb->insert($tabla_actividades, $datos_a_guardar, $format);
        return $resultado ? $wpdb->insert_id : false;
    }
}

function cpp_programador_delete_actividad($actividad_id, $user_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_programador_actividades';
    return $wpdb->delete($tabla_actividades, ['id' => $actividad_id, 'user_id' => $user_id], ['%d', '%d']) !== false;
}

function cpp_programador_get_fecha_for_sesion($sesion_id, $user_id) {
    global $wpdb;

    // Obtener información de la sesión
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    $sesion = $wpdb->get_row($wpdb->prepare("SELECT * FROM $tabla_sesiones WHERE id = %d AND user_id = %d", $sesion_id, $user_id));
    if (!$sesion) return null;

    // Obtener la configuración del programador (horario, calendario)
    $all_data = cpp_programador_get_all_data($user_id);
    $config = $all_data['config'];
    $horario = $config['horario'];
    $calendar_config = $config['calendar_config'];

    // Obtener la fecha de inicio de la evaluación
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $start_date_str = $wpdb->get_var($wpdb->prepare("SELECT start_date FROM $tabla_evaluaciones WHERE id = %d", $sesion->evaluacion_id));
    if (empty($start_date_str)) return null;

    // Obtener todas las sesiones de esa evaluación en orden
    $sesiones_evaluacion = $wpdb->get_results($wpdb->prepare(
        "SELECT id FROM $tabla_sesiones WHERE clase_id = %d AND evaluacion_id = %d AND user_id = %d ORDER BY orden ASC",
        $sesion->clase_id, $sesion->evaluacion_id, $user_id
    ));

    // Lógica de cálculo de fecha
    try {
        $current_date = new DateTime($start_date_str);
    } catch (Exception $e) {
        return null; // Fecha de inicio inválida
    }

    $day_mapping = ['1' => 'mon', '2' => 'tue', '3' => 'wed', '4' => 'thu', '5' => 'fri', '6' => 'sat', '7' => 'sun'];
    $session_index = 0;
    $max_iterations = 50000;
    $counter = 0;

    while ($session_index < count($sesiones_evaluacion)) {
        if ($counter++ > $max_iterations) return null; // Safety break

        $day_of_week = $current_date->format('N'); // 1 (para Lunes) hasta 7 (para Domingo)
        $day_key = $day_mapping[$day_of_week];
        $ymd = $current_date->format('Y-m-d');

        $is_working_day = in_array($day_key, $calendar_config['working_days']);
        $is_holiday = in_array($ymd, $calendar_config['holidays']);
        $is_vacation = false;
        foreach ($calendar_config['vacations'] as $vac) {
            if ($ymd >= $vac['start'] && $ymd <= $vac['end']) {
                $is_vacation = true;
                break;
            }
        }

        if ($is_working_day && !$is_holiday && !$is_vacation && isset($horario[$day_key])) {
            $sorted_slots = array_keys($horario[$day_key]);
            sort($sorted_slots);

            foreach ($sorted_slots as $slot) {
                if (isset($horario[$day_key][$slot]) && $horario[$day_key][$slot] == $sesion->clase_id) {
                    if ($session_index < count($sesiones_evaluacion)) {
                        $current_sesion_in_loop = $sesiones_evaluacion[$session_index];
                        if ($current_sesion_in_loop->id == $sesion_id) {
                            return $current_date->format('Y-m-d');
                        }
                        $session_index++;
                    }
                }
            }
        }

        $current_date->modify('+1 day');
    }

    return null; // No se encontró la sesión
}

function cpp_programador_toggle_evaluable($actividad_id, $user_id, $es_evaluable, $categoria_id = null) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_programador_actividades';

    // 1. Obtener la actividad de la programación
    $actividad_programada = $wpdb->get_row($wpdb->prepare("SELECT * FROM $tabla_actividades WHERE id = %d AND user_id = %d", $actividad_id, $user_id));
    if (!$actividad_programada) {
        return ['success' => false, 'message' => 'Actividad no encontrada.'];
    }

    // 2. Si se marca como evaluable
    if ($es_evaluable) {
        // Si ya tiene una actividad en el cuaderno, no hacer nada.
        if (!empty($actividad_programada->actividad_cuaderno_id)) {
            // Opcional: Actualizar la categoría si ha cambiado
            if ($categoria_id !== null && $categoria_id != $actividad_programada->categoria_id) {
                 $wpdb->update($tabla_actividades, ['categoria_id' => $categoria_id], ['id' => $actividad_id]);
                 // También habría que actualizar la actividad en el cuaderno
                 $datos_cuaderno = ['categoria_id' => $categoria_id, 'user_id' => $user_id];
                 // Necesitamos la evaluacion_id para que la comprobación de la categoría sea correcta
                 $sesion = $wpdb->get_row($wpdb->prepare("SELECT evaluacion_id FROM {$wpdb->prefix}cpp_programador_sesiones WHERE id = %d", $actividad_programada->sesion_id));
                 if ($sesion) {
                    $datos_cuaderno['evaluacion_id'] = $sesion->evaluacion_id;
                 }
                 cpp_actualizar_actividad_evaluable($actividad_programada->actividad_cuaderno_id, $datos_cuaderno);
            }
            return ['success' => true, 'actividad_cuaderno_id' => $actividad_programada->actividad_cuaderno_id];
        }

        // Obtener datos necesarios para crear la actividad en el cuaderno
        $sesion = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}cpp_programador_sesiones WHERE id = %d", $actividad_programada->sesion_id));
        $fecha_actividad = cpp_programador_get_fecha_for_sesion($actividad_programada->sesion_id, $user_id);

        $datos_cuaderno = [
            'clase_id' => $sesion->clase_id,
            'evaluacion_id' => $sesion->evaluacion_id,
            'user_id' => $user_id,
            'categoria_id' => $categoria_id,
            'nombre_actividad' => $actividad_programada->titulo,
            'fecha_actividad' => $fecha_actividad,
            'nota_maxima' => 10 // Valor por defecto
        ];

        $actividad_cuaderno_id = cpp_guardar_actividad_evaluable($datos_cuaderno);

        if ($actividad_cuaderno_id) {
            $wpdb->update($tabla_actividades,
                ['es_evaluable' => 1, 'categoria_id' => $categoria_id, 'actividad_cuaderno_id' => $actividad_cuaderno_id],
                ['id' => $actividad_id]
            );
            return ['success' => true, 'actividad_cuaderno_id' => $actividad_cuaderno_id, 'fecha_actividad' => $fecha_actividad];
        } else {
            return ['success' => false, 'message' => 'Error al crear la actividad en el cuaderno.'];
        }
    } else { // 3. Si se desmarca como evaluable
        // Eliminar la actividad del cuaderno y las calificaciones asociadas
        if (!empty($actividad_programada->actividad_cuaderno_id)) {
            cpp_eliminar_actividad_y_calificaciones($actividad_programada->actividad_cuaderno_id, $user_id);
        }
        // Actualizar la actividad de la programación
        $wpdb->update($tabla_actividades,
            ['es_evaluable' => 0, 'categoria_id' => null, 'actividad_cuaderno_id' => null],
            ['id' => $actividad_id]
        );
        return ['success' => true];
    }
}
