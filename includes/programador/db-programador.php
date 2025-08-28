<?php
// /includes/programador/db-programador.php

defined('ABSPATH') or die('Acceso no permitido');

/**
 * Obtiene toda la configuración del programador para un usuario.
 *
 * @param int $user_id ID del usuario.
 * @return array Un array asociativo con las claves y valores de configuración.
 */
function cpp_programador_get_config($user_id) {
    global $wpdb;
    $tabla_config = $wpdb->prefix . 'cpp_programador_config';
    $resultados = $wpdb->get_results($wpdb->prepare(
        "SELECT clave, valor FROM $tabla_config WHERE user_id = %d",
        $user_id
    ), ARRAY_A);

    $config = [];
    foreach ($resultados as $resultado) {
        $valor = json_decode($resultado['valor'], true);
        // Si json_decode falla, usar el valor raw. Podría ser un string simple.
        $config[$resultado['clave']] = (json_last_error() === JSON_ERROR_NONE) ? $valor : $resultado['valor'];
    }

    // Valores por defecto si no existen
    $defaults = [
        'dias_laborables' => ['1', '2', '3', '4', '5'], // Lunes a Viernes
        'dias_no_laborables' => [], // Fechas específicas como 'YYYY-MM-DD'
        'horario' => [
            ['inicio' => '09:00', 'fin' => '10:00', 'titulo' => ''],
            ['inicio' => '10:00', 'fin' => '11:00', 'titulo' => ''],
        ]
    ];

    return array_merge($defaults, $config);
}

/**
 * Guarda un valor de configuración para el programador de un usuario.
 *
 * @param int $user_id ID del usuario.
 * @param string $clave La clave de configuración.
 * @param mixed $valor El valor de configuración. Se guardará como JSON si es array u objeto.
 * @return bool True si se guardó, false en caso de error.
 */
function cpp_programador_save_config($user_id, $clave, $valor) {
    global $wpdb;
    $tabla_config = $wpdb->prefix . 'cpp_programador_config';

    $data = [
        'user_id' => $user_id,
        'clave' => $clave,
        'valor' => is_array($valor) || is_object($valor) ? wp_json_encode($valor) : $valor
    ];

    $format = ['%d', '%s', '%s'];

    // REPLACE INTO es una extensión de MySQL/MariaDB. WordPress lo maneja con $wpdb->replace.
    $resultado = $wpdb->replace($tabla_config, $data, $format);

    return $resultado !== false;
}

/**
 * Obtiene todas las sesiones de trabajo para un usuario, ordenadas por el campo 'orden'.
 *
 * @param int $user_id ID del usuario.
 * @return array Un array de objetos de sesión.
 */
function cpp_programador_get_sesiones($user_id) {
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';

    return $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $tabla_sesiones WHERE user_id = %d ORDER BY orden ASC",
        $user_id
    ));
}

/**
 * Guarda (crea o actualiza) una sesión de trabajo.
 *
 * @param array $data Datos de la sesión. Debe incluir user_id y, si se edita, id.
 * @return int|false El ID de la sesión guardada o false en caso de error.
 */
function cpp_programador_save_sesion($data) {
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';

    $defaults = [
        'id' => null,
        'user_id' => get_current_user_id(),
        'titulo' => '',
        'descripcion' => '',
        'orden' => 0,
        'clase_id' => null
    ];
    $sesion = array_merge($defaults, $data);

    // Si no se proporciona un orden, lo calculamos para que sea el último
    if (!isset($data['orden'])) {
        $max_orden = $wpdb->get_var($wpdb->prepare(
            "SELECT MAX(orden) FROM $tabla_sesiones WHERE user_id = %d",
            $sesion['user_id']
        ));
        $sesion['orden'] = $max_orden + 1;
    }

    $datos_a_guardar = [
        'user_id' => $sesion['user_id'],
        'titulo' => $sesion['titulo'],
        'descripcion' => $sesion['descripcion'],
        'orden' => $sesion['orden'],
        'clase_id' => $sesion['clase_id']
    ];

    if (!empty($sesion['id'])) {
        // Actualizar
        $wpdb->update($tabla_sesiones, $datos_a_guardar, ['id' => $sesion['id']], null, ['%d']);
        return $sesion['id'];
    } else {
        // Crear
        $wpdb->insert($tabla_sesiones, $datos_a_guardar);
        return $wpdb->insert_id;
    }
}

/**
 * Elimina una sesión de trabajo.
 *
 * @param int $sesion_id ID de la sesión a eliminar.
 * @param int $user_id ID del usuario propietario.
 * @return bool True si se eliminó, false en caso contrario.
 */
function cpp_programador_delete_sesion($sesion_id, $user_id) {
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';

    $resultado = $wpdb->delete($tabla_sesiones, [
        'id' => $sesion_id,
        'user_id' => $user_id
    ], ['%d', '%d']);

    return $resultado !== false;
}

/**
 * Actualiza el orden de múltiples sesiones.
 *
 * @param int $user_id ID del usuario.
 * @param array $orden_sesiones Array de IDs de sesión en el nuevo orden.
 * @return bool True en éxito, false en error.
 */
function cpp_programador_reorder_sesiones($user_id, $orden_sesiones) {
    global $wpdb;
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';

    $wpdb->query('START TRANSACTION');

    foreach ($orden_sesiones as $index => $sesion_id) {
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
