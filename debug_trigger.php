<?php
define('WP_USE_THEMES', false);
require_once('/wordpress/wp-load.php');

// Simulate a logged-in user (user ID 1 is typically the admin)
wp_set_current_user(1);

// Set the required POST variables for the AJAX action
$_POST['action'] = 'cpp_search_alumnos';
$_POST['nonce'] = wp_create_nonce('cpp_frontend_nonce');
$_POST['search_term'] = '';

// Manually call the AJAX handler function after ensuring it's loaded
require_once(WP_PLUGIN_DIR . '/cuaderno-para-profes/includes/ajax-handlers/ajax-alumnos.php');

if (function_exists('cpp_ajax_search_alumnos')) {
    echo "Triggering cpp_ajax_search_alumnos...\n";
    cpp_ajax_search_alumnos();
    echo "Done.\n";
} else {
    echo "Error: cpp_ajax_search_alumnos function not found.\n";
}
