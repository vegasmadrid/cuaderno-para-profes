<?php
// Advanced diagnostic script

// Load WordPress environment robustly
$wp_load_path = __DIR__ . '/../../../wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = '/home/musicae1/public_html/cuadernodeprofe.com/wp-load.php';
}
if (!file_exists($wp_load_path)) {
    die('Critical Error: Could not find wp-load.php');
}
require_once($wp_load_path);

// Load plugin dependencies
if (!defined('CPP_PLUGIN_DIR')) {
    define('CPP_PLUGIN_DIR', plugin_dir_path(__FILE__));
}
require_once(CPP_PLUGIN_DIR . 'includes/db.php');
require_once(CPP_PLUGIN_DIR . 'includes/db-queries/queries-alumnos.php');

function run_advanced_diagnostics() {
    global $wpdb;
    $user_id_to_test = 20;
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';

    // Test 1: Run the function
    $function_results = cpp_obtener_todos_alumnos_usuario($user_id_to_test);

    // Test 2: Raw data query
    $raw_sql_query = $wpdb->prepare("SELECT id, user_id, nombre, apellidos FROM $tabla_alumnos WHERE user_id = %d LIMIT 20", $user_id_to_test);
    $raw_data_results_with_user_id = $wpdb->get_results($raw_sql_query, ARRAY_A);

    // Test 3: Raw data query for NULL user_id
    $raw_sql_query_null = "SELECT id, user_id, nombre, apellidos FROM $tabla_alumnos WHERE user_id IS NULL LIMIT 20";
    $raw_data_results_null_user_id = $wpdb->get_results($raw_sql_query_null, ARRAY_A);

    // Test 4: Count all students for the user
    $count_query = $wpdb->prepare("SELECT COUNT(*) FROM $tabla_alumnos WHERE user_id = %d", $user_id_to_test);
    $total_count = $wpdb->get_var($count_query);

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'DIAGNOSTIC_RESULTS' => [
            'Test_1_Function_Call' => [
                'description' => 'Result of calling cpp_obtener_todos_alumnos_usuario(20)',
                'result_count' => is_array($function_results) ? count($function_results) : 'N/A',
                'results' => $function_results
            ],
            'Test_2_Raw_SQL_Direct_Query' => [
                'description' => 'Raw query for students WHERE user_id = 20',
                'query' => $raw_sql_query,
                'result_count' => is_array($raw_data_results_with_user_id) ? count($raw_data_results_with_user_id) : 'N/A',
                'results' => $raw_data_results_with_user_id
            ],
            'Test_3_Raw_SQL_NULL_UserID' => [
                 'description' => 'Raw query for students WHERE user_id IS NULL',
                 'query' => $raw_sql_query_null,
                 'result_count' => is_array($raw_data_results_null_user_id) ? count($raw_data_results_null_user_id) : 'N/A',
                 'results' => $raw_data_results_null_user_id
            ],
            'Test_4_Total_Count' => [
                 'description' => 'Total count of students for user_id = 20',
                 'query' => $count_query,
                 'total' => $total_count
            ]
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}

if (isset($_GET['test']) && $_GET['test'] === 'data') {
    run_advanced_diagnostics();
} else {
    echo "Advanced diagnostic script. Add '?test=data' to the URL to run.";
}
