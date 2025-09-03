// assets/js/cpp-modales-clase.js (v1.5.2 - FINAL)

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-modales-clase.js no puede inicializarse.");
        return;
    }
    cpp.modals = cpp.modals || {};

    cpp.modals.clase = {
        currentClaseIdForModal: null,

        init: function() {
            console.log("CPP Modals Clase Module Initializing...");
        },

        resetForm: function() {
            const $modal = $('#cpp-modal-clase');
            const $form = $modal.find('#cpp-form-clase');

            if ($form.length) {
                $form.trigger('reset');
                $form.find('#clase_id_editar').val('');
                
                const $classSwatchesContainer = $modal.find('.cpp-color-swatches-container:not(.cpp-category-color-swatches)');
                let defaultColor = '#2962FF'; 
                const firstSwatch = $classSwatchesContainer.find('.cpp-color-swatch:first');
                if (firstSwatch.length) {
                    defaultColor = firstSwatch.data('color') || defaultColor;
                }
                
                const $defaultClassColorSwatch = $classSwatchesContainer.find(`.cpp-color-swatch[data-color="${defaultColor.toUpperCase()}"]`);

                $classSwatchesContainer.find('.cpp-color-swatch').removeClass('selected');
                if ($defaultClassColorSwatch.length) {
                    $defaultClassColorSwatch.addClass('selected');
                    $('#color_clase_hidden_modal').val($defaultClassColorSwatch.data('color'));
                } else if (firstSwatch.length) {
                    firstSwatch.addClass('selected');
                    $('#color_clase_hidden_modal').val(firstSwatch.data('color'));
                }
                
                $form.find('#base_nota_final_clase_modal').val('100.00');
                $form.find('#nota_aprobado_clase_modal').val('50.00');
                $modal.find('#cpp-modal-clase-titulo').text('Crear Nueva Clase');
                $modal.find('#cpp-submit-clase-btn-modal').html('<span class="dashicons dashicons-saved"></span> Guardar Clase');
                $modal.find('#cpp-eliminar-clase-modal-btn').hide();
                
                $modal.find('.cpp-tab-nav').show(); 
                $modal.find('.cpp-tab-link').removeClass('active').show();
                $modal.find('.cpp-tab-content').removeClass('active').hide();
                $modal.find('.cpp-tab-link[data-tab="cpp-tab-general"]').addClass('active');
                $modal.find('#cpp-tab-general').addClass('active').show();
                
                $('#cpp-clase-modal-evaluaciones-container').html('<p>Abre una clase existente para gestionar sus evaluaciones.</p>');
                $('#cpp-clase-modal-ponderaciones-container').html('<p>Abre una clase existente para gestionar sus ponderaciones.</p>');
            }
            this.currentClaseIdForModal = null;
        },

        showParaCrear: function(e) {
            if (e) e.preventDefault();
            
            const $modal = $('#cpp-modal-clase');
            this.resetForm(); 

            $('#cpp-modal-clase-titulo').text('Crear Nueva Clase');
            $('#cpp-submit-clase-btn-modal').html('<span class="dashicons dashicons-saved"></span> Guardar Clase');
            $('#cpp-eliminar-clase-modal-btn').hide();
            
            $modal.find('.cpp-tab-link[data-tab="cpp-tab-evaluaciones"]').hide();
            $modal.find('.cpp-tab-link[data-tab="cpp-tab-ponderaciones"]').hide();

            $('#cpp-opcion-clase-ejemplo-container').show();
            $('#rellenar_clase_ejemplo').prop('checked', false);
            
            $modal.fadeIn().find('#nombre_clase_modal').focus();
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
            
            const $modal = $('#cpp-modal-clase');
            const $form = $modal.find('#cpp-form-clase');
            
            this.resetForm();
            this.currentClaseIdForModal = claseId; 

            $('#cpp-opcion-clase-ejemplo-container').hide();

            $modal.find('.cpp-tab-link').show();

            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                data: { action: 'cpp_obtener_datos_clase_completa', nonce: cppFrontendData.nonce, clase_id: claseId },
                success: (response) => {
                    if (response.success && response.data.clase) {
                        const clase = response.data.clase;
                        if (!$modal.length || !$form.length) { return; }
                        
                        $form.find('#clase_id_editar').val(clase.id);
                        $form.find('#nombre_clase_modal').val(clase.nombre);
                        
                        const $classSwatchesContainer = $modal.find('.cpp-color-swatches-container:not(.cpp-category-color-swatches)');
                        let colorParaSeleccionar = clase.color || $classSwatchesContainer.find('.cpp-color-swatch:first').data('color') || '#2962FF';
                        
                        $('#color_clase_hidden_modal').val(colorParaSeleccionar);
                        $classSwatchesContainer.find('.cpp-color-swatch').removeClass('selected');
                        $classSwatchesContainer.find(`.cpp-color-swatch[data-color="${colorParaSeleccionar.toUpperCase()}"]`).addClass('selected');

                        $form.find('#base_nota_final_clase_modal').val(clase.base_nota_final ? parseFloat(clase.base_nota_final).toFixed(2) : '100.00');
                        $form.find('#nota_aprobado_clase_modal').val(clase.nota_aprobado ? parseFloat(clase.nota_aprobado).toFixed(2) : '50.00');
                        $modal.find('#cpp-modal-clase-titulo').text(`Editar Clase: ${clase.nombre}`);
                        $modal.find('#cpp-submit-clase-btn-modal').html('<span class="dashicons dashicons-edit"></span> Actualizar Clase');
                        
                        $('#cpp-eliminar-clase-modal-btn').show();
                        
                        this.handleTabClick(null, 'cpp-tab-general', $modal);
                        
                        $modal.fadeIn();
                        $form.find('#nombre_clase_modal').focus();
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

            $('#cpp-modal-clase').fadeOut();

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
            const colorClase = $form.find('#color_clase_hidden_modal').val();
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
        
        eliminarDesdeModal: function(eventButton) { 
            eventButton.preventDefault();
            const $btnEliminar = $(eventButton.currentTarget);
            const claseId = $('#cpp-form-clase #clase_id_editar').val();
            const claseNombre = $('#cpp-form-clase #nombre_clase_modal').val().trim() || 'esta clase';
            if (!claseId) { alert('Error: No se pudo identificar la clase para eliminar.'); return; }
            if (confirm(`¿Estás SEGURO de que quieres eliminar la clase "${claseNombre}"?\n\nATENCIÓN: Esta acción es permanente y no se puede deshacer.`)) {
                const originalBtnHtml = $btnEliminar.html();
                $btnEliminar.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Eliminando...');
                $('#cpp-submit-clase-btn-modal').prop('disabled', true); 
                $.ajax({
                    url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                    data: { action: 'cpp_eliminar_clase', nonce: cppFrontendData.nonce, clase_id: claseId },
                    success: function(response) {
                        if (response.success) {
                            window.location.reload();
                        } else {
                            alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo eliminar.'));
                            $btnEliminar.prop('disabled', false).html(originalBtnHtml);
                            $('#cpp-submit-clase-btn-modal').prop('disabled', false);
                        }
                    },
                    error: function() {
                        alert('Error de conexión al eliminar.');
                        $btnEliminar.prop('disabled', false).html(originalBtnHtml);
                        $('#cpp-submit-clase-btn-modal').prop('disabled', false);
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

        handleTabClick: function(event, targetTabId = null, modalContext = null) { 
            if (event) event.preventDefault();
            const $clickedLink = event ? $(event.currentTarget).closest('.cpp-tab-link') : null;
            const $modal = modalContext || ($clickedLink ? $clickedLink.closest('.cpp-modal') : $('#cpp-modal-clase'));
            const tabId = targetTabId || ($clickedLink ? $clickedLink.data('tab') : 'cpp-tab-general');
            const $targetLink = $modal.find(`.cpp-tab-link[data-tab="${tabId}"]`);
            
            $modal.find('.cpp-tab-content').removeClass('active').hide();
            $modal.find('.cpp-tab-nav .cpp-tab-link').removeClass('active');
            
            $modal.find('#' + tabId).addClass('active').show();
            $targetLink.addClass('active');
            
            const claseIdActualEnModal = this.currentClaseIdForModal || $modal.find('#clase_id_editar').val();

            if (tabId === 'cpp-tab-evaluaciones') {
                if (claseIdActualEnModal && claseIdActualEnModal !== '0') {
                    this.refreshEvaluacionesList(claseIdActualEnModal);
                } else {
                     $('#cpp-clase-modal-evaluaciones-container').html('<p>Guarda la información general de la clase primero para añadir evaluaciones.</p>');
                }
            } else if (tabId === 'cpp-tab-ponderaciones') {
                if (claseIdActualEnModal && claseIdActualEnModal !== '0') {
                    this.loadPonderacionesTab(claseIdActualEnModal);
                } else {
                    $('#cpp-clase-modal-ponderaciones-container').html('<p>Guarda la información general de la clase primero para gestionar las ponderaciones.</p>');
                }
            }
        },

        loadPonderacionesTab: function(claseId) {
            const $container = $('#cpp-clase-modal-ponderaciones-container');
            $container.html('<p class="cpp-cuaderno-cargando">Cargando evaluaciones...</p>');

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: { action: 'cpp_obtener_evaluaciones', nonce: cppFrontendData.nonce, clase_id: claseId },
                success: function(response) {
                    if (response.success && response.data.evaluaciones && response.data.evaluaciones.length > 0) {
                        let contentHtml = '<h4>Selecciona una evaluación para gestionar sus ponderaciones</h4>';
                        contentHtml += '<div class="cpp-form-group"><select id="cpp-ponderaciones-eval-selector" class="cpp-evaluacion-selector">';
                        contentHtml += '<option value="">-- Selecciona --</option>';
                        response.data.evaluaciones.forEach(function(evaluacion) {
                            contentHtml += `<option value="${evaluacion.id}">${$('<div>').text(evaluacion.nombre_evaluacion).html()}</option>`;
                        });
                        contentHtml += '</select></div><hr>';
                        contentHtml += '<div id="cpp-ponderaciones-settings-content"></div>';
                        $container.html(contentHtml);
                    } else {
                        $container.html('<p>No hay evaluaciones creadas para esta clase. Añade una en la pestaña "Evaluaciones".</p>');
                    }
                },
                error: function() {
                    $container.html('<p class="cpp-error-message">Error al cargar las evaluaciones.</p>');
                }
            });
        },
        
        refreshEvaluacionesList: function(claseId) {
            const $container = $('#cpp-clase-modal-evaluaciones-container');
            $container.html('<p class="cpp-cuaderno-cargando">Cargando...</p>');
            const self = this;
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: { action: 'cpp_obtener_evaluaciones', nonce: cppFrontendData.nonce, clase_id: claseId },
                success: function(response) {
                    if (response.success) {
                        self.renderEvaluacionesList(response.data.evaluaciones);
                    } else {
                        $container.html('<p class="cpp-error-message">Error al cargar las evaluaciones.</p>');
                    }
                },
                error: function() {
                    $container.html('<p class="cpp-error-message">Error de conexión.</p>');
                }
            });
        },
        
        renderEvaluacionesList: function(evaluaciones) {
            const $container = $('#cpp-clase-modal-evaluaciones-container');
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
            
            html += `<button type="button" id="cpp-btn-add-evaluacion" class="cpp-btn cpp-btn-primary">Añadir</button>
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
            console.log("Binding Modals Clase events...");
            const $modalClase = $('#cpp-modal-clase'); 

            // Manejo del Enter en el formulario de la clase
            $modalClase.on('keydown', '#cpp-form-clase', (e) => {
                if (e.key === 'Enter' && $(e.target).is('#nombre_clase_modal')) {
                    if (typeof cpp.tutorial !== 'undefined' && cpp.tutorial.isActive && cpp.tutorial.currentStep === 1) {
                        e.preventDefault();
                    }
                }
            });

            $modalClase.on('submit', '#cpp-form-clase', (e) => { this.guardar(e); });
            $modalClase.on('click', '#cpp-eliminar-clase-modal-btn', (e) => { this.eliminarDesdeModal(e); });
            $modalClase.on('click', '.cpp-tab-link', (e) => { this.handleTabClick(e, null, $modalClase); });

            $modalClase.on('change', '#cpp-ponderaciones-eval-selector', function() {
                const evaluacionId = $(this).val();
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

            const evaluacionContainerSelector = '#cpp-clase-modal-evaluaciones-container';

            $modalClase.on('click', `${evaluacionContainerSelector} #cpp-btn-add-evaluacion`, () => {
                const $input = $('#cpp-nombre-nueva-evaluacion');
                const nombre = $input.val().trim();
                const claseId = this.currentClaseIdForModal;
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
                        } else {
                            alert('Error: ' + (response.data.message || 'No se pudo crear la evaluación.'));
                        }
                    }
                });
            });

            $modalClase.on('click', `${evaluacionContainerSelector} .cpp-btn-eliminar-evaluacion`, (e) => {
                e.preventDefault();
                const $li = $(e.currentTarget).closest('li');
                const evaluacionId = $li.data('evaluacion-id');
                const evaluacionNombre = $li.find('.cpp-evaluacion-nombre').text();
                const claseId = this.currentClaseIdForModal;
                if (confirm(`¿Estás SEGURO de que quieres eliminar la evaluación "${evaluacionNombre}"?\n\n¡Se borrarán TODAS las actividades y notas asociadas a ella!`)) {
                    $.ajax({
                        url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                        data: { action: 'cpp_eliminar_evaluacion', nonce: cppFrontendData.nonce, evaluacion_id: evaluacionId },
                        success: (response) => {
                            if(response.success) {
                                this.refreshEvaluacionesList(claseId);
                            } else {
                                alert('Error: ' + (response.data.message || 'No se pudo eliminar la evaluación.'));
                            }
                        }
                    });
                }
            });
            
            $modalClase.on('click', `${evaluacionContainerSelector} .cpp-btn-editar-evaluacion`, (e) => {
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

            $modalClase.on('click', `${evaluacionContainerSelector} .cpp-btn-cancel-edit-evaluacion`, (e) => {
                e.preventDefault();
                const $li = $(e.currentTarget).closest('li');
                $li.find('.cpp-evaluacion-edit-form').remove();
                $li.find('.cpp-evaluacion-nombre, .cpp-evaluacion-actions').show();
            });

            $modalClase.on('click', `${evaluacionContainerSelector} .cpp-btn-save-evaluacion`, (e) => {
                e.preventDefault();
                const $li = $(e.currentTarget).closest('li');
                const evaluacionId = $li.data('evaluacion-id');
                const nuevoNombre = $li.find('input[type="text"]').val().trim();
                const claseId = this.currentClaseIdForModal;
                if (!nuevoNombre) { alert('El nombre no puede estar vacío.'); return; }
                
                $.ajax({
                    url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                    data: { action: 'cpp_actualizar_evaluacion', nonce: cppFrontendData.nonce, evaluacion_id: evaluacionId, nombre_evaluacion: nuevoNombre },
                    success: (response) => {
                        if(response.success) {
                            this.refreshEvaluacionesList(claseId);
                        } else {
                            alert('Error: ' + (response.data.message || 'No se pudo actualizar.'));
                        }
                    }
                });
            });
        }
    };

})(jQuery);