<?php
// /includes/ajax.php (ahora es el archivo cargador)

defined('ABSPATH') or die('Acceso no permitido');

/**
 * Carga todos los manejadores de AJAX de forma centralizada.
 * * El archivo principal del plugin solo necesita hacer require_once de este archivo,
 * y este se encarga de incluir todos los manejadores específicos desde la
 * subcarpeta /ajax-handlers.
 */

$ajax_handlers_dir = CPP_PLUGIN_DIR . 'includes/ajax-handlers/';

// Los que ya hemos creado:
require_once $ajax_handlers_dir . 'ajax-evaluaciones.php';
require_once $ajax_handlers_dir . 'ajax-clases.php';
require_once $ajax_handlers_dir . 'ajax-alumnos.php';
require_once $ajax_handlers_dir . 'ajax-categorias.php';
require_once $ajax_handlers_dir . 'ajax-cuaderno.php';
require_once $ajax_handlers_dir . 'ajax-asistencia.php';
require_once $ajax_handlers_dir . 'ajax-ficha-alumno.php';