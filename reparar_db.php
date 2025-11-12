<?php
// Manual migration and repair script.

// Load WordPress environment robustly
$wp_load_path = __DIR__ . '/../../../wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = '/home/musicae1/public_html/cuadernodeprofe.com/wp-load.php';
}
if (!file_exists($wp_load_path)) {
    die('Critical Error: Could not find wp-load.php');
}
require_once($wp_load_path);

function run_manual_migration() {
    global $wpdb;

    echo "<h1>Iniciando Reparación y Migración Manual de la Base de Datos</h1>";

    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $tabla_alumnos_clases = $wpdb->prefix . 'cpp_alumnos_clases';
    $charset_collate = $wpdb->get_charset_collate();

    // --- PASO 1: Asegurarse de que la columna `user_id` existe en `cpp_alumnos` ---
    echo "<h2>Paso 1: Verificando la columna 'user_id' en '$tabla_alumnos'...</h2>";
    $column_exists = $wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_alumnos` LIKE 'user_id'"));
    if (!$column_exists) {
        $wpdb->query("ALTER TABLE `$tabla_alumnos` ADD `user_id` BIGINT(20) UNSIGNED NULL DEFAULT NULL AFTER `id`;");
        echo "<p style='color:green;'>Columna 'user_id' no existía. Ha sido creada.</p>";
    } else {
        echo "<p style='color:blue;'>La columna 'user_id' ya existe.</p>";
    }

    // --- PASO 2: Crear la tabla de unión `cpp_alumnos_clases` si no existe ---
    echo "<h2>Paso 2: Verificando la tabla de unión '$tabla_alumnos_clases'...</h2>";
    $sql_alumnos_clases = "CREATE TABLE $tabla_alumnos_clases (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        alumno_id mediumint(9) UNSIGNED NOT NULL,
        clase_id mediumint(9) UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY alumno_clase_unique (alumno_id, clase_id),
        KEY alumno_id (alumno_id),
        KEY clase_id (clase_id)
    ) $charset_collate;";
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql_alumnos_clases);
    echo "<p style='color:green;'>La tabla '$tabla_alumnos_clases' ha sido creada o verificada.</p>";

    // --- PASO 3: Migrar los datos si la columna `clase_id` todavía existe ---
    echo "<h2>Paso 3: Migrando datos de alumnos...</h2>";
    if ($wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM `$tabla_alumnos` LIKE 'clase_id'"))) {
        echo "<p>Se ha encontrado la columna 'clase_id'. Procediendo a migrar los datos...</p>";
        $alumnos_a_migrar = $wpdb->get_results("SELECT id, clase_id FROM $tabla_alumnos WHERE clase_id IS NOT NULL AND clase_id > 0");
        $migrated_count = 0;

        foreach ($alumnos_a_migrar as $alumno) {
            $user_id = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_clases WHERE id = %d", $alumno->clase_id));
            if ($user_id) {
                // Rellenar user_id en la tabla de alumnos
                $wpdb->update($tabla_alumnos, ['user_id' => $user_id], ['id' => $alumno->id]);
                // Rellenar la tabla de unión
                $wpdb->query($wpdb->prepare(
                    "INSERT IGNORE INTO $tabla_alumnos_clases (alumno_id, clase_id) VALUES (%d, %d)",
                    $alumno->id, $alumno->clase_id
                ));
                $migrated_count++;
            }
        }
        echo "<p style='color:green;'>Se han migrado $migrated_count alumnos.</p>";

        // --- PASO 4: Eliminar la columna `clase_id` ---
        echo "<h2>Paso 4: Eliminando la columna 'clase_id' de '$tabla_alumnos'...</h2>";
        $wpdb->query("ALTER TABLE `$tabla_alumnos` DROP COLUMN `clase_id`;");
        echo "<p style='color:green;'>La columna 'clase_id' ha sido eliminada.</p>";

    } else {
        echo "<p style='color:blue;'>La columna 'clase_id' no existe. No se necesita migración de datos.</p>";
    }

    echo "<h1>Proceso Completado</h1>";
}

if (isset($_GET['run']) && $_GET['run'] === 'migration') {
    run_manual_migration();
} else {
    echo "<h1>Script de Reparación Manual</h1><p>Añade '?run=migration' a la URL para ejecutar el proceso.</p>";
}
