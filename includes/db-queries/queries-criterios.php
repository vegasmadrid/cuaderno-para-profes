<?php
// /includes/db-queries/queries-criterios.php

defined('ABSPATH') or die('Acceso no permitido');

// --- GESTIÓN DE CRITERIOS GLOBALES ---

function cpp_obtener_criterios_globales($user_id) {
    global $wpdb;
    $tabla = $wpdb->prefix . 'cpp_criterios_globales';
    return $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $tabla WHERE user_id = %d ORDER BY nombre ASC",
        $user_id
    ), ARRAY_A);
}

function cpp_guardar_criterio_global($user_id, $nombre, $color = '#FFFFFF') {
    global $wpdb;
    $tabla = $wpdb->prefix . 'cpp_criterios_globales';
    $color_validado = preg_match('/^#[a-f0-9]{6}$/i', $color) ? $color : '#FFFFFF';

    if (empty(trim($nombre))) return false;

    $resultado = $wpdb->insert(
        $tabla,
        [
            'user_id' => $user_id,
            'nombre'  => sanitize_text_field($nombre),
            'color'   => $color_validado
        ],
        ['%d', '%s', '%s']
    );
    return $resultado ? $wpdb->insert_id : false;
}

function cpp_obtener_criterio_global_por_id($criterio_id, $user_id) {
    global $wpdb;
    $tabla = $wpdb->prefix . 'cpp_criterios_globales';
    return $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $tabla WHERE id = %d AND user_id = %d",
        $criterio_id, $user_id
    ), ARRAY_A);
}

function cpp_actualizar_criterio_global($criterio_id, $user_id, $datos) {
    global $wpdb;
    $tabla = $wpdb->prefix . 'cpp_criterios_globales';

    $update_data = [];
    $update_formats = [];

    if (isset($datos['nombre'])) {
        $update_data['nombre'] = sanitize_text_field($datos['nombre']);
        $update_formats[] = '%s';
    }
    if (isset($datos['color'])) {
        $update_data['color'] = preg_match('/^#[a-f0-9]{6}$/i', $datos['color']) ? $datos['color'] : '#FFFFFF';
        $update_formats[] = '%s';
    }

    if (empty($update_data)) return false;

    return $wpdb->update($tabla, $update_data, ['id' => $criterio_id, 'user_id' => $user_id], $update_formats, ['%d', '%d']);
}

function cpp_eliminar_criterio_global($criterio_id, $user_id, $new_criterio_id = null) {
    global $wpdb;
    $tabla_criterios = $wpdb->prefix . 'cpp_criterios_globales';
    $tabla_eval_crit = $wpdb->prefix . 'cpp_evaluacion_criterios';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';

    // Iniciar transacción
    $wpdb->query('START TRANSACTION');

    // 1. Desasignar de todas las evaluaciones (los pesos mueren siempre porque el ID global desaparece)
    $wpdb->delete($tabla_eval_crit, ['criterio_id' => $criterio_id], ['%d']);

    // 2. Reasignar o dejar a NULL las actividades de TODAS las clases
    $update_data = ['criterio_id' => $new_criterio_id ? intval($new_criterio_id) : null];
    $wpdb->update($tabla_actividades, $update_data, ['criterio_id' => $criterio_id, 'user_id' => $user_id]);

    // 3. Eliminar el criterio global
    $resultado = $wpdb->delete($tabla_criterios, ['id' => $criterio_id, 'user_id' => $user_id], ['%d', '%d']);

    if ($resultado === false) {
        $wpdb->query('ROLLBACK');
        return false;
    }

    $wpdb->query('COMMIT');
    return true;
}

// --- PESOS POR EVALUACIÓN ---

function cpp_obtener_criterios_por_evaluacion($evaluacion_id, $user_id) {
    global $wpdb;
    $tabla_eval_crit = $wpdb->prefix . 'cpp_evaluacion_criterios';
    $tabla_criterios = $wpdb->prefix . 'cpp_criterios_globales';
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';

    // Safety check for table existence (prevents crash if migration partially failed)
    if($wpdb->get_var("SHOW TABLES LIKE '$tabla_eval_crit'") === null) {
        return [];
    }

    return $wpdb->get_results($wpdb->prepare(
        "SELECT ec.*, cg.nombre, cg.color
         FROM $tabla_eval_crit ec
         INNER JOIN $tabla_criterios cg ON ec.criterio_id = cg.id
         INNER JOIN $tabla_evaluaciones ev ON ec.evaluacion_id = ev.id
         WHERE ec.evaluacion_id = %d AND ev.user_id = %d
         ORDER BY cg.nombre ASC",
        $evaluacion_id, $user_id
    ), ARRAY_A);
}

function cpp_asignar_criterio_a_evaluacion($evaluacion_id, $criterio_id, $porcentaje, $user_id) {
    global $wpdb;
    $tabla_eval_crit = $wpdb->prefix . 'cpp_evaluacion_criterios';

    // Verificar propiedad de la evaluación y el criterio
    $ev_user = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d", $evaluacion_id));
    $crit_user = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_criterios_globales WHERE id = %d", $criterio_id));

    if ($ev_user != $user_id || $crit_user != $user_id) return false;

    return $wpdb->insert($tabla_eval_crit, [
        'evaluacion_id' => $evaluacion_id,
        'criterio_id'   => $criterio_id,
        'porcentaje'    => intval($porcentaje)
    ], ['%d', '%d', '%d']);
}

function cpp_actualizar_peso_criterio_evaluacion($evaluacion_id, $criterio_id, $porcentaje, $user_id, $new_criterio_id = null) {
    global $wpdb;
    $tabla_eval_crit = $wpdb->prefix . 'cpp_evaluacion_criterios';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';

    // Verificar propiedad de la evaluación
    $ev_user = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d", $evaluacion_id));
    if ($ev_user != $user_id) return false;

    if ($new_criterio_id && $new_criterio_id != $criterio_id) {
        // SWAP operation
        $wpdb->query('START TRANSACTION');

        // 1. Actualizar la relación de pesos (cambiar el ID del criterio)
        $res1 = $wpdb->update($tabla_eval_crit,
            ['criterio_id' => intval($new_criterio_id), 'porcentaje' => intval($porcentaje)],
            ['evaluacion_id' => $evaluacion_id, 'criterio_id' => $criterio_id],
            ['%d', '%d'], ['%d', '%d']
        );

        // 2. Actualizar las actividades de esta evaluación
        $res2 = $wpdb->update($tabla_actividades,
            ['criterio_id' => intval($new_criterio_id)],
            ['evaluacion_id' => $evaluacion_id, 'criterio_id' => $criterio_id, 'user_id' => $user_id],
            ['%d'], ['%d', '%d', '%d']
        );

        if ($res1 === false || $res2 === false) {
            $wpdb->query('ROLLBACK');
            return false;
        }
        $wpdb->query('COMMIT');
        return true;
    } else {
        // Solo actualización de porcentaje
        return $wpdb->update($tabla_eval_crit,
            ['porcentaje' => intval($porcentaje)],
            ['evaluacion_id' => $evaluacion_id, 'criterio_id' => $criterio_id],
            ['%d'], ['%d', '%d']
        );
    }
}

function cpp_desasignar_criterio_de_evaluacion($evaluacion_id, $criterio_id, $user_id, $new_criterio_id = null) {
    global $wpdb;
    $tabla_eval_crit = $wpdb->prefix . 'cpp_evaluacion_criterios';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';

    // Verificar propiedad
    $ev_user = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d", $evaluacion_id));
    if ($ev_user != $user_id) return false;

    $wpdb->query('START TRANSACTION');

    // 1. Eliminar relación de pesos
    $res1 = $wpdb->delete($tabla_eval_crit, ['evaluacion_id' => $evaluacion_id, 'criterio_id' => $criterio_id], ['%d', '%d']);

    // 2. Reasignar o dejar a NULL las actividades de esta evaluación
    $update_data = ['criterio_id' => $new_criterio_id ? intval($new_criterio_id) : null];
    $res2 = $wpdb->update($tabla_actividades,
        $update_data,
        ['evaluacion_id' => $evaluacion_id, 'criterio_id' => $criterio_id, 'user_id' => $user_id]
    );

    if ($res1 === false || $res2 === false) {
        $wpdb->query('ROLLBACK');
        return false;
    }

    $wpdb->query('COMMIT');
    return true;
}
