<?php
// /includes/programador/shortcode-programador.php

defined('ABSPATH') or die('Acceso no permitido');

add_shortcode('cpp_programador', 'cpp_shortcode_render_programador');

function cpp_shortcode_render_programador() {
    if (!is_user_logged_in()) {
        return '<div class="cpp-mensaje">Por favor, inicia sesión para acceder al programador.</div>';
    }

    $user_id = get_current_user_id();
    $clases = cpp_obtener_clases_usuario($user_id);
    $current_user = wp_get_current_user();
    $avatar_url = get_avatar_url($user_id);
    $default_class_color_hex = '#2962FF';

    ob_start();
    ?>
    <div id="cpp-programador-app" class="cpp-cuaderno-viewport-classroom">

        <!-- Sidebar de Clases (similar al cuaderno) -->
        <div class="cpp-cuaderno-sidebar-classroom" id="cpp-programador-sidebar">
            <div class="cpp-sidebar-header-placeholder">
                <button class="cpp-header-menu-btn" id="cpp-sidebar-close-btn" title="Cerrar Menú">
                    <span class="dashicons dashicons-menu"></span>
                </button>
                <span>Mis Clases</span>
            </div>
            <nav class="cpp-sidebar-nav">
                <ul class="cpp-sidebar-clases-list">
                    <?php if (!empty($clases)): ?>
                        <?php foreach ($clases as $clase):
                            $clase_color = !empty($clase['color']) ? $clase['color'] : $default_class_color_hex;
                        ?>
                            <li class="cpp-sidebar-clase-item" data-clase-id="<?php echo esc_attr($clase['id']); ?>" data-clase-color="<?php echo esc_attr($clase_color); ?>">
                                <a href="#">
                                    <span class="cpp-sidebar-clase-icon dashicons dashicons-groups" style="color: <?php echo esc_attr($clase_color); ?>;"></span>
                                    <span class="cpp-sidebar-clase-nombre-texto"><?php echo esc_html($clase['nombre']); ?></span>
                                </a>
                            </li>
                        <?php endforeach; ?>
                    <?php else: ?>
                        <li class="cpp-sidebar-no-clases">No hay clases creadas.</li>
                    <?php endif; ?>
                </ul>
            </nav>
        </div>

        <!-- Contenido Principal -->
        <div class="cpp-cuaderno-main-content-classroom" id="cpp-programador-main-content">
            <!-- Barra de cabecera (se rellenará con JS) -->
            <div class="cpp-main-content-header" id="cpp-programador-header">
                <div class="cpp-header-left">
                    <button class="cpp-header-menu-btn" id="cpp-sidebar-open-btn" title="Abrir Menú">
                        <span class="dashicons dashicons-menu"></span>
                    </button>
                    <h2 id="cpp-programador-clase-actual-nombre">Selecciona una clase</h2>
                </div>
                <div class="cpp-header-right">
                    <div class="cpp-user-menu">
                        <img src="<?php echo esc_url($avatar_url); ?>" alt="Avatar" class="cpp-user-avatar">
                    </div>
                </div>
            </div>

            <!-- Pestañas -->
            <div class="cpp-programador-tabs">
                <button class="cpp-tab-link active" data-tab="programacion">Programación</button>
                <button class="cpp-tab-link" data-tab="semana">Semana</button>
                <button class="cpp-tab-link" data-tab="horario">Horario</button>
            </div>

            <!-- Contenido de las Pestañas -->
            <div id="cpp-programador-content" class="cpp-programador-content">
                <div id="tab-programacion" class="cpp-tab-content active">
                    <!-- Contenido de Programación (2 columnas) irá aquí -->
                </div>
                <div id="tab-semana" class="cpp-tab-content">
                    <!-- Contenido de Vista Semanal irá aquí -->
                </div>
                <div id="tab-horario" class="cpp-tab-content">
                    <!-- Contenido de Horario irá aquí -->
                </div>
            </div>
        </div>

        <div class="cpp-sidebar-overlay" id="cpp-sidebar-overlay"></div>

        <!-- Modales, etc. -->
        <div id="cpp-programador-empty-state" style="display: none; text-align: center; padding: 40px;">
            <p>Parece que tu programador está vacío.</p>
            <button id="cpp-programador-create-example-btn" class="cpp-btn cpp-btn-primary">Crear Programación de Ejemplo</button>
        </div>
        <div id="cpp-sesion-modal" class="cpp-modal" style="display:none;">
            <div class="cpp-modal-content">
                <span class="cpp-modal-close">&times;</span>
                <h2 id="cpp-sesion-modal-title">Nueva Sesión</h2>
                <form id="cpp-sesion-form">
                    <input type="hidden" id="cpp-sesion-id" name="sesion_id">
                    <input type="hidden" id="cpp-sesion-clase-id" name="clase_id">
                    <input type="hidden" id="cpp-sesion-evaluacion-id" name="evaluacion_id">
                    <div class="cpp-form-group"><label for="cpp-sesion-titulo">Título:</label><input type="text" id="cpp-sesion-titulo" name="titulo" required></div>
                    <div class="cpp-form-group"><label for="cpp-sesion-descripcion">Descripción:</label><textarea id="cpp-sesion-descripcion" name="descripcion" rows="5"></textarea></div>
                    <div class="cpp-modal-actions"><button type="submit" class="cpp-btn cpp-btn-primary">Guardar Sesión</button></div>
                </form>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}
