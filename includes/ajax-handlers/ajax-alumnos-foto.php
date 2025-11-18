<?php
// includes/ajax-handlers/ajax-alumnos-foto.php

defined('ABSPATH') or die('Acceso no permitido');

add_action('wp_ajax_cpp_upload_alumno_foto', 'cpp_upload_alumno_foto_handler');

function cpp_upload_alumno_foto_handler() {
    check_ajax_referer('cpp_nonce', 'nonce');

    if (!isset($_POST['alumno_id']) || !isset($_FILES['foto'])) {
        wp_send_json_error(['message' => 'Faltan datos requeridos.']);
    }

    $alumno_id = intval($_POST['alumno_id']);
    $user_id = get_current_user_id();

    // Aquí deberíamos verificar que el alumno pertenece al usuario actual.
    // Esta función de verificación debería existir o crearse.
    // if (!cpp_es_propietario_alumno($user_id, $alumno_id)) {
    //     wp_send_json_error(['message' => 'No tienes permiso para modificar este alumno.']);
    // }

    if (!function_exists('wp_handle_upload')) {
        require_once(ABSPATH . 'wp-admin/includes/file.php');
    }

    $uploadedfile = $_FILES['foto'];
    $upload_overrides = ['test_form' => false];
    $movefile = wp_handle_upload($uploadedfile, $upload_overrides);

    if ($movefile && !isset($movefile['error'])) {
        $new_foto_url = $movefile['url'];

        // Actualizar la base de datos
        global $wpdb;
        $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
        $success = $wpdb->update(
            $tabla_alumnos,
            ['foto' => $new_foto_url],
            ['id' => $alumno_id, 'user_id' => $user_id],
            ['%s'],
            ['%d', '%d']
        );

        if ($success !== false) {
            wp_send_json_success(['message' => 'Foto actualizada correctamente.', 'new_foto_url' => $new_foto_url]);
        } else {
            wp_send_json_error(['message' => 'Hubo un error al guardar la nueva foto en la base de datos.']);
        }
    } else {
        wp_send_json_error(['message' => $movefile['error']]);
    }
}
