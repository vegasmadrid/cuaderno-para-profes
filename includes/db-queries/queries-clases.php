<?php
// /includes/db-queries/queries-clases.php

defined('ABSPATH') or die('Acceso no permitido');

// --- FUNCIONES PARA CLASES ---

function cpp_obtener_clase_completa_por_id($clase_id, $user_id) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    return $wpdb->get_row(
        $wpdb->prepare(
            "SELECT id, user_id, nombre, color, base_nota_final, orden, fecha_creacion FROM $tabla_clases WHERE id = %d AND user_id = %d",
            $clase_id,
            $user_id
        ),
        ARRAY_A 
    );
}

function cpp_actualizar_clase_completa($clase_id, $user_id, $datos) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $clase_existente = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_clases WHERE id = %d", $clase_id));
    if (null === $clase_existente || $clase_existente != $user_id) {
        return false; 
    }
    $update_data = [];
    $update_formats = [];
    if (isset($datos['nombre'])) {
        $update_data['nombre'] = sanitize_text_field(substr(trim($datos['nombre']), 0, 100));
        $update_formats[] = '%s';
    }
    if (isset($datos['color'])) {
        $update_data['color'] = preg_match('/^#[a-f0-9]{6}$/i', $datos['color']) ? $datos['color'] : '#FFFFFF';
        $update_formats[] = '%s';
    }
    if (isset($datos['base_nota_final'])) { 
        $base_nota = floatval(str_replace(',', '.', $datos['base_nota_final']));
        if ($base_nota > 0) {
            $update_data['base_nota_final'] = $base_nota;
            $update_formats[] = '%f';
        }
    }
    if (empty($update_data)) {
        return 0; 
    }
    return $wpdb->update(
        $tabla_clases,
        $update_data,
        ['id' => $clase_id, 'user_id' => $user_id], 
        $update_formats,
        ['%d', '%d'] 
    );
}

function cpp_guardar_base_nota_final_clase($clase_id, $user_id, $base_nota) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    if (!is_numeric($base_nota) || floatval($base_nota) <= 0) {
        return false;
    }
    $base_nota_sanitizada = floatval($base_nota);
    $clase_existente = $wpdb->get_row($wpdb->prepare("SELECT user_id FROM $tabla_clases WHERE id = %d", $clase_id));
    if (!$clase_existente || $clase_existente->user_id != $user_id) {
        return false; 
    }
    $resultado = $wpdb->update(
        $tabla_clases,
        ['base_nota_final' => $base_nota_sanitizada],
        ['id' => $clase_id, 'user_id' => $user_id],
        ['%f'], 
        ['%d', '%d'] 
    );
    return $resultado;
}

function cpp_obtener_clases_usuario($user_id) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $query = $wpdb->prepare(
        "SELECT c.id, c.user_id, c.nombre, c.color, c.base_nota_final, c.orden, c.fecha_creacion, COUNT(a.id) as num_alumnos
         FROM $tabla_clases c
         LEFT JOIN $tabla_alumnos a ON c.id = a.clase_id
         WHERE c.user_id = %d
         GROUP BY c.id
         ORDER BY c.orden ASC, c.fecha_creacion DESC", 
        $user_id
    );
    return $wpdb->get_results($query, ARRAY_A);
}

function cpp_guardar_clase($user_id, $datos) {
    global $wpdb;
    $base_nota_final = isset($datos['base_nota_final']) ? floatval(str_replace(',', '.', $datos['base_nota_final'])) : 100.00;
    if ($base_nota_final <= 0) $base_nota_final = 100.00;
    $nombre_clase = isset($datos['nombre']) ? sanitize_text_field(substr(trim($datos['nombre']), 0, 100)) : '';
    $resultado = $wpdb->insert(
        $wpdb->prefix . 'cpp_clases',
        [
            'user_id' => $user_id,
            'nombre' => $nombre_clase,
            'color' => preg_match('/^#[a-f0-9]{6}$/i', $datos['color']) ? $datos['color'] : '#2962FF',
            'base_nota_final' => $base_nota_final
        ],
        ['%d', '%s', '%s', '%f'] 
    );
    if($resultado) {
        $nueva_clase_id = $wpdb->insert_id;
        cpp_crear_evaluacion($nueva_clase_id, $user_id, 'Evaluación General');
    }
    return $resultado;
}

function cpp_actualizar_orden_clases($user_id, $clases_ids_ordenadas) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    if (!is_array($clases_ids_ordenadas)) {
        return false;
    }
    $success = true;
    foreach ($clases_ids_ordenadas as $index => $clase_id) {
        $clase_id_sanitizada = intval($clase_id);
        $orden_nuevo = intval($index);
        $resultado_update = $wpdb->update(
            $tabla_clases,
            ['orden' => $orden_nuevo],
            ['id' => $clase_id_sanitizada, 'user_id' => $user_id],
            ['%d'],  
            ['%d', '%d']
        );
        if ($resultado_update === false) {
            $success = false;
        }
    }
    return $success;
}

function cpp_eliminar_clase_y_alumnos($clase_id, $user_id) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $tabla_categorias_evaluacion = $wpdb->prefix . 'cpp_categorias_evaluacion';
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_asistencia = $wpdb->prefix . 'cpp_asistencia';
    $clase_a_eliminar = $wpdb->get_row( $wpdb->prepare("SELECT user_id FROM $tabla_clases WHERE id = %d", $clase_id) );
    if (!$clase_a_eliminar || $clase_a_eliminar->user_id != $user_id) { return false; }
    
    // Eliminar dependencias en cascada
    $actividades_ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM $tabla_actividades WHERE clase_id = %d", $clase_id));
    if (!empty($actividades_ids)) {
        $placeholders = implode(', ', array_fill(0, count($actividades_ids), '%d'));
        $wpdb->query($wpdb->prepare("DELETE FROM $tabla_calificaciones WHERE actividad_id IN ($placeholders)", $actividades_ids));
    }
    $wpdb->delete($tabla_actividades, ['clase_id' => $clase_id, 'user_id' => $user_id], ['%d', '%d']);
    $wpdb->delete($tabla_categorias_evaluacion, ['clase_id' => $clase_id, 'user_id' => $user_id], ['%d', '%d']);
    $wpdb->delete($tabla_evaluaciones, ['clase_id' => $clase_id, 'user_id' => $user_id], ['%d', '%d']);
    $wpdb->delete($tabla_asistencia, ['clase_id' => $clase_id, 'user_id' => $user_id], ['%d', '%d']);
    cpp_eliminar_todos_alumnos_clase($clase_id, $user_id); 
    $clase_eliminada = $wpdb->delete($tabla_clases, ['id' => $clase_id, 'user_id' => $user_id], ['%d', '%d']);
    return $clase_eliminada;
}