<?php
// Temporary debug trigger file.
// This file is used to manually test backend functions.

// Cargar el entorno de WordPress
require_once('../../../wp-load.php');

// Verificar que el usuario actual es el administrador (o un usuario específico)
if (!current_user_can('manage_options')) {
    wp_die('Acceso no autorizado.');
}

// Cargar las dependencias necesarias del plugin
require_once(plugin_dir_path(__FILE__) . 'includes/db.php');
require_once(plugin_dir_path(__FILE__) . 'includes/db-queries/queries-alumnos.php');

// --- FUNCIÓN DE TEST ---
function run_alumnos_test() {
    // ID de usuario a probar (hardcodeado para este test)
    $user_id_to_test = 20;

    // Llamar a la función que queremos diagnosticar
    $alumnos = cpp_obtener_todos_alumnos_usuario($user_id_to_test);

    // Imprimir el resultado en formato JSON para un análisis claro
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'test_function' => 'cpp_obtener_todos_alumnos_usuario',
        'user_id_tested' => $user_id_to_test,
        'result_count' => is_array($alumnos) ? count($alumnos) : 'N/A',
        'results' => $alumnos
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}

// Ejecutar la función de test si se pasa el parámetro correcto en la URL
if (isset($_GET['test']) && $_GET['test'] === 'alumnos') {
    run_alumnos_test();
    exit;
} else {
    echo "Script de diagnóstico. Añade '?test=alumnos' a la URL para ejecutar la prueba.";
}
