<?php
// /includes/programador/shortcode-programador.php

defined('ABSPATH') or die('Acceso no permitido');

add_shortcode('cpp_programador', 'cpp_shortcode_programador');

function cpp_shortcode_programador() {
    if (!is_user_logged_in()) {
        return '<div class="cpp-mensaje">Por favor, inicia sesión para acceder al programador.</div>';
    }

    // Placeholder for the scheduler's HTML structure
    ob_start();
    ?>
    <div id="cpp-programador-app" class="cpp-programador-container" data-user-id="<?php echo esc_attr(get_current_user_id()); ?>">
        <div class="cpp-programador-header">
            <h1>Programador de Trabajo</h1>
            <div class="cpp-programador-actions">
                <button id="cpp-programador-settings-btn" class="cpp-btn">Ajustes</button>
                <button id="cpp-programador-add-session-btn" class="cpp-btn cpp-btn-primary">Añadir Sesión</button>
            </div>
        </div>
        <div class="cpp-programador-main">
            <div id="cpp-programador-schedule-view">
                <p>Cargando programador...</p>
            </div>
        </div>

        <!-- Modal for settings -->
        <div id="cpp-programador-settings-modal" class="cpp-modal" style="display:none;">
            <div class="cpp-modal-content">
                <span class="cpp-modal-close" id="cpp-close-settings-modal">&times;</span>
                <h2>Ajustes del Programador</h2>
                <form id="cpp-programador-settings-form">
                    <div class="cpp-form-group">
                        <label>Días Laborables:</label>
                        <div class="cpp-checkbox-group">
                            <label><input type="checkbox" name="dias_laborables" value="1"> Lunes</label>
                            <label><input type="checkbox" name="dias_laborables" value="2"> Martes</label>
                            <label><input type="checkbox" name="dias_laborables" value="3"> Miércoles</label>
                            <label><input type="checkbox" name="dias_laborables" value="4"> Jueves</label>
                            <label><input type="checkbox" name="dias_laborables" value="5"> Viernes</label>
                            <label><input type="checkbox" name="dias_laborables" value="6"> Sábado</label>
                            <label><input type="checkbox" name="dias_laborables" value="7"> Domingo</label>
                        </div>
                    </div>
                    <div class="cpp-form-group">
                        <label for="cpp-dias-no-laborables">Días no Laborables (festivos):</label>
                        <textarea id="cpp-dias-no-laborables" name="dias_no_laborables" rows="3" placeholder="Añade fechas en formato YYYY-MM-DD, separadas por comas."></textarea>
                    </div>
                    <div class="cpp-modal-actions">
                        <button type="submit" class="cpp-btn cpp-btn-primary">Guardar Ajustes</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Modal for adding/editing sessions -->
        <div id="cpp-programador-session-modal" class="cpp-modal" style="display:none;">
            <div class="cpp-modal-content">
                <span class="cpp-modal-close" id="cpp-close-session-modal">&times;</span>
                <h2 id="cpp-programador-session-modal-title">Añadir Nueva Sesión</h2>
                <form id="cpp-programador-session-form">
                    <input type="hidden" id="cpp-sesion-id" name="sesion_id" value="">
                    <div class="cpp-form-group">
                        <label for="cpp-sesion-titulo">Título de la Sesión:</label>
                        <input type="text" id="cpp-sesion-titulo" name="titulo" required>
                    </div>
                    <div class="cpp-form-group">
                        <label for="cpp-sesion-descripcion">Descripción (opcional):</label>
                        <textarea id="cpp-sesion-descripcion" name="descripcion" rows="4"></textarea>
                    </div>
                    <div class="cpp-modal-actions">
                        <button type="submit" class="cpp-btn cpp-btn-primary">Guardar Sesión</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}
