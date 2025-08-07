<?php
// /includes/db-queries/queries-categorias.php

defined('ABSPATH') or die('Acceso no permitido');

// --- FUNCIONES PARA CATEGORÍAS DE EVALUACIÓN ---

function cpp_guardar_categoria_evaluacion($evaluacion_id, $user_id, $nombre_categoria, $porcentaje, $color = '#FFFFFF') {
    global $wpdb;
    
    $owner_check = $wpdb->get_var($wpdb->prepare(
        "SELECT user_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d",
        $evaluacion_id
    ));
    if ($owner_check != $user_id) {
        return false;
    }

    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
    $color_validado = preg_match('/^#[a-f0-9]{6}$/i', $color) ? $color : '#FFFFFF';
    if (!is_numeric($porcentaje) || $porcentaje < 0 || $porcentaje > 100 || empty(trim($nombre_categoria))) {
        return false;
    }

    $resultado = $wpdb->insert(
        $tabla_categorias,
        [
            'evaluacion_id'    => $evaluacion_id,
            'nombre_categoria' => sanitize_text_field($nombre_categoria),
            'porcentaje'       => intval($porcentaje),
            'color'            => $color_validado
        ],
        ['%d', '%s', '%d', '%s']
    );
    return $resultado ? $wpdb->insert_id : false;
}

function cpp_obtener_categoria_por_id($categoria_id, $user_id) {
    global $wpdb;
    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';

    return $wpdb->get_row(
        $wpdb->prepare(
            "SELECT cat.* FROM $tabla_categorias cat
             INNER JOIN $tabla_evaluaciones ev ON cat.evaluacion_id = ev.id
             WHERE cat.id = %d AND ev.user_id = %d",
            $categoria_id, $user_id
        ), ARRAY_A
    );
}

function cpp_actualizar_categoria_evaluacion($categoria_id, $user_id, $datos_categoria) {
    global $wpdb;

    $categoria_existente = cpp_obtener_categoria_por_id($categoria_id, $user_id);
    if (!$categoria_existente) {
        return false;
    }

    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
    $update_data = [];
    $update_formats = [];

    if (isset($datos_categoria['nombre_categoria'])) {
        $nombre_limpio = sanitize_text_field(trim($datos_categoria['nombre_categoria']));
        if (!empty($nombre_limpio)) {
            $update_data['nombre_categoria'] = $nombre_limpio;
            $update_formats[] = '%s';
        } else { return false; }
    }
    if (isset($datos_categoria['porcentaje'])) {
        $porcentaje_validado = intval($datos_categoria['porcentaje']);
        if ($porcentaje_validado >= 0 && $porcentaje_validado <= 100) {
            $update_data['porcentaje'] = $porcentaje_validado;
            $update_formats[] = '%d';
        } else { return false; }
    }
    if (isset($datos_categoria['color'])) {
        $color_validado = preg_match('/^#[a-f0-9]{6}$/i', $datos_categoria['color']) ? $datos_categoria['color'] : '#FFFFFF';
        $update_data['color'] = $color_validado;
        $update_formats[] = '%s';
    }

    if (empty($update_data)) { return 0; }

    $resultado = $wpdb->update($tabla_categorias, $update_data, ['id' => $categoria_id], $update_formats, ['%d']);
    return $resultado;
}

function cpp_obtener_categorias_por_evaluacion($evaluacion_id, $user_id) {
    global $wpdb;

    if (empty($evaluacion_id)) { return []; }

    $owner_check = $wpdb->get_var($wpdb->prepare(
        "SELECT user_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d",
        $evaluacion_id
    ));
    if ($owner_check != $user_id) {
        return [];
    }
    
    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
    return $wpdb->get_results(
        $wpdb->prepare(
            "SELECT * FROM $tabla_categorias WHERE evaluacion_id = %d ORDER BY nombre_categoria ASC",
            $evaluacion_id
        ), ARRAY_A
    );
}

function cpp_eliminar_categoria_evaluacion($categoria_id, $user_id) {
    global $wpdb;
    
    $categoria_a_eliminar = cpp_obtener_categoria_por_id($categoria_id, $user_id);

    if (!$categoria_a_eliminar) {
        return false; 
    }
    
    cpp_reasignar_actividades_a_categoria_por_defecto($categoria_a_eliminar['evaluacion_id'], $user_id, $categoria_id);

    return $wpdb->delete($wpdb->prefix . 'cpp_categorias_evaluacion', ['id' => $categoria_id], ['%d']);
}


function cpp_reasignar_actividades_a_categoria_por_defecto($evaluacion_id, $user_id, $categoria_a_eliminar_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
    $nombre_cat_defecto = 'Sin categoría';

    $id_cat_defecto = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $tabla_categorias WHERE evaluacion_id = %d AND nombre_categoria = %s",
        $evaluacion_id, $nombre_cat_defecto
    ));

    if (!$id_cat_defecto) {
        $id_cat_defecto = cpp_guardar_categoria_evaluacion($evaluacion_id, $user_id, $nombre_cat_defecto, 0, '#808080');
        if (!$id_cat_defecto) {
            return; 
        }
    }

    if ($categoria_a_eliminar_id == $id_cat_defecto) {
        return;
    }

    $wpdb->update(
        $tabla_actividades,
        ['categoria_id' => $id_cat_defecto],
        ['categoria_id' => $categoria_a_eliminar_id, 'evaluacion_id' => $evaluacion_id],
        ['%d'],
        ['%d', '%d']
    );
}