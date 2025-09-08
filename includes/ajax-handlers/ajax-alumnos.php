<?php
// /includes/ajax-handlers/ajax-alumnos.php

defined('ABSPATH') or die('Acceso no permitido');

// --- ACCIONES AJAX PARA ALUMNOS ---

add_action('wp_ajax_cpp_obtener_datos_alumno', 'cpp_ajax_obtener_datos_alumno');
function cpp_ajax_obtener_datos_alumno() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $alumno_id = isset($_POST['alumno_id']) ? intval($_POST['alumno_id']) : 0;
    if (empty($alumno_id)) { wp_send_json_error(['message' => 'ID de alumno no proporcionado.']); return; }
    $alumno = cpp_obtener_alumno_por_id($alumno_id);
    if ($alumno) {
        wp_send_json_success(['alumno' => $alumno]);
    } else {
        wp_send_json_error(['message' => 'Alumno no encontrado.']);
    }
}

add_action('wp_ajax_cpp_obtener_alumnos', 'cpp_ajax_obtener_alumnos');
function cpp_ajax_obtener_alumnos() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado']); return; }
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    if (!$clase_id) { wp_send_json_error(['message' => 'ID de clase no proporcionado o inválido.']); return; }
    $alumnos = cpp_obtener_alumnos_clase($clase_id);
    ob_start();
    ?>
    <div class="cpp-alumnos-header">
        <h3>Lista de Alumnos</h3>
        <button class="cpp-btn cpp-btn-primary" id="cpp-nuevo-alumno-btn">
            <span class="dashicons dashicons-plus"></span> Nuevo Alumno
        </button>
    </div>
    <div class="cpp-alumnos-list">
        <?php if (empty($alumnos)): ?>
            <p class="cpp-no-alumnos">No hay alumnos en esta clase.</p>
        <?php else: ?>
            <?php foreach ($alumnos as $alumno): ?>
                <div class="cpp-alumno-card" data-alumno-id="<?php echo esc_attr($alumno['id']); ?>">
                    <div class="cpp-alumno-avatar"><img src="<?php echo cpp_get_avatar_url($alumno); ?>" alt="Avatar de <?php echo esc_attr($alumno['nombre']); ?>"></div>
                    <div class="cpp-alumno-info"><h4><?php echo esc_html($alumno['nombre'] . ' ' . $alumno['apellidos']); ?></h4></div>
                    <div class="cpp-alumno-actions">
                        <button class="cpp-btn cpp-btn-editar" data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" title="Editar Alumno"><span class="dashicons dashicons-edit"></span></button>
                        <button class="cpp-btn cpp-btn-eliminar-alumno" data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" title="Eliminar Alumno"><span class="dashicons dashicons-trash"></span></button>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
    <div class="cpp-form-alumno-container" id="cpp-form-alumno" style="display:none;">
        <h3 id="cpp-form-alumno-titulo">Añadir Nuevo Alumno</h3>
        <form id="cpp-form-nuevo-alumno" enctype="multipart/form-data">
            <input type="hidden" name="clase_id_form_alumno" value="<?php echo esc_attr($clase_id); ?>">
            <input type="hidden" id="alumno_id_editar" name="alumno_id_editar" value="">
            <div class="cpp-form-group"><label for="nombre_alumno_form_<?php echo esc_attr($clase_id); ?>">Nombre:</label><input type="text" id="nombre_alumno_form_<?php echo esc_attr($clase_id); ?>" name="nombre_alumno" required></div>
            <div class="cpp-form-group"><label for="apellidos_alumno_form_<?php echo esc_attr($clase_id); ?>">Apellidos:</label><input type="text" id="apellidos_alumno_form_<?php echo esc_attr($clase_id); ?>" name="apellidos_alumno" required></div>
            <div class="cpp-form-group"><label for="foto_alumno_form_<?php echo esc_attr($clase_id); ?>">Foto (opcional):</label><input type="file" id="foto_alumno_form_<?php echo esc_attr($clase_id); ?>" name="foto_alumno" accept="image/*"><small>Si editas y no seleccionas una nueva foto, se mantendrá la actual.</small><div id="cpp-foto-actual-preview" style="margin-top:10px;"></div></div>
            <button type="submit" class="cpp-btn cpp-btn-primary" id="cpp-submit-alumno-btn"><span class="dashicons dashicons-saved"></span> Guardar Alumno</button>
        </form>
    </div>
    <?php
    $html = ob_get_clean();
    wp_send_json_success(['html' => $html]);
}

add_action('wp_ajax_cpp_guardar_alumno', 'cpp_ajax_guardar_alumno');
function cpp_ajax_guardar_alumno() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado']); return; }
    $clase_id = isset($_POST['clase_id_form_alumno']) ? intval($_POST['clase_id_form_alumno']) : 0;
    $nombre = isset($_POST['nombre_alumno']) ? sanitize_text_field($_POST['nombre_alumno']) : '';
    $apellidos = isset($_POST['apellidos_alumno']) ? sanitize_text_field($_POST['apellidos_alumno']) : '';
    $alumno_id_editar = isset($_POST['alumno_id_editar']) ? intval($_POST['alumno_id_editar']) : 0;
    if (empty($clase_id) && !$alumno_id_editar) { wp_send_json_error(['message' => 'ID de clase no proporcionado.']); return; }
    if (empty($nombre) || empty($apellidos)) { wp_send_json_error(['message' => 'Nombre y apellidos son obligatorios.']); return; }
    $datos_alumno = ['nombre' => $nombre, 'apellidos' => $apellidos];
    if (isset($_FILES['foto_alumno']) && $_FILES['foto_alumno']['error'] == UPLOAD_ERR_OK) {
        if (!function_exists('wp_handle_upload')) { require_once(ABSPATH . 'wp-admin/includes/file.php'); }
        $uploadedfile = $_FILES['foto_alumno'];
        $upload_overrides = ['test_form' => false, 'mimes' => ['jpg|jpeg|jpe'=>'image/jpeg', 'gif'=>'image/gif', 'png'=>'image/png']];
        $movefile = wp_handle_upload($uploadedfile, $upload_overrides);
        if ($movefile && !isset($movefile['error'])) { $datos_alumno['foto'] = $movefile['url']; }
        else { wp_send_json_error(['message' => 'Error al subir la nueva foto: ' . (isset($movefile['error']) ? esc_html($movefile['error']) : 'Error desconocido')]); return; }
    }
    global $wpdb; $mensaje_exito = '';
    if ($alumno_id_editar > 0) { $resultado = cpp_actualizar_alumno($alumno_id_editar, $datos_alumno); $mensaje_exito = 'Alumno actualizado.'; }
    else { $resultado = cpp_guardar_alumno($clase_id, $datos_alumno); $mensaje_exito = 'Alumno guardado.'; }
    if (false === $resultado) { wp_send_json_error(['message' => 'Error al procesar datos del alumno.', 'db_error' => $wpdb->last_error]); }
    elseif (0 === $resultado && $alumno_id_editar > 0) { $mensaje_exito = 'No se realizaron cambios.'; }
    wp_send_json_success(['message' => $mensaje_exito]);
}

add_action('wp_ajax_cpp_eliminar_alumno', 'cpp_ajax_eliminar_alumno');
function cpp_ajax_eliminar_alumno() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $alumno_id = isset($_POST['alumno_id']) ? intval($_POST['alumno_id']) : 0;
    $clase_id_actual = isset($_POST['clase_id_actual']) ? intval($_POST['clase_id_actual']) : 0;
    $user_id = get_current_user_id();
    if (empty($alumno_id) || empty($clase_id_actual)) { wp_send_json_error(['message' => 'IDs no proporcionados.']); return; }
    $resultado = cpp_eliminar_alumno($alumno_id, $user_id);
    if (false === $resultado) { wp_send_json_error(['message' => 'Error al eliminar alumno o no tienes permiso.']); }
    elseif (0 === $resultado) { wp_send_json_error(['message' => 'Alumno no encontrado o ya eliminado.']); }
    else { wp_send_json_success(['message' => 'Alumno eliminado.']); }
}