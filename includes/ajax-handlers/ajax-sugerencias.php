<?php
// /includes/ajax-handlers/ajax-sugerencias.php

defined('ABSPATH') or die('Acceso no permitido');

add_action('wp_ajax_cpp_get_sugerencias', 'cpp_ajax_get_sugerencias');
function cpp_ajax_get_sugerencias() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');

    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Debes iniciar sesión.']);
    }

    $user_id = get_current_user_id();
    $tipo = isset($_POST['tipo']) ? sanitize_text_field($_POST['tipo']) : 'propuesta';
    $orden = isset($_POST['orden']) ? sanitize_text_field($_POST['orden']) : 'votos';

    $items = cpp_obtener_sugerencias($tipo, $orden, $user_id);

    wp_send_json_success([
        'items' => $items,
        'user_id' => $user_id
    ]);
}

add_action('wp_ajax_cpp_crear_sugerencia', 'cpp_ajax_crear_sugerencia');
function cpp_ajax_crear_sugerencia() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');

    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Debes iniciar sesión.']);
    }

    // 1. Honeypot check
    if (!empty($_POST['website_hp'])) {
        wp_send_json_error(['message' => 'Petición no válida (spam detectado).']);
    }

    $user_id = get_current_user_id();

    // 2. Cooldown check (30 seconds between suggestions)
    $cooldown_key = 'cpp_sug_cooldown_' . $user_id;
    if (get_transient($cooldown_key)) {
        wp_send_json_error(['message' => 'Por favor, espera unos segundos antes de publicar otra entrada.']);
    }

    // 3. Daily limit check (max 5 suggestions per day)
    $daily_key = 'cpp_sug_daily_' . $user_id . '_' . date('Ymd');
    $daily_count = (int) get_transient($daily_key);
    if ($daily_count >= 5) {
        wp_send_json_error(['message' => 'Has alcanzado el límite diario de publicaciones (máximo 5 al día).']);
    }

    $tipo = isset($_POST['tipo']) ? sanitize_text_field($_POST['tipo']) : 'propuesta';
    $titulo = isset($_POST['titulo']) ? sanitize_text_field($_POST['titulo']) : '';
    $descripcion = isset($_POST['descripcion']) ? sanitize_textarea_field($_POST['descripcion']) : '';

    if (empty($titulo) || empty($descripcion)) {
        wp_send_json_error(['message' => 'Por favor completa el título y la descripción.']);
    }

    // 4. Minimum length check
    if (mb_strlen(trim($titulo)) < 5) {
        wp_send_json_error(['message' => 'El título debe tener al menos 5 caracteres.']);
    }
    if (mb_strlen(trim($descripcion)) < 15) {
        wp_send_json_error(['message' => 'La descripción debe tener al menos 15 caracteres.']);
    }

    $sugerencia_id = cpp_crear_sugerencia($user_id, $tipo, $titulo, $descripcion);

    if ($sugerencia_id) {
        // Record cooldown & increment daily count
        set_transient($cooldown_key, true, 30);
        set_transient($daily_key, $daily_count + 1, DAY_IN_SECONDS);

        wp_send_json_success([
            'message' => 'Entrada creada correctamente.',
            'sugerencia_id' => $sugerencia_id
        ]);
    } else {
        wp_send_json_error(['message' => 'Error al guardar la entrada en la base de datos.']);
    }
}

add_action('wp_ajax_cpp_toggle_voto_sugerencia', 'cpp_ajax_toggle_voto_sugerencia');
function cpp_ajax_toggle_voto_sugerencia() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');

    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Debes iniciar sesión para votar.']);
    }

    $user_id = get_current_user_id();
    $sugerencia_id = isset($_POST['sugerencia_id']) ? intval($_POST['sugerencia_id']) : 0;

    if (!$sugerencia_id) {
        wp_send_json_error(['message' => 'Sugerencia no válida.']);
    }

    $result = cpp_toggle_voto_sugerencia($sugerencia_id, $user_id);

    wp_send_json_success($result);
}

add_action('wp_ajax_cpp_get_comentarios_sugerencia', 'cpp_ajax_get_comentarios_sugerencia');
function cpp_ajax_get_comentarios_sugerencia() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');

    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Debes iniciar sesión.']);
    }

    $user_id = get_current_user_id();
    $sugerencia_id = isset($_POST['sugerencia_id']) ? intval($_POST['sugerencia_id']) : 0;

    if (!$sugerencia_id) {
        wp_send_json_error(['message' => 'ID no válido.']);
    }

    $sugerencia = cpp_obtener_sugerencia_por_id($sugerencia_id, $user_id);
    $comentarios = cpp_obtener_comentarios_sugerencia($sugerencia_id);

    wp_send_json_success([
        'sugerencia' => $sugerencia,
        'comentarios' => $comentarios
    ]);
}

add_action('wp_ajax_cpp_agregar_comentario_sugerencia', 'cpp_ajax_agregar_comentario_sugerencia');
function cpp_ajax_agregar_comentario_sugerencia() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');

    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Debes iniciar sesión para comentar.']);
    }

    // 1. Honeypot check
    if (!empty($_POST['website_hp'])) {
        wp_send_json_error(['message' => 'Petición no válida (spam detectado).']);
    }

    $user_id = get_current_user_id();

    // 2. Cooldown check (15 seconds between comments)
    $cooldown_key = 'cpp_com_cooldown_' . $user_id;
    if (get_transient($cooldown_key)) {
        wp_send_json_error(['message' => 'Por favor, espera unos segundos antes de publicar otro comentario.']);
    }

    // 3. Daily limit check (max 15 comments per day)
    $daily_key = 'cpp_com_daily_' . $user_id . '_' . date('Ymd');
    $daily_count = (int) get_transient($daily_key);
    if ($daily_count >= 15) {
        wp_send_json_error(['message' => 'Has alcanzado el límite diario de comentarios (máximo 15 al día).']);
    }

    $sugerencia_id = isset($_POST['sugerencia_id']) ? intval($_POST['sugerencia_id']) : 0;
    $comentario = isset($_POST['comentario']) ? sanitize_textarea_field($_POST['comentario']) : '';

    if (!$sugerencia_id || empty($comentario)) {
        wp_send_json_error(['message' => 'Por favor escribe un comentario.']);
    }

    // 4. Minimum length check
    if (mb_strlen(trim($comentario)) < 5) {
        wp_send_json_error(['message' => 'El comentario debe tener al menos 5 caracteres.']);
    }

    $comentario_id = cpp_agregar_comentario_sugerencia($sugerencia_id, $user_id, $comentario);

    if ($comentario_id) {
        // Record cooldown & increment daily count
        set_transient($cooldown_key, true, 15);
        set_transient($daily_key, $daily_count + 1, DAY_IN_SECONDS);

        wp_send_json_success(['message' => 'Comentario añadido correctamente.']);
    } else {
        wp_send_json_error(['message' => 'Error al guardar el comentario.']);
    }
}
