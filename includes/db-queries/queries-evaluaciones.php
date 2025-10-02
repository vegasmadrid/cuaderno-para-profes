<?php
// /includes/db-queries/queries-evaluaciones.php

defined('ABSPATH') or die('Acceso no permitido');

// --- FUNCIONES CRUD PARA EVALUACIONES ---

function cpp_obtener_evaluaciones_por_clase($clase_id, $user_id) {
    global $wpdb;
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $clase_pertenece = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}cpp_clases WHERE id = %d AND user_id = %d", $clase_id, $user_id));
    if ($clase_pertenece == 0) {
        return [];
    }
    $evaluaciones = $wpdb->get_results($wpdb->prepare(
        "SELECT id, clase_id, user_id, nombre_evaluacion, start_date, calculo_nota, orden, fecha_creacion FROM $tabla_evaluaciones WHERE clase_id = %d AND user_id = %d ORDER BY orden ASC, fecha_creacion ASC",
        $clase_id, $user_id
    ), ARRAY_A);

    if (!empty($evaluaciones)) {
        foreach ($evaluaciones as $key => $evaluacion) {
            $evaluaciones[$key]['categorias'] = cpp_obtener_categorias_por_evaluacion($evaluacion['id'], $user_id);
        }
    }

    return $evaluaciones;
}

function cpp_crear_evaluacion($clase_id, $user_id, $nombre_evaluacion) {
    global $wpdb;
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    if (empty(trim($nombre_evaluacion))) {
        return false;
    }
    $clase_pertenece = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}cpp_clases WHERE id = %d AND user_id = %d", $clase_id, $user_id));
    if ($clase_pertenece == 0) {
        return false;
    }
    // El método de cálculo por defecto ('total') se establece en la BBDD. No es necesario añadirlo aquí.
    $resultado = $wpdb->insert(
        $tabla_evaluaciones,
        [
            'clase_id' => $clase_id,
            'user_id' => $user_id,
            'nombre_evaluacion' => sanitize_text_field($nombre_evaluacion)
        ],
        ['%d', '%d', '%s']
    );
    return $resultado ? $wpdb->insert_id : false;
}

function cpp_actualizar_evaluacion($evaluacion_id, $user_id, $nuevo_nombre) {
    global $wpdb;
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    if (empty(trim($nuevo_nombre))) {
        return false;
    }
    $owner_check = $wpdb->get_var($wpdb->prepare(
        "SELECT user_id FROM $tabla_evaluaciones WHERE id = %d",
        $evaluacion_id
    ));
    if ((int)$owner_check !== (int)$user_id) {
        return false;
    }
    return $wpdb->update(
        $tabla_evaluaciones,
        ['nombre_evaluacion' => sanitize_text_field($nuevo_nombre)],
        ['id' => $evaluacion_id, 'user_id' => $user_id],
        ['%s'],
        ['%d', '%d']
    );
}

function cpp_actualizar_orden_evaluaciones($user_id, $evaluaciones_ids_ordenadas) {
    global $wpdb;
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    if (!is_array($evaluaciones_ids_ordenadas)) {
        return false;
    }
    $success = true;
    foreach ($evaluaciones_ids_ordenadas as $index => $evaluacion_id) {
        $resultado_update = $wpdb->update(
            $tabla_evaluaciones,
            ['orden' => intval($index)],
            ['id' => intval($evaluacion_id), 'user_id' => $user_id],
            ['%d'],
            ['%d', '%d']
        );
        if ($resultado_update === false) {
            $success = false;
        }
    }
    return $success;
}

function cpp_eliminar_evaluacion_y_dependencias($evaluacion_id, $user_id) {
    global $wpdb;
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';

    $evaluacion_owner = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_evaluaciones WHERE id = %d", $evaluacion_id));
    if (!$evaluacion_owner || $evaluacion_owner != $user_id) {
        return false;
    }

    $actividades_ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM $tabla_actividades WHERE evaluacion_id = %d AND user_id = %d", $evaluacion_id, $user_id));

    if (!empty($actividades_ids)) {
        $placeholders = implode(', ', array_fill(0, count($actividades_ids), '%d'));
        $wpdb->query($wpdb->prepare("DELETE FROM $tabla_calificaciones WHERE actividad_id IN ($placeholders)", $actividades_ids));
        $wpdb->query($wpdb->prepare("DELETE FROM $tabla_actividades WHERE id IN ($placeholders) AND user_id = %d", array_merge($actividades_ids, [$user_id])));
    }
    
    $wpdb->delete($tabla_categorias, ['evaluacion_id' => $evaluacion_id], ['%d']);

    return $wpdb->delete($tabla_evaluaciones, ['id' => $evaluacion_id, 'user_id' => $user_id], ['%d', '%d']);
}

function cpp_copiar_categorias_de_evaluacion($id_evaluacion_origen, $id_evaluacion_destino, $user_id) {
    global $wpdb;
    $evaluacion_origen_owner = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d", $id_evaluacion_origen));
    $evaluacion_destino_owner = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d", $id_evaluacion_destino));
    if ($evaluacion_origen_owner != $user_id || $evaluacion_destino_owner != $user_id) { return false; }
    $categorias_origen = cpp_obtener_categorias_por_evaluacion($id_evaluacion_origen, $user_id);
    if (empty($categorias_origen)) { return true; }
    foreach ($categorias_origen as $categoria) {
        cpp_guardar_categoria_evaluacion(
            $id_evaluacion_destino,
            $user_id,
            $categoria['nombre_categoria'],
            $categoria['porcentaje'],
            $categoria['color']
        );
    }
    return true;
}

function cpp_get_evaluaciones_para_media($clase_id, $user_id) {
    global $wpdb;
    $config_table = $wpdb->prefix . 'cpp_clase_final_eval_config';

    $config_row = $wpdb->get_var($wpdb->prepare(
        "SELECT evaluacion_ids FROM $config_table WHERE clase_id = %d AND user_id = %d",
        $clase_id,
        $user_id
    ));

    if ($config_row !== null) {
        // Si hay una configuración guardada, devolverla como un array de IDs
        // Filtramos para quitar valores vacíos por si la cadena es ""
        return array_filter(array_map('intval', explode(',', $config_row)));
    } else {
        // Si no hay configuración, por defecto se usan TODAS las evaluaciones
        $todas_las_evaluaciones = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
        return wp_list_pluck($todas_las_evaluaciones, 'id');
    }
}

function cpp_save_evaluaciones_para_media($clase_id, $user_id, $evaluaciones_ids) {
    global $wpdb;
    $config_table = $wpdb->prefix . 'cpp_clase_final_eval_config';

    // Asegurarnos de que el usuario es dueño de la clase
    $clase_owner_check = $wpdb->get_var($wpdb->prepare(
        "SELECT user_id FROM {$wpdb->prefix}cpp_clases WHERE id = %d",
        $clase_id
    ));

    if ((int)$clase_owner_check !== (int)$user_id) {
        return false; // El usuario no es el dueño de la clase
    }

    $ids_string = implode(',', array_map('intval', $evaluaciones_ids));

    // Usamos INSERT ... ON DUPLICATE KEY UPDATE para insertar o actualizar
    $query = $wpdb->prepare(
        "INSERT INTO $config_table (clase_id, user_id, evaluacion_ids) VALUES (%d, %d, %s)
         ON DUPLICATE KEY UPDATE evaluacion_ids = %s",
        $clase_id,
        $user_id,
        $ids_string,
        $ids_string
    );

    $resultado = $wpdb->query($query);

    return $resultado !== false;
}

// ====================================================================
// --- NUEVA FUNCIÓN ---
// Asigna actividades sin categoría a una categoría por defecto.
// ====================================================================
function cpp_asignar_actividades_huerfanas_a_categoria_por_defecto($evaluacion_id, $user_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
    $nombre_cat_defecto = 'Sin categoría';
    
    // 1. Buscar o crear la categoría por defecto para esta evaluación.
    $id_cat_defecto = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $tabla_categorias WHERE evaluacion_id = %d AND nombre_categoria = %s",
        $evaluacion_id, $nombre_cat_defecto
    ));

    if (!$id_cat_defecto) {
        $id_cat_defecto = cpp_guardar_categoria_evaluacion($evaluacion_id, $user_id, $nombre_cat_defecto, 0, '#808080');
        if (!$id_cat_defecto) {
            return false; // No se pudo crear la categoría por defecto
        }
    }

    // 2. Encontrar todas las actividades de esta evaluación que NO tengan una categoría válida.
    // Una categoría no es válida si su ID no está en la lista de IDs de categorías de esta evaluación.
    $ids_categorias_validas = $wpdb->get_col($wpdb->prepare("SELECT id FROM $tabla_categorias WHERE evaluacion_id = %d", $evaluacion_id));
    
    // Si por alguna razón la lista está vacía, no podemos continuar.
    if(empty($ids_categorias_validas)) return false;

    $placeholders = implode(', ', array_fill(0, count($ids_categorias_validas), '%d'));

    $actividades_huerfanas = $wpdb->get_col($wpdb->prepare(
        "SELECT id FROM $tabla_actividades WHERE evaluacion_id = %d AND categoria_id NOT IN ($placeholders)",
        array_merge([$evaluacion_id], $ids_categorias_validas)
    ));

    // 3. Si hay actividades huérfanas, asignarlas a la categoría por defecto.
    if (!empty($actividades_huerfanas)) {
        $placeholders_huerfanas = implode(', ', array_fill(0, count($actividades_huerfanas), '%d'));
        $wpdb->query($wpdb->prepare(
            "UPDATE $tabla_actividades SET categoria_id = %d WHERE id IN ($placeholders_huerfanas)",
            array_merge([$id_cat_defecto], $actividades_huerfanas)
        ));
    }

    return true;
}