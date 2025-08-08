<?php
// /includes/db-queries/queries-calculos.php (v1.5.0+)

defined('ABSPATH') or die('Acceso no permitido');

// --- FUNCIONES DE CÁLCULO ---

function cpp_calcular_nota_final_alumno($alumno_id, $clase_id, $user_id, $evaluacion_id) {
    global $wpdb;
    
    if (empty($evaluacion_id)) {
        return 0.00;
    }

    // --- INICIO LÓGICA MEJORADA ---
    // 1. Obtener el tipo y método de cálculo para esta evaluación
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $evaluacion_actual = $wpdb->get_row($wpdb->prepare("SELECT tipo, calculo_nota FROM $tabla_evaluaciones WHERE id = %d", $evaluacion_id), ARRAY_A);

    if (!$evaluacion_actual) { return 0.00; }

    $tipo_evaluacion = $evaluacion_actual['tipo'];
    $metodo_calculo = !empty($evaluacion_actual['calculo_nota']) ? $evaluacion_actual['calculo_nota'] : 'total';

    // 2. Si es de tipo 'final', calcular la media de las otras evaluaciones
    if ($tipo_evaluacion === 'final') {
        $evaluaciones_normales = $wpdb->get_results($wpdb->prepare(
            "SELECT id FROM $tabla_evaluaciones WHERE clase_id = %d AND user_id = %d AND tipo = 'normal'",
            $clase_id, $user_id
        ), ARRAY_A);

        if (empty($evaluaciones_normales)) { return 0.00; }

        $suma_notas_finales = 0.0;
        $num_evaluaciones = count($evaluaciones_normales);

        foreach ($evaluaciones_normales as $eval) {
            // Llamada recursiva para obtener la nota final (0-100) de cada evaluación normal
            $suma_notas_finales += cpp_calcular_nota_final_alumno($alumno_id, $clase_id, $user_id, $eval['id']);
        }

        $media_final = ($num_evaluaciones > 0) ? ($suma_notas_finales / $num_evaluaciones) : 0.0;
        return round($media_final, 2);
    }
    // --- FIN LÓGICA MEJORADA ---


    // 3. Si es 'normal', proceder con el cálculo basado en actividades
    $actividades_raw = cpp_obtener_actividades_por_clase($clase_id, $user_id, $evaluacion_id);
    if (empty($actividades_raw)) { return 0.00; }

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

    // 4. Aplicar la lógica de cálculo según el método
    if ($metodo_calculo === 'ponderada') {
        // --- MODO PONDERADO POR CATEGORÍAS ---
        $categorias_evaluacion = cpp_obtener_categorias_por_evaluacion($evaluacion_id, $user_id);
        if (empty($categorias_evaluacion)) { return 0.00; }

        $map_categorias_porcentajes = [];
        $total_porcentaje = 0;
        foreach ($categorias_evaluacion as $cat) { 
            $map_categorias_porcentajes[$cat['id']] = floatval($cat['porcentaje']);
            $total_porcentaje += floatval($cat['porcentaje']);
        }

        if (empty($map_categorias_porcentajes)) { return 0.00; }

        $notas_por_categoria_alumno = [];
        $nota_final_alumno_0_100 = 0.0;

        foreach ($actividades_raw as $actividad) {
            $categoria_id_actividad = $actividad['categoria_id'];
            if (!isset($map_categorias_porcentajes[$categoria_id_actividad])) { continue; }
            
            if (isset($calificaciones_alumno[$actividad['id']]) && is_numeric($calificaciones_alumno[$actividad['id']])) {
                $nota_obtenida = floatval($calificaciones_alumno[$actividad['id']]);
                $nota_maxima_actividad = floatval($actividad['nota_maxima']) > 0 ? floatval($actividad['nota_maxima']) : 10.0;
                
                $nota_normalizada_0_1 = $nota_obtenida / $nota_maxima_actividad;
                
                if (!isset($notas_por_categoria_alumno[$categoria_id_actividad])) {
                    $notas_por_categoria_alumno[$categoria_id_actividad] = ['suma_normalizada' => 0.0, 'contador' => 0];
                }
                $notas_por_categoria_alumno[$categoria_id_actividad]['suma_normalizada'] += $nota_normalizada_0_1;
                $notas_por_categoria_alumno[$categoria_id_actividad]['contador']++;
            }
        }

        foreach ($notas_por_categoria_alumno as $cat_id => $data_cat) {
            if ($data_cat['contador'] > 0) {
                $media_categoria_normalizada = $data_cat['suma_normalizada'] / $data_cat['contador'];
                $porcentaje_categoria = $map_categorias_porcentajes[$cat_id];
                $nota_final_alumno_0_100 += $media_categoria_normalizada * $porcentaje_categoria;
            }
        }

        if ($total_porcentaje > 0 && $total_porcentaje < 100) {
            $nota_final_alumno_0_100 = ($nota_final_alumno_0_100 / $total_porcentaje) * 100;
        }
        
        $nota_final_alumno_0_100 = min($nota_final_alumno_0_100, 100);

        return round($nota_final_alumno_0_100, 2);

    } else {
        // --- MODO PUNTUACIÓN TOTAL (MEDIA SIMPLE) ---
        $suma_notas_normalizadas = 0.0;
        $numero_de_actividades_con_nota = 0;

        foreach ($actividades_raw as $actividad) {
            if (isset($calificaciones_alumno[$actividad['id']]) && is_numeric($calificaciones_alumno[$actividad['id']])) {
                $nota_obtenida = floatval($calificaciones_alumno[$actividad['id']]);
                $nota_maxima_actividad = floatval($actividad['nota_maxima']) > 0 ? floatval($actividad['nota_maxima']) : 10.0;
                
                $suma_notas_normalizadas += $nota_obtenida / $nota_maxima_actividad;
                $numero_de_actividades_con_nota++;
            }
        }

        if ($numero_de_actividades_con_nota > 0) {
            $media_simple = $suma_notas_normalizadas / $numero_de_actividades_con_nota;
            return round($media_simple * 100, 2); // Devolver en escala de 0 a 100
        } else {
            return 0.00;
        }
    }
}