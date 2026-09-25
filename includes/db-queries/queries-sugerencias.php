<?php
// /includes/db-queries/queries-sugerencias.php

defined('ABSPATH') or die('Acceso no permitido');

/**
 * Obtener lista de sugerencias/preguntas con sus conteos de votos, comentarios y si el usuario actual ha votado.
 */
function cpp_obtener_sugerencias($tipo = 'propuesta', $orden = 'votos', $user_id = 0) {
    global $wpdb;
    $tabla_sug = $wpdb->prefix . 'cpp_sugerencias';
    $tabla_votos = $wpdb->prefix . 'cpp_sugerencia_votos';
    $tabla_com = $wpdb->prefix . 'cpp_sugerencia_comentarios';

    $tipo_clean = ($tipo === 'duda') ? 'duda' : 'propuesta';

    $order_clause = "num_votos DESC, s.fecha_creacion DESC";
    if ($orden === 'recientes') {
        $order_clause = "s.fecha_creacion DESC";
    }

    $sql = $wpdb->prepare("
        SELECT s.*,
               u.display_name as autor_nombre,
               COUNT(DISTINCT v.id) as num_votos,
               COUNT(DISTINCT c.id) as num_comentarios,
               MAX(CASE WHEN v.user_id = %d THEN 1 ELSE 0 END) as votado_por_usuario
        FROM {$tabla_sug} s
        LEFT JOIN {$wpdb->users} u ON s.user_id = u.ID
        LEFT JOIN {$tabla_votos} v ON s.id = v.sugerencia_id
        LEFT JOIN {$tabla_com} c ON s.id = c.sugerencia_id
        WHERE s.tipo = %s
        GROUP BY s.id
        ORDER BY {$order_clause}
    ", $user_id, $tipo_clean);

    return $wpdb->get_results($sql);
}

/**
 * Obtener una sugerencia individual por ID.
 */
function cpp_obtener_sugerencia_por_id($sugerencia_id, $user_id = 0) {
    global $wpdb;
    $tabla_sug = $wpdb->prefix . 'cpp_sugerencias';
    $tabla_votos = $wpdb->prefix . 'cpp_sugerencia_votos';
    $tabla_com = $wpdb->prefix . 'cpp_sugerencia_comentarios';

    $sql = $wpdb->prepare("
        SELECT s.*,
               u.display_name as autor_nombre,
               COUNT(DISTINCT v.id) as num_votos,
               COUNT(DISTINCT c.id) as num_comentarios,
               MAX(CASE WHEN v.user_id = %d THEN 1 ELSE 0 END) as votado_por_usuario
        FROM {$tabla_sug} s
        LEFT JOIN {$wpdb->users} u ON s.user_id = u.ID
        LEFT JOIN {$tabla_votos} v ON s.id = v.sugerencia_id
        LEFT JOIN {$tabla_com} c ON s.id = c.sugerencia_id
        WHERE s.id = %d
        GROUP BY s.id
    ", $user_id, $sugerencia_id);

    return $wpdb->get_row($sql);
}

/**
 * Crear nueva sugerencia o pregunta.
 */
function cpp_crear_sugerencia($user_id, $tipo, $titulo, $descripcion) {
    global $wpdb;
    $tabla_sug = $wpdb->prefix . 'cpp_sugerencias';

    $tipo_clean = ($tipo === 'duda') ? 'duda' : 'propuesta';

    $inserted = $wpdb->insert(
        $tabla_sug,
        [
            'user_id' => $user_id,
            'tipo' => $tipo_clean,
            'titulo' => $titulo,
            'descripcion' => $descripcion,
            'estado' => 'estudio'
        ],
        ['%d', '%s', '%s', '%s', '%s']
    );

    if ($inserted) {
        $sugerencia_id = $wpdb->insert_id;

        // Notificación por correo inmediatamente al email de administración
        $admin_email = get_option('admin_email');
        if ($admin_email) {
            $user_info = get_userdata($user_id);
            $nombre_usuario = $user_info ? $user_info->display_name : 'Usuario #' . $user_id;
            $email_usuario = $user_info ? $user_info->user_email : '';

            $tipo_label = ($tipo_clean === 'duda') ? 'Pregunta / Comentario' : 'Solicitud de Funcionalidad';
            $subject = sprintf('[Cuaderno Profe] Nueva %s: %s', $tipo_label, $titulo);

            $message = sprintf(
                "Se ha publicado una nueva entrada en la sección de Sugerencias:\n\n" .
                "Tipo: %s\n" .
                "Autor: %s (%s)\n" .
                "Título: %s\n\n" .
                "Descripción:\n%s\n\n" .
                "--\nCuaderno de Profe",
                $tipo_label,
                $nombre_usuario,
                $email_usuario,
                $titulo,
                $descripcion
            );

            wp_mail($admin_email, $subject, $message);
        }

        return $sugerencia_id;
    }

    return false;
}

/**
 * Alternar voto (votar / desvotar).
 */
function cpp_toggle_voto_sugerencia($sugerencia_id, $user_id) {
    global $wpdb;
    $tabla_votos = $wpdb->prefix . 'cpp_sugerencia_votos';

    $existe = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM {$tabla_votos} WHERE sugerencia_id = %d AND user_id = %d",
        $sugerencia_id, $user_id
    ));

    if ($existe) {
        $wpdb->delete($tabla_votos, ['id' => $existe], ['%d']);
        $votado = false;
    } else {
        $wpdb->insert($tabla_votos, ['sugerencia_id' => $sugerencia_id, 'user_id' => $user_id], ['%d', '%d']);
        $votado = true;
    }

    $num_votos = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$tabla_votos} WHERE sugerencia_id = %d",
        $sugerencia_id
    ));

    return [
        'votado' => $votado,
        'num_votos' => intval($num_votos)
    ];
}

/**
 * Obtener comentarios de una sugerencia.
 */
function cpp_obtener_comentarios_sugerencia($sugerencia_id) {
    global $wpdb;
    $tabla_com = $wpdb->prefix . 'cpp_sugerencia_comentarios';

    $sql = $wpdb->prepare("
        SELECT c.*, u.display_name as autor_nombre, u.user_email
        FROM {$tabla_com} c
        LEFT JOIN {$wpdb->users} u ON c.user_id = u.ID
        WHERE c.sugerencia_id = %d
        ORDER BY c.fecha_comentario ASC
    ", $sugerencia_id);

    $comentarios = $wpdb->get_results($sql);

    foreach ($comentarios as $com) {
        $com->es_admin = user_can($com->user_id, 'manage_options');
    }

    return $comentarios;
}

/**
 * Agregar un comentario a una sugerencia.
 */
function cpp_agregar_comentario_sugerencia($sugerencia_id, $user_id, $comentario) {
    global $wpdb;
    $tabla_com = $wpdb->prefix . 'cpp_sugerencia_comentarios';

    $inserted = $wpdb->insert(
        $tabla_com,
        [
            'sugerencia_id' => $sugerencia_id,
            'user_id' => $user_id,
            'comentario' => $comentario
        ],
        ['%d', '%d', '%s']
    );

    if ($inserted) {
        // Notificación inmediata al admin
        $admin_email = get_option('admin_email');
        if ($admin_email) {
            $sugerencia = cpp_obtener_sugerencia_por_id($sugerencia_id, $user_id);
            $user_info = get_userdata($user_id);
            $nombre_usuario = $user_info ? $user_info->display_name : 'Usuario #' . $user_id;

            $subject = sprintf('[Cuaderno Profe] Nuevo comentario en: %s', $sugerencia ? $sugerencia->titulo : 'Propuesta');
            $message = sprintf(
                "Se ha agregado un nuevo comentario:\n\n" .
                "En la propuesta/pregunta: %s\n" .
                "Autor del comentario: %s\n\n" .
                "Comentario:\n%s\n\n" .
                "--\nCuaderno de Profe",
                $sugerencia ? $sugerencia->titulo : 'Propuesta #' . $sugerencia_id,
                $nombre_usuario,
                $comentario
            );

            wp_mail($admin_email, $subject, $message);
        }

        return $wpdb->insert_id;
    }

    return false;
}

/**
 * Cambiar estado de una sugerencia (Admin).
 */
function cpp_actualizar_estado_sugerencia($sugerencia_id, $estado) {
    global $wpdb;
    $tabla_sug = $wpdb->prefix . 'cpp_sugerencias';

    $estados_validos = ['estudio', 'planeada', 'desarrollo', 'implementada'];
    if (!in_array($estado, $estados_validos)) {
        return false;
    }

    return $wpdb->update(
        $tabla_sug,
        ['estado' => $estado],
        ['id' => $sugerencia_id],
        ['%s'],
        ['%d']
    );
}
