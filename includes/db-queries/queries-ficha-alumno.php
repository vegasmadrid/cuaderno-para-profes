<?php
// /includes/db-queries/queries-ficha-alumno.php

defined('ABSPATH') or die('Acceso no permitido');

/**
 * Obtiene las notas medias de un alumno agrupadas por categoría para una evaluación específica.
 * También obtiene todas las calificaciones individuales para esa evaluación.
 */
function cpp_obtener_resumen_evaluacion_alumno($alumno_id, $clase_id, $evaluacion_id, $user_id) {
    global $wpdb;
    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';

    // 1. Obtener todas las categorías y sus porcentajes para la evaluación
    $categorias = $wpdb->get_results($wpdb->prepare(
        "SELECT id, nombre_categoria, porcentaje, color FROM $tabla_categorias WHERE evaluacion_id = %d",
        $evaluacion_id
    ), ARRAY_A);

    $map_categorias = [];
    foreach ($categorias as $cat) {
        $map_categorias[$cat['id']] = [
            'nombre_categoria' => $cat['nombre_categoria'],
            'porcentaje_categoria' => (float)$cat['porcentaje'],
            'color_categoria' => $cat['color'],
            'actividades' => [],
            'suma_notas' => 0,
            'suma_max_notas' => 0,
            'nota_media' => 0
        ];
    }

    // 2. Obtener todas las actividades de la evaluación y sus calificaciones para el alumno
    $actividades_y_calificaciones = $wpdb->get_results($wpdb->prepare(
        "SELECT
            act.id AS actividad_id,
            act.nombre_actividad,
            act.nota_maxima,
            act.categoria_id,
            cal.calificacion
        FROM
            $tabla_actividades AS act
        LEFT JOIN
            $tabla_calificaciones AS cal ON act.id = cal.actividad_id AND cal.alumno_id = %d
        WHERE
            act.evaluacion_id = %d AND act.user_id = %d
        ORDER BY
            act.fecha_actividad DESC, act.id DESC",
        $alumno_id, $evaluacion_id, $user_id
    ), ARRAY_A);

    $calificaciones_individuales = [];

    foreach ($actividades_y_calificaciones as $item) {
        $categoria_id = $item['categoria_id'];
        $nota_maxima = (float)$item['nota_maxima'];
        $calificacion = is_numeric($item['calificacion']) ? (float)$item['calificacion'] : null;

        // Añadir a la lista de calificaciones individuales para el desglose
        $calificaciones_individuales[] = [
            'nombre_actividad' => $item['nombre_actividad'],
            'nota_maxima' => cpp_formatear_nota_display($nota_maxima),
            'calificacion' => is_null($calificacion) ? '-' : cpp_formatear_nota_display($calificacion)
        ];

        // Agrupar por categoría para el cálculo de medias
        if (isset($map_categorias[$categoria_id]) && !is_null($calificacion)) {
            $map_categorias[$categoria_id]['suma_notas'] += $calificacion;
            $map_categorias[$categoria_id]['suma_max_notas'] += $nota_maxima;
        }
    }

    // 3. Calcular la nota media para cada categoría
    foreach ($map_categorias as $cat_id => &$cat_data) {
        if ($cat_data['suma_max_notas'] > 0) {
            // La nota media es el porcentaje de la nota obtenida sobre la máxima posible
            $cat_data['nota_media'] = ($cat_data['suma_notas'] / $cat_data['suma_max_notas']) * 100;
        }
    }

    return [
        'notas_por_categoria' => array_values($map_categorias),
        'calificaciones_individuales' => $calificaciones_individuales
    ];
}
