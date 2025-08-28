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
    $tabla_lecciones = $wpdb->prefix . 'cpp_programador_lecciones';
    $tabla_eventos = $wpdb->prefix . 'cpp_programador_eventos';

    $clases = cpp_obtener_clases_usuario($user_id);

    $config_results = $wpdb->get_results($wpdb->prepare("SELECT clave, valor FROM $tabla_config WHERE user_id = %d", $user_id), ARRAY_A);
    $config = [];
    foreach ($config_results as $resultado) {
        $valor = json_decode($resultado['valor'], true);
        $config[$resultado['clave']] = (json_last_error() === JSON_ERROR_NONE) ? $valor : $resultado['valor'];
    }

    $defaults = ['time_slots' => ['09:00', '10:00', '11:00', '12:00'], 'horario' => new stdClass()];
    $config = array_merge($defaults, $config);

    $lecciones = $wpdb->get_results($wpdb->prepare("SELECT * FROM $tabla_lecciones WHERE user_id = %d ORDER BY clase_id, orden ASC", $user_id));
    $eventos = $wpdb->get_results($wpdb->prepare("SELECT * FROM $tabla_eventos WHERE user_id = %d", $user_id));

    return ['clases' => $clases, 'config' => $config, 'lecciones' => $lecciones, 'eventos' => $eventos];
}

function cpp_programador_save_leccion($data) {
    global $wpdb;
    $tabla_lecciones = $wpdb->prefix . 'cpp_programador_lecciones';
    $leccion_id = isset($data['id']) ? intval($data['id']) : 0;
    $user_id = isset($data['user_id']) ? intval($data['user_id']) : 0;
    $clase_id = isset($data['clase_id']) ? intval($data['clase_id']) : 0;
    $titulo = isset($data['titulo']) ? sanitize_text_field($data['titulo']) : '';
    $descripcion = isset($data['descripcion']) ? sanitize_textarea_field($data['descripcion']) : '';

    if (empty($user_id) || empty($clase_id) || empty($titulo)) return false;

    $datos_a_guardar = ['user_id' => $user_id, 'clase_id' => $clase_id, 'titulo' => $titulo, 'descripcion' => $descripcion];
    $format = ['%d', '%d', '%s', '%s'];

    if ($leccion_id > 0) {
        $resultado = $wpdb->update($tabla_lecciones, $datos_a_guardar, ['id' => $leccion_id, 'user_id' => $user_id], $format, ['%d', '%d']);
        return $resultado !== false ? $leccion_id : false;
    } else {
        $max_orden = $wpdb->get_var($wpdb->prepare("SELECT MAX(orden) FROM $tabla_lecciones WHERE user_id = %d AND clase_id = %d", $user_id, $clase_id));
        $datos_a_guardar['orden'] = is_null($max_orden) ? 0 : $max_orden + 1;
        $format[] = '%d';
        $resultado = $wpdb->insert($tabla_lecciones, $datos_a_guardar, $format);
        return $resultado ? $wpdb->insert_id : false;
    }
}

function cpp_programador_delete_leccion($leccion_id, $user_id) {
    global $wpdb;
    $tabla_lecciones = $wpdb->prefix . 'cpp_programador_lecciones';
    $tabla_eventos = $wpdb->prefix . 'cpp_programador_eventos';
    $wpdb->delete($tabla_eventos, ['leccion_id' => $leccion_id, 'user_id' => $user_id], ['%d', '%d']);
    return $wpdb->delete($tabla_lecciones, ['id' => $leccion_id, 'user_id' => $user_id], ['%d', '%d']) !== false;
}

function cpp_programador_save_evento($data) {
    global $wpdb;
    $tabla_eventos = $wpdb->prefix . 'cpp_programador_eventos';
    $user_id = isset($data['user_id']) ? intval($data['user_id']) : 0;
    $leccion_id = isset($data['leccion_id']) ? intval($data['leccion_id']) : 0;
    $fecha = isset($data['fecha']) ? $data['fecha'] : '';
    $hora_inicio = isset($data['hora_inicio']) ? $data['hora_inicio'] : '';

    if (empty($user_id) || empty($leccion_id) || empty($fecha) || empty($hora_inicio)) return false;

    $config = cpp_programador_get_all_data($user_id)['config'];
    $time_slots = $config['time_slots'];
    $slot_index = array_search($hora_inicio, $time_slots);
    $hora_fin = isset($time_slots[$slot_index + 1]) ? $time_slots[$slot_index + 1] : date('H:i:s', strtotime($hora_inicio . ' +1 hour'));

    $datos_a_guardar = ['user_id' => $user_id, 'leccion_id' => $leccion_id, 'fecha' => $fecha, 'hora_inicio' => $hora_inicio, 'hora_fin' => $hora_fin];
    return $wpdb->replace($tabla_eventos, $datos_a_guardar, ['%d', '%d', '%s', '%s', '%s']) !== false;
}

function cpp_programador_delete_evento($evento_id, $user_id) {
    global $wpdb;
    $tabla_eventos = $wpdb->prefix . 'cpp_programador_eventos';
    return $wpdb->delete($tabla_eventos, ['id' => $evento_id, 'user_id' => $user_id], ['%d', '%d']) !== false;
}

function cpp_programador_create_example_data($user_id) {
    $clases = cpp_obtener_clases_usuario($user_id);
    if (empty($clases)) { return false; } // No se puede crear ejemplo sin clases

    // 1. Crear config de ejemplo
    $time_slots = ['09:00', '10:00', '11:00', '12:00'];
    $horario = [
        'mon' => ['09:00' => $clases[0]['id'], '10:00' => $clases[1]['id'] ?? ''],
        'tue' => ['11:00' => $clases[0]['id']],
        'wed' => ['09:00' => $clases[1]['id'] ?? '', '11:00' => $clases[0]['id']],
        'thu' => ['10:00' => $clases[0]['id']],
        'fri' => ['09:00' => $clases[0]['id'], '10:00' => $clases[1]['id'] ?? ''],
    ];
    cpp_programador_save_config_value($user_id, 'time_slots', $time_slots);
    cpp_programador_save_config_value($user_id, 'horario', $horario);

    // 2. Crear lecciones de ejemplo para las dos primeras clases
    foreach (array_slice($clases, 0, 2) as $clase) {
        for ($i = 1; $i <= 3; $i++) {
            cpp_programador_save_leccion([
                'user_id' => $user_id,
                'clase_id' => $clase['id'],
                'titulo' => "Lección de ejemplo $i para " . $clase['nombre'],
                'descripcion' => 'Esta es una descripción de ejemplo.'
            ]);
        }
    }
    return true;
}
