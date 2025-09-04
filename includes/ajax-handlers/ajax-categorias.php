<?php
// /includes/ajax-handlers/ajax-categorias.php (FINAL)

defined('ABSPATH') or die('Acceso no permitido');

add_action('wp_ajax_cpp_obtener_categorias_evaluacion', 'cpp_ajax_obtener_categorias_evaluacion');
function cpp_ajax_obtener_categorias_evaluacion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    
    global $wpdb;
    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;

    if (empty($evaluacion_id)) {
        wp_send_json_error(['message' => 'ID de evaluación no proporcionado.']);
        return;
    }

    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $metodo_calculo = $wpdb->get_var($wpdb->prepare("SELECT calculo_nota FROM $tabla_evaluaciones WHERE id = %d AND user_id = %d", $evaluacion_id, $user_id));

    if (null === $metodo_calculo) {
        wp_send_json_error(['message' => 'Evaluación no encontrada o sin permisos.']);
        return;
    }
    
    $categorias = cpp_obtener_categorias_por_evaluacion($evaluacion_id, $user_id);
    $total_porcentaje = 0;
    if (is_array($categorias)) {
        foreach ($categorias as $categoria) {
            $total_porcentaje += $categoria['porcentaje'];
        }
    }

    $pastel_colors = ['#FFB6C1', '#ADD8E6', '#98FB98', '#E6E6FA', '#FFDAB9', '#FFFFE0', '#AFEEEE', '#F08080', '#D8BFD8', '#EEE8AA', '#FFE4E1', '#B0E0E6'];
    $default_category_color = $pastel_colors[1];

    ob_start();
    ?>
    <div class="cpp-form-group">
        <label>Método de Cálculo de la Nota Final</label>
        <div class="cpp-radio-group">
            <label>
                <input type="radio" name="metodo_calculo_evaluacion" value="total" <?php checked($metodo_calculo, 'total'); ?>>
                Puntuación total (media simple de todas las actividades)
            </label>
            <label>
                <input type="radio" name="metodo_calculo_evaluacion" value="ponderada" <?php checked($metodo_calculo, 'ponderada'); ?>>
                Ponderada por categorías
            </label>
        </div>
    </div>

    <div id="cpp-gestion-categorias-wrapper" style="<?php echo $metodo_calculo === 'total' ? 'display:none;' : ''; ?>">
        <hr style="margin: 20px 0;">
        <div class="cpp-categorias-list">
            <h4>Categorías (Total: <span id="cpp-total-porcentaje-display"><?php echo esc_html($total_porcentaje); ?></span>%)</h4>
            <?php if (empty($categorias)): ?>
                <p>No hay categorías de ponderación definidas para esta evaluación.</p>
            <?php else: ?>
                <ul>
                    <?php foreach ($categorias as $categoria): ?>
                        <li data-categoria-id="<?php echo esc_attr($categoria['id']); ?>">
                            <span class="cpp-category-color-indicator" style="background-color: <?php echo esc_attr($categoria['color']); ?>;" title="Color: <?php echo esc_attr($categoria['color']); ?>"></span>
                            <span class="cpp-categoria-nombre-listado"><?php echo esc_html($categoria['nombre_categoria']); ?></span>:
                            <strong class="cpp-categoria-porcentaje-listado"><?php echo esc_html($categoria['porcentaje']); ?>%</strong>
                            <div class="cpp-categoria-actions">
                                <button type="button" class="cpp-btn cpp-btn-icon cpp-btn-editar-categoria" data-categoria-id="<?php echo esc_attr($categoria['id']); ?>" title="Editar categoría"><span class="dashicons dashicons-edit"></span></button>
                                <button type="button" class="cpp-btn cpp-btn-icon cpp-btn-eliminar-categoria" data-categoria-id="<?php echo esc_attr($categoria['id']); ?>" title="Eliminar categoría"><span class="dashicons dashicons-trash"></span></button>
                            </div>
                        </li>
                    <?php endforeach; ?>
                </ul>
            <?php endif; ?>
        </div>
        <div class="cpp-form-categoria-container">
            <h4 id="cpp-form-categoria-titulo">Añadir Categoría</h4>
            <input type="hidden" id="categoria_id_editar_modal" value="">
            <div class="cpp-form-group">
                <label for="nombre_nueva_categoria_modal">Nombre:</label>
                <input type="text" id="nombre_nueva_categoria_modal" name="nombre_nueva_categoria" required>
            </div>
            <div class="cpp-form-group">
                <label for="porcentaje_nueva_categoria_modal">Porcentaje (%):</label>
                <input type="number" id="porcentaje_nueva_categoria_modal" name="porcentaje_nueva_categoria" min="0" max="100" step="1" required>
            </div>
            <div class="cpp-form-group">
                <label>Color de la Categoría:</label>
                <div class="cpp-color-swatches-container cpp-category-color-swatches">
                    <?php foreach ($pastel_colors as $hex):
                        $is_selected_cat_color = (strtoupper($hex) === strtoupper($default_category_color));?>
                        <span class="cpp-color-swatch <?php echo $is_selected_cat_color ? 'selected' : ''; ?>" data-color="<?php echo esc_attr($hex); ?>" style="background-color: <?php echo esc_attr($hex); ?>;" title="<?php echo esc_attr($hex); ?>"></span>
                    <?php endforeach; ?>
                </div>
                <input type="hidden" id="color_nueva_categoria_hidden_modal" name="color_nueva_categoria" value="<?php echo esc_attr($default_category_color); ?>">
            </div>
            <div class="cpp-categoria-form-actions">
                <button type="button" class="cpp-btn cpp-btn-primary" id="cpp-submit-categoria-btn"><span class="dashicons dashicons-plus-alt"></span> Añadir</button>
                <button type="button" class="cpp-btn cpp-btn-secondary" id="cpp-cancelar-edicion-categoria-btn" style="display:none;">Cancelar Edición</button>
            </div>
            <p id="cpp-mensaje-error-categorias" class="cpp-error-message" style="display:none;"></p>
        </div>
    </div>
    <?php
    $html = ob_get_clean();
    wp_send_json_success(['html' => $html, 'metodo_calculo' => $metodo_calculo]);
}


add_action('wp_ajax_cpp_guardar_o_actualizar_categoria', 'cpp_ajax_guardar_o_actualizar_categoria');
function cpp_ajax_guardar_o_actualizar_categoria() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $categoria_id_editar = isset($_POST['categoria_id_editar']) ? intval($_POST['categoria_id_editar']) : 0;
    $nombre_categoria = isset($_POST['nombre_nueva_categoria']) ? sanitize_text_field(trim($_POST['nombre_nueva_categoria'])) : '';
    $porcentaje_nuevo = isset($_POST['porcentaje_nueva_categoria']) ? intval($_POST['porcentaje_nueva_categoria']) : -1;
    $color_categoria = isset($_POST['color_nueva_categoria']) ? sanitize_hex_color($_POST['color_nueva_categoria']) : '#FFFFFF';

    if (empty($evaluacion_id)) { wp_send_json_error(['message' => 'El ID de la evaluación no es válido.']); return; }
    if (empty($nombre_categoria)) { wp_send_json_error(['message' => 'El nombre de la categoría es obligatorio.']); return; }
    if ($porcentaje_nuevo < 0 || $porcentaje_nuevo > 100) { wp_send_json_error(['message' => 'El porcentaje debe estar entre 0 y 100.']); return; }

    global $wpdb;
    $owner_check = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d", $evaluacion_id));
    if ($owner_check != $user_id) { wp_send_json_error(['message' => 'No tienes permiso para modificar esta evaluación.']); return; }
    
    $categorias_existentes = cpp_obtener_categorias_por_evaluacion($evaluacion_id, $user_id);
    $total_porcentaje_otras_categorias = 0;
    if (is_array($categorias_existentes)) {
        foreach ($categorias_existentes as $cat_existente) {
            if ($cat_existente['id'] != $categoria_id_editar) { $total_porcentaje_otras_categorias += intval($cat_existente['porcentaje']); }
        }
    }
    if (($total_porcentaje_otras_categorias + $porcentaje_nuevo) > 100) { wp_send_json_error(['message' => 'La suma de porcentajes no puede exceder 100%.']); return; }

    if ($categoria_id_editar > 0) {
        $datos_para_actualizar = ['nombre_categoria' => $nombre_categoria, 'porcentaje' => $porcentaje_nuevo, 'color' => $color_categoria];
        $resultado = cpp_actualizar_categoria_evaluacion($categoria_id_editar, $user_id, $datos_para_actualizar);
        if ($resultado !== false) { wp_send_json_success(['message' => 'Categoría actualizada.']); } 
        else { wp_send_json_error(['message' => 'Error al actualizar la categoría.']); }
    } else {
        $resultado = cpp_guardar_categoria_evaluacion($evaluacion_id, $user_id, $nombre_categoria, $porcentaje_nuevo, $color_categoria);
        if ($resultado) { wp_send_json_success(['message' => 'Categoría guardada.']); } 
        else { wp_send_json_error(['message' => 'Error al guardar la categoría. Puede que ya exista una con el mismo nombre en esta evaluación.']); }
    }
}


add_action('wp_ajax_cpp_obtener_datos_categoria', 'cpp_ajax_obtener_datos_categoria');
function cpp_ajax_obtener_datos_categoria() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $categoria_id = isset($_POST['categoria_id']) ? intval($_POST['categoria_id']) : 0;
    if (empty($categoria_id)) { wp_send_json_error(['message' => 'ID de categoría no proporcionado.']); return; }
    $categoria_data = cpp_obtener_categoria_por_id($categoria_id, $user_id);
    if ($categoria_data) { wp_send_json_success(['categoria' => $categoria_data]); } 
    else { wp_send_json_error(['message' => 'Categoría no encontrada o no tienes permiso.']); }
}


add_action('wp_ajax_cpp_eliminar_categoria_evaluacion', 'cpp_ajax_eliminar_categoria_evaluacion');
function cpp_ajax_eliminar_categoria_evaluacion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    
    $categoria_id = isset($_POST['categoria_id']) ? intval($_POST['categoria_id']) : 0;
    $user_id = get_current_user_id();

    if (empty($categoria_id)) {
        wp_send_json_error(['message' => 'ID de categoría no proporcionado.']);
        return;
    }

    global $wpdb;
    $nombre_categoria = $wpdb->get_var($wpdb->prepare(
        "SELECT nombre_categoria FROM {$wpdb->prefix}cpp_categorias_evaluacion WHERE id = %d", 
        $categoria_id
    ));

    if ($nombre_categoria === 'Sin categoría') {
        wp_send_json_error(['message' => 'La categoría por defecto "Sin categoría" no se puede eliminar.']);
        return;
    }
    
    $resultado = cpp_eliminar_categoria_evaluacion($categoria_id, $user_id);
    
    if ($resultado) { 
        wp_send_json_success(['message' => 'Categoría eliminada. Las actividades asociadas se han movido a "Sin categoría".']); 
    } else { 
        wp_send_json_error(['message' => 'Error al eliminar la categoría o no tienes permiso.']); 
    }
}


add_action('wp_ajax_cpp_get_json_categorias_por_evaluacion', 'cpp_ajax_get_json_categorias_por_evaluacion');
function cpp_ajax_get_json_categorias_por_evaluacion() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    if (empty($evaluacion_id)) { wp_send_json_error(['message' => 'ID de evaluación no proporcionado.']); return; }
    $categorias = cpp_obtener_categorias_por_evaluacion($evaluacion_id, $user_id);
    wp_send_json_success(['categorias' => $categorias]);
}