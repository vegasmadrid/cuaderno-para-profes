<?php
// /includes/db-queries/queries-asistencia.php

defined('ABSPATH') or die('Acceso no permitido');

// --- FUNCIONES PARA ASISTENCIA ---

function cpp_guardar_asistencia_multiple($user_id, $clase_id, $fecha_asistencia, $asistencias_alumnos) {
    global $wpdb;
    $tabla_asistencia = $wpdb->prefix . 'cpp_asistencia';
    $user_id = intval($user_id);
    $clase_id = intval($clase_id);

    if (!preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $fecha_asistencia)) {
        return false;
    }

    $clase_pertenece = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}cpp_clases WHERE id = %d AND user_id = %d",
        $clase_id, $user_id
    ));
    if ($clase_pertenece == 0) {
        return false;
    }

    $todos_ok = true;
    foreach ($asistencias_alumnos as $asistencia) {
        $alumno_id = isset($asistencia['alumno_id']) ? intval($asistencia['alumno_id']) : 0;
        $estado = isset($asistencia['estado']) ? sanitize_text_field($asistencia['estado']) : '';
        $observaciones = isset($asistencia['observaciones']) ? sanitize_textarea_field($asistencia['observaciones']) : null;

        if (empty($alumno_id) || empty($estado)) {
            $todos_ok = false;
            continue;
        }

        $existente_id = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $tabla_asistencia WHERE clase_id = %d AND alumno_id = %d AND user_id = %d AND fecha_asistencia = %s",
            $clase_id, $alumno_id, $user_id, $fecha_asistencia
        ));

        if ($existente_id) {
            $resultado = $wpdb->update(
                $tabla_asistencia,
                ['estado' => $estado, 'observaciones' => $observaciones, 'fecha_registro' => current_time('mysql', 1)],
                ['id' => $existente_id],
                ['%s', '%s', '%s'], ['%d']
            );
        } else {
            $resultado = $wpdb->insert(
                $tabla_asistencia,
                [
                    'clase_id' => $clase_id,
                    'alumno_id' => $alumno_id,
                    'user_id' => $user_id,
                    'fecha_asistencia' => $fecha_asistencia,
                    'estado' => $estado,
                    'observaciones' => $observaciones,
                    'fecha_registro' => current_time('mysql', 1) 
                ],
                ['%d', '%d', '%d', '%s', '%s', '%s', '%s']
            );
        }

        if ($resultado === false) {
            $todos_ok = false;
        }
    }
    return $todos_ok;
}

function cpp_obtener_asistencia_por_fecha($user_id, $clase_id, $fecha) {
    global $wpdb;
    $tabla_asistencia = $wpdb->prefix . 'cpp_asistencia';
    $user_id = intval($user_id);
    $clase_id = intval($clase_id);

    if (!preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $fecha)) {
        return [];
    }

    $sql = $wpdb->prepare(
        "SELECT alumno_id, estado, observaciones FROM $tabla_asistencia 
         WHERE clase_id = %d AND user_id = %d AND fecha_asistencia = %s",
        $clase_id, $user_id, $fecha
    );
    $resultados = $wpdb->get_results($sql, ARRAY_A);

    if ($wpdb->last_error) {
        return []; 
    }

    $asistencia_por_alumno = [];
    if ($resultados) {
        foreach ($resultados as $row) {
            $asistencia_por_alumno[$row['alumno_id']] = [
                'estado' => $row['estado'],
                'observaciones' => $row['observaciones']
            ];
        }
    }
    return $asistencia_por_alumno;
}

function cpp_obtener_asistencia_alumno_para_clase($user_id, $alumno_id, $clase_id) {
    global $wpdb;
    $tabla_asistencia = $wpdb->prefix . 'cpp_asistencia';
    $tabla_clases = $wpdb->prefix . 'cpp_clases';

    $user_id = intval($user_id);
    $alumno_id = intval($alumno_id);
    $clase_id = intval($clase_id);

    $clase_owner = $wpdb->get_var($wpdb->prepare(
        "SELECT user_id FROM $tabla_clases WHERE id = %d", $clase_id
    ));

    if (!$clase_owner || $clase_owner != $user_id) {
        return [];
    }

    $sql = $wpdb->prepare(
        "SELECT fecha_asistencia, estado, observaciones 
         FROM $tabla_asistencia
         WHERE alumno_id = %d AND clase_id = %d AND user_id = %d
         ORDER BY fecha_asistencia DESC",
        $alumno_id, $clase_id, $user_id 
    );
    $resultados = $wpdb->get_results($sql, ARRAY_A);

    if ($wpdb->last_error) {
        return []; 
    }

    return $resultados ? $resultados : [];
}