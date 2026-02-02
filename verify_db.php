<?php
// verify_db.php

// Attempt to load WP
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

echo "<h2>Database Verification</h2>";

// 1. Check Table
$table_exists = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table_name));
if (!$table_exists) {
    die("Error: Table $table_name does not exist!");
}
echo "Table $table_name exists.<br>";

// 2. Check Column
$column_exists = $wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$table_name` LIKE %s", 'orden_alumnos_predeterminado'));
if (!$column_exists) {
    echo "<span style='color:red'>ERROR: Column 'orden_alumnos_predeterminado' is MISSING!</span><br>";

    if (isset($_GET['fix']) && $_GET['fix'] === 'yes') {
        echo "Attempting to fix...<br>";
        $wpdb->query("ALTER TABLE `$table_name` ADD `orden_alumnos_predeterminado` VARCHAR(20) DEFAULT 'apellidos' AFTER `nota_aprobado` ");
        echo "Query executed. Refresh to check.<br>";
    } else {
        echo "Add '?fix=yes' to the URL to try adding the column.<br>";
    }
} else {
    echo "Column 'orden_alumnos_predeterminado' exists.<br>";

    // 3. Test Update
    if (isset($_GET['test_id'])) {
        $test_id = intval($_GET['test_id']);
        $new_val = isset($_GET['val']) ? $_GET['val'] : 'nombre';
        echo "Testing update for class ID $test_id to '$new_val'...<br>";
        $res = $wpdb->update($table_name, ['orden_alumnos_predeterminado' => $new_val], ['id' => $test_id]);
        if ($res === false) {
            echo "Update FAILED: " . $wpdb->last_error . "<br>";
        } else {
            echo "Update success! Rows affected: $res<br>";
        }
    }
}

// 4. List all classes for current user or user 20
$user_id = get_current_user_id() ? get_current_user_id() : 20;
echo "<h3>Classes for User $user_id:</h3>";
$clases = $wpdb->get_results($wpdb->prepare("SELECT id, nombre, orden_alumnos_predeterminado FROM `$table_name` WHERE user_id = %d", $user_id), ARRAY_A);
echo "<pre>";
print_r($clases);
echo "</pre>";
