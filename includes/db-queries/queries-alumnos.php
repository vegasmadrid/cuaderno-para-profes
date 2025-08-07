<?php
// /includes/db-queries/queries-alumnos.php

defined('ABSPATH') or die('Acceso no permitido');

// --- FUNCIONES PARA ALUMNOS ---

function cpp_obtener_alumnos_clase($clase_id) {
    global $wpdb;
    $query = $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}cpp_alumnos WHERE clase_id = %d ORDER BY apellidos, nombre", $clase_id );
    return $wpdb->get_results($query, ARRAY_A);
}

function cpp_obtener_alumno_por_id($alumno_id) {
    global $wpdb;
    return $wpdb->get_row( $wpdb->prepare("SELECT * FROM {$wpdb->prefix}cpp_alumnos WHERE id = %d", $alumno_id), ARRAY_A );
}

function cpp_guardar_alumno($clase_id, $datos) {
    global $wpdb;
    return $wpdb->insert(
        $wpdb->prefix . 'cpp_alumnos',
        ['clase_id' => $clase_id, 'nombre' => sanitize_text_field($datos['nombre']), 'apellidos' => sanitize_text_field($datos['apellidos']), 'foto' => isset($datos['foto']) ? sanitize_text_field($datos['foto']) : ''],
        ['%d', '%s', '%s', '%s']
    );
}

function cpp_actualizar_alumno($alumno_id, $datos) {
    global $wpdb;
    $update_data = ['nombre' => sanitize_text_field($datos['nombre']), 'apellidos' => sanitize_text_field($datos['apellidos'])];
    $update_format = ['%s', '%s'];
    if (isset($datos['foto'])) { $update_data['foto'] = sanitize_text_field($datos['foto']); $update_format[] = '%s'; }
    return $wpdb->update( $wpdb->prefix . 'cpp_alumnos', $update_data, ['id' => $alumno_id], $update_format, ['%d'] );
}

function cpp_eliminar_todos_alumnos_clase($clase_id, $user_id) {
    global $wpdb;
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $clase_owner = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_clases WHERE id = %d", $clase_id));
    if ($clase_owner != $user_id) { return false; }
    $alumnos_ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM $tabla_alumnos WHERE clase_id = %d", $clase_id));
    if (!empty($alumnos_ids)) {
        $placeholders_alumnos = implode(', ', array_fill(0, count($alumnos_ids), '%d'));
        $wpdb->query($wpdb->prepare("DELETE FROM $tabla_calificaciones WHERE alumno_id IN ($placeholders_alumnos)", $alumnos_ids));
    }
    $alumnos_eliminados = $wpdb->delete($tabla_alumnos, ['clase_id' => $clase_id], ['%d']);
    return $alumnos_eliminados;
}

function cpp_alumno_existe($clase_id, $nombre, $apellidos) {
    global $wpdb;
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $count = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $tabla_alumnos WHERE clase_id = %d AND nombre = %s AND apellidos = %s",
        $clase_id, sanitize_text_field($nombre), sanitize_text_field($apellidos)
    ));
    return $count > 0;
}

function cpp_eliminar_alumno($alumno_id, $user_id) {
    global $wpdb;
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_asistencia = $wpdb->prefix . 'cpp_asistencia';
    $clase_del_usuario = $wpdb->get_var( $wpdb->prepare( "SELECT c.user_id FROM $tabla_alumnos a INNER JOIN $tabla_clases c ON a.clase_id = c.id WHERE a.id = %d", $alumno_id ) );
    if (null === $clase_del_usuario || $clase_del_usuario != $user_id) { return false; }
    $wpdb->delete($tabla_calificaciones, ['alumno_id' => $alumno_id], ['%d']);
    $wpdb->delete($tabla_asistencia, ['alumno_id' => $alumno_id, 'user_id' => $user_id], ['%d', '%d']);
    $resultado = $wpdb->delete($tabla_alumnos, ['id' => $alumno_id], ['%d']);
    return $resultado;
}