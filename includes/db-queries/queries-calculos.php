<?php
// /includes/db-queries/queries-calculos.php (v1.5.0+)

defined('ABSPATH') or die('Acceso no permitido');

// --- FUNCIONES DE CÁLCULO ---

/**
 * Extrae la parte numérica de una calificación que puede contener texto (ej. "7.5 👍").
 * @param string $calificacion_str La calificación guardada.
 * @return float|null El número extraído o null si no se encuentra ninguno.
 */
function cpp_extraer_numero_de_calificacion($calificacion_str) {
    // Busca el primer número (entero o decimal, con punto o coma) en la cadena.
    preg_match('/[0-9]+([.,][0-9]+)?/', $calificacion_str, $matches);
    if (isset($matches[0])) {
        // Reemplaza la coma por un punto para la conversión a float.
        return floatval(str_replace(',', '.', $matches[0]));
    }
    return null;
}

function cpp_calcular_nota_final_alumno($alumno_id, $clase_id, $user_id, $evaluacion_id) {
    global $wpdb;
    
    $default_return = ['nota' => 0.00, 'is_incomplete' => false, 'used_categories' => [], 'missing_categories' => []];

    if (empty($evaluacion_id)) {
        return $default_return;
    }

    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $metodo_calculo = $wpdb->get_var($wpdb->prepare("SELECT calculo_nota FROM $tabla_evaluaciones WHERE id = %d", $evaluacion_id));
    if (empty($metodo_calculo)) { $metodo_calculo = 'total'; }

    $actividades_raw = cpp_obtener_actividades_por_clase($clase_id, $user_id, $evaluacion_id);
    if (empty($actividades_raw)) { return $default_return; }

    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $calificaciones_alumno_raw = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT ca.actividad_id, ca.nota FROM $tabla_calificaciones ca
             INNER JOIN $tabla_actividades act ON ca.actividad_id = act.id
             WHERE ca.alumno_id = %d AND act.evaluacion_id = %d", 
            $alumno_id, $evaluacion_id
        ), ARRAY_A
    );
    
    $calificaciones_alumno = []; 
    foreach ($calificaciones_alumno_raw as $cal) { $calificaciones_alumno[$cal['actividad_id']] = $cal['nota']; }

    if ($metodo_calculo === 'ponderada') {
        $categorias_evaluacion = cpp_obtener_categorias_por_evaluacion($evaluacion_id, $user_id);
        if (empty($categorias_evaluacion)) { return $default_return; }

        $map_categorias = [];
        $total_porcentaje = 0;
        foreach ($categorias_evaluacion as $cat) {
            $map_categorias[$cat['id']] = ['nombre' => $cat['nombre_categoria'], 'porcentaje' => floatval($cat['porcentaje'])];
            $total_porcentaje += floatval($cat['porcentaje']);
        }

        if (empty($map_categorias)) { return $default_return; }

        $notas_por_categoria_alumno = [];
        $nota_final_alumno_0_100 = 0.0;
        $categorias_con_nota = [];

        foreach ($actividades_raw as $actividad) {
            $categoria_id_actividad = $actividad['categoria_id'];
            if (!isset($map_categorias[$categoria_id_actividad])) { continue; }
            
            if (isset($calificaciones_alumno[$actividad['id']])) {
                $nota_obtenida = cpp_extraer_numero_de_calificacion($calificaciones_alumno[$actividad['id']]);
                if ($nota_obtenida !== null) {
                    $nota_maxima_actividad = floatval($actividad['nota_maxima']) > 0 ? floatval($actividad['nota_maxima']) : 10.0;
                    $nota_normalizada_0_1 = $nota_obtenida / $nota_maxima_actividad;

                    if (!isset($notas_por_categoria_alumno[$categoria_id_actividad])) {
                        $notas_por_categoria_alumno[$categoria_id_actividad] = ['suma_normalizada' => 0.0, 'contador' => 0];
                    }
                    $notas_por_categoria_alumno[$categoria_id_actividad]['suma_normalizada'] += $nota_normalizada_0_1;
                    $notas_por_categoria_alumno[$categoria_id_actividad]['contador']++;
                    $categorias_con_nota[$categoria_id_actividad] = true;
                }
            }
        }

        foreach ($notas_por_categoria_alumno as $cat_id => $data_cat) {
            if ($data_cat['contador'] > 0) {
                $media_categoria_normalizada = $data_cat['suma_normalizada'] / $data_cat['contador'];
                $porcentaje_categoria = $map_categorias[$cat_id]['porcentaje'];
                $nota_final_alumno_0_100 += $media_categoria_normalizada * $porcentaje_categoria;
            }
        }

        if ($total_porcentaje > 0 && $total_porcentaje < 100) {
            $nota_final_alumno_0_100 = ($nota_final_alumno_0_100 / $total_porcentaje) * 100;
        }
        
        $nota_final_alumno_0_100 = min($nota_final_alumno_0_100, 100);

        // Lógica de advertencia
        $used_categories_names = [];
        $missing_categories_names = [];
        $is_incomplete = false;
        foreach ($map_categorias as $id => $cat_data) {
            if (isset($categorias_con_nota[$id])) {
                $used_categories_names[] = $cat_data['nombre'];
            } else {
                $missing_categories_names[] = $cat_data['nombre'];
            }
        }
        if (!empty($missing_categories_names)) {
            $is_incomplete = true;
        }

        return [
            'nota' => round($nota_final_alumno_0_100, 2),
            'is_incomplete' => $is_incomplete,
            'used_categories' => $used_categories_names,
            'missing_categories' => $missing_categories_names
        ];

    } else {
        $suma_notas_normalizadas = 0.0;
        $numero_de_actividades_con_nota = 0;
        foreach ($actividades_raw as $actividad) {
            if (isset($calificaciones_alumno[$actividad['id']])) {
                $nota_obtenida = cpp_extraer_numero_de_calificacion($calificaciones_alumno[$actividad['id']]);
                if ($nota_obtenida !== null) {
                    $nota_maxima_actividad = floatval($actividad['nota_maxima']) > 0 ? floatval($actividad['nota_maxima']) : 10.0;
                    $suma_notas_normalizadas += $nota_obtenida / $nota_maxima_actividad;
                    $numero_de_actividades_con_nota++;
                }
            }
        }
        $nota_final = 0.00;
        if ($numero_de_actividades_con_nota > 0) {
            $media_simple = $suma_notas_normalizadas / $numero_de_actividades_con_nota;
            $nota_final = round($media_simple * 100, 2);
        }
        return ['nota' => $nota_final, 'is_incomplete' => false, 'used_categories' => [], 'missing_categories' => []];
    }
}

function cpp_calcular_nota_media_final_alumno($alumno_id, $clase_id, $user_id) {
    // 1. Obtener las evaluaciones seleccionadas para la media
    $evaluaciones_ids = cpp_get_evaluaciones_para_media($clase_id, $user_id);

    if (empty($evaluaciones_ids)) {
        return 0.00;
    }

    $suma_notas_evaluaciones = 0.0;
    $numero_evaluaciones = count($evaluaciones_ids);

    // 2. Iterar sobre cada ID de evaluación y calcular la nota final del alumno
    foreach ($evaluaciones_ids as $evaluacion_id) {
        $resultado_nota = cpp_calcular_nota_final_alumno($alumno_id, $clase_id, $user_id, $evaluacion_id);
        $suma_notas_evaluaciones += $resultado_nota['nota'];
    }

    // 3. Calcular la media de las evaluaciones seleccionadas
    if ($numero_evaluaciones > 0) {
        $media_final = $suma_notas_evaluaciones / $numero_evaluaciones;
        return round($media_final, 2); // Devuelve la nota media en escala 0-100
    }

    return 0.00;
}

function cpp_get_desglose_academico_por_evaluacion($alumno_id, $clase_id, $user_id, $evaluacion_id, $base_nota_clase) {
    global $wpdb;

    $resultado = [
        'nota_final' => 0.00,
        'nota_final_formateada' => cpp_formatear_nota_display(0, 0),
        'desglose_categorias' => []
    ];

    if (empty($evaluacion_id)) {
        return $resultado;
    }

    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $metodo_calculo = $wpdb->get_var($wpdb->prepare("SELECT calculo_nota FROM $tabla_evaluaciones WHERE id = %d", $evaluacion_id));
    if (empty($metodo_calculo)) {
        $metodo_calculo = 'total';
    }

    $actividades_raw = cpp_obtener_actividades_por_clase($clase_id, $user_id, $evaluacion_id);
    if (empty($actividades_raw)) {
        return $resultado;
    }

    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $calificaciones_alumno_raw = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT ca.actividad_id, ca.nota FROM $tabla_calificaciones ca
             INNER JOIN $tabla_actividades act ON ca.actividad_id = act.id
             WHERE ca.alumno_id = %d AND act.evaluacion_id = %d",
            $alumno_id, $evaluacion_id
        ), ARRAY_A
    );

    $calificaciones_alumno = [];
    foreach ($calificaciones_alumno_raw as $cal) {
        $calificaciones_alumno[$cal['actividad_id']] = $cal['nota'];
    }

    $nota_final_alumno_0_100 = 0.0;

    if ($metodo_calculo === 'ponderada') {
        $categorias_evaluacion = cpp_obtener_categorias_por_evaluacion($evaluacion_id, $user_id);
        if (empty($categorias_evaluacion)) {
             $metodo_calculo = 'total';
        } else {
            $map_categorias = [];
            $total_porcentaje = 0;
            foreach ($categorias_evaluacion as $cat) {
                $map_categorias[$cat['id']] = [
                    'nombre' => $cat['nombre_categoria'],
                    'porcentaje' => floatval($cat['porcentaje'])
                ];
                $total_porcentaje += floatval($cat['porcentaje']);
            }

            $notas_por_categoria_alumno = [];
            foreach ($actividades_raw as $actividad) {
                $categoria_id_actividad = $actividad['categoria_id'];
                if (!isset($map_categorias[$categoria_id_actividad])) { continue; }

                if (isset($calificaciones_alumno[$actividad['id']])) {
                    $nota_obtenida = cpp_extraer_numero_de_calificacion($calificaciones_alumno[$actividad['id']]);
                    if ($nota_obtenida !== null) {
                        $nota_maxima_actividad = floatval($actividad['nota_maxima']) > 0 ? floatval($actividad['nota_maxima']) : 10.0;
                        $nota_normalizada_0_1 = $nota_obtenida / $nota_maxima_actividad;

                        if (!isset($notas_por_categoria_alumno[$categoria_id_actividad])) {
                            $notas_por_categoria_alumno[$categoria_id_actividad] = ['suma_normalizada' => 0.0, 'contador' => 0];
                        }
                        $notas_por_categoria_alumno[$categoria_id_actividad]['suma_normalizada'] += $nota_normalizada_0_1;
                        $notas_por_categoria_alumno[$categoria_id_actividad]['contador']++;
                    }
                }
            }

            foreach ($notas_por_categoria_alumno as $cat_id => $data_cat) {
                if ($data_cat['contador'] > 0) {
                    $media_categoria_normalizada = $data_cat['suma_normalizada'] / $data_cat['contador'];
                    $porcentaje_categoria = $map_categorias[$cat_id]['porcentaje'];
                    $nota_final_alumno_0_100 += $media_categoria_normalizada * $porcentaje_categoria;

                    $nota_categoria_reescalada = ($media_categoria_normalizada * 100 / 100) * $base_nota_clase;
                    $decimales_cat = ($base_nota_clase == floor($base_nota_clase) && $nota_categoria_reescalada == floor($nota_categoria_reescalada)) ? 0 : 2;

                    $resultado['desglose_categorias'][] = [
                        'nombre_categoria' => $map_categorias[$cat_id]['nombre'],
                        'porcentaje' => $porcentaje_categoria,
                        'nota_categoria_formateada' => cpp_formatear_nota_display($nota_categoria_reescalada, $decimales_cat)
                    ];
                }
            }

            if ($total_porcentaje > 0 && $total_porcentaje < 100) {
                $nota_final_alumno_0_100 = ($nota_final_alumno_0_100 / $total_porcentaje) * 100;
            }
            $nota_final_alumno_0_100 = min($nota_final_alumno_0_100, 100);
        }
    }

    if ($metodo_calculo === 'total') {
        $suma_notas_normalizadas = 0.0;
        $numero_de_actividades_con_nota = 0;
        foreach ($actividades_raw as $actividad) {
            if (isset($calificaciones_alumno[$actividad['id']])) {
                $nota_obtenida = cpp_extraer_numero_de_calificacion($calificaciones_alumno[$actividad['id']]);
                if ($nota_obtenida !== null) {
                    $nota_maxima_actividad = floatval($actividad['nota_maxima']) > 0 ? floatval($actividad['nota_maxima']) : 10.0;
                    $suma_notas_normalizadas += $nota_obtenida / $nota_maxima_actividad;
                    $numero_de_actividades_con_nota++;
                }
            }
        }
        if ($numero_de_actividades_con_nota > 0) {
            $nota_final_alumno_0_100 = ($suma_notas_normalizadas / $numero_de_actividades_con_nota) * 100;
        }
    }

    $nota_final_reescalada = ($nota_final_alumno_0_100 / 100) * $base_nota_clase;
    $decimales = ($base_nota_clase == floor($base_nota_clase) && $nota_final_reescalada == floor($nota_final_reescalada)) ? 0 : 2;

    $resultado['nota_final'] = round($nota_final_reescalada, 2);
    $resultado['nota_final_formateada'] = cpp_formatear_nota_display($nota_final_reescalada, $decimales);

    return $resultado;
}