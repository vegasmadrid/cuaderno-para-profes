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
    
    $base_nota_clase = floatval($clase_info['base_nota_final']);
    if ($base_nota_clase <= 0) $base_nota_clase = 100.0;

    // Obtener todas las evaluaciones para la clase y calcular la nota media para cada una
    $evaluaciones = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
    $resumen_notas_ficha = [];
    
    foreach ($evaluaciones as $evaluacion) {
        // En lugar de calcular medias por categoría, calculamos la nota final de la evaluación completa
        $nota_final_evaluacion_0_100 = cpp_calcular_nota_final_alumno($alumno_id, $clase_id, $user_id, $evaluacion['id']);
        $nota_final_reescalada = ($nota_final_evaluacion_0_100 / 100) * $base_nota_clase;

        $decimales_nota_final = 2;
        if ($base_nota_clase == floor($base_nota_clase) && $nota_final_reescalada == floor($nota_final_reescalada)) {
            $decimales_nota_final = 0;
        }

        // El backend debería devolver la nota media para cada categoría en la evaluación activa
        // Como la ficha ahora muestra el resumen de evaluaciones, vamos a modificar esta parte.
        // Vamos a devolver un array con las notas finales de cada evaluación.
        $resumen_notas_ficha[] = [
            'id_evaluacion' => $evaluacion['id'],
            'nombre_evaluacion' => $evaluacion['nombre_evaluacion'],
            'nota_final_formateada' => cpp_formatear_nota_display($nota_final_reescalada, $decimales_nota_final)
        ];
    }

    $historial_asistencia = cpp_obtener_asistencia_alumno_para_clase($user_id, $alumno_id, $clase_id);

    $stats_asistencia = [ 'presente' => 0, 'ausente' => 0, 'retraso' => 0, 'justificado' => 0, ];
    foreach($historial_asistencia as $asistencia_item) {
        if (isset($stats_asistencia[$asistencia_item['estado']])) {
            $stats_asistencia[$asistencia_item['estado']]++;
        }
    }

    // El frontend espera 'resumen_notas' => ['notas_medias_por_evaluacion' => [...]]
    // Así que lo envolvemos correctamente
    $data_ficha = [
        'alumno_info' => $alumno_info,
        'clase_info' => [
            'id' => $clase_info['id'],
            'nombre' => $clase_info['nombre'],
            'base_nota_final' => cpp_formatear_nota_display($base_nota_clase, ($base_nota_clase == floor($base_nota_clase) ? 0 : 2))
        ],
        'resumen_notas' => ['notas_medias_por_evaluacion' => $resumen_notas_ficha],
        'historial_asistencia' => $historial_asistencia,
        'stats_asistencia' => $stats_asistencia
    ];

    wp_send_json_success($data_ficha);
}