<?php
// diag_clases.php

$wp_load_path = __DIR__ . '/../../../wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = '/home/musicae1/public_html/cuadernodeprofe.com/wp-load.php';
}
if (!file_exists($wp_load_path)) {
    die('Critical Error: Could not find wp-load.php');
}
require_once($wp_load_path);

global $wpdb;
$table_name = $wpdb->prefix . 'cpp_clases';

echo "<h2>Diagnostic for Table: $table_name</h2>";

// Check columns
$columns = $wpdb->get_results("SHOW COLUMNS FROM `$table_name`", ARRAY_A);
echo "<h3>Columns:</h3><pre>";
print_r($columns);
echo "</pre>";

// Check values for user 20 (assuming that's the test user)
$user_id = 20;
$clases = $wpdb->get_results($wpdb->prepare("SELECT id, nombre, orden_alumnos_predeterminado FROM `$table_name` WHERE user_id = %d", $user_id), ARRAY_A);

echo "<h3>Values for User $user_id:</h3><pre>";
print_r($clases);
echo "</pre>";
