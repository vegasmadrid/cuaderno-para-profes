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

    $defaults = ['time_slots' => ['09:00', '10:00', '11:00', '12:00'], 'horario' => new stdClass()];
    $config = array_merge($defaults, $config);

    $sesiones = $wpdb->get_results($wpdb->prepare("SELECT * FROM $tabla_sesiones WHERE user_id = %d ORDER BY clase_id, evaluacion_id, orden ASC", $user_id));

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
