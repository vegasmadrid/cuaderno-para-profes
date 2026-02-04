<?php
// /includes/ajax-handlers/ajax-actividades.php

defined('ABSPATH') or die('Acceso no permitido');

add_action('wp_ajax_cpp_get_actividades_tab_content', 'cpp_ajax_get_actividades_tab_content');
function cpp_ajax_get_actividades_tab_content() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;

    if (empty($clase_id) || empty($evaluacion_id)) {
        wp_send_json_error(['message' => 'ID de clase o evaluación no proporcionado.']);
        return;
    }

    // Si la evaluación es 'final', no mostramos actividades (el usuario dijo solo evaluación vigente)
    if ($evaluacion_id === 'final' || $evaluacion_id <= 0) {
        ob_start();
        ?>
        <div class="cpp-empty-panel">
            <p>Selecciona una evaluación específica para gestionar sus actividades.</p>
        </div>
        <?php
        wp_send_json_success(['html' => ob_get_clean()]);
        return;
    }

    $actividades = cpp_obtener_actividades_por_clase($clase_id, $user_id, $evaluacion_id);
    $categorias = cpp_obtener_categorias_por_evaluacion($evaluacion_id, $user_id);

    ob_start();
    if (empty($actividades)) : ?>
        <div class="cpp-empty-panel">
            <span class="dashicons dashicons-clipboard"></span>
            <h2>No hay actividades evaluables</h2>
            <p>Añade actividades desde el Cuaderno o la Programación para verlas aquí.</p>
        </div>
    <?php else : ?>
        <div class="cpp-actividades-table-wrapper">
            <table class="cpp-actividades-table" id="cpp-actividades-main-table">
                <thead>
                    <tr>
                        <th style="width: 25%;" class="cpp-sortable-header" data-sort-key="nombre">Nombre <span class="dashicons dashicons-sort"></span></th>
                        <th style="width: 15%;" class="cpp-sortable-header" data-sort-key="categoria">Categoría <span class="dashicons dashicons-sort"></span></th>
                        <th style="width: 12%;" class="cpp-sortable-header" data-sort-key="fecha">Fecha <span class="dashicons dashicons-sort"></span></th>
                        <th style="width: 10%;" class="cpp-sortable-header" data-sort-key="nota_max">Nota Máx. <span class="dashicons dashicons-sort"></span></th>
                        <th style="width: 20%;" class="cpp-sortable-header" data-sort-key="descripcion">Descripción <span class="dashicons dashicons-sort"></span></th>
                        <th style="width: 10%;" class="cpp-sortable-header" data-sort-key="media">Nota Media <span class="dashicons dashicons-sort"></span></th>
                        <th style="width: 8%;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($actividades as $act) :
                        $promedio = cpp_obtener_promedio_actividad($act['id']);
                        $categoria_color = !empty($act['categoria_color']) ? $act['categoria_color'] : '#e0e0e0';
                        $is_programada = !empty($act['sesion_id']);

                        $cat_name = 'Sin categoría';
                        foreach($categorias as $cat) {
                            if($cat['id'] == $act['categoria_id']) {
                                $cat_name = $cat['nombre_categoria'];
                                break;
                            }
                        }
                    ?>
                        <tr data-actividad-id="<?php echo esc_attr($act['id']); ?>">
                            <td data-sort-value="<?php echo esc_attr($act['nombre_actividad']); ?>">
                                <input type="text" class="cpp-inline-edit" data-field="nombre_actividad" value="<?php echo esc_attr($act['nombre_actividad']); ?>" placeholder="Nombre de la actividad">
                            </td>
                            <td data-sort-value="<?php echo esc_attr($cat_name); ?>">
                                <div class="cpp-actividad-categoria-cell">
                                    <span class="cpp-category-dot" style="background-color: <?php echo esc_attr($categoria_color); ?>;"></span>
                                    <select class="cpp-inline-edit" data-field="categoria_id">
                                        <?php foreach ($categorias as $cat) : ?>
                                            <option value="<?php echo esc_attr($cat['id']); ?>" <?php selected($act['categoria_id'], $cat['id']); ?> data-color="<?php echo esc_attr($cat['color']); ?>">
                                                <?php echo esc_html($cat['nombre_categoria']); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                            </td>
                            <td data-sort-value="<?php echo esc_attr($act['fecha_actividad'] ? $act['fecha_actividad'] : '0000-00-00'); ?>">
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
    <?php endif;
    $html = ob_get_clean();
    wp_send_json_success(['html' => $html]);
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
    $campos_permitidos = ['nombre_actividad', 'categoria_id', 'nota_maxima', 'descripcion_actividad'];
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
        wp_send_json_success(['message' => 'Actividad actualizada.']);
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
        wp_send_json_success(['message' => 'Actividad eliminada correctamente.']);
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
