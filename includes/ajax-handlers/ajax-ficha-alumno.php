<?php
// /includes/ajax-handlers/ajax-ficha-alumno.php

defined('ABSPATH') or die('Acceso no permitido');

// --- ACCIONES AJAX PARA LA FICHA DEL ALUMNO ---

add_action('wp_ajax_cpp_obtener_datos_ficha_alumno', 'cpp_ajax_obtener_datos_ficha_alumno_handler');
function cpp_ajax_obtener_datos_ficha_alumno_handler() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.']);
        return;
    }

    $user_id = get_current_user_id();
    $alumno_id = isset($_POST['alumno_id']) ? intval($_POST['alumno_id']) : 0;
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;

    if (empty($alumno_id) || empty($clase_id)) {
        wp_send_json_error(['message' => 'Faltan IDs de alumno o clase.']);
        return;
    }

    $clase_info = cpp_obtener_clase_completa_por_id($clase_id, $user_id);
    if (!$clase_info) {
        wp_send_json_error(['message' => 'Clase no encontrada o no tienes permiso.']);
        return;
    }

    $alumno_info = cpp_obtener_alumno_por_id($alumno_id);
    if (!$alumno_info || $alumno_info['clase_id'] != $clase_id) {
        wp_send_json_error(['message' => 'Alumno no encontrado o no pertenece a esta clase.']);
        return;
    }

    $alumno_info['avatar_url'] = cpp_get_avatar_url($alumno_info);
    
    $base_nota_clase = floatval($clase_info['base_nota_final']);
    if ($base_nota_clase <= 0) $base_nota_clase = 100.0;

    // --- Resumen Académico ---
    $evaluaciones = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
    $desglose_evaluaciones = [];
    foreach ($evaluaciones as $evaluacion) {
        $desglose_academico = cpp_get_desglose_academico_por_evaluacion($alumno_id, $clase_id, $user_id, $evaluacion['id'], $base_nota_clase);
        $desglose_evaluaciones[] = [
            'id' => $evaluacion['id'],
            'nombre_evaluacion' => $evaluacion['nombre_evaluacion'],
            'nota_final_formateada' => $desglose_academico['nota_final_formateada'],
            'desglose_categorias' => $desglose_academico['desglose_categorias']
        ];
    }

    $nota_media_final_0_100 = cpp_calcular_nota_media_final_alumno($alumno_id, $clase_id, $user_id);
    $nota_media_final_reescalada = ($nota_media_final_0_100 / 100) * $base_nota_clase;
    $decimales_media_final = ($base_nota_clase == floor($base_nota_clase) && $nota_media_final_reescalada == floor($nota_media_final_reescalada)) ? 0 : 2;

    $resumen_academico = [
        'nota_final_global_formateada' => cpp_formatear_nota_display($nota_media_final_reescalada, $decimales_media_final),
        'desglose_evaluaciones' => $desglose_evaluaciones
    ];

    // --- Resumen de Asistencia ---
    $historial_asistencia_completo = cpp_obtener_asistencia_alumno_para_clase($user_id, $alumno_id, $clase_id);
    $stats_asistencia = [ 'presente' => 0, 'ausente' => 0, 'retraso' => 0, 'justificado' => 0 ];
    $historial_incidencias = [];

    foreach($historial_asistencia_completo as $asistencia_item) {
        $estado = $asistencia_item['estado'];
        // Mapear 'falta' (obsoleto) a 'ausente' para las estadísticas
        $estado_para_stats = ($estado === 'falta') ? 'ausente' : $estado;

        if (isset($stats_asistencia[$estado_para_stats])) {
            $stats_asistencia[$estado_para_stats]++;
        }
        if ($estado !== 'presente') {
            $historial_incidencias[] = $asistencia_item;
        }
    }
    // Ordenar incidencias por fecha descendente
    usort($historial_incidencias, function($a, $b) {
        return strtotime($b['fecha_asistencia']) - strtotime($a['fecha_asistencia']);
    });

    // --- Actividades con faltas (X) ---
    $actividades_con_falta = [];
    foreach ($evaluaciones as $evaluacion) {
        $actividades_alumno = cpp_obtener_actividades_con_calificaciones_alumno($evaluacion['id'], $alumno_id, $user_id);
        foreach ($actividades_alumno as $act) {
            if ($act['calificacion'] && strpos($act['calificacion'], '❌') !== false) {
                $actividades_con_falta[] = [
                    'nombre' => $act['nombre_actividad'],
                    'fecha' => $act['fecha_actividad'],
                    'nota' => $act['calificacion'],
                    'evaluacion' => $evaluacion['nombre_evaluacion']
                ];
            }
        }
    }

    $resumen_asistencia = [
        'stats' => $stats_asistencia,
        'historial_completo' => $historial_incidencias,
        'actividades_con_falta' => $actividades_con_falta
    ];

    // --- Ensamblar datos finales ---
    $data_ficha = [
        'alumno_info' => $alumno_info,
        'clase_info' => [
            'id' => $clase_info['id'],
            'nombre' => $clase_info['nombre'],
            'base_nota_final' => cpp_formatear_nota_display($base_nota_clase, ($base_nota_clase == floor($base_nota_clase) ? 0 : 2))
        ],
        'resumen_academico' => $resumen_academico,
        'resumen_asistencia' => $resumen_asistencia
    ];

    wp_send_json_success($data_ficha);
}