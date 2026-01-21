<?php

/*
Plugin Name: Cuaderno de profe
Description: Gestión de clases y alumnos completamente desde el frontend.
Version: 1.9
Author: Javier Vegas Serrano
*/

defined('ABSPATH') or die('Acceso no permitido');

// --- VERSIÓN ACTUALIZADA PARA LA NUEVA MIGRACIÓN ---
define('CPP_VERSION', '2.4.1');

// Constantes
define('CPP_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('CPP_PLUGIN_URL', plugin_dir_url(__FILE__));

// Incluir archivos
require_once CPP_PLUGIN_DIR . 'includes/utils.php';
require_once CPP_PLUGIN_DIR . 'includes/db.php';
require_once CPP_PLUGIN_DIR . 'includes/shortcodes.php';
require_once CPP_PLUGIN_DIR . 'includes/ajax.php';
require_once CPP_PLUGIN_DIR . 'includes/excel-export.php'; 
require_once CPP_PLUGIN_DIR . 'includes/excel-import.php';

// Incluir archivos del programador
require_once CPP_PLUGIN_DIR . 'includes/programador/db-programador.php';
require_once CPP_PLUGIN_DIR . 'includes/programador/shortcode-programador.php';
require_once CPP_PLUGIN_DIR . 'includes/programador/ajax-programador.php';

// Crear tablas al activar
register_activation_hook(__FILE__, 'cpp_crear_tablas');

// Cargar assets
add_action('wp_enqueue_scripts', 'cpp_cargar_assets');
function cpp_cargar_assets() {
    global $post;
    // Solo cargar los assets si el shortcode [cuaderno] está presente
    if (!is_a($post, 'WP_Post') || !has_shortcode($post->post_content, 'cuaderno')) {
        return;
    }

    $plugin_version = defined('WP_DEBUG') && WP_DEBUG ? time() : CPP_VERSION;

    // Estilos
    wp_enqueue_style('dashicons');
    wp_enqueue_style('cpp-frontend-css', CPP_PLUGIN_URL . 'assets/css/frontend.css', [], $plugin_version);
    wp_enqueue_style('cpp-programador-css', CPP_PLUGIN_URL . 'assets/css/cpp-programador.css', [], $plugin_version);
    wp_enqueue_style('cpp-alumnos-css', CPP_PLUGIN_URL . 'assets/css/cpp-alumnos.css', [], $plugin_version);
    wp_register_style('cpp-resumen-css', CPP_PLUGIN_URL . 'assets/css/cpp-resumen.css', [], $plugin_version);

    // Scripts de librerías
    wp_enqueue_script('jquery-ui-sortable');
    wp_enqueue_script('jquery-ui-droppable');
    wp_enqueue_script('jquery-ui-draggable');
    wp_enqueue_script('chart-js', 'https://cdn.jsdelivr.net/npm/chart.js', [], '4.4.0', true);

    // Scripts del plugin
    wp_enqueue_script('cpp-core-js', CPP_PLUGIN_URL . 'assets/js/cpp-core.js', ['jquery', 'jquery-ui-sortable'], $plugin_version, true);
    wp_enqueue_script('cpp-utils-js', CPP_PLUGIN_URL . 'assets/js/cpp-utils.js', ['cpp-core-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-clase-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-clase.js', ['cpp-core-js'], $plugin_version, true);
    wp_enqueue_script('cpp-sidebar-js', CPP_PLUGIN_URL . 'assets/js/cpp-sidebar.js', ['cpp-core-js', 'cpp-modales-clase-js'], $plugin_version, true);

    wp_enqueue_script('cpp-programador-js', CPP_PLUGIN_URL . 'assets/js/cpp-programador.js', ['cpp-core-js', 'jquery-ui-droppable', 'jquery-ui-draggable'], $plugin_version, true);
    wp_enqueue_script('cpp-cuaderno-js', CPP_PLUGIN_URL . 'assets/js/cpp-cuaderno.js', ['cpp-core-js', 'cpp-programador-js'], $plugin_version, true);

    wp_enqueue_script('cpp-modales-general-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-general.js', ['cpp-core-js'], $plugin_version, true);
    wp_enqueue_script('cpp-configuracion-js', CPP_PLUGIN_URL . 'assets/js/cpp-configuracion.js', ['cpp-core-js'], $plugin_version, true);
    wp_register_script('cpp-resumen-js', CPP_PLUGIN_URL . 'assets/js/cpp-resumen.js', ['cpp-core-js', 'chart-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-actividad-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-actividad.js', ['cpp-core-js', 'cpp-modales-general-js', 'cpp-cuaderno-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-excel-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-excel.js', ['cpp-core-js', 'cpp-modales-general-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-asistencia-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-asistencia.js', ['cpp-core-js', 'cpp-modales-general-js', 'cpp-cuaderno-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-ficha-alumno-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-ficha-alumno.js', ['cpp-core-js', 'cpp-modales-general-js', 'cpp-cuaderno-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-evaluacion-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-evaluacion.js', ['cpp-core-js', 'cpp-modales-general-js'], $plugin_version, true);
    wp_enqueue_script('cpp-alumnos-js', CPP_PLUGIN_URL . 'assets/js/cpp-alumnos.js', ['cpp-core-js', 'cpp-cuaderno-js'], $plugin_version, true);

    // Datos para JavaScript
    wp_localize_script('cpp-core-js', 'cppFrontendData', [
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('cpp_frontend_nonce'),
        'userId' => get_current_user_id()
    ]);
}

// Acción para manejar la descarga de Excel (exportación)
add_action('wp_ajax_cpp_download_handler', 'cpp_trigger_excel_download_handler');
function cpp_trigger_excel_download_handler() {
    // 1. Verificar nonce y permisos de usuario.
    if (!isset($_GET['nonce']) || !wp_verify_nonce($_GET['nonce'], 'cpp_frontend_nonce')) {
        wp_die('Error de seguridad (nonce).');
    }
    if (!is_user_logged_in()) {
        wp_die('Debes iniciar sesión para descargar.');
    }
    $user_id = get_current_user_id();

    // 2. Recoger y sanitizar datos de la URL (GET).
    $download_type = isset($_GET['download_type']) ? sanitize_text_field($_GET['download_type']) : null;
    $clase_id = isset($_GET['clase_id']) ? intval($_GET['clase_id']) : null;
    $evaluacion_id = isset($_GET['evaluacion_id']) ? intval($_GET['evaluacion_id']) : null;

    // 3. Validar datos necesarios según el tipo de descarga.
    if ($download_type === 'single_class' && (empty($clase_id) || empty($evaluacion_id))) {
        wp_die('Faltan datos (clase o evaluación) para generar el archivo.');
    }
    if (empty($download_type)) {
        wp_die('No se ha especificado un tipo de descarga.');
    }

    // 4. Generar nombre de archivo dinámicamente.
    $filename = 'cuaderno-exportado.xlsx'; // Nombre por defecto
    if ($download_type === 'single_class') {
        global $wpdb;
        $clase_nombre = $wpdb->get_var($wpdb->prepare("SELECT nombre FROM {$wpdb->prefix}cpp_clases WHERE id = %d AND user_id = %d", $clase_id, $user_id));
        if ($clase_nombre) {
            $filename = 'Cuaderno - ' . sanitize_file_name($clase_nombre) . '.xlsx';
        }
    } elseif ($download_type === 'all_classes') {
        $filename = 'Cuaderno - Todas las clases.xlsx';
    }

    // 5. Llamar a la función de exportación con los parámetros correctos.
    cpp_generate_excel_for_download(
        $user_id,
        $clase_id,
        $download_type,
        $filename,
        $evaluacion_id
    );

    // La función cpp_generate_excel_for_download se encarga de llamar a exit;
    // por lo que no es necesario wp_die() aquí.
}

function cpp_migrate_add_default_evaluations() {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $clases = $wpdb->get_results("SELECT id, user_id FROM $tabla_clases");
    if (empty($clases)) { return; }
    foreach ($clases as $clase) {
        $count_evaluaciones = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $tabla_evaluaciones WHERE clase_id = %d", $clase->id));
        if ($count_evaluaciones == 0) {
            // Esta función ya existe en el scope global porque db.php se carga antes
            cpp_crear_evaluacion($clase->id, $clase->user_id, 'Evaluación General');
        }
    }
}

function cpp_migrate_categories_to_evaluations_v1_3() {
    global $wpdb;
    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    
    if (!$wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_categorias` LIKE 'evaluacion_id'"))) { return; }
    if (!$wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_categorias` LIKE 'clase_id'"))) { return; }

    $categorias_a_migrar = $wpdb->get_results("SELECT id, clase_id FROM $tabla_categorias WHERE (evaluacion_id IS NULL OR evaluacion_id = 0) AND clase_id IS NOT NULL");
    if (empty($categorias_a_migrar)) { return; }

    foreach ($categorias_a_migrar as $categoria) {
        $primera_evaluacion_id = $wpdb->get_var($wpdb->prepare( "SELECT id FROM $tabla_evaluaciones WHERE clase_id = %d ORDER BY orden ASC, id ASC LIMIT 1", $categoria->clase_id ));
        if ($primera_evaluacion_id) {
            $wpdb->update( $tabla_categorias, ['evaluacion_id' => $primera_evaluacion_id], ['id' => $categoria->id], ['%d'], ['%d'] );
        }
    }
}

function cpp_migrate_restructure_categories_v1_4() {
    global $wpdb;
    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    
    if (!$wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_categorias` LIKE 'evaluacion_id'"))) {
        $wpdb->query("ALTER TABLE `$tabla_categorias` ADD `evaluacion_id` MEDIUMINT(9) UNSIGNED NULL AFTER `id`;");
    }

    if ($wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_categorias` LIKE 'clase_id'"))) {
        $categorias_a_migrar = $wpdb->get_results("SELECT id, clase_id FROM `$tabla_categorias` WHERE evaluacion_id IS NULL OR evaluacion_id = 0");
        if (!empty($categorias_a_migrar)) {
            foreach ($categorias_a_migrar as $categoria) {
                $primera_evaluacion_id = $wpdb->get_var($wpdb->prepare("SELECT id FROM `$tabla_evaluaciones` WHERE clase_id = %d ORDER BY orden ASC, id ASC LIMIT 1", $categoria->clase_id));
                if ($primera_evaluacion_id) {
                    $wpdb->update($tabla_categorias, ['evaluacion_id' => $primera_evaluacion_id], ['id' => $categoria->id]);
                }
            }
        }
    }

    if ($wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_categorias` LIKE 'clase_id'"))) {
        $wpdb->query("ALTER TABLE `$tabla_categorias` DROP COLUMN `clase_id`;");
    }
    if ($wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_categorias` LIKE 'user_id'"))) {
        $wpdb->query("ALTER TABLE `$tabla_categorias` DROP COLUMN `user_id`;");
    }
}

function cpp_migrate_add_calculation_method_v1_5() {
    global $wpdb;
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';

    if (!$wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_evaluaciones` LIKE 'calculo_nota'"))) {
        $wpdb->query("ALTER TABLE `$tabla_evaluaciones` ADD `calculo_nota` VARCHAR(20) NOT NULL DEFAULT 'total' AFTER `nombre_evaluacion`;");
    }

    $evaluaciones = $wpdb->get_results("SELECT id FROM `$tabla_evaluaciones`");
    if (empty($evaluaciones)) {
        return;
    }

    foreach ($evaluaciones as $evaluacion) {
        $conteo_categorias_reales = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM `$tabla_categorias` WHERE evaluacion_id = %d AND nombre_categoria != 'General' AND nombre_categoria != 'Sin categoría'",
            $evaluacion->id
        ));
        $conteo_total_categorias = $wpdb->get_var($wpdb->prepare( "SELECT COUNT(*) FROM `$tabla_categorias` WHERE evaluacion_id = %d", $evaluacion->id ));

        if ($conteo_total_categorias > 1 || $conteo_categorias_reales > 0) {
            $wpdb->update(
                $tabla_evaluaciones,
                ['calculo_nota' => 'ponderada'],
                ['id' => $evaluacion->id]
            );
        }
    }
}

function cpp_migrate_unify_default_category_v1_5_1() {
    global $wpdb;
    $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
    
    $wpdb->update(
        $tabla_categorias,
        ['nombre_categoria' => 'Sin categoría'],
        ['nombre_categoria' => 'General'],
        ['%s'],
        ['%s']
    );
}

function cpp_migrate_add_passing_grade_v1_6() {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';

    if (!$wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_clases` LIKE 'nota_aprobado'"))) {
        $wpdb->query("ALTER TABLE `$tabla_clases` ADD `nota_aprobado` DECIMAL(10,2) NOT NULL DEFAULT 5.00 AFTER `base_nota_final`;");
    }

    // Actualizar clases existentes para que tengan un valor por defecto razonable
    $clases_sin_nota_aprobado = $wpdb->get_results("SELECT id, base_nota_final FROM `$tabla_clases` WHERE `nota_aprobado` = 5.00");

    foreach ($clases_sin_nota_aprobado as $clase) {
        $base_nota = (float) $clase->base_nota_final;
        $nota_aprobado_default = $base_nota / 2;

        $wpdb->update(
            $tabla_clases,
            ['nota_aprobado' => $nota_aprobado_default],
            ['id' => $clase->id],
            ['%f'],
            ['%d']
        );
    }
}
// --- FIN: SCRIPT DE MIGRACIÓN DE DATOS ---

function cpp_migrate_add_link_column_v1_7() {
    global $wpdb;
    $tabla_actividades_evaluables = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_actividades_programadas = $wpdb->prefix . 'cpp_programador_actividades';

    if (!$wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_actividades_evaluables` LIKE 'id_actividad_programada'"))) {
        $wpdb->query("ALTER TABLE `$tabla_actividades_evaluables` ADD `id_actividad_programada` BIGINT(20) UNSIGNED NULL DEFAULT NULL AFTER `user_id`, ADD KEY `id_actividad_programada` (`id_actividad_programada`);");
    }

    if (!$wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_actividades_programadas` LIKE 'categoria_id'"))) {
        $wpdb->query("ALTER TABLE `$tabla_actividades_programadas` ADD `categoria_id` MEDIUMINT(9) UNSIGNED NULL DEFAULT NULL AFTER `es_evaluable`;");
    }
}

function cpp_migrate_nota_to_varchar_v1_9_1() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $column_name = 'nota';
    $column_type = 'VARCHAR(255)';

    // Check if the column exists and is not already VARCHAR
    $column_info = $wpdb->get_row($wpdb->prepare("SHOW COLUMNS FROM `$table_name` LIKE %s", $column_name));

    if ($column_info && strpos(strtolower($column_info->Type), 'decimal') !== false) {
        // Only alter if the column is of type decimal
        $wpdb->query("ALTER TABLE `$table_name` MODIFY COLUMN `$column_name` $column_type DEFAULT NULL");
    }
}

function cpp_migrate_add_final_eval_config_table_v2_0() {
    global $wpdb;
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    $charset_collate = $wpdb->get_charset_collate();

    $table_name = $wpdb->prefix . 'cpp_clase_final_eval_config';
    $sql = "CREATE TABLE $table_name (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        clase_id mediumint(9) UNSIGNED NOT NULL,
        user_id bigint(20) UNSIGNED NOT NULL,
        evaluacion_ids text NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY clase_user_unique (clase_id, user_id)
    ) $charset_collate;";
    dbDelta($sql);
}

function cpp_migrate_add_symbol_id_to_sessions_v2_1() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'cpp_programador_sesiones';
    $column_name = 'simbolo_id';

    // Check if the column exists
    $column_info = $wpdb->get_row($wpdb->prepare("SHOW COLUMNS FROM `$table_name` LIKE %s", $column_name));

    if (!$column_info) {
        $wpdb->query("ALTER TABLE `$table_name` ADD COLUMN `$column_name` VARCHAR(50) NULL DEFAULT NULL AFTER `seguimiento`;");
    }
}

function cpp_migrate_add_fixed_date_to_sessions_v2_2() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'cpp_programador_sesiones';
    $column_name = 'fecha_fijada';

    // Comprobar si la columna ya existe
    $column_info = $wpdb->get_row($wpdb->prepare("SHOW COLUMNS FROM `$table_name` LIKE %s", $column_name));

    if (!$column_info) {
        // Añadir la columna de tipo DATE que puede ser NULL
        $wpdb->query("ALTER TABLE `$table_name` ADD COLUMN `$column_name` DATE NULL DEFAULT NULL AFTER `simbolo_id`;");
    }
}

function cpp_migrate_nullify_scheduled_activity_dates_v2_2_1() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'cpp_actividades_evaluables';

    // Pone a NULL la fecha de todas las actividades que están vinculadas a una sesión
    $wpdb->query(
        "UPDATE $table_name SET fecha_actividad = NULL WHERE sesion_id IS NOT NULL"
    );
}

function cpp_migrate_alumnos_to_many_to_many_v2_3_0_final() {
    global $wpdb;
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');

    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $tabla_alumnos_clases = $wpdb->prefix . 'cpp_alumnos_clases';
    $charset_collate = $wpdb->get_charset_collate();

    // -- PASO 1: Crear la tabla de unión (dbDelta es seguro para esto)
    $sql_alumnos_clases = "CREATE TABLE $tabla_alumnos_clases (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        alumno_id mediumint(9) UNSIGNED NOT NULL,
        clase_id mediumint(9) UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY alumno_clase_unique (alumno_id, clase_id),
        KEY alumno_id (alumno_id),
        KEY clase_id (clase_id)
    ) $charset_collate;";
    dbDelta($sql_alumnos_clases);

    // -- PASO 2: Forzar la adición de la columna `user_id` con SQL directo si no existe
    $column_exists = $wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_alumnos` LIKE 'user_id'"));
    if (!$column_exists) {
        $wpdb->query("ALTER TABLE `$tabla_alumnos` ADD `user_id` BIGINT(20) UNSIGNED NULL DEFAULT NULL AFTER `id`;");
    }

    // -- PASO 3: Forzar la adición del índice `user_id` con SQL directo si no existe
    $index_exists = $wpdb->get_var($wpdb->prepare("SHOW INDEX FROM `$tabla_alumnos` WHERE Key_name = 'user_id'"));
    if (!$index_exists) {
        $wpdb->query("ALTER TABLE `$tabla_alumnos` ADD KEY `user_id` (`user_id`);");
    }

    // -- PASO 4: Migrar los datos si la columna antigua `clase_id` todavía existe
    if ($wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_alumnos` LIKE 'clase_id'"))) {
        $alumnos_a_migrar = $wpdb->get_results("SELECT id, clase_id FROM $tabla_alumnos WHERE clase_id IS NOT NULL AND clase_id > 0");

        foreach ($alumnos_a_migrar as $alumno) {
            $user_id = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_clases WHERE id = %d", $alumno->clase_id));
            if ($user_id) {
                // Rellenar user_id
                $wpdb->update($tabla_alumnos, ['user_id' => $user_id], ['id' => $alumno->id]);
                // Rellenar tabla de unión
                $wpdb->query($wpdb->prepare(
                    "INSERT IGNORE INTO $tabla_alumnos_clases (alumno_id, clase_id) VALUES (%d, %d)",
                    $alumno->id, $alumno->clase_id
                ));
            }
        }

        // Finalmente, eliminar la columna antigua
        $wpdb->query("ALTER TABLE `$tabla_alumnos` DROP COLUMN `clase_id`;");
    }
}

function cpp_migrate_add_sort_order_v2_4_1() {
    // Esta función simplemente vuelve a llamar a la creación de tablas.
    // dbDelta se encargará de añadir la nueva columna de forma segura.
    cpp_crear_tablas();
}


function cpp_run_migrations() {
    $current_version = get_option('cpp_version', '1.0');

    if (version_compare($current_version, '1.6', '<')) {
        cpp_migrate_add_passing_grade_v1_6();
    }
    if (version_compare($current_version, '1.7', '<')) {
        cpp_migrate_add_link_column_v1_7();
    }
    if (version_compare($current_version, '1.8', '<')) {
        cpp_migrate_horario_data_v1_8();
    }
    if (version_compare($current_version, '1.9', '<')) {
        cpp_migrate_refactor_activities_v1_9();
    }
    if (version_compare($current_version, '1.9.1', '<')) {
        cpp_migrate_nota_to_varchar_v1_9_1();
    }
    if (version_compare($current_version, '2.0.0', '<')) {
        cpp_migrate_add_final_eval_config_table_v2_0();
    }
	if (version_compare($current_version, '2.1.0', '<')) {
        cpp_migrate_add_symbol_id_to_sessions_v2_1();
    }
    if (version_compare($current_version, '2.2.0', '<')) {
        cpp_migrate_add_fixed_date_to_sessions_v2_2();
    }
     if (version_compare($current_version, '2.2.1', '<')) {
        cpp_migrate_nullify_scheduled_activity_dates_v2_2_1();
    }
    if (version_compare($current_version, '2.3.0', '<')) {
        cpp_migrate_alumnos_to_many_to_many_v2_3_0_final();
    }
    if (version_compare($current_version, '2.4.1', '<')) {
        cpp_migrate_add_sort_order_v2_4_1();
    }
    // Aquí se podrían añadir futuras migraciones con if(version_compare...)
    // --- IMPORTANTE: Limpiar caché después de las migraciones ---
    // Si se ha ejecutado alguna migración, la versión actual será diferente a la de la BBDD.
    if (version_compare($current_version, CPP_VERSION, '<')) {
        // Forzamos la limpieza de la caché de datos del programador para todos los usuarios
        // para asegurar que los datos se regeneran con la nueva estructura.
        delete_metadata('user', 0, 'cpp_programador_all_data_cache', '', true);
    }
    update_option('cpp_version', CPP_VERSION);
}

function cpp_migrate_horario_data_v1_8() {
    global $wpdb;
    $tabla_config = $wpdb->prefix . 'cpp_programador_config';

    // Obtener todos los horarios de todos los usuarios
    $horarios_a_migrar = $wpdb->get_results(
        $wpdb->prepare("SELECT id, valor FROM $tabla_config WHERE clave = %s", 'horario')
    );

    foreach ($horarios_a_migrar as $item) {
        $horario_actual = json_decode($item->valor, true);
        if (empty($horario_actual) || !is_array($horario_actual)) {
            continue; // No es un horario válido, lo saltamos
        }

        $horario_nuevo = [];
        $migracion_necesaria = false;

        foreach ($horario_actual as $dia => $slots) {
            if (!is_array($slots)) continue;
            $horario_nuevo[$dia] = [];
            foreach ($slots as $hora => $valor) {
                if (is_string($valor)) {
                    // Formato antiguo: el valor es solo el ID de la clase
                    $horario_nuevo[$dia][$hora] = [
                        'claseId' => $valor,
                        'notas'   => ''
                    ];
                    $migracion_necesaria = true;
                } elseif (is_array($valor) && isset($valor['claseId'])) {
                    // Formato nuevo, nos aseguramos de que tenga el campo de notas
                    $horario_nuevo[$dia][$hora] = [
                        'claseId' => $valor['claseId'],
                        'notas'   => isset($valor['notas']) ? $valor['notas'] : ''
                    ];
                } else {
                    // Dato inesperado, lo conservamos como está para no perderlo
                    $horario_nuevo[$dia][$hora] = $valor;
                }
            }
        }

        if ($migracion_necesaria) {
            $wpdb->update(
                $tabla_config,
                ['valor' => wp_json_encode($horario_nuevo)],
                ['id' => $item->id],
                ['%s'],
                ['%d']
            );
        }
    }
}

function cpp_migrate_refactor_activities_v1_9() {
    global $wpdb;
    $tabla_prog_act = $wpdb->prefix . 'cpp_programador_actividades';
    $tabla_eval_act = $wpdb->prefix . 'cpp_actividades_evaluables';

    // 1. Add new columns to 'cpp_actividades_evaluables' if they don't exist
    if (!$wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_eval_act` LIKE 'sesion_id'"))) {
        $wpdb->query("ALTER TABLE `$tabla_eval_act` ADD `sesion_id` BIGINT(20) UNSIGNED NULL DEFAULT NULL AFTER `clase_id`, ADD KEY `sesion_id` (`sesion_id`);");
    }
    if (!$wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_eval_act` LIKE 'orden'"))) {
        $wpdb->query("ALTER TABLE `$tabla_eval_act` ADD `orden` INT NOT NULL DEFAULT 0 AFTER `user_id`;");
    }

    // 2. Find all evaluable activities in the programmer table to migrate them
    $actividades_a_migrar = $wpdb->get_results(
        "SELECT id, sesion_id, orden, actividad_calificable_id FROM `$tabla_prog_act` WHERE es_evaluable = 1 AND actividad_calificable_id IS NOT NULL"
    );

    $ids_a_eliminar = [];
    if (!empty($actividades_a_migrar)) {
        foreach ($actividades_a_migrar as $act_prog) {
            // 3. For each one, update its corresponding gradebook activity with the sesion_id and orden
            $wpdb->update(
                $tabla_eval_act,
                [
                    'sesion_id' => $act_prog->sesion_id,
                    'orden' => $act_prog->orden
                ],
                ['id' => $act_prog->actividad_calificable_id],
                ['%d', '%d'],
                ['%d']
            );
            $ids_a_eliminar[] = $act_prog->id;
        }

        // 4. Delete the now-redundant rows from the programmer table
        if (!empty($ids_a_eliminar)) {
            $placeholders = implode(',', array_fill(0, count($ids_a_eliminar), '%d'));
            $wpdb->query($wpdb->prepare("DELETE FROM $tabla_prog_act WHERE id IN ($placeholders)", $ids_a_eliminar));
        }
    }

    // 5. Drop unnecessary columns from the programmer activities table
    if ($wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_prog_act` LIKE 'es_evaluable'"))) {
        $wpdb->query("ALTER TABLE `$tabla_prog_act` DROP COLUMN `es_evaluable`;");
    }
    if ($wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_prog_act` LIKE 'actividad_calificable_id'"))) {
        $wpdb->query("ALTER TABLE `$tabla_prog_act` DROP COLUMN `actividad_calificable_id`;");
    }
    if ($wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_prog_act` LIKE 'categoria_id'"))) {
        $wpdb->query("ALTER TABLE `$tabla_prog_act` DROP COLUMN `categoria_id`;");
    }
}
add_action('plugins_loaded', 'cpp_run_migrations');

// Añadir modales al footer para que estén disponibles en el DOM
add_action('wp_footer', 'cpp_add_modals_to_footer');
function cpp_add_modals_to_footer() {
    global $post;
    if (!is_a($post, 'WP_Post') || !has_shortcode($post->post_content, 'cuaderno')) {
        return;
    }
    ?>
    <!-- Modal para Gestionar Evaluaciones en la Nota Final -->
    <div id="cpp-modal-manage-final-grade-evals" class="cpp-modal">
        <div class="cpp-modal-content">
            <span class="cpp-close-btn">&times;</span>
            <h2 id="cpp-modal-manage-final-grade-evals-title">Configurar Evaluaciones para la Media</h2>
            <div id="cpp-manage-final-grade-evals-container" class="cpp-modal-body">
                <!-- El contenido se cargará aquí vía AJAX -->
                <p class="cpp-cuaderno-cargando">Cargando...</p>
            </div>
            <div class="cpp-modal-footer">
                <button id="cpp-save-final-grade-evals-btn" class="cpp-btn cpp-btn-primary">Guardar Configuración</button>
            </div>
        </div>
    </div>

    <!-- El modal de símbolos del programador se ha eliminado y se generará dinámicamente como una paleta. -->

    <?php
}
?>