<?php
// /includes/programador/shortcode-programador.php

defined('ABSPATH') or die('Acceso no permitido');

// add_shortcode('cpp_programador', 'cpp_shortcode_render_programador'); // Shortcode obsoleto, integrado en [cuaderno]

function cpp_shortcode_render_programador() {
    if (!is_user_logged_in()) {
        return '<div class="cpp-mensaje">Por favor, inicia sesión para acceder al programador.</div>';
    }

    ob_start();
    ?>
    <div id="cpp-programador-app" class="cpp-programador-container">

        <div class="cpp-programador-tabs">
            <button class="cpp-tab-link active" data-tab="programacion">Programación</button>
            <button class="cpp-tab-link" data-tab="semana">Semana</button>
            <button class="cpp-tab-link" data-tab="horario">Horario</button>
        </div>

        <div id="cpp-programador-content" class="cpp-programador-content">
            <div id="tab-programacion" class="cpp-tab-content active">
                <!-- Contenido renderizado por JS -->
            </div>
            <div id="tab-semana" class="cpp-tab-content">
                <!-- Contenido renderizado por JS -->
            </div>
            <div id="tab-horario" class="cpp-tab-content">
                <!-- Contenido renderizado por JS -->
            </div>
        </div>

        <div id="cpp-sesion-modal" class="cpp-modal" style="display:none;">
            <div class="cpp-modal-content">
                <span class="cpp-modal-close">&times;</span>
                <h2 id="cpp-sesion-modal-title">Nueva Sesión</h2>
                <form id="cpp-sesion-form">
                    <input type="hidden" id="cpp-sesion-id" name="sesion_id">
                    <input type="hidden" id="cpp-sesion-clase-id" name="clase_id">
                    <input type="hidden" id="cpp-sesion-evaluacion-id" name="evaluacion_id">
                    <div class="cpp-form-group"><label for="cpp-sesion-titulo">Título de la Sesión:</label><input type="text" id="cpp-sesion-titulo" name="titulo" required></div>
                    <div class="cpp-form-group"><label for="cpp-sesion-descripcion">Descripción:</label><textarea id="cpp-sesion-descripcion" name="descripcion" rows="3"></textarea></div>
                    <div class="cpp-modal-actions"><button type="submit" class="cpp-btn cpp-btn-primary">Guardar Sesión</button></div>
                </form>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}
