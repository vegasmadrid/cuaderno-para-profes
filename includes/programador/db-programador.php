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
            // FIX: Añadir las categorías a cada evaluación para que estén disponibles en el frontend del programador.
            if (!empty($clases[$i]['evaluaciones'])) {
                for ($j = 0; $j < count($clases[$i]['evaluaciones']); $j++) {
                    $evaluacion_id = $clases[$i]['evaluaciones'][$j]['id'];
                    $clases[$i]['evaluaciones'][$j]['categorias'] = cpp_obtener_categorias_por_evaluacion($evaluacion_id, $user_id);
                }
            }
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

    if (isset($config['calendar_config'])) {
        $config['calendar_config'] = array_merge($defaults['calendar_config'], $config['calendar_config']);
    }

    $sesiones = $wpdb->get_results($wpdb->prepare("SELECT * FROM $tabla_sesiones WHERE user_id = %d ORDER BY clase_id, evaluacion_id, orden ASC", $user_id), OBJECT_K);

    if (!empty($sesiones)) {
        $sesiones_ids = array_keys($sesiones);
        $placeholders = implode(',', array_fill(0, count($sesiones_ids), '%d'));

        // Cargar actividades NO evaluables
        $actividades_no_evaluables = $wpdb->get_results($wpdb->prepare("SELECT *, 'no_evaluable' as tipo FROM $tabla_actividades WHERE sesion_id IN ($placeholders)", $sesiones_ids));

        // Cargar actividades EVALUABLES
        $tabla_evaluables = $wpdb->prefix . 'cpp_actividades_evaluables';
        $actividades_evaluables = $wpdb->get_results($wpdb->prepare("SELECT id, sesion_id, nombre_actividad as titulo, orden, 'evaluable' as tipo FROM $tabla_evaluables WHERE sesion_id IN ($placeholders)", $sesiones_ids));

        // Unir y ordenar
        $todas_las_actividades = array_merge($actividades_no_evaluables, $actividades_evaluables);
        usort($todas_las_actividades, function($a, $b) {
            return $a->orden <=> $b->orden;
        });

        foreach ($todas_las_actividades as $actividad) {
            if (isset($sesiones[$actividad->sesion_id])) {
                if (!isset($sesiones[$actividad->sesion_id]->actividades_programadas)) {
                    $sesiones[$actividad->sesion_id]->actividades_programadas = [];
                }
                $sesiones[$actividad->sesion_id]->actividades_programadas[] = $actividad;
            }
        }
    }

    // Calcular y adjuntar las fechas de las sesiones
    if (!empty($clases) && !empty($sesiones)) {
        foreach ($clases as $clase) {
            foreach ($clase['evaluaciones'] as $evaluacion) {
                if (!empty($evaluacion['start_date'])) {
                    $sesiones_de_la_evaluacion = array_filter($sesiones, function($s) use ($evaluacion) {
                        return $s->evaluacion_id == $evaluacion['id'];
                    });

                    if (!empty($sesiones_de_la_evaluacion)) {
                        $schedule = cpp_programador_calculate_schedule_for_evaluation(
                            array_values($sesiones_de_la_evaluacion),
                            $evaluacion['start_date'],
                            $config['horario'],
                            $config['calendar_config'],
                            $clase['id']
                        );

                        $i = 0;
                        foreach ($sesiones_de_la_evaluacion as $sesion_obj) {
                            if (isset($schedule[$i])) {
                                $sesiones[$sesion_obj->id]->fecha_calculada = explode('_', $schedule[$i])[0];
                            }
                            $i++;
                        }
                    }
                }
            }
        }
    }

    return ['clases' => $clases, 'config' => $config, 'sesiones' => array_values($sesiones), 'debug_evaluables' => $actividades_evaluables];
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
        'seguimiento' => isset($data['seguimiento']) ? wp_kses_post($data['seguimiento']) : '',
    ];
    $format = ['%d', '%d', '%d', '%s', '%s', '%s', '%s', '%s'];
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

function cpp_programador_delete_sesion($sesion_id, $user_id, $delete_activities = false) {
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    $tabla_act_evaluables = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_act_programadas = $wpdb->prefix . 'cpp_programador_actividades';

    // Primero, verificar que el usuario es el propietario de la sesión
    $owner_check = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_sesiones WHERE id = %d", $sesion_id));
    if ($owner_check != $user_id) {
        return false;
    }

    $wpdb->query('START TRANSACTION');

    // Gestionar actividades evaluables asociadas
    $actividades_evaluables_ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM $tabla_act_evaluables WHERE sesion_id = %d", $sesion_id));

    if (!empty($actividades_evaluables_ids)) {
        if ($delete_activities) {
            // Incluir el archivo necesario para la función de eliminación
            require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-actividades-calificaciones.php';
            foreach ($actividades_evaluables_ids as $actividad_id) {
                if (function_exists('cpp_eliminar_actividad_y_calificaciones')) {
                    $delete_ok = cpp_eliminar_actividad_y_calificaciones($actividad_id, $user_id);
                    if (!$delete_ok) {
                        $wpdb->query('ROLLBACK');
                        return false;
                    }
                } else {
                    // Fallback o error si la función no existe
                    $wpdb->query('ROLLBACK');
                    return false;
                }
            }
        } else {
            // Desvincular las actividades evaluables
            $ids_placeholder = implode(',', array_fill(0, count($actividades_evaluables_ids), '%d'));
            $result = $wpdb->query($wpdb->prepare(
                "UPDATE $tabla_act_evaluables SET sesion_id = NULL WHERE id IN ($ids_placeholder)",
                $actividades_evaluables_ids
            ));
            if ($result === false) {
                $wpdb->query('ROLLBACK');
                return false;
            }
        }
    }

    // Eliminar actividades no evaluables (que solo existen en la tabla del programador)
    $wpdb->delete($tabla_act_programadas, ['sesion_id' => $sesion_id], ['%d']);

    // Finalmente, eliminar la sesión
    $delete_sesion_ok = $wpdb->delete($tabla_sesiones, ['id' => $sesion_id, 'user_id' => $user_id], ['%d', '%d']);
    if ($delete_sesion_ok === false) {
        $wpdb->query('ROLLBACK');
        return false;
    }

    $wpdb->query('COMMIT');
    return true;
}

function cpp_programador_delete_multiple_sesiones($session_ids, $user_id, $delete_activities) {
    global $wpdb;
    if (empty($session_ids) || !is_array($session_ids)) {
        return false;
    }

    $wpdb->query('START TRANSACTION');

    foreach ($session_ids as $session_id) {
        $result = cpp_programador_delete_sesion(intval($session_id), $user_id, $delete_activities);
        if (!$result) {
            $wpdb->query('ROLLBACK');
            return false;
        }
    }

    $wpdb->query('COMMIT');
    return true;
}

function cpp_copy_sessions_to_class($session_ids, $destination_clase_id, $destination_evaluacion_id, $user_id) {
    global $wpdb;

    if (empty($session_ids) || !is_array($session_ids)) {
        return false;
    }

    $wpdb->query('START TRANSACTION');

    // Helper function to get the default category ID for an evaluation
    if (!function_exists('cpp_get_default_category_id_for_evaluacion')) {
        function cpp_get_default_category_id_for_evaluacion($evaluacion_id) {
            global $wpdb;
            $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
            // Assuming 'Sin categoría' is the default category name
            $default_category_id = $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM $tabla_categorias WHERE evaluacion_id = %d AND nombre_categoria = 'Sin categoría'",
                $evaluacion_id
            ));
            if ($default_category_id) {
                return $default_category_id;
            }
            // Fallback to the first category if 'Sin categoría' does not exist
            return $wpdb->get_var($wpdb->prepare("SELECT id FROM $tabla_categorias WHERE evaluacion_id = %d ORDER BY id ASC LIMIT 1", $evaluacion_id));
        }
    }

    // Helper function to get a category by name for a given evaluation
    if (!function_exists('cpp_get_category_id_by_name')) {
        function cpp_get_category_id_by_name($evaluacion_id, $category_name) {
            global $wpdb;
            $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
            return $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM $tabla_categorias WHERE evaluacion_id = %d AND nombre_categoria = %s",
                $evaluacion_id, $category_name
            ));
        }
    }


    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    $tabla_act_programadas = $wpdb->prefix . 'cpp_programador_actividades';
    $tabla_act_evaluables = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';

    // Get the current max order in the destination
    $max_orden = $wpdb->get_var($wpdb->prepare(
        "SELECT MAX(orden) FROM $tabla_sesiones WHERE clase_id = %d AND evaluacion_id = %d AND user_id = %d",
        $destination_clase_id, $destination_evaluacion_id, $user_id
    ));
    $current_order = is_null($max_orden) ? 0 : $max_orden + 1;

    foreach ($session_ids as $session_id) {
        $session_id = intval($session_id);

        // 1. Fetch original session
        $original_session = $wpdb->get_row($wpdb->prepare("SELECT * FROM $tabla_sesiones WHERE id = %d AND user_id = %d", $session_id, $user_id), ARRAY_A);

        if (!$original_session) {
            $wpdb->query('ROLLBACK');
            return false; // Session not found or user does not own it
        }

        // 2. Duplicate session
        $new_session_data = $original_session;
        unset($new_session_data['id']);
        $new_session_data['clase_id'] = $destination_clase_id;
        $new_session_data['evaluacion_id'] = $destination_evaluacion_id;
        $new_session_data['orden'] = $current_order++;

        $result = $wpdb->insert($tabla_sesiones, $new_session_data);
        if (!$result) {
            $wpdb->query('ROLLBACK');
            return false;
        }
        $new_session_id = $wpdb->insert_id;

        // 3. Fetch and duplicate associated activities
        // Non-evaluable activities
        $non_evaluable_activities = $wpdb->get_results($wpdb->prepare("SELECT * FROM $tabla_act_programadas WHERE sesion_id = %d", $session_id), ARRAY_A);
        foreach ($non_evaluable_activities as $activity) {
            $new_activity_data = $activity;
            unset($new_activity_data['id']);
            $new_activity_data['sesion_id'] = $new_session_id;
            if (!$wpdb->insert($tabla_act_programadas, $new_activity_data)) {
                $wpdb->query('ROLLBACK');
                return false;
            }
        }

        // Evaluable activities
        $evaluable_activities = $wpdb->get_results($wpdb->prepare("SELECT * FROM $tabla_act_evaluables WHERE sesion_id = %d", $session_id), ARRAY_A);
        foreach ($evaluable_activities as $activity) {
            $new_activity_data = $activity;
            unset($new_activity_data['id']);
            $new_activity_data['clase_id'] = $destination_clase_id;
            $new_activity_data['evaluacion_id'] = $destination_evaluacion_id;
            $new_activity_data['sesion_id'] = $new_session_id;

            // Handle category mapping
            $original_category_name = $wpdb->get_var($wpdb->prepare("SELECT nombre_categoria FROM $tabla_categorias WHERE id = %d", $activity['categoria_id']));
            if ($original_category_name) {
                $new_category_id = cpp_get_category_id_by_name($destination_evaluacion_id, $original_category_name);
                if (!$new_category_id) {
                    $new_category_id = cpp_get_default_category_id_for_evaluacion($destination_evaluacion_id);
                }
                $new_activity_data['categoria_id'] = $new_category_id;
            } else {
                $new_activity_data['categoria_id'] = cpp_get_default_category_id_for_evaluacion($destination_evaluacion_id);
            }

            if (!$new_activity_data['categoria_id']) {
                // If there's still no category, we can't proceed
                $wpdb->query('ROLLBACK');
                return false;
            }

            if (!$wpdb->insert($tabla_act_evaluables, $new_activity_data)) {
                $wpdb->query('ROLLBACK');
                return false;
            }
        }
    }

    $wpdb->query('COMMIT');
    return true;
}

function cpp_programador_save_sesiones_order($user_id, $clase_id, $evaluacion_id, $orden_sesiones) {
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    if (!is_array($orden_sesiones)) {
        return false;
    }

    // Security check: Verify the user owns the class.
    $clase_owner = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_clases WHERE id = %d", $clase_id));
    if ($clase_owner != $user_id) {
        return false;
    }

    $wpdb->query('START TRANSACTION');
    foreach ($orden_sesiones as $index => $sesion_id) {
        // Update the order for each session, ensuring it belongs to the current user.
        $resultado = $wpdb->update(
            $tabla_sesiones,
            ['orden' => $index],
            ['id' => intval($sesion_id), 'user_id' => $user_id]
        );
        if ($resultado === false) {
            $wpdb->query('ROLLBACK');
            return false;
        }
    }
    $wpdb->query('COMMIT');
    return true;
}

function cpp_programador_recalculate_and_update_activity_dates($evaluacion_id, $user_id) {
    global $wpdb;

    // Obtener todos los datos necesarios en una sola llamada
    $all_data = cpp_programador_get_all_data($user_id);
    $tabla_act_evaluables = $wpdb->prefix . 'cpp_actividades_evaluables';

    $evaluacion_target = null;
    $clase_id = null;

    // Encontrar la evaluación y la clase correspondiente
    foreach ($all_data['clases'] as $clase) {
        foreach ($clase['evaluaciones'] as $eval) {
            if ($eval['id'] == $evaluacion_id) {
                $evaluacion_target = $eval;
                $clase_id = $clase['id'];
                break 2;
            }
        }
    }

    if (!$evaluacion_target || !$clase_id) {
        return false; // No se encontró la evaluación o la clase
    }

    $start_date = $evaluacion_target['start_date'];
    if (empty($start_date)) {
        return true; // No hay fecha de inicio, no hay nada que recalcular
    }

    // Filtrar las sesiones que pertenecen a esta evaluación
    $sesiones_en_evaluacion = array_filter($all_data['sesiones'], function($sesion) use ($evaluacion_id) {
        return $sesion->evaluacion_id == $evaluacion_id;
    });
    $sesiones_en_evaluacion = array_values($sesiones_en_evaluacion); // Reset keys

    if (empty($sesiones_en_evaluacion)) {
        return true; // No hay sesiones, no hay nada que hacer
    }

    // Calcular el nuevo calendario de fechas para las sesiones
    $schedule = cpp_programador_calculate_schedule_for_evaluation(
        $sesiones_en_evaluacion,
        $start_date,
        $all_data['config']['horario'],
        $all_data['config']['calendar_config'],
        $clase_id
    );

    $wpdb->query('START TRANSACTION');

    $errors = false;
    foreach ($sesiones_en_evaluacion as $index => $sesion) {
        if (isset($schedule[$index])) {
            $fecha_calculada_str = explode('_', $schedule[$index])[0];

            // Actualizar todas las actividades evaluables de esta sesión
            $update_result = $wpdb->update(
                $tabla_act_evaluables,
                ['fecha_actividad' => $fecha_calculada_str],
                ['sesion_id' => $sesion->id, 'user_id' => $user_id],
                ['%s'],
                ['%d', '%d']
            );

            if ($update_result === false) {
                $errors = true;
                break;
            }
        }
    }

    if ($errors) {
        $wpdb->query('ROLLBACK');
        return false;
    }

    $wpdb->query('COMMIT');
    return true;
}


function cpp_programador_save_start_date($user_id, $evaluacion_id, $start_date) {
    global $wpdb;
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $owner_check = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_evaluaciones WHERE id = %d", $evaluacion_id));
    if ($owner_check != $user_id) return false;

    $update_ok = $wpdb->update($tabla_evaluaciones, ['start_date' => $start_date], ['id' => $evaluacion_id], ['%s'], ['%d']) !== false;

    if ($update_ok) {
        // Después de guardar la nueva fecha de inicio, recalcular y actualizar las fechas de las actividades.
        $recalculate_ok = cpp_programador_recalculate_and_update_activity_dates($evaluacion_id, $user_id);
        // Si el recálculo falla, podríamos querer revertir el guardado de la fecha de inicio,
        // pero por ahora, simplemente devolvemos el estado del recálculo.
        return $recalculate_ok;
    }

    return false;
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

// --- Funciones de Lógica de Horario ---

/**
 * Calculates all the dates for a given evaluation's sessions based on a start date and schedule.
 *
 * @param array $sesiones_en_evaluacion Array of session objects for the evaluation.
 * @param string $start_date_str The start date in 'Y-m-d' format.
 * @param array $horario The user's schedule.
 * @param array $calendar_config The user's calendar config (working_days, holidays, vacations).
 * @param int $clase_id The ID of the class.
 * @return array An array of calculated dates for each session, e.g., ['2025-09-15_09:00', '2025-09-15_10:00'].
 */
function cpp_programador_calculate_schedule_for_evaluation($sesiones_en_evaluacion, $start_date_str, $horario, $calendar_config, $clase_id) {
    if (empty($start_date_str) || empty($sesiones_en_evaluacion) || empty($horario)) {
        return [];
    }

    $schedule = [];

    try {
        $current_date = new DateTime($start_date_str . 'T12:00:00Z');
    } catch (Exception $e) {
        return []; // Invalid date format
    }

    $session_index = 0;
    $safety_counter = 0;
    $max_iterations = 365 * 5; // 5 years of margin

    while ($session_index < count($sesiones_en_evaluacion) && $safety_counter < $max_iterations) {
        $day_key = strtolower($current_date->format('D')); // mon, tue, etc.
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

        if ($is_working_day && !$is_holiday && !$is_vacation && isset($horario[$day_key])) {
            $slots_del_dia = $horario[$day_key];
            ksort($slots_del_dia);

            foreach ($slots_del_dia as $slot => $slot_data) {
                if (isset($slot_data['claseId']) && strval($slot_data['claseId']) === strval($clase_id)) {
                    if ($session_index < count($sesiones_en_evaluacion)) {
                        $schedule[] = $ymd . '_' . $slot;
                        $session_index++;
                    }
                }
            }
        }

        $current_date->add(new DateInterval('P1D'));
        $safety_counter++;
    }

    return $schedule;
}

/**
 * Checks if a proposed start date for an evaluation causes a schedule conflict.
 *
 * @param int $user_id
 * @param int $evaluacion_id_a_chequear The evaluation being changed.
 * @param string $nueva_start_date The proposed new start date.
 * @return bool True if there is a conflict, false otherwise.
 */
function cpp_programador_check_schedule_conflict($user_id, $evaluacion_id_a_chequear, $nueva_start_date) {
    global $wpdb;
    $all_data = cpp_programador_get_all_data($user_id);

    $clase_id = $wpdb->get_var($wpdb->prepare("SELECT clase_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d AND user_id = %d", $evaluacion_id_a_chequear, $user_id));
    if (!$clase_id) return false;

    $sesiones_de_la_clase = array_filter($all_data['sesiones'], function($sesion) use ($clase_id) {
        return $sesion->clase_id == $clase_id;
    });

    $occupied_slots = [];

    $otras_evaluaciones = $wpdb->get_results($wpdb->prepare(
        "SELECT id, start_date FROM {$wpdb->prefix}cpp_evaluaciones WHERE clase_id = %d AND id != %d AND user_id = %d",
        $clase_id, $evaluacion_id_a_chequear, $user_id
    ));

    foreach ($otras_evaluaciones as $eval) {
        if (!empty($eval->start_date)) {
            $sesiones_de_esta_eval = array_filter($sesiones_de_la_clase, function($sesion) use ($eval) {
                return $sesion->evaluacion_id == $eval->id;
            });
            $schedule = cpp_programador_calculate_schedule_for_evaluation(array_values($sesiones_de_esta_eval), $eval->start_date, $all_data['config']['horario'], $all_data['config']['calendar_config'], $clase_id);
            $occupied_slots = array_merge($occupied_slots, $schedule);
        }
    }

    $occupied_slots = array_unique($occupied_slots);

    $sesiones_a_chequear = array_filter($sesiones_de_la_clase, function($sesion) use ($evaluacion_id_a_chequear) {
        return $sesion->evaluacion_id == $evaluacion_id_a_chequear;
    });
    $proposed_schedule = cpp_programador_calculate_schedule_for_evaluation(array_values($sesiones_a_chequear), $nueva_start_date, $all_data['config']['horario'], $all_data['config']['calendar_config'], $clase_id);

    $conflict = array_intersect($proposed_schedule, $occupied_slots);

    return !empty($conflict);
}


// --- Funciones CRUD para Actividades del Programador ---

function cpp_programador_get_actividades_by_sesion_id($sesion_id, $user_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_programador_actividades';
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';

    // Verificar que el usuario es el dueño de la sesión
    $owner_id = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_sesiones WHERE id = %d", $sesion_id));
    if ($owner_id != $user_id) {
        return false;
    }

    return $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $tabla_actividades WHERE sesion_id = %d ORDER BY orden ASC",
        $sesion_id
    ), ARRAY_A);
}

function cpp_programador_get_sesion_owner($sesion_id) {
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    return $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_sesiones WHERE id = %d", $sesion_id));
}

function cpp_programador_save_actividad($actividad_data, $user_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_programador_actividades';

    $actividad_id = isset($actividad_data['id']) ? intval($actividad_data['id']) : 0;
    $sesion_id = isset($actividad_data['sesion_id']) ? intval($actividad_data['sesion_id']) : 0;

    // Security check: ensure the user owns the session this activity belongs to
    $sesion_owner_id = cpp_programador_get_sesion_owner($sesion_id);
    if ($sesion_owner_id != $user_id) {
        return false;
    }

    // This table now only stores non-evaluable activities.
    $data_to_save = [
        'sesion_id' => $sesion_id,
        'titulo' => isset($actividad_data['titulo']) ? sanitize_text_field($actividad_data['titulo']) : 'Nueva tarea...',
    ];
    $format = ['%d', '%s'];

    if ($actividad_id > 0) {
        // Update existing activity
        $result = $wpdb->update($tabla_actividades, $data_to_save, ['id' => $actividad_id], $format, ['%d']);
        return $result !== false ? $actividad_id : false;
    } else {
        // Insert new activity
        $tabla_act_evaluables = $wpdb->prefix . 'cpp_actividades_evaluables';
        $max_orden_evaluable = $wpdb->get_var($wpdb->prepare("SELECT MAX(orden) FROM $tabla_act_evaluables WHERE sesion_id = %d", $sesion_id));
        $max_orden_programada = $wpdb->get_var($wpdb->prepare("SELECT MAX(orden) FROM $tabla_actividades WHERE sesion_id = %d", $sesion_id));
        $max_orden = max((is_null($max_orden_evaluable) ? -1 : $max_orden_evaluable), (is_null($max_orden_programada) ? -1 : $max_orden_programada));

        $data_to_save['orden'] = $max_orden + 1;
        $format[] = '%d';

        $result = $wpdb->insert($tabla_actividades, $data_to_save, $format);
        return $result ? $wpdb->insert_id : false;
    }
}

function cpp_programador_delete_actividad($actividad_id, $user_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_programador_actividades';

    // Security check: Get sesion_id from the activity to verify ownership
    $sesion_id = $wpdb->get_var($wpdb->prepare("SELECT sesion_id FROM $tabla_actividades WHERE id = %d", $actividad_id));
    if (!$sesion_id) {
        return false; // Activity doesn't exist
    }
    $sesion_owner_id = cpp_programador_get_sesion_owner($sesion_id);
    if ($sesion_owner_id != $user_id) {
        return false; // User doesn't own this session
    }

    // This function now only deletes non-evaluable activities.
    // Deletion of evaluable activities is handled by the gradebook's AJAX handler.
    return $wpdb->delete($tabla_actividades, ['id' => $actividad_id], ['%d']) !== false;
}

function cpp_programador_save_actividades_order($sesion_id, $orden_actividades, $user_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_programador_actividades';

    // Security check
    $sesion_owner_id = cpp_programador_get_sesion_owner($sesion_id);
    if ($sesion_owner_id != $user_id) {
        return false;
    }

    if (!is_array($orden_actividades)) return false;

    $wpdb->query('START TRANSACTION');
    foreach ($orden_actividades as $index => $actividad_id) {
        $result = $wpdb->update(
            $tabla_actividades,
            ['orden' => $index],
            ['id' => intval($actividad_id), 'sesion_id' => $sesion_id]
        );
        if ($result === false) {
            $wpdb->query('ROLLBACK');
            return false;
        }
    }
    $wpdb->query('COMMIT');
    return true;
}
