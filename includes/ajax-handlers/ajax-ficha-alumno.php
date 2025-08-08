<?php
// /includes/ajax-handlers/ajax-ficha-alumno.php

defined('ABSPATH') or die('Acceso no permitido');

// Incluir las nuevas funciones de consulta para la ficha
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-ficha-alumno.php';

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
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;

    if (empty($alumno_id) || empty($clase_id)) {
        wp_send_json_error(['message' => 'Faltan IDs de alumno o clase.']);
        return;
    }

    // --- Obtener información básica ---
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

    // Si no se pasa una evaluación, se coge la primera de la clase como fallback
    if (empty($evaluacion_id)) {
        $primera_evaluacion = cpp_obtener_primera_evaluacion_clase($clase_id, $user_id);
        if ($primera_evaluacion) {
            $evaluacion_id = $primera_evaluacion['id'];
        } else {
            wp_send_json_error(['message' => 'La clase no tiene evaluaciones para mostrar datos.']);
            return;
        }
    }
    
    $base_nota_clase = floatval($clase_info['base_nota_final']);
    if ($base_nota_clase <= 0) $base_nota_clase = 100.0;

    // --- Calcular nota final para la evaluación seleccionada ---
    $nota_final_0_100 = cpp_calcular_nota_final_alumno($alumno_id, $clase_id, $user_id, $evaluacion_id);
    $nota_final_reescalada = ($nota_final_0_100 / 100) * $base_nota_clase;
    
    $decimales_nota_final = 2;
    if ($base_nota_clase == floor($base_nota_clase) && $nota_final_reescalada == floor($nota_final_reescalada)) {
        $decimales_nota_final = 0;
    }
    $nota_final_formateada = cpp_formatear_nota_display($nota_final_reescalada, $decimales_nota_final);

    // --- Obtener desglose de notas y calificaciones individuales ---
    $resumen_evaluacion = cpp_obtener_resumen_evaluacion_alumno($alumno_id, $clase_id, $evaluacion_id, $user_id);

    $notas_medias_por_categoria = [];
    foreach ($resumen_evaluacion['notas_por_categoria'] as $categoria) {
        $nota_media_reescalada = ($categoria['nota_media'] / 100) * $base_nota_clase;
        $notas_medias_por_categoria[] = [
            'nombre_categoria' => $categoria['nombre_categoria'],
            'porcentaje_categoria' => $categoria['porcentaje_categoria'],
            'color_categoria' => $categoria['color_categoria'],
            'nota_media_formateada' => cpp_formatear_nota_display($nota_media_reescalada, 2)
        ];
    }

    // --- Obtener datos de asistencia ---
    $historial_asistencia = cpp_obtener_asistencia_alumno_para_clase($user_id, $alumno_id, $clase_id);
    $stats_asistencia = [ 'presente' => 0, 'ausente' => 0, 'retraso' => 0, 'justificado' => 0 ];
    foreach($historial_asistencia as $asistencia_item) {
        if (isset($stats_asistencia[$asistencia_item['estado']])) {
            $stats_asistencia[$asistencia_item['estado']]++;
        }
    }

    // --- Construir la respuesta JSON final ---
    $data_ficha = [
        'alumno_info' => $alumno_info,
        'clase_info' => [
            'id' => $clase_info['id'],
            'nombre' => $clase_info['nombre'],
            'base_nota_final' => cpp_formatear_nota_display($base_nota_clase, ($base_nota_clase == floor($base_nota_clase) ? 0 : 2))
        ],
        'resumen_notas' => [
            'nota_final_formateada' => $nota_final_formateada,
            'notas_medias_por_categoria' => $notas_medias_por_categoria,
            'calificaciones_individuales' => $resumen_evaluacion['calificaciones_individuales'] // Nuevo dato
        ],
        'historial_asistencia' => $historial_asistencia,
        'stats_asistencia' => $stats_asistencia
    ];

    wp_send_json_success($data_ficha);
}