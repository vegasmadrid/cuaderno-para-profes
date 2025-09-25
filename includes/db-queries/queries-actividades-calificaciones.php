<?php
// /includes/db-queries/queries-actividades-calificaciones.php

defined('ABSPATH') or die('Acceso no permitido');

// --- FUNCIONES PARA ACTIVIDADES Y CALIFICACIONES ---

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
    
    // Se añade `a.id_actividad_programada` a la consulta
    return $wpdb->get_results( $wpdb->prepare(
        "SELECT a.*, cat.nombre_categoria, cat.color AS categoria_color
         FROM $tabla_actividades a
         LEFT JOIN $tabla_categorias cat ON a.categoria_id = cat.id
         WHERE a.clase_id = %d AND a.user_id = %d AND a.evaluacion_id = %d
         ORDER BY a.fecha_actividad DESC, a.nombre_actividad ASC",
        $clase_id, $user_id, $evaluacion_id
    ), ARRAY_A );
}

function cpp_guardar_actividad_evaluable($datos) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    if (empty($datos['clase_id']) || empty($datos['user_id']) || !isset($datos['categoria_id']) || empty(trim($datos['nombre_actividad'])) || empty($datos['evaluacion_id'])) { return false; }
    $nota_maxima = isset($datos['nota_maxima']) ? floatval($datos['nota_maxima']) : 10.00;
    if ($nota_maxima <= 0) { $nota_maxima = 10.00; }
    $data_to_insert = [
        'clase_id' => intval($datos['clase_id']),
        'sesion_id' => isset($datos['sesion_id']) ? intval($datos['sesion_id']) : null,
        'evaluacion_id' => intval($datos['evaluacion_id']),
        'user_id' => intval($datos['user_id']),
        'categoria_id' => intval($datos['categoria_id']),
        'nombre_actividad' => sanitize_text_field($datos['nombre_actividad']),
        'descripcion_actividad' => isset($datos['descripcion_actividad']) ? sanitize_textarea_field($datos['descripcion_actividad']) : '',
        'nota_maxima' => $nota_maxima,
        'orden' => isset($datos['orden']) ? intval($datos['orden']) : 0,
    ];
    $formats = ['%d', '%d', '%d', '%d', '%d', '%s', '%s', '%f', '%d'];
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
    $actividad_existente = $wpdb->get_row($wpdb->prepare("SELECT user_id FROM $tabla_actividades WHERE id = %d", $actividad_id));
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
    if (array_key_exists('fecha_actividad', $datos)) {
        if (!empty($datos['fecha_actividad']) && preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $datos['fecha_actividad'])) { $data_to_update['fecha_actividad'] = $datos['fecha_actividad']; }
        else { $data_to_update['fecha_actividad'] = null; }
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

        $valor_a_guardar = sanitize_text_field($nota);

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