<?php
// /includes/ajax-handlers/ajax-alumnos.php

defined('ABSPATH') or die('Acceso no permitido');

// Dependencias
require_once CPP_PLUGIN_DIR . 'includes/utils.php';
require_once CPP_PLUGIN_DIR . 'includes/db.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-clases.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-evaluaciones.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-categorias.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-actividades-calificaciones.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-calculos.php';
require_once CPP_PLUGIN_DIR . 'includes/programador/db-programador.php';
require_once CPP_PLUGIN_DIR . 'includes/programador/ajax-programador.php';

add_action('wp_ajax_cpp_get_all_clases_for_user', 'cpp_ajax_get_all_clases_for_user');
function cpp_ajax_get_all_clases_for_user() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    $clases = cpp_obtener_clases_usuario($user_id);
    wp_send_json_success(['clases' => $clases]);
}

add_action('wp_ajax_cpp_search_alumnos', 'cpp_ajax_search_alumnos');
function cpp_ajax_search_alumnos() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    $search_term = isset($_POST['search_term']) ? sanitize_text_field($_POST['search_term']) : '';
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;

    global $wpdb;
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $tabla_clases = $wpdb->prefix . 'cpp_clases';

    $query = "SELECT a.id, a.nombre, a.apellidos, c.nombre AS clase_nombre
              FROM $tabla_alumnos a
              JOIN $tabla_clases c ON a.clase_id = c.id
              WHERE c.user_id = %d";

    $params = [$user_id];

    if (!empty($search_term)) {
        $query .= " AND (a.nombre LIKE %s OR a.apellidos LIKE %s)";
        $like_term = '%' . $wpdb->esc_like($search_term) . '%';
        $params[] = $like_term;
        $params[] = $like_term;
    }

    if (!empty($clase_id)) {
        $query .= " AND a.clase_id = %d";
        $params[] = $clase_id;
    }

    $query .= " ORDER BY a.apellidos, a.nombre";

    $alumnos = $wpdb->get_results($wpdb->prepare($query, ...$params));

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

    global $wpdb;
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $tabla_clases = $wpdb->prefix . 'cpp_clases';

    $query = "SELECT a.id, a.nombre, a.apellidos, a.foto, c.nombre AS clase_nombre, c.id AS clase_id
              FROM $tabla_alumnos a
              JOIN $tabla_clases c ON a.clase_id = c.id
              WHERE a.id = %d AND c.user_id = %d";

    $alumno = $wpdb->get_row($wpdb->prepare($query, $alumno_id, $user_id));

    if (!$alumno) {
        wp_send_json_error(['message' => 'Alumno no encontrado.']);
    }

    // Recopilar datos adicionales
    $tabla_anotaciones = $wpdb->prefix . 'cpp_anotaciones';
    $tabla_asistencia = $wpdb->prefix . 'cpp_asistencia';
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';

    $anotaciones = $wpdb->get_results($wpdb->prepare("SELECT * FROM $tabla_anotaciones WHERE alumno_id = %d ORDER BY fecha DESC", $alumno_id));
    $ausencias = $wpdb->get_results($wpdb->prepare("SELECT fecha, estado FROM $tabla_asistencia WHERE alumno_id = %d ORDER BY fecha DESC", $alumno_id));

    $calificaciones = $wpdb->get_results($wpdb->prepare("
        SELECT ca.nota, ae.nota_maxima
        FROM $tabla_calificaciones ca
        JOIN $tabla_actividades ae ON ca.actividad_id = ae.id
        WHERE ca.alumno_id = %d
    ", $alumno_id));

    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $evaluaciones = $wpdb->get_results($wpdb->prepare("SELECT * FROM $tabla_evaluaciones WHERE clase_id = %d ORDER BY orden", $alumno->clase_id));

    $calificaciones_por_evaluacion = [];
    foreach ($evaluaciones as $evaluacion) {
        $actividades_evaluacion = $wpdb->get_results($wpdb->prepare("
            SELECT ae.id, ae.nombre_actividad, ca.nota, ae.nota_maxima
            FROM $tabla_actividades ae
            LEFT JOIN $tabla_calificaciones ca ON ae.id = ca.actividad_id AND ca.alumno_id = %d
            WHERE ae.evaluacion_id = %d
            ORDER BY ae.orden
        ", $alumno_id, $evaluacion->id));
        $calificaciones_por_evaluacion[] = [
            'evaluacion_nombre' => $evaluacion->nombre_evaluacion,
            'actividades' => $actividades_evaluacion
        ];
    }

    $promedios_por_evaluacion = [];
    foreach ($calificaciones_por_evaluacion as $eval_data) {
        $notas = [];
        foreach ($eval_data['actividades'] as $actividad) {
            if (is_numeric($actividad->nota) && is_numeric($actividad->nota_maxima) && $actividad->nota_maxima > 0) {
                $notas[] = ($actividad->nota / $actividad->nota_maxima) * 100;
            }
        }
        $promedio = count($notas) > 0 ? array_sum($notas) / count($notas) : 0;
        $promedios_por_evaluacion[] = [
            'evaluacion_nombre' => $eval_data['evaluacion_nombre'],
            'promedio' => $promedio
        ];
    }

    // --- NUEVO: Preparar datos para el gráfico de rendimiento ---
    $actividades_calificadas_raw = $wpdb->get_results($wpdb->prepare("
        SELECT
            act.id, act.sesion_id, act.evaluacion_id, act.fecha_actividad,
            act.nota_maxima, cal.nota, act.nombre_actividad
        FROM {$wpdb->prefix}cpp_actividades_evaluables AS act
        JOIN {$wpdb->prefix}cpp_calificaciones_alumnos AS cal ON act.id = cal.actividad_id
        WHERE act.clase_id = %d AND cal.alumno_id = %d
    ", $alumno->clase_id, $alumno_id), ARRAY_A);

    $actividades_por_evaluacion_para_hidratar = [];
    foreach ($actividades_calificadas_raw as $actividad) {
        if (cpp_extraer_numero_de_calificacion($actividad['nota']) !== null) {
            $actividades_por_evaluacion_para_hidratar[$actividad['evaluacion_id']][] = $actividad;
        }
    }

    $actividades_hidratadas = [];
    foreach ($actividades_por_evaluacion_para_hidratar as $eval_id => $actividades) {
        $hidratadas = cpp_hidratar_fechas_de_actividades($actividades, $alumno->clase_id, $eval_id, $user_id);
        $actividades_hidratadas = array_merge($actividades_hidratadas, $hidratadas);
    }

    $rendimiento_data = [];
    foreach ($actividades_hidratadas as $actividad) {
        if (!empty($actividad['fecha_actividad'])) {
            $nota_numerica = cpp_extraer_numero_de_calificacion($actividad['nota']);
            $nota_maxima = !empty($actividad['nota_maxima']) && floatval($actividad['nota_maxima']) > 0 ? floatval($actividad['nota_maxima']) : 10.0;
            $rendimiento_data[] = [
                'fecha' => $actividad['fecha_actividad'],
                'nota_percent' => round(($nota_numerica / $nota_maxima) * 100, 2),
                'nombre_actividad' => $actividad['nombre_actividad'],
            ];
        }
    }

    usort($rendimiento_data, function($a, $b) {
        return strtotime($a['fecha']) - strtotime($b['fecha']);
    });

    $estadisticas = [
        'total_anotaciones' => count($anotaciones),
        'total_ausencias' => count(array_filter($ausencias, function($a) { return $a->estado === 'ausente'; })),
        'calificaciones_por_evaluacion' => $calificaciones_por_evaluacion,
        'promedios_por_evaluacion' => $promedios_por_evaluacion,
        'rendimiento_data' => $rendimiento_data
    ];

    $ficha_data = [
        'id' => $alumno->id,
        'nombre' => $alumno->nombre,
        'apellidos' => $alumno->apellidos,
        'foto' => $alumno->foto,
        'clase_nombre' => $alumno->clase_nombre,
        'anotaciones' => $anotaciones,
        'ausencias' => $ausencias,
        'estadisticas' => $estadisticas
    ];

    // Calcular ranking
    require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-calculos.php';
    $alumnos_clase = $wpdb->get_results($wpdb->prepare("SELECT id FROM $tabla_alumnos WHERE clase_id = %d", $alumno->clase_id));
    $notas_finales = [];
    foreach ($alumnos_clase as $a) {
        // FIX: Utilizar la función correcta que calcula la media de las evaluaciones configuradas
        // y pasar todos los argumentos necesarios (user_id).
        $notas_finales[$a->id] = cpp_calcular_nota_media_final_alumno($a->id, $alumno->clase_id, $user_id);
    }
    arsort($notas_finales);
    $ranking = array_search($alumno_id, array_keys($notas_finales)) + 1;
    $ficha_data['ranking'] = $ranking;
    $ficha_data['total_alumnos'] = count($alumnos_clase);


    wp_send_json_success(['ficha' => $ficha_data]);
}

add_action('wp_ajax_cpp_update_alumno', 'cpp_ajax_update_alumno');
function cpp_ajax_update_alumno() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    $alumno_id = isset($_POST['alumno_id']) ? intval($_POST['alumno_id']) : 0;
    $nombre = isset($_POST['nombre']) ? sanitize_text_field($_POST['nombre']) : '';
    $apellidos = isset($_POST['apellidos']) ? sanitize_text_field($_POST['apellidos']) : '';

    if (empty($alumno_id) || empty($nombre) || empty($apellidos)) {
        wp_send_json_error(['message' => 'Faltan datos para actualizar el alumno.']);
    }

    global $wpdb;
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $tabla_clases = $wpdb->prefix . 'cpp_clases';

    // Verify user ownership of the student before updating
    $clase_id = $wpdb->get_var($wpdb->prepare("SELECT clase_id FROM $tabla_alumnos WHERE id = %d", $alumno_id));
    $owner_id = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_clases WHERE id = %d", $clase_id));

    if ($owner_id != $user_id) {
        wp_send_json_error(['message' => 'No tienes permiso para editar este alumno.']);
    }

    $result = $wpdb->update(
        $tabla_alumnos,
        ['nombre' => $nombre, 'apellidos' => $apellidos],
        ['id' => $alumno_id],
        ['%s', '%s'],
        ['%d']
    );

    if ($result === false) {
        wp_send_json_error(['message' => 'Error al actualizar el alumno en la base de datos.']);
    }

    wp_send_json_success();
}

add_action('wp_ajax_cpp_obtener_alumnos', 'cpp_ajax_obtener_alumnos_handler');
function cpp_ajax_obtener_alumnos_handler() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;

    if (empty($clase_id)) {
        wp_send_json_error(['message' => 'ID de clase no proporcionado.']);
    }

    // Security check: Make sure the user owns the class
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $owner_id = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_clases WHERE id = %d", $clase_id));

    if ($owner_id != $user_id) {
        wp_send_json_error(['message' => 'No tienes permiso para ver estos alumnos.']);
    }

    require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-alumnos.php';
    $alumnos = cpp_obtener_alumnos_clase($clase_id);

    ob_start();
    ?>
    <div class="cpp-alumnos-header">
        <h3>Alumnos de la clase</h3>
        <div>
            <button id="cpp-importar-alumnos-excel-btn" class="cpp-btn cpp-btn-secondary">
                <span class="dashicons dashicons-upload"></span> Importar desde Excel
            </button>
            <button id="cpp-nuevo-alumno-btn" class="cpp-btn cpp-btn-primary">
                <span class="dashicons dashicons-plus"></span> Añadir Alumno
            </button>
        </div>
    </div>
    <div class="cpp-alumnos-list">
        <?php if (empty($alumnos)) : ?>
            <p>No hay alumnos en esta clase todavía.</p>
        <?php else : ?>
            <?php foreach ($alumnos as $alumno) : ?>
                <div class="cpp-alumno-card">
                    <div class="cpp-alumno-info">
                        <img src="<?php echo esc_url(cpp_get_avatar_url($alumno)); ?>" alt="Avatar" class="cpp-alumno-avatar">
                        <h4><?php echo esc_html($alumno['nombre'] . ' ' . $alumno['apellidos']); ?></h4>
                    </div>
                    <div class="cpp-alumno-actions">
                        <button class="cpp-btn-icon cpp-btn-editar" data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" title="Editar">
                            <span class="dashicons dashicons-edit"></span>
                        </button>
                        <button class="cpp-btn-icon cpp-btn-eliminar-alumno" data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" title="Eliminar">
                            <span class="dashicons dashicons-trash"></span>
                        </button>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
    <div id="cpp-form-alumno" style="display:none;">
        <h3 id="cpp-form-alumno-titulo">Añadir Nuevo Alumno</h3>
        <form id="cpp-form-nuevo-alumno" class="cpp-modern-form">
            <input type="hidden" name="clase_id_form_alumno" value="<?php echo esc_attr($clase_id); ?>">
            <input type="hidden" id="alumno_id_editar" name="alumno_id_editar" value="">

            <div class="cpp-form-grid">
                <div class="cpp-form-group">
                    <label for="nombre_alumno">Nombre</label>
                    <input type="text" id="nombre_alumno" name="nombre_alumno" required>
                </div>
                <div class="cpp-form-group">
                    <label for="apellidos_alumno">Apellidos</label>
                    <input type="text" id="apellidos_alumno" name="apellidos_alumno" required>
                </div>
            </div>

            <div class="cpp-form-group">
                <label for="foto_alumno">URL de la foto (opcional)</label>
                <input type="text" id="foto_alumno" name="foto_alumno">
                <div id="cpp-foto-actual-preview" style="margin-top:10px;"></div>
            </div>

            <div class="cpp-form-actions">
                 <button type="submit" id="cpp-submit-alumno-btn" class="cpp-btn cpp-btn-primary"><span class="dashicons dashicons-saved"></span> Guardar Alumno</button>
                 <button type="button" id="cpp-cancel-edit-alumno-btn" class="cpp-btn cpp-btn-secondary">Cancelar</button>
            </div>
        </form>
    </div>
    <?php
    $html = ob_get_clean();

    wp_send_json_success(['html' => $html]);
}
