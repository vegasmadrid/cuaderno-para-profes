<?php
// /includes/ajax-handlers/ajax-alumnos.php
// --- REFACTORIZADO PARA GESTIÓN GLOBAL DE ALUMNOS ---

defined('ABSPATH') or die('Acceso no permitido');

// Dependencias críticas para que las funciones de consulta estén disponibles
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-alumnos.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-clases.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-evaluaciones.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-actividades-calificaciones.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-calculos.php';
require_once CPP_PLUGIN_DIR . 'includes/utils.php';

// --- BÚSQUEDA Y OBTENCIÓN DE DATOS GLOBALES ---

add_action('wp_ajax_cpp_get_clases_for_filter', 'cpp_get_clases_for_filter');
function cpp_get_clases_for_filter() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    if (!$user_id) {
        wp_send_json_error(['message' => 'Error: Usuario no autenticado.']);
        return;
    }

    $clases = cpp_obtener_clases_usuario($user_id);
    if (is_wp_error($clases)) {
        wp_send_json_error(['message' => 'Error al obtener las clases.']);
        return;
    }

    wp_send_json_success(['clases' => $clases]);
}

add_action('wp_ajax_cpp_search_alumnos', 'cpp_ajax_search_alumnos');
function cpp_ajax_search_alumnos() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    $search_term = isset($_POST['search_term']) ? sanitize_text_field($_POST['search_term']) : '';
    $clase_id = isset($_POST['clase_id']) ? $_POST['clase_id'] : 'all';

    if ($clase_id !== 'all' && is_numeric($clase_id)) {
        $clase_id = intval($clase_id);
        if (!cpp_es_propietario_clase($clase_id, $user_id)) {
            wp_send_json_error(['message' => 'Permiso denegado para esta clase.']);
            return;
        }
        $alumnos = cpp_obtener_alumnos_clase($clase_id, $search_term, 'apellidos');
    } else {
        $alumnos = cpp_obtener_todos_alumnos_usuario($user_id, 'apellidos', $search_term);
    }

    // Para cada alumno, obtenemos sus clases
    foreach ($alumnos as &$alumno) {
        $clases_ids = cpp_get_clases_for_alumno($alumno['id']);
        $clases_nombres = [];
        if (!empty($clases_ids)) {
            global $wpdb;
            $placeholders = implode(',', array_fill(0, count($clases_ids), '%d'));
            $clases_nombres = $wpdb->get_col($wpdb->prepare(
                "SELECT nombre FROM {$wpdb->prefix}cpp_clases WHERE id IN ($placeholders)",
                $clases_ids
            ));
        }
        $alumno['clases'] = $clases_nombres;
    }

    wp_send_json_success(['alumnos' => $alumnos]);
}

add_action('wp_ajax_cpp_get_alumno_ficha', 'cpp_ajax_get_alumno_ficha');
function cpp_ajax_get_alumno_ficha() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    $alumno_id = isset($_POST['alumno_id']) ? intval($_POST['alumno_id']) : 0;

    if (empty($alumno_id)) {
        wp_send_json_error(['message' => 'ID de alumno no válido.']);
    }

    $alumno = cpp_obtener_alumno_por_id($alumno_id, $user_id);
    if (!$alumno) {
        wp_send_json_error(['message' => 'Alumno no encontrado o sin permisos.']);
    }

    // Obtener todas las clases del profesor y las del alumno
    $todas_las_clases = cpp_obtener_clases_usuario($user_id);
    $clases_del_alumno_ids = cpp_get_clases_for_alumno($alumno_id);

    // Obtener calificaciones de todas las clases
    $calificaciones_por_clase = [];
    foreach ($clases_del_alumno_ids as $clase_id) {
        $clase_info = cpp_obtener_clase_completa_por_id($clase_id, $user_id);
        if (!$clase_info) continue;

        $evaluaciones = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
        $calificaciones_por_evaluacion = [];

        foreach ($evaluaciones as $evaluacion) {
            // Utilizamos la nueva función que ya combina actividades y calificaciones
            $actividades = cpp_obtener_actividades_con_calificaciones_alumno($evaluacion['id'], $alumno_id, $user_id);
            $nota_final_evaluacion = cpp_calcular_nota_final_alumno($alumno_id, $clase_id, $user_id, $evaluacion['id']);

            $calificaciones_por_evaluacion[] = [
                'evaluacion_id' => $evaluacion['id'],
                'evaluacion_nombre' => $evaluacion['nombre_evaluacion'],
                'actividades' => $actividades,
                'nota_final' => $nota_final_evaluacion,
            ];
        }

        $nota_final_clase = cpp_calcular_nota_media_final_alumno($alumno_id, $clase_id, $user_id);

        // --- Resumen de Asistencia por Clase ---
        $historial_asistencia = cpp_obtener_asistencia_alumno_para_clase($user_id, $alumno_id, $clase_id);
        $stats_asistencia = [ 'presente' => 0, 'ausente' => 0, 'retraso' => 0, 'justificado' => 0 ];
        $incidencias = [];

        foreach($historial_asistencia as $asistencia_item) {
            $estado = $asistencia_item['estado'];
            $estado_para_stats = ($estado === 'falta') ? 'ausente' : $estado;

            if (isset($stats_asistencia[$estado_para_stats])) {
                $stats_asistencia[$estado_para_stats]++;
            }
            if ($estado !== 'presente') {
                $incidencias[] = $asistencia_item;
            }
        }

        // --- Actividades con faltas (X) en esta clase ---
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

        $calificaciones_por_clase[] = [
            'clase_id' => $clase_id,
            'clase_nombre' => $clase_info['nombre'],
            'evaluaciones' => $calificaciones_por_evaluacion,
            'nota_final_clase' => $nota_final_clase,
            'resumen_asistencia' => [
                'stats' => $stats_asistencia,
                'historial' => $incidencias,
                'actividades_con_falta' => $actividades_con_falta
            ]
        ];
    }

    $ficha_data = [
        'alumno' => $alumno,
        'todas_las_clases' => $todas_las_clases,
        'clases_del_alumno_ids' => $clases_del_alumno_ids,
        'calificaciones_agrupadas' => $calificaciones_por_clase
    ];

    wp_send_json_success(['ficha' => $ficha_data]);
}

// --- CREACIÓN, ACTUALIZACIÓN Y ELIMINACIÓN ---

add_action('wp_ajax_cpp_save_alumno_details', 'cpp_ajax_save_alumno_details');
function cpp_ajax_save_alumno_details() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();

    $alumno_id = isset($_POST['alumno_id']) ? intval($_POST['alumno_id']) : 0;
    $datos = [
        'nombre' => isset($_POST['nombre']) ? sanitize_text_field($_POST['nombre']) : '',
        'apellidos' => isset($_POST['apellidos']) ? sanitize_text_field($_POST['apellidos']) : '',
        'foto' => isset($_POST['foto']) ? sanitize_url($_POST['foto']) : '',
    ];

    if (empty($datos['nombre']) || empty($datos['apellidos'])) {
        wp_send_json_error(['message' => 'El nombre y los apellidos son obligatorios.']);
    }

    if ($alumno_id > 0) { // Actualizar
        $result = cpp_actualizar_alumno($alumno_id, $user_id, $datos);
        if ($result === false) {
            wp_send_json_error(['message' => 'Error al actualizar el alumno.']);
        }
        $new_alumno_id = $alumno_id;
    } else { // Crear
        if (cpp_alumno_existe($user_id, $datos['nombre'], $datos['apellidos'])) {
            wp_send_json_error(['message' => 'Ya existe un alumno con ese nombre y apellidos.']);
        }
        $new_alumno_id = cpp_crear_alumno($user_id, $datos);
        if (!$new_alumno_id) {
            wp_send_json_error(['message' => 'Error al crear el alumno.']);
        }
    }

    $alumno_guardado = cpp_obtener_alumno_por_id($new_alumno_id, $user_id);
    wp_send_json_success(['message' => 'Alumno guardado correctamente.', 'alumno' => $alumno_guardado]);
}

add_action('wp_ajax_cpp_update_alumno_clases', 'cpp_ajax_update_alumno_clases');
function cpp_ajax_update_alumno_clases() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    $alumno_id = isset($_POST['alumno_id']) ? intval($_POST['alumno_id']) : 0;
    $clases_ids = isset($_POST['clases_ids']) ? (array)$_POST['clases_ids'] : [];

    if (empty($alumno_id)) {
        wp_send_json_error(['message' => 'ID de alumno no válido.']);
    }

    $result = cpp_actualizar_clases_de_alumno($alumno_id, $user_id, $clases_ids);

    if (!$result['success']) {
        wp_send_json_error(['message' => $result['error'] ?? 'Error al actualizar las clases del alumno.']);
    }

    wp_send_json_success(['message' => 'Clases del alumno actualizadas.']);
}


add_action('wp_ajax_cpp_delete_alumno_globally', 'cpp_ajax_delete_alumno_globally');
function cpp_ajax_delete_alumno_globally() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    $alumno_id = isset($_POST['alumno_id']) ? intval($_POST['alumno_id']) : 0;

    if (empty($alumno_id)) {
        wp_send_json_error(['message' => 'ID de alumno no válido.']);
    }

    $result = cpp_eliminar_alumno($alumno_id, $user_id);
    if ($result === false) {
        wp_send_json_error(['message' => 'No se pudo eliminar al alumno o no tienes permisos.']);
    }

    wp_send_json_success(['message' => 'Alumno eliminado permanentemente.']);
}

// --- LÓGICA PARA LA PANTALLA DE CONFIGURACIÓN DE CLASE ---

add_action('wp_ajax_cpp_get_alumnos_for_clase_config', 'cpp_ajax_get_alumnos_for_clase_config');
function cpp_ajax_get_alumnos_for_clase_config() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;

    if (empty($clase_id) || !cpp_es_propietario_clase($clase_id, $user_id)) {
        wp_send_json_error(['message' => 'Clase no válida o sin permisos.']);
    }

    $alumnos = cpp_obtener_alumnos_clase($clase_id, '', 'apellidos');

    // Generar HTML
    ob_start();
    ?>
    <div class="cpp-alumnos-header-config">
        <h3>Alumnos en esta clase</h3>
        <p class="cpp-info-text">Para añadir, importar o eliminar alumnos de forma permanente, ve a la pestaña global <span class="dashicons dashicons-groups"></span> <strong>Alumnos</strong>.</p>
    </div>
    <div class="cpp-alumnos-list">
        <?php if (empty($alumnos)) : ?>
            <p>No hay alumnos en esta clase.</p>
        <?php else : ?>
            <?php foreach ($alumnos as $alumno) : ?>
                <div class="cpp-alumno-card">
                    <div class="cpp-alumno-info">
                        <img src="<?php echo esc_url(cpp_get_avatar_url($alumno)); ?>" alt="Avatar" class="cpp-alumno-avatar">
                        <h4><?php echo esc_html($alumno['nombre'] . ' ' . $alumno['apellidos']); ?></h4>
                    </div>
                    <div class="cpp-alumno-actions">
                        <button class="cpp-btn-icon cpp-btn-editar-desde-clase" data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" title="Editar en la Ficha Global">
                            <span class="dashicons dashicons-edit"></span>
                        </button>
                        <button class="cpp-btn-icon cpp-btn-quitar-de-clase" data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" data-clase-id="<?php echo esc_attr($clase_id); ?>" title="Quitar de esta clase">
                            <span class="dashicons dashicons-dismiss"></span>
                        </button>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
    <?php
    $html = ob_get_clean();

    wp_send_json_success(['html' => $html]);
}


add_action('wp_ajax_cpp_get_alumno_ranking_in_clase', 'cpp_ajax_get_alumno_ranking_in_clase');
add_action('wp_ajax_cpp_get_alumno_calificaciones_evolucion', 'cpp_ajax_get_alumno_calificaciones_evolucion');
function cpp_ajax_get_alumno_calificaciones_evolucion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    $alumno_id = isset($_POST['alumno_id']) ? intval($_POST['alumno_id']) : 0;
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;

    if (empty($alumno_id) || empty($clase_id) || !cpp_es_propietario_clase($clase_id, $user_id)) {
        wp_send_json_error(['message' => 'Datos no válidos o sin permisos.']);
    }

    $evolution_data = cpp_obtener_evolucion_calificaciones_alumno($alumno_id, $clase_id, $user_id);

    wp_send_json_success($evolution_data);
}

function cpp_ajax_get_alumno_ranking_in_clase() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    $alumno_id = isset($_POST['alumno_id']) ? intval($_POST['alumno_id']) : 0;
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;

    if (empty($alumno_id) || empty($clase_id) || !cpp_es_propietario_clase($clase_id, $user_id)) {
        wp_send_json_error(['message' => 'Datos no válidos o sin permisos.']);
    }

    $ranking_data = cpp_calcular_ranking_alumno_en_clase($alumno_id, $clase_id, $user_id);

    if (!$ranking_data) {
        wp_send_json_error(['message' => 'No se pudo calcular el ranking.']);
    }

    wp_send_json_success($ranking_data);
}

// --- AJAX HANDLERS PARA COPIAR ALUMNOS ---

add_action('wp_ajax_cpp_get_source_classes_for_copy', 'cpp_ajax_get_source_classes_for_copy');
function cpp_ajax_get_source_classes_for_copy() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    if (!$user_id) {
        wp_send_json_error(['message' => 'Error: Usuario no autenticado.']);
        return;
    }

    $target_clase_id = isset($_POST['target_clase_id']) ? intval($_POST['target_clase_id']) : 0;
    if (empty($target_clase_id)) {
        wp_send_json_error(['message' => 'Clase de destino no especificada.']);
        return;
    }

    $all_clases = cpp_obtener_clases_usuario($user_id);
    if (is_wp_error($all_clases)) {
        wp_send_json_error(['message' => 'Error al obtener las clases.']);
        return;
    }

    // Filtrar la clase de destino para que no aparezca en la lista de origen
    $source_clases = array_filter($all_clases, function($clase) use ($target_clase_id) {
        return $clase['id'] != $target_clase_id;
    });

    // Re-indexar el array para asegurar que sea un array JSON y no un objeto
    $source_clases = array_values($source_clases);

    wp_send_json_success(['clases' => $source_clases]);
}

add_action('wp_ajax_cpp_copy_alumnos_to_clase', 'cpp_ajax_copy_alumnos_to_clase');
function cpp_ajax_copy_alumnos_to_clase() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    global $wpdb;
    $user_id = get_current_user_id();

    // 1. Validar Entradas
    $source_clase_id = isset($_POST['source_clase_id']) ? intval($_POST['source_clase_id']) : 0;
    $target_clase_id = isset($_POST['target_clase_id']) ? intval($_POST['target_clase_id']) : 0;

    if (empty($source_clase_id) || empty($target_clase_id)) {
        wp_send_json_error(['message' => 'IDs de clase de origen y destino son requeridos.']);
    }

    // 2. Verificar Permisos
    if (!cpp_es_propietario_clase($source_clase_id, $user_id) || !cpp_es_propietario_clase($target_clase_id, $user_id)) {
        wp_send_json_error(['message' => 'Permiso denegado. No eres propietario de una de las clases.']);
    }

    // 3. Obtener Alumnos de Origen y Destino
    $alumnos_origen = cpp_obtener_alumnos_clase($source_clase_id);
    $alumnos_destino_actuales = cpp_obtener_alumnos_clase($target_clase_id);
    $ids_alumnos_destino = wp_list_pluck($alumnos_destino_actuales, 'id');

    $alumnos_a_copiar = array_filter($alumnos_origen, function($alumno) use ($ids_alumnos_destino) {
        return !in_array($alumno['id'], $ids_alumnos_destino);
    });

    if (empty($alumnos_a_copiar)) {
        wp_send_json_success(['message' => 'No hay alumnos nuevos que copiar. La clase de destino ya los contiene todos.']);
    }

    // 4. Realizar la Inserción
    $table_name = $wpdb->prefix . 'cpp_alumnos_clases';
    $copied_count = 0;
    foreach ($alumnos_a_copiar as $alumno) {
        $result = $wpdb->insert(
            $table_name,
            [
                'alumno_id' => $alumno['id'],
                'clase_id' => $target_clase_id,
            ],
            ['%d', '%d']
        );
        if ($result) {
            $copied_count++;
        }
    }

    // 5. Enviar Respuesta
    if ($copied_count > 0) {
        wp_send_json_success(['message' => "Se han copiado $copied_count alumnos con éxito."]);
    } else {
        wp_send_json_error(['message' => 'Ocurrió un error y no se pudieron copiar los alumnos.']);
    }
}
