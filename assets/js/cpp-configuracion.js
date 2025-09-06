// assets/js/cpp-configuracion.js

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-configuracion.js no puede inicializarse.");
        return;
    }
    cpp.config = {
        currentClaseIdForConfig: null,

        init: function() {
            console.log("CPP Configuracion Module Initializing...");
            this.bindEvents();
        },

        resetForm: function() {
            const $configTab = $('#cpp-main-tab-configuracion');
            const $form = $configTab.find('#cpp-form-clase');

            if ($form.length) {
                $form.trigger('reset');
                $form.find('#clase_id_editar').val('');
                
                const $classSwatchesContainer = $configTab.find('.cpp-color-swatches-container:not(.cpp-category-color-swatches)');
                let defaultColor = '#2962FF'; 
                const firstSwatch = $classSwatchesContainer.find('.cpp-color-swatch:first');
                if (firstSwatch.length) {
                    defaultColor = firstSwatch.data('color') || defaultColor;
                }
                
                const $defaultClassColorSwatch = $classSwatchesContainer.find(`.cpp-color-swatch[data-color="${defaultColor.toUpperCase()}"]`);

                $classSwatchesContainer.find('.cpp-color-swatch').removeClass('selected');
                if ($defaultClassColorSwatch.length) {
                    $defaultClassColorSwatch.addClass('selected');
                    $('#color_clase_hidden_config').val($defaultClassColorSwatch.data('color'));
                } else if (firstSwatch.length) {
                    firstSwatch.addClass('selected');
                    $('#color_clase_hidden_config').val(firstSwatch.data('color'));
                }
                
                $form.find('#base_nota_final_clase_config').val('100.00');
                $form.find('#nota_aprobado_clase_config').val('50.00');
                $configTab.find('#cpp-config-clase-titulo').text('Crear Nueva Clase');
                $configTab.find('#cpp-submit-clase-btn-config').html('<span class="dashicons dashicons-saved"></span> Guardar Clase');
                $configTab.find('#cpp-eliminar-clase-config-btn').hide();
                
                $('#cpp-config-evaluaciones-container').html('<p>Abre una clase existente para gestionar sus evaluaciones.</p>');
                $('#cpp-config-ponderaciones-container').html('<p>Abre una clase existente para gestionar sus ponderaciones.</p>');
            }
            this.currentClaseIdForConfig = null;
        },

        showModalParaCrear: function(e) {
            if (e) e.preventDefault();
            const $modal = $('#cpp-modal-crear-clase');
            const $form = $modal.find('#cpp-form-crear-clase');

            $form.trigger('reset');
            // Reset color swatches
            const $swatches = $modal.find('.cpp-color-swatches-container .cpp-color-swatch');
            $swatches.removeClass('selected');
            const defaultColor = '#2962FF';
            $swatches.filter(`[data-color="${defaultColor.toUpperCase()}"]`).addClass('selected');
            $modal.find('#color_clase_hidden_modal_crear').val(defaultColor);

            $modal.fadeIn();
            $modal.find('#nombre_clase_modal_crear').focus();
        },

        guardarDesdeModal: function(eventForm) {
            eventForm.preventDefault();
            const self = this;
            const $form = $(eventForm.target);
            const $btn = $form.find('button[type="submit"]');
            const nombreClase = $form.find('[name="nombre_clase"]').val().trim();
            const baseNotaFinalClase = $form.find('[name="base_nota_final_clase"]').val().trim();
            const notaAprobadoClase = $form.find('[name="nota_aprobado_clase"]').val().trim();
            const colorClase = $form.find('[name="color_clase"]').val();
            const rellenarConEjemplo = $form.find('[name="rellenar_clase_ejemplo"]').is(':checked');

            if (nombreClase === '') { alert('El nombre de la clase es obligatorio.'); return; }
            if (nombreClase.length > 16) { alert('El nombre de la clase no puede exceder los 16 caracteres.'); return; }

            if (rellenarConEjemplo) {
                this.crearClaseEjemplo(eventForm, nombreClase, colorClase);
                return;
            }

            const baseNotaNumerica = parseFloat(baseNotaFinalClase.replace(',', '.'));
            if (baseNotaFinalClase === '' || isNaN(baseNotaNumerica) || baseNotaNumerica <= 0) {
                alert('Por favor, introduce un valor numérico positivo para la Base de Nota Final.'); return;
            }
            const notaAprobadoNumerica = parseFloat(notaAprobadoClase.replace(',', '.'));
            if (notaAprobadoClase === '' || isNaN(notaAprobadoNumerica) || notaAprobadoNumerica < 0) {
                alert('Por favor, introduce un valor numérico positivo para la Nota Mínima para Aprobar.'); return;
            }
            if (notaAprobadoNumerica >= baseNotaNumerica) {
                alert('La nota mínima para aprobar debe ser menor que la base de la nota final.');
                return;
            }

            const btnTextOriginal = $btn.html();
            $btn.prop('disabled', true).html(`<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...`);

            const ajaxData = {
                action: 'cpp_crear_clase', nonce: cppFrontendData.nonce,
                nombre_clase: nombreClase,
                color_clase: colorClase,
                base_nota_final_clase: baseNotaNumerica.toFixed(2),
                nota_aprobado_clase: notaAprobadoNumerica.toFixed(2)
            };

            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json', data: ajaxData,
                success: function(response) {
                    if (response.success) {
                        $('#cpp-modal-crear-clase').fadeOut();
                        self._handleSuccessfulClassCreation(response.data.clase);
                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'Error desconocido.'));
                    }
                },
                error: function() { alert('Error de conexión.'); },
                complete: function() { $btn.prop('disabled', false).html(btnTextOriginal); }
            });
        },

        showParaEditar: function(e, goToPonderaciones = false, claseIdFromParam = null) { 
            if (e && typeof e.preventDefault === 'function') {
                e.preventDefault(); e.stopPropagation();
            }
            let claseId = claseIdFromParam;
            if (!claseId && e && $(e.currentTarget).data('clase-id')) { 
                claseId = $(e.currentTarget).data('clase-id');
            }
            if (!claseId && cpp.currentClaseIdCuaderno) { 
                claseId = cpp.currentClaseIdCuaderno;
            }
            
            if (!claseId) { alert('Error: No se pudo identificar la clase para editar.'); return; }
            
            $('.cpp-main-tab-link[data-tab="configuracion"]').trigger('click');

            if (cpp.sidebar && cpp.sidebar.isSidebarVisible) {
                cpp.sidebar.toggle();
            }

            const $configTab = $('#cpp-main-tab-configuracion');
            const $form = $configTab.find('#cpp-form-clase');
            
            this.resetForm();
            this.currentClaseIdForConfig = claseId;

            $('#cpp-opcion-clase-ejemplo-container').hide();

            const self = this;

            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                data: { action: 'cpp_obtener_datos_clase_completa', nonce: cppFrontendData.nonce, clase_id: claseId },
                success: (response) => {
                    if (response.success && response.data.clase) {
                        const clase = response.data.clase;
                        if (!$configTab.length || !$form.length) { return; }
                        
                        $form.find('#clase_id_editar').val(clase.id);
                        $form.find('#nombre_clase_config').val(clase.nombre);
                        
                        const $classSwatchesContainer = $configTab.find('.cpp-color-swatches-container:not(.cpp-category-color-swatches)');
                        let colorParaSeleccionar = clase.color || $classSwatchesContainer.find('.cpp-color-swatch:first').data('color') || '#2962FF';
                        
                        $('#color_clase_hidden_config').val(colorParaSeleccionar);
                        $classSwatchesContainer.find('.cpp-color-swatch').removeClass('selected');
                        $classSwatchesContainer.find(`.cpp-color-swatch[data-color="${colorParaSeleccionar.toUpperCase()}"]`).addClass('selected');

                        $form.find('#base_nota_final_clase_config').val(clase.base_nota_final ? parseFloat(clase.base_nota_final).toFixed(2) : '100.00');
                        $form.find('#nota_aprobado_clase_config').val(clase.nota_aprobado ? parseFloat(clase.nota_aprobado).toFixed(2) : '50.00');
                        $configTab.find('#cpp-config-clase-titulo').text(`Editar Clase: ${clase.nombre}`);
                        $configTab.find('#cpp-submit-clase-btn-config').html('<span class="dashicons dashicons-edit"></span> Actualizar Clase');
                        
                        $('#cpp-eliminar-clase-config-btn').show();
                        
                        this.handleConfigTabClick(null, 'clase');
                        $form.find('#nombre_clase_config').focus();

                        // Cargar datos en las otras pestañas
                        self.refreshEvaluacionesList(clase.id, clase.evaluaciones);
                        self.loadPonderacionesTab(clase.id, clase.evaluaciones);

                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudieron cargar datos.'));
                        this.resetForm();
                    }
                },
                error: () => {
                    alert('Error de conexión al obtener datos.');
                    this.resetForm();
                }
            });
        },
        
        _handleSuccessfulClassCreation: function(claseData) {
            const $sidebarList = $('#cpp-cuaderno-sidebar .cpp-sidebar-clases-list');
            const newClassHtml = `
                <li class="cpp-sidebar-clase-item"
                    data-clase-id="${claseData.id}"
                    data-clase-nombre="${claseData.nombre}"
                    data-base-nota-final="${claseData.base_nota_final}">
                    <a href="#">
                        <span class="cpp-sidebar-clase-icon dashicons dashicons-groups" style="color: ${claseData.color};"></span>
                        <span class="cpp-sidebar-clase-nombre-texto">${claseData.nombre}</span>
                    </a>
                    <div class="cpp-sidebar-item-actions">
                        <button class="cpp-sidebar-clase-alumnos-btn" data-clase-id="${claseData.id}" data-clase-nombre="${claseData.nombre}" title="Gestionar Alumnos de ${claseData.nombre}">
                            <span class="dashicons dashicons-admin-users"></span>
                        </button>
                        <button class="cpp-sidebar-clase-settings-btn" data-clase-id="${claseData.id}" data-clase-nombre="${claseData.nombre}" title="Configurar Clase: ${claseData.nombre}">
                            <span class="dashicons dashicons-admin-generic"></span>
                        </button>
                    </div>
                </li>`;

            if ($sidebarList.find('.cpp-sidebar-no-clases').length) {
                $sidebarList.html(newClassHtml);
            } else {
                $sidebarList.append(newClassHtml);
            }

            $('#cpp-welcome-box').hide();

            // Cambiar a la pestaña de cuaderno y seleccionar la nueva clase
            $('.cpp-main-tab-link[data-tab="cuaderno"]').trigger('click');
            $sidebarList.find(`li[data-clase-id="${claseData.id}"] a`).first().trigger('click');
        },

        guardar: function(eventForm) { 
            eventForm.preventDefault(); 
            const self = this;
            const $form = $(eventForm.target); 
            const $btn = $form.find('button[type="submit"]');
            const claseIdEditar = $form.find('#clase_id_editar').val();
            const esEdicion = claseIdEditar && claseIdEditar !== '';
            const nombreClase = $form.find('[name="nombre_clase"]').val().trim();
            const baseNotaFinalClase = $form.find('[name="base_nota_final_clase"]').val().trim();
            const notaAprobadoClase = $form.find('[name="nota_aprobado_clase"]').val().trim();
            const colorClase = $form.find('#color_clase_hidden_config').val();
            const rellenarConEjemplo = $('#rellenar_clase_ejemplo').is(':checked');

            if (nombreClase === '') { alert('El nombre de la clase es obligatorio.'); return; }
            if (nombreClase.length > 16) { alert('El nombre de la clase no puede exceder los 16 caracteres.'); return; }

            if (!esEdicion && rellenarConEjemplo) {
                this.crearClaseEjemplo(eventForm, nombreClase, colorClase);
                return;
            }

            const baseNotaNumerica = parseFloat(baseNotaFinalClase.replace(',', '.'));
            if (baseNotaFinalClase === '' || isNaN(baseNotaNumerica) || baseNotaNumerica <= 0) {
                alert('Por favor, introduce un valor numérico positivo para la Base de Nota Final.'); return;
            }

            const notaAprobadoNumerica = parseFloat(notaAprobadoClase.replace(',', '.'));
            if (notaAprobadoClase === '' || isNaN(notaAprobadoNumerica) || notaAprobadoNumerica < 0) {
                alert('Por favor, introduce un valor numérico positivo para la Nota Mínima para Aprobar.'); return;
            }

            if (notaAprobadoNumerica >= baseNotaNumerica) {
                alert('La nota mínima para aprobar debe ser menor que la base de la nota final.');
                return;
            }

            const btnTextProcesando = esEdicion ? 'Actualizando...' : 'Guardando...';
            const btnTextOriginal = esEdicion ? '<span class="dashicons dashicons-edit"></span> Actualizar Clase' : '<span class="dashicons dashicons-saved"></span> Guardar Clase';
            $btn.prop('disabled', true).html(`<span class="dashicons dashicons-update dashicons-spin"></span> ${btnTextProcesando}`);

            const ajaxData = {
                action: 'cpp_crear_clase', nonce: cppFrontendData.nonce,
                clase_id_editar: claseIdEditar, nombre_clase: nombreClase,
                color_clase: colorClase, base_nota_final_clase: baseNotaNumerica.toFixed(2),
                nota_aprobado_clase: notaAprobadoNumerica.toFixed(2)
            };

            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json', data: ajaxData,
                success: function(response) {
                    if (response.success) {
                        if (esEdicion) {
                            window.location.reload();
                        } else {
                            self._handleSuccessfulClassCreation(response.data.clase);
                        }
                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'Error desconocido.'));
                    }
                },
                error: function() {
                    alert('Error de conexión.');
                },
                complete: function() { $btn.prop('disabled', false).html(btnTextOriginal); }
            });
        },
        
        eliminarDesdeConfig: function(eventButton) {
            eventButton.preventDefault();
            const $btnEliminar = $(eventButton.currentTarget);
            const claseId = $('#cpp-form-clase #clase_id_editar').val();
            const claseNombre = $('#cpp-form-clase #nombre_clase_config').val().trim() || 'esta clase';
            if (!claseId) { alert('Error: No se pudo identificar la clase para eliminar.'); return; }
            if (confirm(`¿Estás SEGURO de que quieres eliminar la clase "${claseNombre}"?\n\nATENCIÓN: Esta acción es permanente y no se puede deshacer.`)) {
                const originalBtnHtml = $btnEliminar.html();
                $btnEliminar.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Eliminando...');
                $('#cpp-submit-clase-btn-config').prop('disabled', true);
                $.ajax({
                    url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                    data: { action: 'cpp_eliminar_clase', nonce: cppFrontendData.nonce, clase_id: claseId },
                    success: function(response) {
                        if (response.success) {
                            window.location.reload();
                        } else {
                            alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo eliminar.'));
                            $btnEliminar.prop('disabled', false).html(originalBtnHtml);
                            $('#cpp-submit-clase-btn-config').prop('disabled', false);
                        }
                    },
                    error: function() {
                        alert('Error de conexión al eliminar.');
                        $btnEliminar.prop('disabled', false).html(originalBtnHtml);
                        $('#cpp-submit-clase-btn-config').prop('disabled', false);
                    }
                });
            }
        },

        crearClaseEjemplo: function(event, nombreClase, colorClase) {
            event.preventDefault();
            const self = this;
            const $btn = $(event.currentTarget).is('form') ? $(event.currentTarget).find('button[type="submit"]') : $(event.currentTarget);
            const originalBtnHtml = $btn.html();
            $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Creando...');

            const ajaxData = {
                action: 'cpp_crear_clase_ejemplo',
                nonce: cppFrontendData.nonce,
                nombre_clase: nombreClase,
                color_clase: colorClase
            };

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: ajaxData,
                success: function(response) {
                    if (response.success) {
                        self._handleSuccessfulClassCreation(response.data.clase);
                    } else {
                        alert('Error: ' + (response.data.message || 'No se pudo crear la clase de ejemplo.'));
                    }
                },
                error: function() {
                    alert('Error de conexión al crear la clase de ejemplo.');
                },
                complete: function() {
                    $btn.prop('disabled', false).html(originalBtnHtml);
                }
            });
        },

        handleConfigTabClick: function(event, targetTabId = null) {
            if (event) event.preventDefault();
            const $clickedLink = event ? $(event.currentTarget) : null;
            const tabId = targetTabId || ($clickedLink ? $clickedLink.data('config-tab') : 'clase');
            
            $('.cpp-config-tab-link').removeClass('active');
            $('.cpp-config-tab-content').removeClass('active');

            $(`.cpp-config-tab-link[data-config-tab="${tabId}"]`).addClass('active');
            $(`#cpp-config-tab-${tabId}`).addClass('active');
        },


        loadPonderacionesTab: function(claseId, evaluaciones) {
            const $container = $('#cpp-config-ponderaciones-container');
            if (evaluaciones && evaluaciones.length > 0) {
                let contentHtml = '<h4>Selecciona una evaluación para gestionar sus ponderaciones</h4>';
                contentHtml += '<div class="cpp-form-group"><select id="cpp-ponderaciones-eval-selector" class="cpp-evaluacion-selector">';
                contentHtml += '<option value="">-- Selecciona --</option>';
                evaluaciones.forEach(function(evaluacion) {
                    contentHtml += `<option value="${evaluacion.id}">${$('<div>').text(evaluacion.nombre_evaluacion).html()}</option>`;
                });
                contentHtml += '</select></div><hr>';
                contentHtml += '<div id="cpp-ponderaciones-settings-content"></div>';
                $container.html(contentHtml);
            } else {
                $container.html('<p>No hay evaluaciones creadas para esta clase. Añade una en la sección de arriba.</p>');
            }
        },
        
        refreshEvaluacionesList: function(claseId, evaluaciones) {
            this.renderEvaluacionesList(evaluaciones, claseId);
        },

        renderEvaluacionesList: function(evaluaciones, claseId) {
            const $container = $('#cpp-config-evaluaciones-container');
            let html = '<h4>Gestionar Evaluaciones</h4>';
            html += '<p><small>Arrastra las evaluaciones para reordenarlas.</small></p>';
            html += '<ul class="cpp-evaluaciones-list">';

            if (evaluaciones && evaluaciones.length > 0) {
                evaluaciones.forEach(function(evaluacion) {
                    html += `<li data-evaluacion-id="${evaluacion.id}">
                                <span class="cpp-drag-handle dashicons dashicons-menu"></span>
                                <span class="cpp-evaluacion-nombre">${$('<div>').text(evaluacion.nombre_evaluacion).html()}</span>
                                <div class="cpp-evaluacion-actions">
                                    <button type="button" class="cpp-btn cpp-btn-icon cpp-btn-editar-evaluacion" title="Renombrar"><span class="dashicons dashicons-edit"></span></button>
                                    <button type="button" class="cpp-btn cpp-btn-icon cpp-btn-eliminar-evaluacion" title="Eliminar"><span class="dashicons dashicons-trash"></span></button>
                                </div>
                             </li>`;
                });
            } else {
                html += '<li class="cpp-no-evaluaciones">No hay evaluaciones creadas.</li>';
            }
            html += '</ul>';

            html += `<div class="cpp-form-add-evaluacion">
                        <input type="text" id="cpp-nombre-nueva-evaluacion" placeholder="Nombre de la nueva evaluación" style="flex-grow:1;">`;

            if (evaluaciones && evaluaciones.length > 0) {
                html += `<div class="cpp-form-group" style="margin-bottom:0; flex-basis: 200px;">
                            <select id="cpp-copy-from-eval-select">
                                <option value="0">No copiar ponderaciones</option>`;
                evaluaciones.forEach(function(evaluacion_origen) {
                    html += `<option value="${evaluacion_origen.id}">Copiar de: ${$('<div>').text(evaluacion_origen.nombre_evaluacion).html()}</option>`;
                });
                html += `</select>
                         </div>`;
            }

            html += `<button type="button" id="cpp-btn-add-evaluacion" class="cpp-btn cpp-btn-primary" data-clase-id="${claseId}">Añadir</button>
                     </div>`;

            $container.html(html);

            $container.find('.cpp-evaluaciones-list').sortable({
                handle: '.cpp-drag-handle', axis: 'y', placeholder: 'cpp-sortable-placeholder',
                update: function(event, ui) {
                    const orderedIds = $(this).find('li').map(function() { return $(this).data('evaluacion-id'); }).get();
                    $.ajax({
                        url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                        data: { action: 'cpp_guardar_orden_evaluaciones', nonce: cppFrontendData.nonce, orden_evaluaciones: orderedIds }
                    });
                }
            });
        },

        bindEvents: function() {
            const $mainContent = $('#cpp-cuaderno-main-content');
            const $body = $('body');

            // --- Eventos de la Pestaña de Configuración ---
            $mainContent.on('click', '.cpp-config-tab-link', (e) => { this.handleConfigTabClick(e); });
            $mainContent.on('click', '#cpp-config-tab-evaluaciones .cpp-tab-link', (e) => { this.handleInnerTabClick(e); });

            // Guardar/Eliminar desde la pestaña de configuración
            $mainContent.on('submit', '#cpp-form-clase', (e) => { this.guardar(e); });
            $mainContent.on('click', '#cpp-eliminar-clase-config-btn', (e) => { this.eliminarDesdeConfig(e); });

            // --- Eventos del Modal de Crear Clase ---
            $body.on('submit', '#cpp-form-crear-clase', (e) => { this.guardarDesdeModal(e); });
            $body.on('click', '#cpp-modal-crear-clase .cpp-color-swatch', function() {
                const $swatch = $(this);
                $swatch.closest('.cpp-color-swatches-container').find('.cpp-color-swatch').removeClass('selected');
                $swatch.addClass('selected');
                $swatch.closest('.cpp-form-group').find('input[type="hidden"]').val($swatch.data('color'));
            });
            $body.on('click', '#cpp-btn-crear-clase-ejemplo', (e) => { this.crearClaseEjemplo(e, 'Clase de Ejemplo', '#cd18be'); });

            // --- Eventos Comunes de Evaluaciones / Ponderaciones (dentro de la pestaña de config) ---
            $mainContent.on('change', '#cpp-ponderaciones-eval-selector', (e) => {
                const evaluacionId = $(e.currentTarget).val();
                const $settingsContainer = $('#cpp-ponderaciones-settings-content');
                if (evaluacionId) {
                    $settingsContainer.html('<p class="cpp-cuaderno-cargando">Cargando...</p>');
                    if (cpp.modals.evaluacion && typeof cpp.modals.evaluacion.refreshCategoriasList === 'function') {
                        cpp.modals.evaluacion.refreshCategoriasList(evaluacionId, '#cpp-ponderaciones-settings-content');
                    }
                } else {
                    $settingsContainer.empty();
                }
            });

            $('body').on('click', '#cpp-btn-crear-clase-ejemplo', (e) => { this.crearClaseEjemplo(e, 'Clase de Ejemplo', '#cd18be'); });

            const evaluacionContainerSelector = '#cpp-config-evaluaciones-container';

            $mainContent.on('click', `${evaluacionContainerSelector} #cpp-btn-add-evaluacion`, (e) => {
                const $button = $(e.currentTarget);
                const $input = $('#cpp-nombre-nueva-evaluacion');
                const nombre = $input.val().trim();
                const claseId = $button.data('clase-id') || this.currentClaseIdForConfig;
                const sourceEvalId = $('#cpp-copy-from-eval-select').val() || '0';

                if (!nombre) { alert('El nombre de la evaluación no puede estar vacío.'); $input.focus(); return; }
                if (!claseId) { alert('Error: no se ha podido identificar la clase.'); return; }

                $.ajax({
                    url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                    data: { 
                        action: 'cpp_crear_evaluacion', 
                        nonce: cppFrontendData.nonce, 
                        clase_id: claseId, 
                        nombre_evaluacion: nombre,
                        source_eval_id: sourceEvalId
                    },
                    success: (response) => {
                        if(response.success) {
                            this.refreshEvaluacionesList(claseId);
                            this.loadPonderacionesTab(claseId); // Recargar también las ponderaciones
                        } else {
                            alert('Error: ' + (response.data.message || 'No se pudo crear la evaluación.'));
                        }
                    }
                });
            });

            $mainContent.on('click', `${evaluacionContainerSelector} .cpp-btn-eliminar-evaluacion`, (e) => {
                e.preventDefault();
                const $li = $(e.currentTarget).closest('li');
                const evaluacionId = $li.data('evaluacion-id');
                const evaluacionNombre = $li.find('.cpp-evaluacion-nombre').text();
                const claseId = this.currentClaseIdForConfig;
                if (confirm(`¿Estás SEGURO de que quieres eliminar la evaluación "${evaluacionNombre}"?\n\n¡Se borrarán TODAS las actividades y notas asociadas a ella!`)) {
                    $.ajax({
                        url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                        data: { action: 'cpp_eliminar_evaluacion', nonce: cppFrontendData.nonce, evaluacion_id: evaluacionId },
                        success: (response) => {
                            if(response.success) {
                                this.refreshEvaluacionesList(claseId);
                                this.loadPonderacionesTab(claseId);
                            } else {
                                alert('Error: ' + (response.data.message || 'No se pudo eliminar la evaluación.'));
                            }
                        }
                    });
                }
            });
            
            $mainContent.on('click', `${evaluacionContainerSelector} .cpp-btn-editar-evaluacion`, (e) => {
                e.preventDefault();
                const $li = $(e.currentTarget).closest('li');
                $li.find('.cpp-evaluacion-nombre, .cpp-evaluacion-actions').hide();
                const currentName = $li.find('.cpp-evaluacion-nombre').text();
                const editHtml = `<div class="cpp-evaluacion-edit-form">
                                    <input type="text" value="${$('<div>').text(currentName).html()}">
                                    <button type="button" class="cpp-btn-icon cpp-btn-save-evaluacion" title="Guardar"><span class="dashicons dashicons-yes-alt"></span></button>
                                    <button type="button" class="cpp-btn-icon cpp-btn-cancel-edit-evaluacion" title="Cancelar"><span class="dashicons dashicons-no"></span></button>
                                  </div>`;
                $li.append(editHtml);
                $li.find('input[type="text"]').focus().select();
            });

            $mainContent.on('click', `${evaluacionContainerSelector} .cpp-btn-cancel-edit-evaluacion`, (e) => {
                e.preventDefault();
                const $li = $(e.currentTarget).closest('li');
                $li.find('.cpp-evaluacion-edit-form').remove();
                $li.find('.cpp-evaluacion-nombre, .cpp-evaluacion-actions').show();
            });

            $mainContent.on('click', `${evaluacionContainerSelector} .cpp-btn-save-evaluacion`, (e) => {
                e.preventDefault();
                const $li = $(e.currentTarget).closest('li');
                const evaluacionId = $li.data('evaluacion-id');
                const nuevoNombre = $li.find('input[type="text"]').val().trim();
                const claseId = this.currentClaseIdForConfig;
                if (!nuevoNombre) { alert('El nombre no puede estar vacío.'); return; }
                
                $.ajax({
                    url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                    data: { action: 'cpp_actualizar_evaluacion', nonce: cppFrontendData.nonce, evaluacion_id: evaluacionId, nombre_evaluacion: nuevoNombre },
                    success: (response) => {
                        if(response.success) {
                            this.refreshEvaluacionesList(claseId);
                            this.loadPonderacionesTab(claseId);
                        } else {
                            alert('Error: ' + (response.data.message || 'No se pudo actualizar.'));
                        }
                    }
                });
            });

        }
    };

})(jQuery);