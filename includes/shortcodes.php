<?php
// /includes/shortcodes.php

defined('ABSPATH') or die('Acceso no permitido');

// --- SHORTCODE [cuaderno] (ÚNICO PUNTO DE ENTRADA DEL FRONTEND) ---
add_shortcode('cuaderno', 'cpp_shortcode_cuaderno_notas_classroom');
function cpp_shortcode_cuaderno_notas_classroom() {
    if (!is_user_logged_in()) {
        return '<div class="cpp-mensaje">Por favor, inicia sesión para acceder al cuaderno de notas.</div>';
    }

    $user_id = get_current_user_id();
    $clases = cpp_obtener_clases_usuario($user_id); 

    $milan_vivid_colors = [
        '#FFD600' => 'Amarillo Milan', '#FF6D00' => 'Naranja Milan', '#D50000' => 'Rojo Milan',
        '#cd18be' => 'Rosa Milan (Nuevo)', '#AA00FF' => 'Violeta Milan', '#0091EA' => 'Azul Cielo Milan',
        '#2962FF' => 'Azul Oscuro Milan', '#00C853' => 'Verde Claro Milan', '#1B5E20' => 'Verde Oscuro Milan',
        '#5D4037' => 'Marrón Milan', '#616161' => 'Gris Milan', '#000000' => 'Negro Milan'
    ];
    $default_class_color_hex = '#2962FF'; 

    ob_start();
    ?>
    <div class="cpp-cuaderno-viewport-classroom">
        <div class="cpp-cuaderno-sidebar-classroom" id="cpp-cuaderno-sidebar">
            <div class="cpp-sidebar-header-placeholder">
                <button class="cpp-header-menu-btn" id="cpp-sidebar-close-btn" title="Cerrar Menú">
                    <span class="dashicons dashicons-menu"></span>
                </button>
                <span>Mis Clases</span>
            </div>
            <nav class="cpp-sidebar-nav">
                <ul class="cpp-sidebar-clases-list">
                    <?php if (!empty($clases)): ?>
                        <?php foreach ($clases as $index => $clase): 
                            $clase_color_actual = isset($clase['color']) && !empty($clase['color']) ? $clase['color'] : $default_class_color_hex;
                            $clase_base_nota_final = isset($clase['base_nota_final']) ? $clase['base_nota_final'] : '100';
                        ?>
                            <li class="cpp-sidebar-clase-item" 
                                data-clase-id="<?php echo esc_attr($clase['id']); ?>"
                                data-clase-nombre="<?php echo esc_html($clase['nombre']); ?>"
                                data-base-nota-final="<?php echo esc_attr($clase_base_nota_final); ?>">
                                <a href="#">
                                    <span class="cpp-sidebar-clase-icon dashicons dashicons-groups" style="color: <?php echo esc_attr($clase_color_actual); ?>;"></span>
                                    <span class="cpp-sidebar-clase-nombre-texto"><?php echo esc_html($clase['nombre']); ?></span>
                                </a>
                                <div class="cpp-sidebar-item-actions">
                                    <button class="cpp-sidebar-clase-alumnos-btn" data-clase-id="<?php echo esc_attr($clase['id']); ?>" data-clase-nombre="<?php echo esc_attr($clase['nombre']); ?>" title="Gestionar Alumnos de <?php echo esc_attr($clase['nombre']); ?>">
                                        <span class="dashicons dashicons-admin-users"></span>
                                    </button>
                                    <button class="cpp-sidebar-clase-settings-btn" data-clase-id="<?php echo esc_attr($clase['id']); ?>" data-clase-nombre="<?php echo esc_attr($clase['nombre']); ?>" title="Configurar Clase: <?php echo esc_attr($clase['nombre']); ?>">
                                        <span class="dashicons dashicons-admin-generic"></span>
                                    </button>
                                </div>
                            </li>
                        <?php endforeach; ?>
                    <?php else: ?>
                        <li class="cpp-sidebar-no-clases">No hay clases creadas.</li>
                    <?php endif; ?>
                </ul>
            </nav>
            <div class="cpp-sidebar-footer">
                <button class="cpp-btn cpp-btn-primary cpp-sidebar-add-clase-btn" id="cpp-btn-nueva-clase-sidebar">
                    <span class="dashicons dashicons-plus"></span> Nueva Clase
                </button>
            </div>
        </div>

        <div class="cpp-cuaderno-main-content-classroom" id="cpp-cuaderno-main-content">
            <div class="cpp-fixed-top-bar">
                <div class="cpp-top-bar-left">
                    <button class="cpp-btn-icon cpp-top-bar-menu-btn" id="cpp-a1-menu-btn-toggle" title="Menú de clases">
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
                    </button>
                    <span id="cpp-cuaderno-nombre-clase-activa-a1" class="cpp-top-bar-class-name"></span>
                </div>
                <div class="cpp-top-bar-center cpp-tabs-clase-specific">
                    <button class="cpp-main-tab-link active" data-tab="cuaderno">Cuaderno</button>
                    <button class="cpp-main-tab-link" data-tab="programacion">Programación</button>
                    <button class="cpp-main-tab-link" data-tab="configuracion">Configuración</button>
                </div>
                <div class="cpp-top-bar-right">
                    <div class="cpp-tabs-general">
                        <button class="cpp-main-tab-link" data-tab="semana">Semana</button>
                        <button class="cpp-main-tab-link" data-tab="horario">Horario</button>
                    </div>
                    <div class="cpp-user-menu-container">
                        <button class="cpp-user-menu-avatar-btn">
                            <img src="<?php echo esc_url(get_avatar_url($user_id)); ?>" alt="Avatar de usuario">
                        </button>
                        <div class="cpp-user-menu-dropdown">
                            <ul>
                                <li><a href="#">Mi Cuenta</a></li>
                                <li><a href="#">Ayuda</a></li>
                                <li><a href="#">Contacto</a></li>
                                <li><a href="<?php echo esc_url(wp_logout_url(get_permalink())); ?>">Cerrar Sesión</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            <div id="cpp-programador-app">
                <div class="cpp-main-tabs-content">
                    <div id="cpp-main-tab-cuaderno" class="cpp-main-tab-content active">
                        <div id="cpp-cuaderno-tabla-area">
                            <div id="cpp-cuaderno-contenido">
                                <?php if (empty($clases)): ?>
                                    <div class="cpp-welcome-screen" id="cpp-welcome-box">
                                        <h2 class="cpp-welcome-title">¡Bienvenido al Cuaderno de profe! 👋</h2>
                                        <p class="cpp-welcome-subtitle">Parece que este es tu primer viaje. ¿Listo para organizar tu universo de clases?</p>
                                        <div class="cpp-welcome-actions">
                                            <button class="cpp-btn cpp-btn-primary cpp-btn-lg" id="cpp-btn-crear-primera-clase">
                                                <span class="dashicons dashicons-plus"></span> Crear mi primera clase
                                            </button>
                                            <button class="cpp-btn cpp-btn-secondary cpp-btn-lg" id="cpp-btn-crear-clase-ejemplo">
                                                <span class="dashicons dashicons-admin-plugins"></span> Crear clase de ejemplo
                                            </button>
                                        </div>
                                    </div>
                                <?php else: ?>
                                    <div class="cpp-cuaderno-mensaje-vacio">
                                        <p class="cpp-cuaderno-cargando">Cargando clase...</p>
                                    </div>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                    <div id="cpp-main-tab-programacion" class="cpp-main-tab-content"></div>
                    <div id="cpp-main-tab-semana" class="cpp-main-tab-content"></div>
                    <div id="cpp-main-tab-horario" class="cpp-main-tab-content"></div>
                    <div id="cpp-main-tab-configuracion" class="cpp-main-tab-content">
                        <div class="cpp-config-container">
                            <div class="cpp-config-sidebar">
                                <a href="#" class="cpp-config-tab-link active" data-config-tab="clase">
                                    <span class="dashicons dashicons-admin-settings"></span>
                                    <span>Clase</span>
                                </a>
                                <a href="#" class="cpp-config-tab-link" data-config-tab="evaluaciones">
                                    <span class="dashicons dashicons-chart-bar"></span>
                                    <span>Evaluaciones</span>
                                </a>
                                <a href="#" class="cpp-config-tab-link" data-config-tab="calendario">
                                    <span class="dashicons dashicons-calendar-alt"></span>
                                    <span>Calendario</span>
                                </a>
                            </div>
                            <div class="cpp-config-content-area">
                                <div id="cpp-config-tab-clase" class="cpp-config-tab-content active">
                                    <form id="cpp-form-clase" novalidate>
                                        <input type="hidden" id="clase_id_editar" name="clase_id_editar" value="">
                                        <h2 id="cpp-config-clase-titulo">Configuración de la Clase</h2>

                                        <h3>Información General</h3>
                                        <div class="cpp-form-group">
                                            <label for="nombre_clase_config">Nombre de la clase (máx. 16 caracteres):</label>
                                            <input type="text" id="nombre_clase_config" name="nombre_clase" required maxlength="16">
                                        </div>
                                        <div class="cpp-form-group" id="cpp-opcion-clase-ejemplo-container" style="display: none;">
                                            <label style="font-weight:normal; display:flex; align-items: center; gap: 8px;">
                                                <input type="checkbox" id="rellenar_clase_ejemplo" name="rellenar_clase_ejemplo">
                                                Rellenar la clase con datos de ejemplo
                                            </label>
                                        </div>
                                        <div class="cpp-form-group">
                                            <label>Color de la clase:</label>
                                            <div class="cpp-color-swatches-container">
                                                <?php foreach ($milan_vivid_colors as $hex => $name): ?>
                                                    <span class="cpp-color-swatch <?php echo (strtoupper($hex) === strtoupper($default_class_color_hex)) ? 'selected' : ''; ?>" data-color="<?php echo esc_attr($hex); ?>" style="background-color: <?php echo esc_attr($hex); ?>;" title="<?php echo esc_attr($name); ?>"></span>
                                                <?php endforeach; ?>
                                            </div>
                                            <input type="hidden" id="color_clase_hidden_config" name="color_clase" value="<?php echo esc_attr($default_class_color_hex); ?>">
                                        </div>
                                        <div class="cpp-form-group">
                                            <label for="base_nota_final_clase_config">Base Nota Final (ej: 10, 100):</label>
                                            <input type="number" id="base_nota_final_clase_config" name="base_nota_final_clase" value="100" step="0.01" min="1" required>
                                            <small>La nota final de los alumnos se calculará sobre esta base.</small>
                                        </div>
                                        <div class="cpp-form-group">
                                            <label for="nota_aprobado_clase_config">Nota mínima para aprobar (ej: 5, 50):</label>
                                            <input type="number" id="nota_aprobado_clase_config" name="nota_aprobado_clase" value="50" step="0.01" min="0" required>
                                            <small>Los alumnos con una nota final inferior a esta se considerarán suspensos.</small>
                                        </div>

                                        <div class="cpp-config-actions">
                                            <button type="submit" class="cpp-btn cpp-btn-primary cpp-config-submit-btn" id="cpp-submit-clase-btn-config"><span class="dashicons dashicons-saved"></span> Guardar Clase</button>
                                            <button type="button" class="cpp-btn cpp-btn-danger" id="cpp-eliminar-clase-config-btn" style="display: none; margin-left: auto;"><span class="dashicons dashicons-trash"></span> Eliminar Clase</button>
                                        </div>
                                    </form>
                                </div>
                                <div id="cpp-config-tab-evaluaciones" class="cpp-config-tab-content">
                                    <div id="cpp-config-evaluaciones-container" class="cpp-config-section">
                                        <p>Cargando evaluaciones...</p>
                                    </div>
                                    <hr class="cpp-config-divider">
                                    <div id="cpp-config-ponderaciones-container" class="cpp-config-section">
                                        <p>Selecciona una evaluación para ver sus ponderaciones.</p>
                                    </div>
                                </div>
                                <div id="cpp-config-tab-calendario" class="cpp-config-tab-content">
                                    <h2>Configuración del Calendario</h2>
                                    <form id="cpp-config-form">
                                        <div class="cpp-form-section">
                                            <h3>Días lectivos</h3>
                                            <div id="cpp-working-days" class="cpp-form-group">
                                                <label><input type="checkbox" name="working_days" value="mon"> Lunes</label>
                                                <label><input type="checkbox" name="working_days" value="tue"> Martes</label>
                                                <label><input type="checkbox" name="working_days" value="wed"> Miércoles</label>
                                                <label><input type="checkbox" name="working_days" value="thu"> Jueves</label>
                                                <label><input type="checkbox" name="working_days" value="fri"> Viernes</label>
                                                <label><input type="checkbox" name="working_days" value="sat"> Sábado</label>
                                                <label><input type="checkbox" name="working_days" value="sun"> Domingo</label>
                                            </div>
                                        </div>
                                        <div class="cpp-form-section">
                                            <h3>Días festivos</h3>
                                            <div id="cpp-holidays-list" class="cpp-dynamic-list"></div>
                                            <div class="cpp-form-group">
                                                <input type="date" id="cpp-new-holiday-date">
                                                <button type="button" id="cpp-add-holiday-btn" class="cpp-btn cpp-btn-secondary">Añadir festivo</button>
                                            </div>
                                        </div>
                                        <div class="cpp-form-section">
                                            <h3>Periodos de vacaciones</h3>
                                            <div id="cpp-vacations-list" class="cpp-dynamic-list"></div>
                                            <div class="cpp-form-group">
                                                <label>Inicio: <input type="date" id="cpp-new-vacation-start"></label>
                                                <label>Fin: <input type="date" id="cpp-new-vacation-end"></label>
                                                <button type="button" id="cpp-add-vacation-btn" class="cpp-btn cpp-btn-secondary">Añadir vacaciones</button>
                                            </div>
                                        </div>
                                        <div class="cpp-config-actions">
                                            <button type="submit" class="cpp-btn cpp-btn-primary">Guardar Configuración</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
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
                <div id="cpp-copy-sesion-modal" class="cpp-modal" style="display:none;">
                    <div class="cpp-modal-content">
                        <span class="cpp-modal-close">&times;</span>
                        <h2 id="cpp-copy-sesion-modal-title">Copiar Sesiones</h2>
                        <form id="cpp-copy-sesion-form">
                            <div class="cpp-form-group">
                                <label for="cpp-copy-dest-clase">Copiar a la clase:</label>
                                <select id="cpp-copy-dest-clase" name="dest_clase" required></select>
                            </div>
                            <div class="cpp-form-group">
                                <label for="cpp-copy-dest-evaluacion">En la evaluación:</label>
                                <select id="cpp-copy-dest-evaluacion" name="dest_evaluacion" required></select>
                            </div>
                            <div class="cpp-modal-actions">
                                <button type="submit" class="cpp-btn cpp-btn-primary">Copiar Sesiones</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="cpp-sidebar-overlay" id="cpp-sidebar-overlay"></div>

        <?php
        // --- INICIO DE LA SECCIÓN DE MODALES ---

        // Modal para la paleta de símbolos
        if (empty(did_action('cpp_modal_symbol_palette_outputted'))) {
            ?>
            <div class="cpp-modal" id="cpp-modal-symbol-palette">
                <div class="cpp-modal-content">
                    <span class="cpp-modal-close">&times;</span>
                    <h2>Paleta de Símbolos</h2>
                    <p>Haz clic en un símbolo para insertarlo en la celda activa. Edita la leyenda para personalizar su significado.</p>
                    <div id="cpp-symbol-palette-container">
                        <div id="cpp-symbol-grid">
                            <!-- Los símbolos se generarán aquí por JS -->
                        </div>
                        <div id="cpp-symbol-legend">
                            <h3>Leyenda</h3>
                            <div id="cpp-symbol-legend-inputs">
                                <!-- Las entradas para la leyenda se generarán aquí por JS -->
                            </div>
                        </div>
                    </div>
                    <div class="cpp-modal-actions">
                        <button type="button" class="cpp-btn cpp-btn-primary" id="cpp-save-symbol-legend-btn">Guardar Leyenda</button>
                    </div>
                </div>
            </div>
            <?php
            do_action('cpp_modal_symbol_palette_outputted');
        }


        if (empty(did_action('cpp_modal_crear_clase_outputted'))) {
            ?>
            <div class="cpp-modal" id="cpp-modal-crear-clase">
                <div class="cpp-modal-content">
                    <span class="cpp-modal-close">&times;</span>
                    <h2 id="cpp-modal-crear-clase-titulo">Crear Nueva Clase</h2>
                    <form id="cpp-form-crear-clase" novalidate>
                        <div class="cpp-form-group">
                            <label for="nombre_clase_modal_crear">Nombre de la clase (máx. 16 caracteres):</label>
                            <input type="text" id="nombre_clase_modal_crear" name="nombre_clase" required maxlength="16">
                        </div>
                        <div class="cpp-form-group">
                            <label style="font-weight:normal; display:flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="rellenar_clase_ejemplo_modal_crear" name="rellenar_clase_ejemplo">
                                Rellenar la clase con datos de ejemplo
                            </label>
                        </div>
                        <div class="cpp-form-group">
                            <label>Color de la clase:</label>
                            <div class="cpp-color-swatches-container">
                                <?php foreach ($milan_vivid_colors as $hex => $name): ?>
                                    <span class="cpp-color-swatch <?php echo (strtoupper($hex) === strtoupper($default_class_color_hex)) ? 'selected' : ''; ?>" data-color="<?php echo esc_attr($hex); ?>" style="background-color: <?php echo esc_attr($hex); ?>;" title="<?php echo esc_attr($name); ?>"></span>
                                <?php endforeach; ?>
                            </div>
                            <input type="hidden" id="color_clase_hidden_modal_crear" name="color_clase" value="<?php echo esc_attr($default_class_color_hex); ?>">
                        </div>
                        <div class="cpp-form-group">
                            <label for="base_nota_final_clase_modal_crear">Base Nota Final (ej: 10, 100):</label>
                            <input type="number" id="base_nota_final_clase_modal_crear" name="base_nota_final_clase" value="100" step="0.01" min="1" required>
                            <small>La nota final de los alumnos se calculará sobre esta base.</small>
                        </div>
                        <div class="cpp-form-group">
                            <label for="nota_aprobado_clase_modal_crear">Nota mínima para aprobar (ej: 5, 50):</label>
                            <input type="number" id="nota_aprobado_clase_modal_crear" name="nota_aprobado_clase" value="50" step="0.01" min="0" required>
                            <small>Los alumnos con una nota final inferior a esta se considerarán suspensos.</small>
                        </div>
                        <div class="cpp-modal-actions">
                            <button type="submit" class="cpp-btn cpp-btn-primary"><span class="dashicons dashicons-saved"></span> Guardar Clase</button>
                        </div>
                    </form>
                </div>
            </div>
            <?php
            do_action('cpp_modal_crear_clase_outputted');
        }

        if (empty(did_action('cpp_modal_alumnos_outputted'))) {
            ?>
            <div class="cpp-modal" id="cpp-modal-alumnos"><div class="cpp-modal-content"><span class="cpp-modal-close">&times;</span><h2 id="cpp-modal-alumnos-title">Gestión de Alumnos</h2><div id="cpp-alumnos-container"></div></div></div>
            <?php
            do_action('cpp_modal_alumnos_outputted');
        }
        
        if (empty(did_action('cpp_modal_actividad_cuaderno_outputted'))) { 
            ?>
            <div class="cpp-modal" id="cpp-modal-actividad-evaluable-cuaderno">
                <div class="cpp-modal-content">
                    <span class="cpp-modal-close">&times;</span>
                    <h2 id="cpp-modal-actividad-titulo-cuaderno">Añadir Actividad Evaluable</h2>
                    <form id="cpp-form-actividad-evaluable-cuaderno" novalidate>
                        <input type="hidden" id="clase_id_actividad_cuaderno_form" name="clase_id_actividad" value="">
                        <input type="hidden" id="actividad_id_editar_cuaderno" name="actividad_id_editar" value="">
                        <input type="hidden" id="sesion_id_cuaderno" name="sesion_id" value="">
                        <div class="cpp-form-group"><label for="nombre_actividad_cuaderno_input">Nombre de la Actividad:</label><input type="text" id="nombre_actividad_cuaderno_input" name="nombre_actividad" required></div>
                        <div class="cpp-form-group"><label for="categoria_id_actividad_cuaderno_select">Categoría de Evaluación:</label><select id="categoria_id_actividad_cuaderno_select" name="categoria_id_actividad"><option value="">-- Selecciona una categoría --</option></select></div>
                        <div class="cpp-form-group"><label for="nota_maxima_actividad_cuaderno_input">Nota Máxima (ej. 10, 100):</label><input type="number" id="nota_maxima_actividad_cuaderno_input" name="nota_maxima_actividad" value="10.00" step="0.01" min="0.01" required></div>
                        <div class="cpp-form-group"><label for="fecha_actividad_cuaderno_input">Fecha (opcional):</label><input type="date" id="fecha_actividad_cuaderno_input" name="fecha_actividad"></div>
                        <div class="cpp-form-group"><label for="descripcion_actividad_cuaderno_textarea">Descripción (opcional):</label><textarea id="descripcion_actividad_cuaderno_textarea" name="descripcion_actividad" rows="3"></textarea></div>
                        
                        <div class="cpp-modal-actions" style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
                            <button type="button" class="cpp-btn cpp-btn-danger" id="cpp-eliminar-actividad-btn-modal" style="display: none; margin-right: auto;">
                                <span class="dashicons dashicons-trash"></span> Eliminar Actividad
                            </button>
                            <button type="submit" class="cpp-btn cpp-btn-primary" id="cpp-submit-actividad-btn-cuaderno-form">
                                <span class="dashicons dashicons-saved"></span> Guardar Actividad
                            </button>
                        </div>

                    </form>
                </div>
            </div>
            <?php
            do_action('cpp_modal_actividad_cuaderno_outputted');
        }

        if (empty(did_action('cpp_modal_excel_options_outputted'))) {
            ?>
            <div class="cpp-modal" id="cpp-modal-excel-options">
                <div class="cpp-modal-content">
                    <span class="cpp-modal-close">&times;</span>
                    <h2 id="cpp-modal-excel-options-titulo">Opciones de Descarga Excel</h2>
                    <div class="cpp-modal-excel-options-buttons" style="text-align: center;">
                        <p style="margin-bottom: 20px;">¿Qué datos deseas descargar en formato Excel?</p>
                        <button type="button" class="cpp-btn cpp-btn-primary" id="cpp-btn-download-excel-current-class" style="margin-right: 10px;"><span class="dashicons dashicons-download"></span> Solo esta Clase</button>
                        <button type="button" class="cpp-btn cpp-btn-secondary" id="cpp-btn-download-excel-all-classes"><span class="dashicons dashicons-archive"></span> Todo el Cuaderno</button>
                    </div>
                </div>
            </div>
            <?php
            do_action('cpp_modal_excel_options_outputted');
        }

        if (empty(did_action('cpp_modal_import_students_outputted'))) {
            ?>
            <div class="cpp-modal" id="cpp-modal-import-students">
                <div class="cpp-modal-content">
                    <span class="cpp-modal-close">&times;</span>
                    <h2 id="cpp-modal-import-students-titulo">Importar Alumnos desde Excel</h2>
                    <div id="cpp-import-step-1-upload">
                        <p>Sube un archivo Excel (.xlsx o .xls) con los datos de los alumnos. La primera fila debe contener las cabeceras "Nombre" y "Apellidos".</p>
                        <div class="cpp-form-group">
                            <label for="cpp-btn-download-student-template" style="display:block; margin-bottom:5px;">Descarga una plantilla de ejemplo:</label>
                            <button type="button" class="cpp-btn cpp-btn-info" id="cpp-btn-download-student-template"><span class="dashicons dashicons-media-spreadsheet"></span> Descargar Plantilla</button>
                        </div>
                        <hr style="margin: 20px 0;">
                        <div class="cpp-form-group">
                            <label for="student_excel_file_input">Selecciona el archivo Excel:</label>
                            <input type="file" id="student_excel_file_input" name="student_excel_file" accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
                            <small>Formatos permitidos: .xlsx, .xls</small>
                        </div>
                        <div id="cpp-upload-status-message" style="margin-top:10px; font-style: italic;"></div>
                        <button type="button" class="cpp-btn cpp-btn-primary" id="cpp-btn-upload-excel-file" disabled><span class="dashicons dashicons-upload"></span> Subir y Validar Archivo</button>
                    </div>
                    <div id="cpp-import-step-2-options" style="display:none; margin-top:20px;">
                        <h4>Archivo subido: <span id="cpp-uploaded-file-name-display"></span></h4>
                        <p>¿Cómo deseas importar los alumnos a la clase actual (<strong id="cpp-import-target-class-name"></strong>)?</p>
                        <div class="cpp-form-group">
                            <label style="font-weight:normal; margin-bottom: 5px;"><input type="radio" name="import_mode" value="add" checked> Añadir alumnos a la lista existente.</label><br>
                            <label style="font-weight:normal;"><input type="radio" name="import_mode" value="replace"> Reemplazar la lista actual de alumnos (¡borrará los alumnos y notas existentes!).</label>
                        </div>
                        <button type="button" class="cpp-btn cpp-btn-primary" id="cpp-btn-confirm-student-import"><span class="dashicons dashicons-database-import"></span> Confirmar Importación</button>
                        <button type="button" class="cpp-btn cpp-btn-secondary" id="cpp-btn-cancel-excel-import" style="margin-left:10px;">Cancelar</button>
                    </div>
                    <div id="cpp-import-results" style="display:none; margin-top:20px; padding:10px; border:1px solid #ccc; background-color:#f9f9f9;">
                        <h4>Resultados de la Importación:</h4>
                        <div id="cpp-import-results-message" style="margin-bottom:10px;"></div>
                        <ul id="cpp-import-errors-list" style="max-height: 150px; overflow-y: auto; margin-top:10px; padding-left:20px;"></ul>
                    </div>
                </div>
            </div>
            <?php
            do_action('cpp_modal_import_students_outputted');
        }
        
        if (empty(did_action('cpp_modal_asistencia_outputted'))) {
            ?>
            <div class="cpp-modal" id="cpp-modal-asistencia">
                <div class="cpp-modal-content">
                    <span class="cpp-modal-close">&times;</span>
                    <h2 id="cpp-modal-asistencia-titulo">Pasar Lista</h2>
                    <div class="cpp-modal-asistencia-controles" style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                        <div class="cpp-form-group" style="margin-bottom:0; flex-grow: 1; margin-right:10px;">
                            <label for="cpp-asistencia-fecha" style="margin-bottom:2px;">Fecha:</label>
                            <input type="date" id="cpp-asistencia-fecha" name="asistencia_fecha" style="padding: 6px 10px;">
                        </div>
                        <button type="button" class="cpp-btn cpp-btn-secondary" id="cpp-marcar-todos-presentes-btn" style="white-space: nowrap;">Marcar Todos Presentes</button>
                    </div>
                    <div id="cpp-asistencia-lista-alumnos-container" class="cpp-asistencia-lista-alumnos">
                        <p>Cargando alumnos...</p>
                    </div>
                    <div class="cpp-modal-actions">
                        <button type="button" class="cpp-btn cpp-btn-primary" id="cpp-guardar-asistencia-btn"><span class="dashicons dashicons-saved"></span> Guardar Asistencia</button>
                    </div>
                </div>
            </div>
            <?php
            do_action('cpp_modal_asistencia_outputted');
        }

        if (empty(did_action('cpp_modal_ficha_alumno_outputted'))) {
            ?>
            <div class="cpp-modal" id="cpp-modal-ficha-alumno">
                <div class="cpp-modal-content">
                    <span class="cpp-modal-close">&times;</span>
                    <div class="cpp-ficha-alumno-header">
                        <div id="cpp-ficha-alumno-avatar-container">
                            <img id="cpp-ficha-alumno-foto" src="" alt="Foto Alumno" style="display:none;">
                            <div id="cpp-ficha-alumno-avatar-inicial"></div>
                        </div>
                        <h2 id="cpp-ficha-display-nombre-completo" style="margin:0; font-size: 22px; font-weight: 500; flex-grow: 1; margin-left: 15px;">Ficha del Alumno</h2>
                        <button type="button" class="cpp-btn cpp-btn-icon cpp-edit-info-alumno-btn" title="Editar Información"><span class="dashicons dashicons-edit"></span></button>
                    </div>

                    <div id="cpp-ficha-alumno-main-content">
                        <!-- El contenido dinámico de dos columnas se insertará aquí por JS -->
                        <p class="cpp-cuaderno-cargando">Cargando datos...</p>
                    </div>

                    <form id="cpp-form-editar-alumno-ficha" style="display:none; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                        <input type="hidden" id="ficha_alumno_id_editar" name="alumno_id_editar">
                        <h3>Editar Información</h3>
                        <div class="cpp-form-group"><label for="ficha_nombre_alumno">Nombre:</label><input type="text" id="ficha_nombre_alumno" name="nombre_alumno" required></div>
                        <div class="cpp-form-group"><label for="ficha_apellidos_alumno">Apellidos:</label><input type="text" id="ficha_apellidos_alumno" name="apellidos_alumno" required></div>
                        <div class="cpp-form-group"><label for="ficha_foto_alumno">Cambiar Foto (opcional):</label><input type="file" id="ficha_foto_alumno" name="foto_alumno" accept="image/*"></div>
                        <div class="cpp-modal-actions">
                            <button type="submit" class="cpp-btn cpp-btn-primary"><span class="dashicons dashicons-saved"></span> Guardar Cambios</button>
                            <button type="button" class="cpp-btn cpp-btn-secondary cpp-cancel-edit-info-alumno-btn">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>
            <?php
            do_action('cpp_modal_ficha_alumno_outputted');
        }
        ?>

    </div> 
    <?php
    return ob_get_clean();
}