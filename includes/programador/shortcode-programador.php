<?php
// /includes/programador/shortcode-programador.php

defined('ABSPATH') or die('Acceso no permitido');

add_shortcode('cpp_programador', 'cpp_shortcode_render_programador');

function cpp_shortcode_render_programador() {
    if (!is_user_logged_in()) {
        return '<div class="cpp-mensaje">Por favor, inicia sesión para acceder al programador.</div>';
    }

    ob_start();
    ?>
    <div id="cpp-programador-app" class="cpp-programador-container">

        <div class="cpp-programador-tabs">
            <button class="cpp-tab-link active" data-tab="semana">Semana</button>
            <button class="cpp-tab-link" data-tab="clases">Clases</button>
            <button class="cpp-tab-link" data-tab="horario">Horario</button>
        </div>

        <div id="cpp-programador-content" class="cpp-programador-content">
            <div id="tab-semana" class="cpp-tab-content active">
                <h2>Vista Semanal</h2>
                <!-- El calendario semanal se renderizará aquí -->
                <p>Cargando vista semanal...</p>
            </div>
            <div id="tab-clases" class="cpp-tab-content">
                <h2>Banco de Lecciones por Clase</h2>
                <!-- Las columnas de clases con sus lecciones se renderizarán aquí -->
                <p>Cargando clases...</p>
            </div>
            <div id="tab-horario" class="cpp-tab-content">
                <h2>Configuración del Horario Semanal</h2>
                <!-- La tabla de configuración del horario se renderizará aquí -->
                <p>Cargando configuración de horario...</p>
            </div>
        </div>

        <div id="cpp-programador-empty-state" style="display: none; text-align: center; padding: 40px;">
            <p>Parece que tu programador está vacío.</p>
            <button id="cpp-programador-create-example-btn" class="cpp-btn cpp-btn-primary">Crear Programación de Ejemplo</button>
        </div>

        <!-- Modal genérico para Lecciones -->
        <div id="cpp-leccion-modal" class="cpp-modal" style="display:none;">
            <div class="cpp-modal-content">
                <span class="cpp-modal-close">&times;</span>
                <h2 id="cpp-leccion-modal-title">Nueva Lección</h2>
                <form id="cpp-leccion-form">
                    <input type="hidden" id="cpp-leccion-id" name="leccion_id">
                    <input type="hidden" id="cpp-leccion-clase-id" name="clase_id">
                    <div class="cpp-form-group">
                        <label for="cpp-leccion-titulo">Título:</label>
                        <input type="text" id="cpp-leccion-titulo" name="titulo" required>
                    </div>
                    <div class="cpp-form-group">
                        <label for="cpp-leccion-descripcion">Descripción:</label>
                        <textarea id="cpp-leccion-descripcion" name="descripcion" rows="5"></textarea>
                    </div>
                    <div class="cpp-modal-actions">
                        <button type="submit" class="cpp-btn cpp-btn-primary">Guardar Lección</button>
                    </div>
                </form>
            </div>
        </div>

    </div>
    <?php
    return ob_get_clean();
}
