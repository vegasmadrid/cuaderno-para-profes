<?php
// /includes/ajax-handlers/ajax-actividades.php

defined('ABSPATH') or die('Acceso no permitido');


add_action('wp_ajax_cpp_get_actividades_tab_content', 'cpp_ajax_get_actividades_tab_content');
function cpp_ajax_get_actividades_tab_content() {
    nocache_headers();
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    global $wpdb;
    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $criterio_id = isset($_POST['criterio_id']) ? intval($_POST['criterio_id']) : 0;
    $limit = isset($_POST['limit']) ? intval($_POST['limit']) : 50;

    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $tabla_criterios = $wpdb->prefix . 'cpp_criterios_globales';

    $where_clauses = ["a.user_id = $user_id"];
    if ($clase_id > 0) {
        $where_clauses[] = $wpdb->prepare("a.clase_id = %d", $clase_id);
    }
    if ($evaluacion_id > 0) {
        $where_clauses[] = $wpdb->prepare("a.evaluacion_id = %d", $evaluacion_id);
    }
    if ($criterio_id > 0) {
        $where_clauses[] = $wpdb->prepare("a.criterio_id = %d", $criterio_id);
    } elseif ($criterio_id == -1) {
        $where_clauses[] = "a.criterio_id IS NULL";
    }

    $where_sql = implode(' AND ', $where_clauses);

    // Obtenemos actividades con info de clase y criterio
    $sql = "SELECT a.*,
                   c.nombre as clase_nombre, c.color as clase_color,
                   cg.nombre as nombre_criterio, cg.color as criterio_color,
                   ev.nombre_evaluacion
            FROM $tabla_actividades a
            INNER JOIN $tabla_clases c ON a.clase_id = c.id
            LEFT JOIN $tabla_evaluaciones ev ON a.evaluacion_id = ev.id
            LEFT JOIN $tabla_criterios cg ON a.criterio_id = cg.id
            WHERE $where_sql
            ORDER BY a.fecha_actividad DESC, a.id DESC";

    if ($limit > 0) {
        $sql = $wpdb->prepare($sql . " LIMIT %d", $limit);
    }

    $actividades = $wpdb->get_results($sql, ARRAY_A);

    if (empty($actividades)) {
        ob_start();
        ?>
        <div class="cpp-empty-panel">
            <span class="dashicons dashicons-clipboard"></span>
            <h2>No se han encontrado actividades</h2>
            <p>Prueba a cambiar los filtros o añade nuevas actividades desde el Cuaderno.</p>
        </div>
        <?php
        $html = ob_get_clean();
        wp_send_json_success(['html' => $html]);
        return;
    }

    // --- OPTIMIZACIÓN: Obtener promedios de todas las actividades en una sola pasada ---
    $actividad_ids = wp_list_pluck($actividades, 'id');
    $placeholders = implode(',', array_fill(0, count($actividad_ids), '%d'));

    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_alumnos_clases = $wpdb->prefix . 'cpp_alumnos_clases';

    $sql_notas = $wpdb->prepare("
        SELECT ca.actividad_id, ca.nota, act.clase_id
        FROM $tabla_calificaciones ca
        INNER JOIN $tabla_actividades act ON ca.actividad_id = act.id
        INNER JOIN $tabla_alumnos_clases ac ON ca.alumno_id = ac.alumno_id AND act.clase_id = ac.clase_id
        WHERE ca.actividad_id IN ($placeholders) AND ac.visible = 1
    ", ...$actividad_ids);

    $todas_las_notas = $wpdb->get_results($sql_notas, ARRAY_A);
    $mapa_promedios = [];
    $acumulador_notas = []; // [id] => ['suma' => X, 'count' => Y]

    foreach ($todas_las_notas as $nota_row) {
        $act_id = $nota_row['actividad_id'];
        $nota_num = cpp_extraer_numero_de_calificacion($nota_row['nota']);
        if ($nota_num !== null) {
            if (!isset($acumulador_notas[$act_id])) {
                $acumulador_notas[$act_id] = ['suma' => 0, 'count' => 0];
            }
            $acumulador_notas[$act_id]['suma'] += $nota_num;
            $acumulador_notas[$act_id]['count']++;
        }
    }

    foreach ($acumulador_notas as $act_id => $data) {
        $mapa_promedios[$act_id] = round($data['suma'] / $data['count'], 2);
    }

    // ELIMINADA HIDRATACIÓN COSTOSA: Trust the stored fecha_actividad which is already updated by the Programmer sync.

    // ELIMINADA HIDRATACIÓN COSTOSA: Trust the stored fecha_actividad which is already updated by the Programmer sync.

    $counts = cpp_get_global_criterion_counts($user_id);

    // Agrupar criterios por evaluación para los selectores de la tabla
    $criterios_por_evaluacion = [];

    ob_start();
    ?>
    <div class="cpp-actividades-table-wrapper">
        <table class="cpp-actividades-table" id="cpp-actividades-main-table">
            <thead>
                <tr>
                    <th style="width: 15%;" class="cpp-sortable-header" data-sort-key="clase">Clase <span class="dashicons dashicons-sort"></span></th>
                    <th style="width: 20%;" class="cpp-sortable-header" data-sort-key="nombre">Nombre <span class="dashicons dashicons-sort"></span></th>
                    <th style="width: 15%;" class="cpp-sortable-header" data-sort-key="categoria">Criterio <span class="dashicons dashicons-sort"></span></th>
                    <th style="width: 10%;" class="cpp-sortable-header" data-sort-key="fecha">Fecha <span class="dashicons dashicons-sort"></span></th>
                    <th style="width: 8%;" class="cpp-sortable-header" data-sort-key="nota_max">Nota Máx. <span class="dashicons dashicons-sort"></span></th>
                    <th style="width: 15%;" class="cpp-sortable-header" data-sort-key="descripcion">Descripción <span class="dashicons dashicons-sort"></span></th>
                    <th style="width: 9%;" class="cpp-sortable-header" data-sort-key="media">Nota Media <span class="dashicons dashicons-sort"></span></th>
                    <th style="width: 8%;">Acciones</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($actividades as $act) :
                    $promedio = isset($mapa_promedios[$act['id']]) ? $mapa_promedios[$act['id']] : null;
                    $criterio_color = !empty($act['criterio_color']) ? $act['criterio_color'] : '#FFFFFF';
                    $is_programada = !empty($act['sesion_id']);
                    $clase_color = !empty($act['clase_color']) ? $act['clase_color'] : '#CCCCCC';

                    // Usar criterios globales para el selector de la fila para asegurar consistencia
                    $criterios_fila = $criterios_globales;
                ?>
                        <tr data-actividad-id="<?php echo esc_attr($act['id']); ?>" data-evaluacion-id="<?php echo esc_attr($act['evaluacion_id']); ?>">
                            <td data-sort-value="<?php echo esc_attr($act['clase_nombre']); ?>">
                                <div class="cpp-actividad-clase-cell">
                                    <span class="cpp-clase-color-strip" style="background-color: <?php echo esc_attr($clase_color); ?>;"></span>
                                    <span class="cpp-clase-nombre-text"><?php echo esc_html($act['clase_nombre']); ?></span>
                                </div>
                            </td>
                            <td data-sort-value="<?php echo esc_attr($act['nombre_actividad']); ?>">
                                <input type="text" class="cpp-inline-edit" data-field="nombre_actividad" value="<?php echo esc_attr($act['nombre_actividad']); ?>" placeholder="Nombre de la actividad">
                            </td>
                            <td data-sort-value="<?php echo esc_attr($act['nombre_criterio'] ?: 'Sin criterio'); ?>">
                                <div class="cpp-actividad-categoria-cell">
                                    <span class="cpp-category-dot" style="background-color: <?php echo esc_attr($criterio_color); ?>;"></span>
                                    <select class="cpp-inline-edit" data-field="criterio_id">
                                        <option value="">-- Sin criterio --</option>
                                        <?php foreach ($criterios_fila as $crit) : ?>
                                            <option value="<?php echo esc_attr($crit['id']); ?>" <?php selected($act['criterio_id'], $crit['id']); ?> data-color="<?php echo esc_attr($crit['color']); ?>">
                                                <?php echo esc_html($crit['nombre']); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                            </td>
                            <td data-sort-value="<?php echo esc_attr($act['fecha_actividad'] ?: '0000-00-00'); ?>">
                                <div class="cpp-actividad-fecha-display <?php echo $is_programada ? 'is-programada' : ''; ?>" title="<?php echo $is_programada ? 'Fecha gestionada desde la programación' : ''; ?>">
                                    <?php echo $act['fecha_actividad'] ? date('d/m/Y', strtotime($act['fecha_actividad'])) : '-'; ?>
                                </div>
                            </td>
                            <td data-sort-value="<?php echo esc_attr($act['nota_maxima']); ?>">
                                <input type="number" class="cpp-inline-edit" data-field="nota_maxima" value="<?php echo esc_attr($act['nota_maxima']); ?>" step="0.01" min="0.01">
                            </td>
                            <td data-sort-value="<?php echo esc_attr($act['descripcion_actividad']); ?>">
                                <textarea class="cpp-inline-edit" data-field="descripcion_actividad" rows="1" placeholder="Añade una descripción..."><?php echo esc_textarea($act['descripcion_actividad']); ?></textarea>
                            </td>
                            <td class="cpp-actividad-promedio" data-sort-value="<?php echo esc_attr($promedio !== null ? $promedio : -1); ?>">
                                <strong><?php echo $promedio !== null ? cpp_formatear_nota_display($promedio) : '-'; ?></strong>
                            </td>
                            <td>
                                <button class="cpp-btn-icon cpp-btn-delete-actividad" title="Eliminar Actividad">
                                    <span class="dashicons dashicons-trash"></span>
                                </button>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php
    $html = ob_get_clean();
    wp_send_json_success([
        'html' => $html,
        'criterios' => $counts['criterios'],
        'num_sin_criterio' => $counts['num_sin_criterio']
    ]);
}

add_action('wp_ajax_cpp_actualizar_actividad_inline', 'cpp_ajax_actualizar_actividad_inline');
function cpp_ajax_actualizar_actividad_inline() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $actividad_id = isset($_POST['actividad_id']) ? intval($_POST['actividad_id']) : 0;
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $field = isset($_POST['field']) ? sanitize_text_field($_POST['field']) : '';
    $value = isset($_POST['value']) ? $_POST['value'] : '';

    if (empty($actividad_id) || empty($field)) {
        wp_send_json_error(['message' => 'Datos incompletos.']);
        return;
    }

    // Validar el campo a actualizar
    $campos_permitidos = ['nombre_actividad', 'categoria_id', 'criterio_id', 'nota_maxima', 'descripcion_actividad'];
    if (!in_array($field, $campos_permitidos)) {
        wp_send_json_error(['message' => 'Campo no permitido para edición en línea.']);
        return;
    }

    $datos = [
        'user_id' => $user_id,
        'evaluacion_id' => $evaluacion_id
    ];

    // Sanitización específica por campo
    switch ($field) {
        case 'nombre_actividad':
            $datos[$field] = sanitize_text_field($value);
            break;
        case 'categoria_id':
        case 'criterio_id':
            $datos[$field] = intval($value);
            break;
        case 'nota_maxima':
            $datos[$field] = floatval($value);
            break;
        case 'descripcion_actividad':
            $datos[$field] = sanitize_textarea_field($value);
            break;
    }

    // Si actualizamos categoría o nota máxima, necesitamos forzar el recalculo de notas finales en el frontend
    // pero eso lo manejaremos con una señal de recarga.

    $resultado = cpp_actualizar_actividad_evaluable($actividad_id, $datos);

    if ($resultado !== false) {
        $counts = cpp_get_global_criterion_counts($user_id);
        wp_send_json_success([
            'message' => 'Actividad actualizada.',
            'criterios' => $counts['criterios'],
            'num_sin_criterio' => $counts['num_sin_criterio']
        ]);
    } else {
        wp_send_json_error(['message' => 'Error al actualizar la actividad.']);
    }
}

add_action('wp_ajax_cpp_eliminar_actividad', 'cpp_ajax_eliminar_actividad');
function cpp_ajax_eliminar_actividad() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $actividad_id = isset($_POST['actividad_id']) ? intval($_POST['actividad_id']) : 0;

    if (empty($actividad_id)) {
        wp_send_json_error(['message' => 'ID de actividad no proporcionado.']);
        return;
    }

    $resultado = cpp_eliminar_actividad_y_calificaciones($actividad_id, $user_id);

    if ($resultado) {
        $counts = cpp_get_global_criterion_counts($user_id);
        wp_send_json_success([
            'message' => 'Actividad eliminada correctamente.',
            'criterios' => $counts['criterios'],
            'num_sin_criterio' => $counts['num_sin_criterio']
        ]);
    } else {
        wp_send_json_error(['message' => 'Error al eliminar la actividad o no tienes permiso.']);
    }
}

add_action('wp_ajax_cpp_get_evaluable_activity_data', 'cpp_ajax_get_evaluable_activity_data');
function cpp_ajax_get_evaluable_activity_data() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $actividad_id = isset($_POST['actividad_id']) ? intval($_POST['actividad_id']) : 0;

    if (empty($actividad_id)) {
        wp_send_json_error(['message' => 'ID de actividad no proporcionado.']);
        return;
    }

    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $actividad = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $tabla_actividades WHERE id = %d AND user_id = %d",
        $actividad_id,
        $user_id
    ), ARRAY_A);

    if ($actividad) {
        $actividades_a_hidratar = [$actividad];
        $actividades_hidratadas = cpp_hidratar_fechas_de_actividades(
            $actividades_a_hidratar,
            $actividad['clase_id'],
            $actividad['evaluacion_id'],
            $user_id
        );
        wp_send_json_success($actividades_hidratadas[0]);
    } else {
        wp_send_json_error(['message' => 'Actividad no encontrada o no tienes permiso.']);
    }
}
