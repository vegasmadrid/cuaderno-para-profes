<?php
// /includes/db-queries/queries-alumnos.php

defined('ABSPATH') or die('Acceso no permitido');

// --- FUNCIONES PARA ALUMNOS (Refactorizadas para relación Many-to-Many) ---

/**
 * Obtiene todos los alumnos asociados a una clase específica.
 */
function cpp_obtener_alumnos_clase($clase_id, $search_term = '', $sort_order = 'apellidos') {
    global $wpdb;
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $tabla_alumnos_clases = $wpdb->prefix . 'cpp_alumnos_clases';

    $order_by_clause = 'a.apellidos, a.nombre';
    if ($sort_order === 'nombre') {
        $order_by_clause = 'a.nombre, a.apellidos';
    }

    $sql = "SELECT a.* FROM $tabla_alumnos a
            INNER JOIN $tabla_alumnos_clases ac ON a.id = ac.alumno_id
            WHERE ac.clase_id = %d";
    $params = [$clase_id];

    if (!empty($search_term)) {
        $sql .= " AND (a.nombre LIKE %s OR a.apellidos LIKE %s)";
        $like_term = '%' . $wpdb->esc_like($search_term) . '%';
        $params[] = $like_term;
        $params[] = $like_term;
    }

    $sql .= " ORDER BY $order_by_clause";

    return $wpdb->get_results($wpdb->prepare($sql, ...$params), ARRAY_A);
}

/**
 * Obtiene todos los alumnos de un profesor.
 */
function cpp_obtener_todos_alumnos_usuario($user_id, $sort_order = 'apellidos', $search_term = '') {
    global $wpdb;
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';

    $order_by_clause = 'apellidos, nombre';
    if ($sort_order === 'nombre') {
        $order_by_clause = 'nombre, apellidos';
    }

    $sql = "SELECT * FROM $tabla_alumnos WHERE user_id = %d";
    $params = [$user_id];

    if (!empty($search_term)) {
        $sql .= " AND (nombre LIKE %s OR apellidos LIKE %s)";
        $like_term = '%' . $wpdb->esc_like($search_term) . '%';
        $params[] = $like_term;
        $params[] = $like_term;
    }

    $sql .= " ORDER BY $order_by_clause";

    return $wpdb->get_results($wpdb->prepare($sql, ...$params), ARRAY_A);
}


/**
 * Obtiene los datos de un alumno específico por su ID.
 */
function cpp_obtener_alumno_por_id($alumno_id, $user_id) {
    global $wpdb;
    return $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}cpp_alumnos WHERE id = %d AND user_id = %d",
        $alumno_id, $user_id
    ), ARRAY_A);
}

/**
 * Obtiene los IDs de las clases a las que pertenece un alumno.
 */
function cpp_get_clases_for_alumno($alumno_id) {
    global $wpdb;
    $tabla_alumnos_clases = $wpdb->prefix . 'cpp_alumnos_clases';
    return $wpdb->get_col($wpdb->prepare(
        "SELECT clase_id FROM $tabla_alumnos_clases WHERE alumno_id = %d",
        $alumno_id
    ));
}

/**
 * Crea un nuevo alumno globalmente y lo asocia a las clases proporcionadas.
 */
function cpp_crear_alumno($user_id, $datos, $clases_ids = []) {
    global $wpdb;
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $tabla_alumnos_clases = $wpdb->prefix . 'cpp_alumnos_clases';

    $wpdb->insert(
        $tabla_alumnos,
        [
            'user_id' => $user_id,
            'nombre' => sanitize_text_field($datos['nombre']),
            'apellidos' => sanitize_text_field($datos['apellidos']),
            'foto' => isset($datos['foto']) ? sanitize_text_field($datos['foto']) : '',
        ],
        ['%d', '%s', '%s', '%s']
    );

    $alumno_id = $wpdb->insert_id;

    if ($alumno_id && !empty($clases_ids)) {
        foreach ($clases_ids as $clase_id) {
            $wpdb->insert(
                $tabla_alumnos_clases,
                ['alumno_id' => $alumno_id, 'clase_id' => intval($clase_id)],
                ['%d', '%d']
            );
        }
    }

    return $alumno_id;
}

/**
 * Actualiza los datos personales de un alumno.
 */
function cpp_actualizar_alumno($alumno_id, $user_id, $datos) {
    global $wpdb;

    // Verificación de propiedad
    $owner_id = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_alumnos WHERE id = %d", $alumno_id));
    if ($owner_id != $user_id) {
        return false;
    }

    $update_data = [
        'nombre' => sanitize_text_field($datos['nombre']),
        'apellidos' => sanitize_text_field($datos['apellidos'])
    ];
    $update_format = ['%s', '%s'];

    if (isset($datos['foto'])) {
        $update_data['foto'] = sanitize_text_field($datos['foto']);
        $update_format[] = '%s';
    }

    return $wpdb->update(
        $wpdb->prefix . 'cpp_alumnos',
        $update_data,
        ['id' => $alumno_id],
        $update_format,
        ['%d']
    );
}

/**
 * Sincroniza las clases de un alumno con la lista proporcionada.
 */
function cpp_actualizar_clases_de_alumno($alumno_id, $user_id, $nuevas_clases_ids) {
    global $wpdb;

    // Verificación de propiedad
    $owner_id = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_alumnos WHERE id = %d", $alumno_id));
    if ($owner_id != $user_id) { return ['success' => false, 'error' => 'Permission denied']; }

    $clases_actuales = cpp_get_clases_for_alumno($alumno_id);
    $nuevas_clases_ids = array_map('intval', $nuevas_clases_ids);

    $clases_a_anadir = array_diff($nuevas_clases_ids, $clases_actuales);
    $clases_a_quitar = array_diff($clases_actuales, $nuevas_clases_ids);

    // Añadir nuevas asociaciones
    foreach ($clases_a_anadir as $clase_id) {
        $wpdb->insert(
            $wpdb->prefix . 'cpp_alumnos_clases',
            ['alumno_id' => $alumno_id, 'clase_id' => $clase_id],
            ['%d', '%d']
        );
    }

    // Quitar viejas asociaciones y sus datos
    foreach ($clases_a_quitar as $clase_id) {
        cpp_desvincular_alumno_de_clase($alumno_id, $clase_id, $user_id);
    }

    return ['success' => true];
}

/**
 * Desvincula a un alumno de una clase, eliminando sus calificaciones en esa clase.
 */
function cpp_desvincular_alumno_de_clase($alumno_id, $clase_id, $user_id) {
    global $wpdb;

    // La verificación de propiedad ya se hace en el manejador AJAX que llama a esta función (cpp_es_propietario_clase)

    // 1. Eliminar calificaciones
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $actividades_ids = $wpdb->get_col($wpdb->prepare(
        "SELECT id FROM $tabla_actividades WHERE clase_id = %d", $clase_id
    ));
    if (!empty($actividades_ids)) {
        $placeholders = implode(',', array_fill(0, count($actividades_ids), '%d'));
        $wpdb->query($wpdb->prepare(
            "DELETE FROM $tabla_calificaciones WHERE alumno_id = %d AND actividad_id IN ($placeholders)",
            array_merge([$alumno_id], $actividades_ids)
        ));
    }

    // 2. Eliminar asistencia
    $wpdb->delete($wpdb->prefix . 'cpp_asistencia', ['alumno_id' => $alumno_id, 'clase_id' => $clase_id], ['%d', '%d']);

    // 3. Eliminar la vinculación
    $deleted_rows = $wpdb->delete(
        $wpdb->prefix . 'cpp_alumnos_clases',
        ['alumno_id' => $alumno_id, 'clase_id' => $clase_id],
        ['%d', '%d']
    );

    // Devolver true solo si se eliminó al menos una fila.
    // $wpdb->delete devuelve el número de filas eliminadas, o false en error.
    // Un valor de 0 no es un error, pero para nosotros significa que la operación no tuvo el efecto deseado.
    return ($deleted_rows > 0);
}

/**
 * Comprueba si un alumno con el mismo nombre y apellidos ya existe para un profesor.
 */
function cpp_alumno_existe($user_id, $nombre, $apellidos) {
    global $wpdb;
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $count = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $tabla_alumnos WHERE user_id = %d AND nombre = %s AND apellidos = %s",
        $user_id, sanitize_text_field($nombre), sanitize_text_field($apellidos)
    ));
    return $count > 0;
}

/**
 * Elimina un alumno completamente del sistema.
 */
function cpp_eliminar_alumno($alumno_id, $user_id) {
    global $wpdb;

    // 1. Verificación de propiedad
    $owner_id = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_alumnos WHERE id = %d", $alumno_id));
    if ($owner_id != $user_id) { return false; }

    // 2. Eliminar de la tabla de unión
    $wpdb->delete($wpdb->prefix . 'cpp_alumnos_clases', ['alumno_id' => $alumno_id], ['%d']);

    // 3. Eliminar calificaciones
    $wpdb->delete($wpdb->prefix . 'cpp_calificaciones_alumnos', ['alumno_id' => $alumno_id], ['%d']);

    // 4. Eliminar asistencia
    $wpdb->delete($wpdb->prefix . 'cpp_asistencia', ['alumno_id' => $alumno_id], ['%d']);

    // 5. Eliminar el alumno
    return $wpdb->delete($wpdb->prefix . 'cpp_alumnos', ['id' => $alumno_id], ['%d']);
}

/**
 * Obtiene la evolución de las calificaciones de un alumno en una clase.
 */
function cpp_obtener_evolucion_calificaciones_alumno($alumno_id, $clase_id, $user_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';

    // 1. Obtener todas las actividades y sus calificaciones para el alumno en la clase
    $query = $wpdb->prepare(
        "SELECT
            act.id,
            act.nombre_actividad,
            act.nota_maxima,
            act.fecha_actividad,
            act.sesion_id,
            act.evaluacion_id,
            cal.nota
         FROM $tabla_actividades AS act
         LEFT JOIN $tabla_calificaciones AS cal
            ON act.id = cal.actividad_id AND cal.alumno_id = %d
         WHERE act.clase_id = %d",
        $alumno_id,
        $clase_id
    );
    $resultados = $wpdb->get_results($query, ARRAY_A);

    // 2. Hidratar fechas de forma correcta, agrupando por evaluación
    $actividades_por_evaluacion = [];
    foreach ($resultados as $actividad) {
        if (empty($actividad['evaluacion_id'])) continue;
        $actividades_por_evaluacion[$actividad['evaluacion_id']][] = $actividad;
    }

    $resultados_hidratados = [];
    foreach ($actividades_por_evaluacion as $eval_id => $actividades) {
        $hidratadas = cpp_hidratar_fechas_de_actividades($actividades, $clase_id, $eval_id, $user_id);
        $resultados_hidratados = array_merge($resultados_hidratados, $hidratadas);
    }
    $resultados = $resultados_hidratados;

    // 3. Procesar y normalizar datos
    $datos_evolucion = [];
    foreach ($resultados as $item) {
        if (!empty($item['nota'])) {
            $nota_numerica = cpp_extraer_numero_de_calificacion($item['nota']);
            if ($nota_numerica !== null) {
                $nota_maxima = !empty($item['nota_maxima']) ? floatval($item['nota_maxima']) : 10.0;
                $nota_normalizada = ($nota_maxima > 0) ? ($nota_numerica / $nota_maxima) * 100 : 0;

                $datos_evolucion[] = [
                    'fecha' => $item['fecha_actividad'],
                    'nombre_actividad' => $item['nombre_actividad'],
                    'nota' => round($nota_normalizada, 2),
                ];
            }
        }
    }

    // Ordenar por fecha final después de la hidratación
    usort($datos_evolucion, function($a, $b) {
        $timeA = strtotime($a['fecha']);
        $timeB = strtotime($b['fecha']);
        return $timeA <=> $timeB;
    });

    return $datos_evolucion;
}

/**
 * Comprueba si un alumno pertenece a un usuario.
 */
function cpp_es_propietario_alumno($user_id, $alumno_id) {
    global $wpdb;
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $count = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $tabla_alumnos WHERE id = %d AND user_id = %d",
        $alumno_id, $user_id
    ));
    return $count > 0;
}
