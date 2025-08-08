<?php
// /includes/db.php

defined('ABSPATH') or die('Acceso no permitido');

function cpp_crear_tablas() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');

    // ====================================================================
    // --- INICIO DE LA MODIFICACIÓN ---
    // Añadimos la columna `calculo_nota` a la tabla de evaluaciones.
    // ====================================================================
    $tabla_evaluaciones_nombre = $wpdb->prefix . 'cpp_evaluaciones';
    $sql_evaluaciones = "CREATE TABLE $tabla_evaluaciones_nombre (
        id mediumint(9) UNSIGNED NOT NULL AUTO_INCREMENT,
        clase_id mediumint(9) UNSIGNED NOT NULL,
        user_id bigint(20) UNSIGNED NOT NULL,
        nombre_evaluacion varchar(100) NOT NULL,
        calculo_nota varchar(20) NOT NULL DEFAULT 'total',
        orden int NOT NULL DEFAULT 0,
        fecha_creacion datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (id),
        KEY clase_id (clase_id),
        KEY user_id (user_id),
        KEY orden (orden)
    ) $charset_collate;";
    dbDelta($sql_evaluaciones);
    // ====================================================================
    // --- FIN DE LA MODIFICACIÓN ---
    // ====================================================================

    $tabla_categorias_evaluacion_nombre = $wpdb->prefix . 'cpp_categorias_evaluacion';
    $sql_categorias_evaluacion = "CREATE TABLE $tabla_categorias_evaluacion_nombre (
        id mediumint(9) UNSIGNED NOT NULL AUTO_INCREMENT,
        evaluacion_id mediumint(9) UNSIGNED NOT NULL,
        nombre_categoria varchar(100) NOT NULL,
        porcentaje tinyint(3) unsigned NOT NULL,
        color varchar(7) DEFAULT '#FFFFFF' NOT NULL,
        fecha_creacion datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY evaluacion_id (evaluacion_id),
        UNIQUE KEY evaluacion_nombre (evaluacion_id, nombre_categoria)
    ) $charset_collate;";
    dbDelta($sql_categorias_evaluacion);

    $tabla_clases_nombre = $wpdb->prefix . 'cpp_clases';
    $sql_clases = "CREATE TABLE $tabla_clases_nombre (
        id mediumint(9) UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id bigint(20) UNSIGNED NOT NULL,
        nombre varchar(100) NOT NULL,
        color varchar(7) DEFAULT '#FFFFFF' NOT NULL, 
        base_nota_final decimal(5,2) DEFAULT 100.00 NOT NULL,
        nota_minima decimal(5,2) DEFAULT 5.00 NOT NULL,
        orden INT NOT NULL DEFAULT 0,
        fecha_creacion datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY user_id (user_id),
        KEY orden (orden)
    ) $charset_collate;";
    
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $sql_alumnos = "CREATE TABLE $tabla_alumnos (
        id mediumint(9) UNSIGNED NOT NULL AUTO_INCREMENT,
        clase_id mediumint(9) UNSIGNED NOT NULL,
        nombre varchar(50) NOT NULL,
        apellidos varchar(100) NOT NULL,
        foto varchar(255),
        fecha_creacion datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY clase_id (clase_id)
    ) $charset_collate;";

    $tabla_actividades_evaluables_nombre = $wpdb->prefix . 'cpp_actividades_evaluables';
    $sql_actividades_evaluables = "CREATE TABLE $tabla_actividades_evaluables_nombre (
        id mediumint(9) UNSIGNED NOT NULL AUTO_INCREMENT,
        clase_id mediumint(9) UNSIGNED NOT NULL,
        evaluacion_id mediumint(9) UNSIGNED DEFAULT NULL,
        categoria_id mediumint(9) UNSIGNED NOT NULL, 
        nombre_actividad varchar(150) NOT NULL,
        fecha_actividad date DEFAULT NULL,
        descripcion_actividad text,
        nota_maxima decimal(5,2) DEFAULT 10.00 NOT NULL, 
        user_id bigint(20) UNSIGNED NOT NULL,
        fecha_creacion datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY clase_id (clase_id),
        KEY evaluacion_id (evaluacion_id),
        KEY categoria_id (categoria_id),
        KEY user_id (user_id)
    ) $charset_collate;";

    $tabla_calificaciones_alumnos = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $sql_calificaciones_alumnos = "CREATE TABLE $tabla_calificaciones_alumnos (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        actividad_id mediumint(9) UNSIGNED NOT NULL,
        alumno_id mediumint(9) UNSIGNED NOT NULL,
        nota decimal(5,2) DEFAULT NULL, 
        observaciones text,
        fecha_calificacion datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY actividad_alumno (actividad_id, alumno_id), 
        KEY actividad_id (actividad_id),
        KEY alumno_id (alumno_id)
    ) $charset_collate;";

    $tabla_asistencia_nombre = $wpdb->prefix . 'cpp_asistencia';
    $sql_asistencia = "CREATE TABLE $tabla_asistencia_nombre (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        clase_id mediumint(9) UNSIGNED NOT NULL,
        alumno_id mediumint(9) UNSIGNED NOT NULL,
        user_id bigint(20) UNSIGNED NOT NULL,
        fecha_asistencia date NOT NULL,
        estado varchar(25) NOT NULL,
        observaciones text DEFAULT NULL,
        fecha_registro datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY asistencia_unique (clase_id, alumno_id, user_id, fecha_asistencia),
        KEY clase_id (clase_id),
        KEY alumno_id (alumno_id),
        KEY user_id (user_id),
        KEY fecha_asistencia (fecha_asistencia)
    ) $charset_collate;";
    
    dbDelta($sql_clases);
    dbDelta($sql_alumnos);
    dbDelta($sql_actividades_evaluables); 
    dbDelta($sql_calificaciones_alumnos); 
    dbDelta($sql_asistencia);
}

// --- CARGADOR DE ARCHIVOS DE CONSULTAS A LA BBDD ---
$db_queries_dir = CPP_PLUGIN_DIR . 'includes/db-queries/';

require_once $db_queries_dir . 'queries-evaluaciones.php';
require_once $db_queries_dir . 'queries-asistencia.php';
require_once $db_queries_dir . 'queries-clases.php';
require_once $db_queries_dir . 'queries-alumnos.php';
require_once $db_queries_dir . 'queries-categorias.php';
require_once $db_queries_dir . 'queries-actividades-calificaciones.php';
require_once $db_queries_dir . 'queries-calculos.php';