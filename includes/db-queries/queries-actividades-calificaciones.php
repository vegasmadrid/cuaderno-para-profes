<?php
// /includes/db-queries/queries-actividades-calificaciones.php

defined('ABSPATH') or die('Acceso no permitido');

// --- FUNCIONES PARA ACTIVIDADES Y CALIFICACIONES ---

/**
 * Hidrata un array de actividades con las fechas calculadas de sus sesiones, si es necesario.
 * Esta es la "fuente única de verdad" para las fechas de actividades programadas.
 *
 * @param array $actividades Array de actividades a procesar.
 * @param int $clase_id El ID de la clase actual.
 * @param int $evaluacion_id El ID de la evaluación actual.
 * @param int $user_id El ID del usuario actual.
 * @return array El array de actividades con las fechas actualizadas.
 */
function cpp_hidratar_fechas_de_actividades($actividades, $clase_id, $evaluacion_id, $user_id) {
    if (empty($actividades) || empty($clase_id) || empty($evaluacion_id)) {
        return $actividades;
    }

    $actividades_a_hidratar = [];
    foreach ($actividades as $actividad) {
        if (empty($actividad['fecha_actividad']) && !empty($actividad['sesion_id'])) {
            $actividades_a_hidratar[$actividad['id']] = $actividad['sesion_id'];
        }
    }

    if (empty($actividades_a_hidratar)) {
        return $actividades;
    }

    // Si hay actividades que necesitan fecha, obtenemos el mapa de fechas de la programación.
    // Esta función ya es eficiente y calcula las fechas para toda una evaluación de una vez.
    $fechas_sesiones = cpp_programador_get_fechas_for_evaluacion($user_id, $clase_id, $evaluacion_id);

    if (empty($fechas_sesiones)) {
        return $actividades;
    }

    // Recorremos el array original de actividades y actualizamos las fechas donde sea necesario.
    foreach ($actividades as $index => $actividad) {
        $actividad_id = $actividad['id'];
        if (isset($actividades_a_hidratar[$actividad_id])) {
            $sesion_id_correspondiente = $actividades_a_hidratar[$actividad_id];
            if (isset($fechas_sesiones[$sesion_id_correspondiente]['fecha'])) {
                $actividades[$index]['fecha_actividad'] = $fechas_sesiones[$sesion_id_correspondiente]['fecha'];
            }
        }
    }

    return $actividades;
}


function cpp_obtener_actividades_por_clase($clase_id, $user_id, $evaluacion_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
    $clase_pertenece = $wpdb->get_var($wpdb->prepare( "SELECT COUNT(*) FROM $tabla_clases WHERE id = %d AND user_id = %d", $clase_id, $user_id ));
    if ($clase_pertenece == 0) { return []; }

    if ($evaluacion_id === null) {
        $evaluacion_id = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}cpp_evaluaciones WHERE clase_id = %d AND user_id = %d ORDER BY orden ASC, id ASC LIMIT 1",
            $clase_id, $user_id
        ));
    }
    if(empty($evaluacion_id)) {
        return [];
    }
    
    // 1. Obtener las actividades de la base de datos
    $actividades = $wpdb->get_results( $wpdb->prepare(
        "SELECT a.*, cat.nombre_categoria, cat.color AS categoria_color
         FROM $tabla_actividades a
         LEFT JOIN $tabla_categorias cat ON a.categoria_id = cat.id
         WHERE a.clase_id = %d AND a.user_id = %d AND a.evaluacion_id = %d",
        $clase_id, $user_id, $evaluacion_id
    ), ARRAY_A );

    // 2. Hidratar las fechas de las actividades que lo necesiten
    $actividades = cpp_hidratar_fechas_de_actividades($actividades, $clase_id, $evaluacion_id, $user_id);

    // 3. Ordenar las actividades CON LAS FECHAS YA HIDRATADAS
    usort($actividades, function($a, $b) {
        // Añadir comprobaciones para evitar pasar null a strtotime()
        $fecha_a = !empty($a['fecha_actividad']) ? strtotime($a['fecha_actividad']) : false;
        $fecha_b = !empty($b['fecha_actividad']) ? strtotime($b['fecha_actividad']) : false;

        if ($fecha_a == $fecha_b) {
            return strcmp($a['nombre_actividad'], $b['nombre_actividad']);
        }
        // Si una fecha es nula o inválida, la ponemos al final
        if ($fecha_a === false) return 1;
        if ($fecha_b === false) return -1;

        return $fecha_a - $fecha_b;
    });

    return $actividades;
}

function cpp_guardar_actividad_evaluable($datos) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    if (empty($datos['clase_id']) || empty($datos['user_id']) || !isset($datos['categoria_id']) || empty(trim($datos['nombre_actividad'])) || empty($datos['evaluacion_id'])) { return false; }
    $nota_maxima = isset($datos['nota_maxima']) ? floatval($datos['nota_maxima']) : 10.00;
    if ($nota_maxima <= 0) { $nota_maxima = 10.00; }
    $sesion_id = isset($datos['sesion_id']) && !empty($datos['sesion_id']) ? intval($datos['sesion_id']) : null;
    $data_to_insert = [
        'clase_id' => intval($datos['clase_id']),
        'sesion_id' => $sesion_id,
        'evaluacion_id' => intval($datos['evaluacion_id']),
        'user_id' => intval($datos['user_id']),
        'categoria_id' => intval($datos['categoria_id']),
        'nombre_actividad' => sanitize_text_field($datos['nombre_actividad']),
        'descripcion_actividad' => isset($datos['descripcion_actividad']) ? sanitize_textarea_field($datos['descripcion_actividad']) : '',
        'nota_maxima' => $nota_maxima,
        'orden' => isset($datos['orden']) ? intval($datos['orden']) : 0,
    ];
    $formats = ['%d', '%d', '%d', '%d', '%d', '%s', '%s', '%f', '%d'];
    // La fecha se procesa siempre, ya que el backend puede pasar una fecha calculada
    // para actividades de la programación. La validación en la actualización previene cambios no deseados.
    if (!empty($datos['fecha_actividad'])) {
        if (preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $datos['fecha_actividad'])) {
            $data_to_insert['fecha_actividad'] = $datos['fecha_actividad']; $formats[] = '%s';
        } else { $data_to_insert['fecha_actividad'] = null; $formats[] = '%s'; }
    } else { $data_to_insert['fecha_actividad'] = null; $formats[] = '%s'; }
    $resultado = $wpdb->insert($tabla_actividades, $data_to_insert, $formats);
    return $resultado ? $wpdb->insert_id : false;
}

function cpp_actualizar_actividad_evaluable($actividad_id, $datos) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    if (!isset($datos['user_id'])) { return false; }
    $user_id_actual = intval($datos['user_id']);
    $actividad_existente = $wpdb->get_row($wpdb->prepare("SELECT user_id, sesion_id FROM $tabla_actividades WHERE id = %d", $actividad_id));
    if (!$actividad_existente || $actividad_existente->user_id != $user_id_actual) { return false; }
    $data_to_update = []; $formats_update = [];
    if (isset($datos['nombre_actividad']) && !empty(trim($datos['nombre_actividad']))) { $data_to_update['nombre_actividad'] = sanitize_text_field(trim($datos['nombre_actividad'])); $formats_update[] = '%s'; }
    if (isset($datos['categoria_id']) && isset($datos['evaluacion_id'])) {
        $categoria_valida = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}cpp_categorias_evaluacion WHERE id = %d AND evaluacion_id = %d", intval($datos['categoria_id']), intval($datos['evaluacion_id'])));
        if ($categoria_valida > 0) { $data_to_update['categoria_id'] = intval($datos['categoria_id']); $formats_update[] = '%d'; }
    }
    if (isset($datos['evaluacion_id']) && !empty($datos['evaluacion_id'])) {
        $data_to_update['evaluacion_id'] = intval($datos['evaluacion_id']);
        $formats_update[] = '%d';
    }
     if (isset($datos['sesion_id'])) {
        $data_to_update['sesion_id'] = intval($datos['sesion_id']);
        $formats_update[] = '%d';
    }
    if (isset($datos['nota_maxima'])) { $nota_maxima = floatval($datos['nota_maxima']); $data_to_update['nota_maxima'] = ($nota_maxima > 0) ? $nota_maxima : 10.00; $formats_update[] = '%f'; }

    // Solo actualizar la fecha si la actividad NO está vinculada a una sesión de programación
    $es_actividad_programada = !empty($actividad_existente->sesion_id);
    if (!$es_actividad_programada && array_key_exists('fecha_actividad', $datos)) {
        if (!empty($datos['fecha_actividad']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $datos['fecha_actividad'])) {
            $data_to_update['fecha_actividad'] = $datos['fecha_actividad'];
        } else {
            $data_to_update['fecha_actividad'] = null;
        }
        $formats_update[] = '%s';
    }

    if (isset($datos['descripcion_actividad'])) { $data_to_update['descripcion_actividad'] = sanitize_textarea_field($datos['descripcion_actividad']); $formats_update[] = '%s'; }

    if (empty($data_to_update)) { return 0; }
    $where = ['id' => $actividad_id, 'user_id' => $user_id_actual]; $where_formats = ['%d', '%d'];
    $resultado = $wpdb->update($tabla_actividades, $data_to_update, $where, $formats_update, $where_formats);
    return $resultado;
}

function cpp_obtener_calificaciones_cuaderno($clase_id, $user_id, $evaluacion_id) {
    global $wpdb;
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $clase_pertenece = $wpdb->get_var($wpdb->prepare( "SELECT COUNT(*) FROM $tabla_clases WHERE id = %d AND user_id = %d", $clase_id, $user_id ));
    if ($clase_pertenece == 0) { return []; }

    if ($evaluacion_id === null) {
        $evaluacion_id = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}cpp_evaluaciones WHERE clase_id = %d AND user_id = %d ORDER BY orden ASC, id ASC LIMIT 1",
            $clase_id, $user_id
        ));
    }
    if(empty($evaluacion_id)) {
        return [];
    }

    $calificaciones_raw = $wpdb->get_results( $wpdb->prepare( "SELECT ca.alumno_id, ca.actividad_id, ca.nota FROM $tabla_calificaciones ca INNER JOIN $tabla_actividades act ON ca.actividad_id = act.id WHERE act.clase_id = %d AND act.user_id = %d AND act.evaluacion_id = %d", $clase_id, $user_id, $evaluacion_id ), ARRAY_A );
    $calificaciones_formateadas = [];
    foreach ($calificaciones_raw as $cal) { $calificaciones_formateadas[$cal['alumno_id']][$cal['actividad_id']] = $cal['nota']; }
    return $calificaciones_formateadas;
}

function cpp_guardar_o_actualizar_calificacion($alumno_id, $actividad_id, $nota, $user_id) {
    global $wpdb;
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';

    $actividad_info = $wpdb->get_row($wpdb->prepare("SELECT user_id, nota_maxima FROM $tabla_actividades WHERE id = %d", $actividad_id));
    if (!$actividad_info || $actividad_info->user_id != $user_id) {
        return false;
    }

    $nota_maxima_actividad = floatval($actividad_info->nota_maxima);
    $valor_a_guardar = null;
    $formato_valor = '%s'; // Por defecto, tratar como string para permitir texto libre

    if ($nota !== null) {
        // Extraer solo la parte numérica para la validación
        preg_match('/^[0-9,.]*/', $nota, $matches);
        $parte_numerica_str = isset($matches[0]) ? $matches[0] : '';
        $parte_numerica_str_limpia = str_replace(',', '.', $parte_numerica_str);

        if ($parte_numerica_str_limpia !== '' && is_numeric($parte_numerica_str_limpia)) {
            $nota_numerica = floatval($parte_numerica_str_limpia);
            if ($nota_numerica < 0 || $nota_numerica > $nota_maxima_actividad) {
                return false; // La parte numérica excede los límites
            }
        }

        $valor_a_guardar = $nota;

    } else { // Si la nota es null (celda vacía)
        $existente_id_a_borrar = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $tabla_calificaciones WHERE alumno_id = %d AND actividad_id = %d",
            $alumno_id, $actividad_id
        ));
        if ($existente_id_a_borrar) {
            return $wpdb->delete($tabla_calificaciones, ['id' => $existente_id_a_borrar], ['%d']);
        }
        return true; // No hay nada que borrar, éxito
    }

    $existente_id = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $tabla_calificaciones WHERE alumno_id = %d AND actividad_id = %d",
        $alumno_id, $actividad_id
    ));

    $datos_calificacion = ['alumno_id' => $alumno_id, 'actividad_id' => $actividad_id, 'nota' => $valor_a_guardar];
    $formatos_calificacion = ['%d', '%d', $formato_valor];

    if ($existente_id) {
        return $wpdb->update($tabla_calificaciones, $datos_calificacion, ['id' => $existente_id], $formatos_calificacion, ['%d']);
    } else {
        return $wpdb->insert($tabla_calificaciones, $datos_calificacion, $formatos_calificacion);
    }
}

function cpp_eliminar_actividad_y_calificaciones($actividad_id, $user_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';

    $actividad_owner = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_actividades WHERE id = %d", $actividad_id));
    if ($actividad_owner != $user_id) {
        return false;
    }

    $wpdb->delete($tabla_calificaciones, ['actividad_id' => $actividad_id], ['%d']);
    $resultado = $wpdb->delete($tabla_actividades, ['id' => $actividad_id, 'user_id' => $user_id], ['%d', '%d']);

    return $resultado !== false;
}

/**
 * NUEVA FUNCIÓN PARA OBTENER ACTIVIDADES DE UNA EVALUACIÓN CON LAS CALIFICACIONES DE UN ALUMNO ESPECÍFICO.
 * Combina la obtención de actividades con las notas del alumno para simplificar la lógica en los AJAX Handlers.
 *
 * @param int $evaluacion_id ID de la evaluación.
 * @param int $alumno_id ID del alumno.
 * @param int $user_id ID del usuario para verificación de permisos.
 * @return array Lista de actividades con una propiedad 'calificacion' añadida a cada una.
 */
function cpp_obtener_actividades_con_calificaciones_alumno($evaluacion_id, $alumno_id, $user_id) {
    global $wpdb;

    // Primero, obtenemos todas las actividades de la evaluación.
    // Usamos las funciones existentes para mantener la consistencia.
    $clase_id = $wpdb->get_var($wpdb->prepare(
        "SELECT clase_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d AND user_id = %d",
        $evaluacion_id, $user_id
    ));

    if (!$clase_id) {
        return []; // La evaluación no existe o no pertenece al usuario.
    }

    // Reutilizamos la función existente para obtener todas las actividades ordenadas y con fechas hidratadas
    $actividades = cpp_obtener_actividades_por_clase($clase_id, $user_id, $evaluacion_id);

    if (empty($actividades)) {
        return [];
    }

    // Ahora, obtenemos todas las calificaciones del alumno para estas actividades de una sola vez.
    $ids_actividades = wp_list_pluck($actividades, 'id');
    $placeholders = implode(',', array_fill(0, count($ids_actividades), '%d'));

    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $calificaciones_raw = $wpdb->get_results($wpdb->prepare(
        "SELECT actividad_id, nota FROM $tabla_calificaciones WHERE alumno_id = %d AND actividad_id IN ($placeholders)",
        array_merge([$alumno_id], $ids_actividades)
    ), OBJECT_K); // OBJECT_K para indexar por actividad_id

    // Finalmente, fusionamos las calificaciones con las actividades.
    foreach ($actividades as &$actividad) {
        if (isset($calificaciones_raw[$actividad['id']])) {
            $actividad['calificacion'] = $calificaciones_raw[$actividad['id']]->nota;
        } else {
            $actividad['calificacion'] = null; // Aseguramos que la propiedad siempre exista.
        }
    }

    return $actividades;
}
function cpp_update_actividad_evaluable_fecha($actividad_id, $fecha, $user_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';

    // Verificación de propiedad
    $actividad_owner = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_actividades WHERE id = %d", $actividad_id));
    if ($actividad_owner != $user_id) {
        return false; // El usuario no es el propietario
    }

    // Validación simple de formato de fecha
    if (!preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $fecha)) {
        return false; // Formato de fecha no válido
    }

    $resultado = $wpdb->update(
        $tabla_actividades,
        ['fecha_actividad' => $fecha],
        ['id' => $actividad_id],
        ['%s'],
        ['%d']
    );

    return $resultado !== false;
}