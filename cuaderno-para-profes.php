<?php
/*
Plugin Name: Cuaderno para Profesores
Description: Gestión de clases y alumnos completamente desde el frontend.
Version: 1.5.1
Author: Javier Vegas Serrano
*/

defined('ABSPATH') or die('Acceso no permitido');

// --- VERSIÓN ACTUALIZADA PARA LA NUEVA MIGRACIÓN ---
define('CPP_VERSION', '1.5.1');

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

// Crear tablas al activar
register_activation_hook(__FILE__, 'cpp_crear_tablas');

// Cargar assets
add_action('wp_enqueue_scripts', 'cpp_cargar_assets');
function cpp_cargar_assets() {
    $plugin_version = defined('WP_DEBUG') && WP_DEBUG ? time() : CPP_VERSION;

    wp_enqueue_style('cpp-frontend-css', CPP_PLUGIN_URL . 'assets/css/frontend.css', [], $plugin_version);
    wp_enqueue_style('dashicons');
    wp_enqueue_script('jquery-ui-sortable');

    wp_enqueue_script('cpp-core-js', CPP_PLUGIN_URL . 'assets/js/cpp-core.js', ['jquery', 'jquery-ui-sortable'], $plugin_version, true);
    wp_enqueue_script('cpp-utils-js', CPP_PLUGIN_URL . 'assets/js/cpp-utils.js', ['cpp-core-js'], $plugin_version, true);
    wp_enqueue_script('cpp-sidebar-js', CPP_PLUGIN_URL . 'assets/js/cpp-sidebar.js', ['cpp-core-js'], $plugin_version, true);
    wp_enqueue_script('cpp-cuaderno-js', CPP_PLUGIN_URL . 'assets/js/cpp-cuaderno.js', ['cpp-core-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-general-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-general.js', ['cpp-core-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-clase-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-clase.js', ['cpp-core-js', 'cpp-modales-general-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-alumnos-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-alumnos.js', ['cpp-core-js', 'cpp-modales-general-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-actividad-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-actividad.js', ['cpp-core-js', 'cpp-modales-general-js', 'cpp-cuaderno-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-excel-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-excel.js', ['cpp-core-js', 'cpp-modales-general-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-asistencia-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-asistencia.js', ['cpp-core-js', 'cpp-modales-general-js', 'cpp-cuaderno-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-ficha-alumno-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-ficha-alumno.js', ['cpp-core-js', 'cpp-modales-general-js', 'cpp-cuaderno-js'], $plugin_version, true);
    wp_enqueue_script('cpp-modales-evaluacion-js', CPP_PLUGIN_URL . 'assets/js/cpp-modales-evaluacion.js', ['cpp-core-js', 'cpp-modales-general-js'], $plugin_version, true);

    wp_localize_script('cpp-core-js', 'cppFrontendData', [
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('cpp_frontend_nonce'),
        'userId' => get_current_user_id()
    ]);
}

// Acción para manejar la descarga de Excel (exportación)
add_action('wp_ajax_cpp_download_excel', 'cpp_trigger_excel_download_handler');
function cpp_trigger_excel_download_handler() {
    if (!isset($_REQUEST['nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_REQUEST['nonce'])), 'cpp_frontend_nonce')) { wp_die('Error de seguridad (nonce inválido).'); }
    if (!is_user_logged_in()) { wp_die('Acceso denegado. Debes iniciar sesión.'); }

    $user_id = get_current_user_id();
    $download_type = isset($_REQUEST['download_type']) ? sanitize_text_field($_REQUEST['download_type']) : 'single_class';
    $clase_id_para_exportar = null;
    $filename = 'exportacion_cuaderno.xlsx'; 

    if ($download_type === 'single_class') {
        if (!isset($_REQUEST['clase_id'])) { wp_die('Error: No se especificó el ID de la clase para la descarga.'); }
        $clase_id_para_exportar = intval($_REQUEST['clase_id']);
        if (empty($clase_id_para_exportar)) { wp_die('Error: ID de clase no válido.'); }
        $clase_info = cpp_obtener_clase_completa_por_id($clase_id_para_exportar, $user_id);
        if ($clase_info && !empty($clase_info['nombre'])) {
            $filename = sanitize_file_name('clase_' . $clase_info['nombre'] . '.xlsx');
        } else {
            $filename = sanitize_file_name('clase_' . $clase_id_para_exportar . '.xlsx');
        }
    } elseif ($download_type === 'all_classes') {
        $filename = sanitize_file_name('cuaderno_completo_profesor.xlsx');
    }  
    
    cpp_generate_excel_for_download($user_id, $clase_id_para_exportar, $download_type, $filename);
}

// ACCIONES AJAX PARA IMPORTACIÓN DE ALUMNOS
add_action('wp_ajax_cpp_download_student_template', 'cpp_handle_student_template_download');
add_action('wp_ajax_cpp_upload_student_excel', 'cpp_handle_student_excel_upload');
add_action('wp_ajax_cpp_import_students_from_file', 'cpp_handle_process_students_import');


// --- INICIO: SCRIPT DE MIGRACIÓN DE DATOS ---
add_action('plugins_loaded', 'cpp_check_for_updates');
function cpp_check_for_updates() {
    $stored_version = get_option('cpp_plugin_version', '1.0.0');

    if (version_compare($stored_version, CPP_VERSION, '<')) {
        
        if (version_compare($stored_version, '1.2.0', '<')) {
            cpp_migrate_add_default_evaluations();
        }
        
        if (version_compare($stored_version, '1.3.0', '<')) {
            cpp_migrate_categories_to_evaluations_v1_3();
        }

        if (version_compare($stored_version, '1.4.0', '<')) {
            cpp_migrate_restructure_categories_v1_4();
        }

        if (version_compare($stored_version, '1.5.0', '<')) {
            cpp_migrate_add_calculation_method_v1_5();
        }

        // --- NUEVA MIGRACIÓN PARA LA VERSIÓN 1.5.1 ---
        if (version_compare($stored_version, '1.5.1', '<')) {
            cpp_migrate_unify_default_category_v1_5_1();
        }

        update_option('cpp_plugin_version', CPP_VERSION);
    }
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
// --- FIN: SCRIPT DE MIGRACIÓN DE DATOS ---

?>