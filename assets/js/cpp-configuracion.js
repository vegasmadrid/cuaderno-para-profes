// assets/js/cpp-configuracion.js
// --- REFACTORIZADO PARA NUEVA GESTIÓN DE ALUMNOS ---

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        return;
    }

    cpp.config = {
        currentClaseIdForConfig: null,

        init: function() {
            this.bindEvents();
        },

        showParaEditar: function(e, targetTab = 'clase', claseIdFromParam = null) {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();

            let claseId = claseIdFromParam || (e ? $(e.currentTarget).data('clase-id') : null) || cpp.currentClaseIdCuaderno;
            if (!claseId) {
                alert('Error: No se pudo identificar la clase.');
                return;
            }
            this.currentClaseIdForConfig = claseId;

            $('#cpp-cuaderno-main-content').hide();
            const $settingsPage = $('#cpp-class-settings-page-container').show();
            $('body').addClass('cpp-fullscreen-active');

            if (cpp.sidebar && cpp.sidebar.isSidebarVisible) cpp.sidebar.toggle();

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: { action: 'cpp_obtener_datos_clase_completa', nonce: cppFrontendData.nonce, clase_id: claseId },
                success: (response) => {
                    if (response.success && response.data.clase) {
                        const clase = response.data.clase;
                        const $form = $settingsPage.find('#cpp-form-clase');
                        $form.find('#clase_id_editar').val(clase.id);
                        $form.find('#nombre_clase_config').val(clase.nombre);

                        const $classSwatchesContainer = $settingsPage.find('.cpp-color-swatches-container');
                        let colorParaSeleccionar = clase.color || $classSwatchesContainer.find('.cpp-color-swatch:first').data('color') || '#2962FF';
                        $settingsPage.find('#color_clase_hidden_config').val(colorParaSeleccionar);
                        $classSwatchesContainer.find('.cpp-color-swatch').removeClass('selected');
                        $classSwatchesContainer.find(`.cpp-color-swatch[data-color="${colorParaSeleccionar.toUpperCase()}"]`).addClass('selected');

                        $form.find('#base_nota_final_clase_config').val(clase.base_nota_final ? parseFloat(clase.base_nota_final).toFixed(2) : '100.00');
                        $form.find('#nota_aprobado_clase_config').val(clase.nota_aprobado ? parseFloat(clase.nota_aprobado).toFixed(2) : '50.00');

                        $settingsPage.find('#cpp-class-settings-page-title').text(`Ajustes: ${clase.nombre}`);
                        $('#cpp-eliminar-clase-config-btn').show();
                        $('#cpp-archivar-clase-config-btn').show();
                        $('#cpp-duplicar-clase-config-btn').show();
                        this.handleConfigTabClick(null, targetTab);
                        this.loadEvaluacionesData(claseId);
                    } else {
                        this.hide();
                        alert('Error al cargar datos de la clase.');
                    }
                },
                error: () => {
                    this.hide();
                    alert('Error de conexión.');
                }
            });
        },

        hide: function() {
            $('#cpp-class-settings-page-container').hide();
            $('#cpp-cuaderno-main-content').show();
            $('body').removeClass('cpp-fullscreen-active');
        },

        showGeneralSettings: function() {
            $('#cpp-cuaderno-main-content').hide();
            $('#cpp-general-settings-page-container').show();
            $('body').addClass('cpp-fullscreen-active');
            if (cpp.sidebar && cpp.sidebar.isSidebarVisible) {
                cpp.sidebar.toggle();
            }
            // Cargar los datos del calendario al abrir
            if (window.CppProgramadorApp && typeof window.CppProgramadorApp.populateConfigModal === 'function') {
                window.CppProgramadorApp.populateConfigModal();
            }
            this.loadCriteriosGlobales();
        },

        hideGeneralSettings: function() {
            $('#cpp-general-settings-page-container').hide();
            $('#cpp-cuaderno-main-content').show();
            $('body').removeClass('cpp-fullscreen-active');
        },

        loadAlumnosData: function(claseId) {
            const $container = $('#cpp-config-alumnos-container');
            if (!claseId) {
                $container.html('<p>Error: ID de clase no disponible.</p>');
                return;
            }
            $container.html('<p class="cpp-cuaderno-cargando">Cargando alumnos...</p>');
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_get_alumnos_for_clase_config',
                    nonce: cppFrontendData.nonce,
                    clase_id: claseId
                },
                success: (response) => {
                    if (response.success) {
                        $container.html(response.data.html);
                    } else {
                        $container.html(`<p class="cpp-error-message">${response.data.message || 'Error al cargar alumnos.'}</p>`);
                    }
                },
                error: () => {
                    $container.html('<p class="cpp-error-message">Error de conexión.</p>');
                }
            });
        },

        handleQuitarAlumnoDeClase: function(e) {
            e.preventDefault();
            const $btn = $(e.currentTarget);
            const alumnoId = $btn.data('alumno-id');
            const claseId = $btn.data('clase-id');
            const alumnoNombre = $btn.closest('.cpp-alumno-card').find('h4').text();

            if (!confirm(`¿Seguro que quieres quitar a ${alumnoNombre} de esta clase?\n\nSus calificaciones y datos para esta clase se eliminarán, pero el alumno seguirá existiendo en el sistema.`)) {
                return;
            }

            cpp.showSpinner();
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_unlink_alumno_from_clase',
                    nonce: cppFrontendData.nonce,
                    alumno_id: alumnoId,
                    clase_id: claseId
                },
                success: (response) => {
                    cpp.hideSpinner();
                    if (response.success) {
                        cpp.utils.showToast(response.data.message);
                        this.loadAlumnosData(claseId);
                    } else {
                        alert(`Error: ${response.data.message}`);
                    }
                },
                error: () => {
                    cpp.hideSpinner();
                    alert('Error de conexión.');
                }
            });
        },
        
        handleEditarAlumnoDesdeClase: function(e) {
            const alumnoId = $(e.currentTarget).data('alumno-id');

            // 1. Cerrar la vista de configuración
            this.hide();

            // 2. Cambiar a la pestaña de Alumnos
            $('.cpp-main-tab-link[data-tab="alumnos"]').trigger('click');

            // 3. Abrir la ficha del alumno. Usamos un timeout para dar tiempo a la
            //    pestaña de alumnos a inicializarse si es la primera vez.
            setTimeout(() => {
                const $alumnoItem = $(`.cpp-alumno-list-item[data-alumno-id="${alumnoId}"]`);
                if ($alumnoItem.length) {
                    $alumnoItem.trigger('click');
                    // Scroll a la vista si es necesario
                    $('html, body').animate({
                        scrollTop: $alumnoItem.offset().top - 150
                    }, 500);
                } else if (cpp.alumnos && typeof cpp.alumnos.displayAlumnoFicha === 'function') {
                    // Fallback si el alumno no está visible (p.ej. por búsqueda)
                    cpp.alumnos.displayAlumnoFicha(alumnoId);
                }
            }, 100);
        },

        eliminarDesdeConfig: function(e) {
            e.preventDefault();
            const $btn = $(e.currentTarget);
            const claseId = $('#cpp-form-clase #clase_id_editar').val();
            const claseNombre = $('#cpp-form-clase #nombre_clase_config').val().trim() || 'esta clase';

            if (!claseId) {
                alert('Error: No se pudo identificar la clase para eliminar.');
                return;
            }

            if (confirm(`¿Estás SEGURO de que quieres eliminar la clase "${claseNombre}"?\n\nATENCIÓN: Esta acción es permanente y no se puede deshacer.`)) {
                const originalBtnHtml = $btn.html();
                $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Eliminando...');
                $('#cpp-submit-clase-btn-config').prop('disabled', true);

                $.ajax({
                    url: cppFrontendData.ajaxUrl,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        action: 'cpp_eliminar_clase',
                        nonce: cppFrontendData.nonce,
                        clase_id: claseId
                    },
                    success: function(response) {
                        if (response.success) {
                            window.location.reload();
                        } else {
                            alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo eliminar la clase.'));
                            $btn.prop('disabled', false).html(originalBtnHtml);
                            $('#cpp-submit-clase-btn-config').prop('disabled', false);
                        }
                    },
                    error: function() {
                        alert('Error de conexión al intentar eliminar la clase.');
                        $btn.prop('disabled', false).html(originalBtnHtml);
                        $('#cpp-submit-clase-btn-config').prop('disabled', false);
                    }
                });
            }
        },

        mostrarModalDuplicar: function(e) {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();

            const claseId = $('#cpp-form-clase #clase_id_editar').val() || this.currentClaseIdForConfig || cpp.currentClaseIdCuaderno;
            let claseNombre = $('#cpp-form-clase #nombre_clase_config').val() || $('#cpp-form-clase #nombre_clase_modal').val() || '';
            if (!claseNombre && claseId) {
                const $sidebarItem = $(`#cpp-cuaderno-sidebar .cpp-sidebar-clase-item[data-clase-id="${claseId}"]`);
                if ($sidebarItem.length) {
                    claseNombre = $sidebarItem.data('clase-nombre') || '';
                }
            }
            claseNombre = claseNombre.trim();

            if (!claseId) {
                alert('Error: No se pudo identificar la clase a duplicar.');
                return;
            }

            // Calcular nombre sugerido por defecto (máx 16 caracteres)
            let nombreSugerido = '';
            if (claseNombre.length + 7 <= 16) {
                nombreSugerido = claseNombre + ' COPIA';
            } else {
                nombreSugerido = claseNombre.substring(0, 10) + ' COPIA';
            }

            const $modal = $('#cpp-modal-duplicar-clase');
            $modal.find('#cpp-duplicar-clase-id').val(claseId);
            $modal.find('#cpp-duplicar-clase-nombre').val(nombreSugerido);
            $modal.find('input[name="tipo_copia"][value="total"]').prop('checked', true);

            $modal.fadeIn().find('#cpp-duplicar-clase-nombre').focus().select();
        },

        duplicarClaseSubmit: function(e) {
            e.preventDefault();
            const $form = $(e.currentTarget);
            const $btn = $form.find('#cpp-submit-duplicar-clase-btn');
            const claseId = $form.find('#cpp-duplicar-clase-id').val();
            const nuevoNombre = $form.find('#cpp-duplicar-clase-nombre').val().trim();
            const tipoCopia = $form.find('input[name="tipo_copia"]:checked').val() || 'total';

            if (!nuevoNombre) {
                alert('Por favor, introduce el nombre de la nueva clase.');
                return;
            }
            if (nuevoNombre.length > 16) {
                alert('El nombre de la clase no puede superar los 16 caracteres.');
                return;
            }

            const originalBtnHtml = $btn.html();
            $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Duplicando...');

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_duplicar_clase',
                    nonce: cppFrontendData.nonce,
                    clase_id: claseId,
                    nuevo_nombre: nuevoNombre,
                    tipo_copia: tipoCopia
                },
                success: (response) => {
                    if (response.success) {
                        $('#cpp-modal-duplicar-clase').fadeOut();
                        cpp.utils.showToast(response.data.message || 'Clase duplicada correctamente.');
                        window.location.reload();
                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo duplicar la clase.'));
                        $btn.prop('disabled', false).html(originalBtnHtml);
                    }
                },
                error: () => {
                    alert('Error de conexión al intentar duplicar la clase.');
                    $btn.prop('disabled', false).html(originalBtnHtml);
                }
            });
        },

        archivarDesdeConfig: function(e) {
            e.preventDefault();
            const $btn = $(e.currentTarget);
            const claseId = $('#cpp-form-clase #clase_id_editar').val();
            const claseNombre = $('#cpp-form-clase #nombre_clase_config').val().trim() || 'esta clase';

            if (!claseId) {
                alert('Error: No se pudo identificar la clase para archivar.');
                return;
            }

            if (confirm(`¿Estás seguro de que quieres archivar la clase "${claseNombre}"?\n\nLa clase se ocultará del cuaderno y de la programación, pero todos sus datos se mantendrán a salvo y podrás restaurarla cuando quieras.`)) {
                const originalBtnHtml = $btn.html();
                $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Archivando...');
                $('#cpp-submit-clase-btn-config').prop('disabled', true);
                $('#cpp-eliminar-clase-config-btn').prop('disabled', true);

                $.ajax({
                    url: cppFrontendData.ajaxUrl,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        action: 'cpp_archivar_clase',
                        nonce: cppFrontendData.nonce,
                        clase_id: claseId
                    },
                    success: function(response) {
                        if (response.success) {
                            window.location.reload();
                        } else {
                            alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo archivar la clase.'));
                            $btn.prop('disabled', false).html(originalBtnHtml);
                            $('#cpp-submit-clase-btn-config').prop('disabled', false);
                            $('#cpp-eliminar-clase-config-btn').prop('disabled', false);
                        }
                    },
                    error: function() {
                        alert('Error de conexión al intentar archivar la clase.');
                        $btn.prop('disabled', false).html(originalBtnHtml);
                        $('#cpp-submit-clase-btn-config').prop('disabled', false);
                        $('#cpp-eliminar-clase-config-btn').prop('disabled', false);
                    }
                });
            }
        },

        mostrarClasesArchivadasModal: function() {
            const $modal = $('#cpp-modal-clases-archivadas');
            const $container = $('#cpp-clases-archivadas-lista-container');
            $container.html('<p class="cpp-cuaderno-cargando">Cargando clases archivadas...</p>');
            $modal.fadeIn();

            if (cpp.sidebar && cpp.sidebar.isSidebarVisible) {
                cpp.sidebar.toggle();
            }

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: { action: 'cpp_obtener_clases_archivadas', nonce: cppFrontendData.nonce },
                success: (response) => {
                    if (response.success && response.data.clases) {
                        this.renderListaClasesArchivadas(response.data.clases);
                    } else {
                        $container.html('<p class="cpp-error-message">Error al cargar clases archivadas.</p>');
                    }
                },
                error: () => {
                    $container.html('<p class="cpp-error-message">Error de conexión.</p>');
                }
            });
        },

        renderListaClasesArchivadas: function(clases) {
            const $container = $('#cpp-clases-archivadas-lista-container');
            if (!clases || clases.length === 0) {
                $container.html('<p style="padding: 20px 0; text-align: center; color: #666;">No tienes ninguna clase archivada actualmente.</p>');
                return;
            }

            let html = '<ul class="cpp-config-list" style="list-style:none; padding:0; margin:0;">';
            clases.forEach(clase => {
                const color = clase.color || '#2962FF';
                const nombre = $('<div>').text(clase.nombre).html();
                const numAlumnos = clase.num_alumnos || 0;
                html += `
                    <li data-clase-id="${clase.id}" style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #eee; gap: 12px;">
                        <span style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; display: inline-block; flex-shrink: 0;"></span>
                        <div style="flex-grow: 1;">
                            <strong style="font-size: 15px; color: #333;">${nombre}</strong>
                            <div style="font-size: 12px; color: #777;">${numAlumnos} alumno${numAlumnos == 1 ? '' : 's'}</div>
                        </div>
                        <button type="button" class="cpp-btn cpp-btn-primary cpp-btn-desarchivar-clase" data-clase-id="${clase.id}" data-clase-nombre="${nombre}">
                            <span class="dashicons dashicons-undo"></span> Restaurar
                        </button>
                    </li>`;
            });
            html += '</ul>';
            $container.html(html);
        },

        desarchivarClase: function(e) {
            e.preventDefault();
            const $btn = $(e.currentTarget);
            const claseId = $btn.data('clase-id');
            const claseNombre = $btn.data('clase-nombre');

            if (confirm(`¿Quieres restaurar la clase "${claseNombre}"?\n\nVolverá a estar disponible en el cuaderno y la programación.`)) {
                const originalHtml = $btn.html();
                $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Restaurando...');

                $.ajax({
                    url: cppFrontendData.ajaxUrl,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        action: 'cpp_desarchivar_clase',
                        nonce: cppFrontendData.nonce,
                        clase_id: claseId
                    },
                    success: (response) => {
                        if (response.success) {
                            window.location.reload();
                        } else {
                            alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo restaurar la clase.'));
                            $btn.prop('disabled', false).html(originalHtml);
                        }
                    },
                    error: () => {
                        alert('Error de conexión al restaurar la clase.');
                        $btn.prop('disabled', false).html(originalHtml);
                    }
                });
            }
        },

        guardarClaseDesdeConfig: function(e) {
            e.preventDefault();
            const $form = $(e.currentTarget);
            const $btn = $form.find('#cpp-submit-clase-btn-config');
            const claseIdEditar = $form.find('#clase_id_editar').val();
            const nombreClase = $form.find('#nombre_clase_config').val().trim();
            const baseNotaFinalClase = $form.find('#base_nota_final_clase_config').val().trim();
            const notaAprobadoClase = $form.find('#nota_aprobado_clase_config').val().trim();
            const colorClase = $form.find('#color_clase_hidden_config').val() || '#2962FF';

            if (nombreClase === '') { alert('El nombre de la clase es obligatorio.'); return; }
            if (nombreClase.length > 16) { alert('El nombre de la clase no puede exceder los 16 caracteres.'); return; }

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

            const originalBtnHtml = $btn.html();
            $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...');

            const ajaxData = {
                action: 'cpp_crear_clase',
                nonce: cppFrontendData.nonce,
                clase_id_editar: claseIdEditar,
                nombre_clase: nombreClase,
                color_clase: colorClase,
                base_nota_final_clase: baseNotaNumerica.toFixed(2),
                nota_aprobado_clase: notaAprobadoNumerica.toFixed(2)
            };

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: ajaxData,
                success: (response) => {
                    if (response.success) {
                        cpp.utils.showToast('Clase actualizada correctamente.');

                        // 1. Título de la página de ajustes
                        $('#cpp-class-settings-page-title').text(`Ajustes: ${nombreClase}`);

                        // 2. Si es la clase activa en el cuaderno, actualizar top bar
                        if (parseInt(claseIdEditar) === parseInt(cpp.currentClaseIdCuaderno)) {
                            cpp.utils.updateTopBar({ nombre: nombreClase, color: colorClase });
                            cpp.currentClaseNombreCuaderno = nombreClase;
                        }

                        // 3. Actualizar elemento en sidebar
                        const $sidebarItem = $(`#cpp-cuaderno-sidebar .cpp-sidebar-clase-item[data-clase-id="${claseIdEditar}"]`);
                        if ($sidebarItem.length) {
                            $sidebarItem.attr('data-clase-nombre', nombreClase);
                            $sidebarItem.attr('data-base-nota-final', baseNotaNumerica.toFixed(2));
                            $sidebarItem.find('.cpp-sidebar-clase-nombre-texto').text(nombreClase);
                            $sidebarItem.find('.cpp-sidebar-clase-icon').css('color', colorClase);
                            $sidebarItem.find('.cpp-sidebar-clase-alumnos-btn, .cpp-sidebar-clase-settings-btn').attr('data-clase-nombre', nombreClase);
                        }

                        // 4. Actualizar opciones en selectores de clase
                        $(`select option[value="${claseIdEditar}"]`).text(nombreClase);
                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo guardar la clase.'));
                    }
                },
                error: () => {
                    alert('Error de conexión al guardar la clase.');
                },
                complete: () => {
                    $btn.prop('disabled', false).html(originalBtnHtml);
                }
            });
        },

        bindEvents: function() {
            const $body = $('body');
            const $classSettingsPage = $('#cpp-class-settings-page-container');

            $body.on('click', '.cpp-sidebar-clase-settings-btn', (e) => this.showParaEditar(e));
            $body.on('click', '#cpp-close-class-settings-btn', () => this.hide());
            $body.on('click', '#cpp-general-settings-btn', () => this.showGeneralSettings());
            $body.on('click', '#cpp-close-general-settings-btn', () => this.hideGeneralSettings());

            $classSettingsPage.on('click', '.cpp-config-tab-link', this.handleConfigTabClick.bind(this));
            $classSettingsPage.on('submit', '#cpp-form-clase', this.guardarClaseDesdeConfig.bind(this));
            $classSettingsPage.on('click', '#cpp-eliminar-clase-config-btn', this.eliminarDesdeConfig.bind(this));
            $classSettingsPage.on('click', '#cpp-archivar-clase-config-btn', this.archivarDesdeConfig.bind(this));
            $classSettingsPage.on('click', '#cpp-duplicar-clase-config-btn', this.mostrarModalDuplicar.bind(this));
            $body.on('submit', '#cpp-form-duplicar-clase', this.duplicarClaseSubmit.bind(this));

            $body.on('click', '#cpp-btn-ver-clases-archivadas-sidebar', () => this.mostrarClasesArchivadasModal());
            $body.on('click', '.cpp-btn-desarchivar-clase', this.desarchivarClase.bind(this));

            // --- EVENTOS DE AJUSTES GENERALES (CRITERIOS GLOBALES) ---
            const $generalSettingsPage = $('#cpp-general-settings-page-container');
            $generalSettingsPage.on('click', '.cpp-config-tab-link', this.handleConfigTabClick.bind(this));
            $generalSettingsPage.on('click', '#cpp-btn-guardar-criterio-global', this.saveCriterioGlobal.bind(this));
            $generalSettingsPage.on('click', '.cpp-btn-editar-criterio-global', this.loadCriterioGlobalForEdit.bind(this));
            $generalSettingsPage.on('click', '.cpp-btn-eliminar-criterio-global', this.deleteCriterioGlobal.bind(this));

            // Eventos del modal de borrado inteligente GLOBAL
            $body.on('change', '#cpp-modal-delete-global-criterion input[name="cpp_delete_global_crit_action"]', function() {
                if ($(this).val() === 'reassign') {
                    $(this).closest('.cpp-modal-content').find('.cpp-reassign-select-wrapper').slideDown();
                } else {
                    $(this).closest('.cpp-modal-content').find('.cpp-reassign-select-wrapper').slideUp();
                }
            });

            $body.on('click', '#cpp-confirm-delete-global-crit-btn', (e) => {
                const $btn = $(e.currentTarget);
                const $modal = $('#cpp-modal-delete-global-criterion');
                const id = $modal.data('criterio-id');
                const action = $modal.find('input[name="cpp_delete_global_crit_action"]:checked').val();
                const reassignTo = (action === 'reassign') ? $modal.find('.cpp-reassign-crit-target').val() : null;

                const originalText = $btn.text();
                $btn.prop('disabled', true).text('Borrando...');

                $.ajax({
                    url: cppFrontendData.ajaxUrl,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        action: 'cpp_eliminar_criterio_global',
                        nonce: cppFrontendData.nonce,
                        criterio_id: id,
                        new_criterio_id: reassignTo
                    },
                    success: (response) => {
                        if (response.success) {
                            $modal.fadeOut();
                            cpp.utils.showToast(response.data.message);
                            this.loadCriteriosGlobales();
                            // Forzar recarga del cuaderno en el fondo
                            $(document).trigger('cpp:forceGradebookReload');
                        } else {
                            alert(response.data.message);
                        }
                    },
                    complete: () => {
                        $btn.prop('disabled', false).text(originalText);
                    }
                });
            });

            $generalSettingsPage.on('click', '#cpp-btn-cancelar-criterio-global', this.resetCriterioGlobalForm.bind(this));
            $generalSettingsPage.on('click', '#cpp-criterio-global-colors .cpp-color-swatch', function() {
                $(this).addClass('selected').siblings().removeClass('selected');
                $('#cpp-criterio-global-color-hidden').val($(this).data('color'));
            });

            // --- NUEVOS EVENTOS PARA LA PESTAÑA ALUMNOS EN CONFIG ---
            $classSettingsPage.on('click', '.cpp-btn-quitar-de-clase', this.handleQuitarAlumnoDeClase.bind(this));
            $classSettingsPage.on('click', '.cpp-btn-editar-desde-clase', this.handleEditarAlumnoDesdeClase.bind(this));

            // El resto de eventos (guardar clase, evaluaciones, etc.) se mantienen,
            // pero los que gestionaban alumnos directamente (modales) se han eliminado.

            // --- EVENTOS PARA EVALUACIONES ---
            const evaluacionContainerSelector = '#cpp-config-evaluaciones-container';

            $classSettingsPage.on('click', `${evaluacionContainerSelector} #cpp-btn-importar-evaluaciones-submit`, this.importarEvaluacionesSubmit.bind(this));

            $classSettingsPage.on('click', `${evaluacionContainerSelector} #cpp-btn-add-evaluacion-config`, () => {
                const $input = $('#cpp-nombre-nueva-evaluacion-config');
                const nombre = $input.val().trim();
                const claseId = this.currentClaseIdForConfig;
                const sourceEvalId = $('#cpp-copy-from-eval-select-config').val() || '0';

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
                        if (response.success) {
                            this.loadEvaluacionesData(claseId);
                        } else {
                            alert('Error: ' + (response.data.message || 'No se pudo crear la evaluación.'));
                        }
                    }
                });
            });

            $classSettingsPage.on('click', `${evaluacionContainerSelector} .cpp-btn-eliminar-evaluacion`, (e) => {
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
                            if (response.success) {
                                this.loadEvaluacionesData(claseId);
                            } else {
                                alert('Error: ' + (response.data.message || 'No se pudo eliminar la evaluación.'));
                            }
                        }
                    });
                }
            });

            $classSettingsPage.on('click', `${evaluacionContainerSelector} .cpp-btn-editar-evaluacion`, (e) => {
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

            $classSettingsPage.on('click', `${evaluacionContainerSelector} .cpp-btn-cancel-edit-evaluacion`, (e) => {
                e.preventDefault();
                const $li = $(e.currentTarget).closest('li');
                $li.find('.cpp-evaluacion-edit-form').remove();
                $li.find('.cpp-evaluacion-nombre, .cpp-evaluacion-actions').show();
            });

            $classSettingsPage.on('click', `${evaluacionContainerSelector} .cpp-btn-save-evaluacion`, (e) => {
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
                        if (response.success) {
                            this.loadEvaluacionesData(claseId);
                        } else {
                            alert('Error: ' + (response.data.message || 'No se pudo actualizar.'));
                        }
                    }
                });
            });

            $classSettingsPage.on('change', '#cpp-ponderaciones-eval-selector-config', function() {
                const evaluacionId = $(this).val();
                const $settingsContainer = $('#cpp-ponderaciones-settings-content-config');
                if (evaluacionId) {
                    $settingsContainer.html('<p class="cpp-cuaderno-cargando">Cargando...</p>');
                    // Asegurarse de que el módulo de modales de evaluación exista y tenga la función
                    if (cpp.modals && cpp.modals.evaluacion && typeof cpp.modals.evaluacion.refreshCategoriasList === 'function') {
                        cpp.modals.evaluacion.refreshCategoriasList(evaluacionId, '#cpp-ponderaciones-settings-content-config');
                    } else {
                        console.error("El módulo cpp.modals.evaluacion o la función refreshCategoriasList no están disponibles.");
                        $settingsContainer.html('<p class="cpp-error-message">Error: El módulo de gestión de categorías no está cargado.</p>');
                    }
                } else {
                    $settingsContainer.empty();
                }
            });
        },

        handleConfigTabClick: function(event, targetTabId = null) {
            if (event) event.preventDefault();
            const tabId = targetTabId || $(event.currentTarget).data('config-tab');
            
            // Buscar dentro del contenedor padre para no mezclar pestañas de clase con generales
            const $container = event ? $(event.currentTarget).closest('.cpp-fullscreen-settings-page') : $('.cpp-fullscreen-settings-page:visible');

            $container.find('.cpp-config-tab-link').removeClass('active');
            $container.find('.cpp-config-tab-content').removeClass('active');
            $container.find(`.cpp-config-tab-link[data-config-tab="${tabId}"]`).addClass('active');
            $container.find(`#cpp-config-tab-${tabId}`).addClass('active');

            if (tabId === 'alumnos') {
                this.loadAlumnosData(this.currentClaseIdForConfig);
            } else if (tabId === 'evaluaciones') {
                this.loadEvaluacionesData(this.currentClaseIdForConfig);
            }
            else if (tabId === 'ponderaciones') {
                this.loadPonderacionesData(this.currentClaseIdForConfig);
            }
            else if (tabId === 'criterios-globales') {
                this.loadCriteriosGlobales();
            }
        },

        loadCriteriosGlobales: function() {
            const $ul = $('#cpp-criterios-globales-ul');
            $ul.html('<p class="cpp-cuaderno-cargando">Cargando criterios...</p>');

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: { action: 'cpp_obtener_criterios_globales', nonce: cppFrontendData.nonce },
                success: (response) => {
                    if (response.success) {
                        this.renderCriteriosGlobales(response.data.criterios);
                    } else {
                        $ul.html('<p class="cpp-error-message">Error al cargar criterios.</p>');
                    }
                }
            });
        },

        renderCriteriosGlobales: function(criterios) {
            const $ul = $('#cpp-criterios-globales-ul');
            if (!criterios || criterios.length === 0) {
                $ul.html('<p>No has definido criterios globales todavía.</p>');
                return;
            }

            let html = '';
            criterios.forEach(crit => {
                html += `
                    <li data-criterio-id="${crit.id}">
                        <span class="cpp-category-color-indicator" style="background-color: ${crit.color}; width: 20px; height: 20px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.1); margin-right: 12px;"></span>
                        <span class="cpp-criterio-nombre">${$('<div>').text(crit.nombre).html()}</span>
                        <div class="cpp-config-list-actions">
                            <button type="button" class="cpp-btn-icon cpp-btn-editar-criterio-global" title="Editar"><span class="dashicons dashicons-edit"></span></button>
                            <button type="button" class="cpp-btn-icon cpp-btn-eliminar-criterio-global" title="Eliminar"><span class="dashicons dashicons-trash"></span></button>
                        </div>
                    </li>`;
            });
            $ul.html(html);
        },

        saveCriterioGlobal: function() {
            const id = $('#cpp-criterio-global-id-editar').val();
            const nombre = $('#cpp-criterio-global-nombre').val().trim();
            const color = $('#cpp-criterio-global-color-hidden').val();

            if (!nombre) { alert('El nombre es obligatorio.'); return; }

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_guardar_o_actualizar_criterio_global',
                    nonce: cppFrontendData.nonce,
                    criterio_id: id,
                    nombre: nombre,
                    color: color
                },
                success: (response) => {
                    if (response.success) {
                        cpp.utils.showToast(response.data.message);
                        this.resetCriterioGlobalForm();
                        this.loadCriteriosGlobales();
                    } else {
                        alert(response.data.message);
                    }
                }
            });
        },

        loadCriterioGlobalForEdit: function(e) {
            const $li = $(e.currentTarget).closest('li');
            const id = $li.data('criterio-id');
            const nombre = $li.find('.cpp-criterio-nombre').text();
            const color = $li.find('.cpp-category-color-indicator').css('background-color');

            // Convertir rgb a hex
            const hex = this.rgb2hex(color);

            $('#cpp-criterio-global-id-editar').val(id);
            $('#cpp-criterio-global-nombre').val(nombre).focus();
            $('#cpp-criterio-global-color-hidden').val(hex);

            const self = this;
            $(`#cpp-criterio-global-colors .cpp-color-swatch`).each(function() {
                if (self.rgb2hex($(this).css('background-color')).toUpperCase() === hex.toUpperCase()) {
                    $(this).addClass('selected').siblings().removeClass('selected');
                }
            });

            $('#cpp-criterio-global-form-title').text('Editar Criterio');
            $('#cpp-btn-guardar-criterio-global-text').text('Actualizar Criterio');
            $('#cpp-btn-cancelar-criterio-global').show();
        },

        resetCriterioGlobalForm: function() {
            $('#cpp-criterio-global-id-editar').val('');
            $('#cpp-criterio-global-nombre').val('');
            $('#cpp-criterio-global-form-title').text('Añadir Nuevo Criterio');
            $('#cpp-btn-guardar-criterio-global-text').text('Añadir Criterio');
            $('#cpp-btn-cancelar-criterio-global').hide();
        },

        deleteCriterioGlobal: function(e) {
            const $li = $(e.currentTarget).closest('li');
            const id = $li.data('criterio-id');
            const nombre = $li.find('.cpp-criterio-nombre').text();

            const $modal = $('#cpp-modal-delete-global-criterion');
            $modal.find('.cpp-delete-crit-name').text(nombre);
            $modal.data('criterio-id', id);

            // Poblar el selector de reasignación con los OTROS criterios globales
            const $reassignSelect = $modal.find('.cpp-reassign-crit-target');
            $reassignSelect.empty();

            $('#cpp-criterios-globales-ul li').each(function() {
                const val = $(this).data('criterio-id');
                const text = $(this).find('.cpp-criterio-nombre').text().trim();
                if (val != id) {
                    $reassignSelect.append(`<option value="${val}">${text}</option>`);
                }
            });

            if ($reassignSelect.find('option').length === 0) {
                $modal.find('label:has(input[value="reassign"])').hide();
            } else {
                $modal.find('label:has(input[value="reassign"])').show();
            }

            $modal.find('input[name="cpp_delete_global_crit_action"][value="none"]').prop('checked', true);
            $modal.find('.cpp-reassign-select-wrapper').hide();
            $modal.fadeIn();
        },

        rgb2hex: function(rgb) {
            if (/^#[0-9A-F]{6}$/i.test(rgb)) return rgb;
            var parts = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (!parts) return rgb;
            function hex(x) { return ("0" + parseInt(x).toString(16)).slice(-2); }
            return "#" + hex(parts[1]) + hex(parts[2]) + hex(parts[3]);
        },

        loadPonderacionesData: function(claseId) {
            const $container = $('#cpp-config-ponderaciones-content-container');
            $container.html('<p class="cpp-cuaderno-cargando">Cargando evaluaciones...</p>');

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: { action: 'cpp_obtener_evaluaciones', nonce: cppFrontendData.nonce, clase_id: claseId },
                success: function(response) {
                    if (response.success && response.data.evaluaciones && response.data.evaluaciones.length > 0) {
                        let contentHtml = '<h4>Selecciona una evaluación para gestionar sus ponderaciones</h4>';
                        contentHtml += '<div class="cpp-form-group"><select id="cpp-ponderaciones-eval-selector-config" class="cpp-evaluacion-selector">';
                        contentHtml += '<option value="">-- Selecciona --</option>';
                        response.data.evaluaciones.forEach(function(evaluacion) {
                            contentHtml += `<option value="${evaluacion.id}">${$('<div>').text(evaluacion.nombre_evaluacion).html()}</option>`;
                        });
                        contentHtml += '</select></div><hr>';
                        contentHtml += '<div id="cpp-ponderaciones-settings-content-config"></div>';
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

        loadEvaluacionesData: function(claseId) {
            const $container = $('#cpp-config-evaluaciones-container');
            if (!claseId) {
                $container.html('<p>Error: ID de clase no disponible.</p>');
                return;
            }
            $container.html('<p class="cpp-cuaderno-cargando">Cargando...</p>');
            const self = this;
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: { action: 'cpp_obtener_evaluaciones', nonce: cppFrontendData.nonce, clase_id: claseId },
                success: function(response) {
                    if (response.success) {
                        self.renderEvaluacionesList(response.data.evaluaciones, response.data.clases_importar);
                    } else {
                        $container.html('<p class="cpp-error-message">Error al cargar las evaluaciones.</p>');
                    }
                },
                error: function() {
                    $container.html('<p class="cpp-error-message">Error de conexión.</p>');
                }
            });
        },

        renderEvaluacionesList: function(evaluaciones, clasesImportar) {
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
                        <input type="text" id="cpp-nombre-nueva-evaluacion-config" placeholder="Nombre de la nueva evaluación" style="flex-grow:1;">`;

            if (evaluaciones && evaluaciones.length > 0) {
                html += `<div class="cpp-form-group" style="margin-bottom:0; flex-basis: 200px;">
                            <select id="cpp-copy-from-eval-select-config">
                                <option value="0">No copiar ponderaciones</option>`;
                evaluaciones.forEach(function(evaluacion_origen) {
                    html += `<option value="${evaluacion_origen.id}">Copiar de: ${$('<div>').text(evaluacion_origen.nombre_evaluacion).html()}</option>`;
                });
                html += `</select>
                         </div>`;
            }

            html += `<button type="button" id="cpp-btn-add-evaluacion-config" class="cpp-btn cpp-btn-primary">Añadir</button>
                     </div>`;

            // --- SECCIÓN PARA IMPORTAR EVALUACIONES DE OTRA CLASE ---
            const activas = (clasesImportar && clasesImportar.activas) ? clasesImportar.activas : [];
            const archivadas = (clasesImportar && clasesImportar.archivadas) ? clasesImportar.archivadas : [];

            if (activas.length > 0 || archivadas.length > 0) {
                html += `<hr style="margin: 25px 0 15px 0; border: 0; border-top: 1px solid #eee;">
                         <div class="cpp-importar-evaluaciones-section" style="background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
                            <h4 style="margin-top:0; margin-bottom: 8px; font-size: 15px; color: #2c3e50;"><span class="dashicons dashicons-download" style="vertical-align: text-bottom; margin-right: 4px;"></span> Importar evaluaciones de otra clase</h4>
                            <p style="font-size: 13px; color: #666; margin-bottom: 12px;">Copia la estructura de evaluaciones de otra de tus clases (activas o archivadas) a esta clase.</p>

                            <div class="cpp-form-group" style="margin-bottom: 12px;">
                                <label for="cpp-import-source-class-select" style="display:block; font-weight: 600; font-size: 12px; margin-bottom: 4px;">Clase de origen:</label>
                                <select id="cpp-import-source-class-select" class="cpp-evaluacion-selector" style="width: 100%; max-width: 400px;">
                                    <option value="">-- Selecciona una clase --</option>`;

                if (activas.length > 0) {
                    html += `<optgroup label="Clases activas">`;
                    activas.forEach(function(c) {
                        html += `<option value="${c.id}">${$('<div>').text(c.nombre).html()}</option>`;
                    });
                    html += `</optgroup>`;
                }

                if (archivadas.length > 0) {
                    html += `<optgroup label="Clases archivadas">`;
                    archivadas.forEach(function(c) {
                        html += `<option value="${c.id}">${$('<div>').text(c.nombre).html()} (Archivada)</option>`;
                    });
                    html += `</optgroup>`;
                }

                html += `        </select>
                            </div>

                            <div class="cpp-form-group" style="margin-bottom: 12px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                                    <input type="checkbox" id="cpp-import-copy-system-criteria" checked>
                                    <span>Copiar sistema de evaluación y sus criterios de calificación</span>
                                </label>
                            </div>

                            <div class="cpp-form-group" style="margin-bottom: 15px;">
                                <label style="display:block; font-weight: 600; font-size: 12px; margin-bottom: 6px;">Modo de importación:</label>
                                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
                                    <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                        <input type="radio" name="cpp_import_mode" value="add" checked>
                                        <span>Añadir a las evaluaciones existentes</span>
                                    </label>
                                    <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                        <input type="radio" name="cpp_import_mode" value="replace">
                                        <span>Reemplazar todas las evaluaciones existentes de esta clase</span>
                                    </label>
                                </div>
                            </div>

                            <button type="button" id="cpp-btn-importar-evaluaciones-submit" class="cpp-btn cpp-btn-secondary">
                                <span class="dashicons dashicons-database-import" style="vertical-align: text-bottom; font-size: 16px;"></span> Importar Evaluaciones
                            </button>
                         </div>`;
            }

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

        importarEvaluacionesSubmit: function(e) {
            e.preventDefault();
            const $btn = $('#cpp-btn-importar-evaluaciones-submit');
            const claseOrigenId = $('#cpp-import-source-class-select').val();
            const claseDestinoId = this.currentClaseIdForConfig;
            const copiarSistemaYCriterios = $('#cpp-import-copy-system-criteria').is(':checked');
            const modoImportacion = $('input[name="cpp_import_mode"]:checked').val() || 'add';

            if (!claseOrigenId) {
                alert('Por favor, selecciona una clase de origen.');
                return;
            }

            if (!claseDestinoId) {
                alert('Error: No se pudo identificar la clase destino.');
                return;
            }

            const nombreOrigen = $('#cpp-import-source-class-select option:selected').text();
            let confirmMsg = `¿Estás seguro de que quieres importar las evaluaciones de "${nombreOrigen}"?`;
            if (modoImportacion === 'replace') {
                confirmMsg = `ATENCIÓN: Se eliminarán TODAS las evaluaciones actuales de esta clase y sus actividades/calificaciones asociadas para reemplazarlas por las de "${nombreOrigen}".\n\n¿Deseas continuar?`;
            }

            if (!confirm(confirmMsg)) {
                return;
            }

            const originalBtnHtml = $btn.html();
            $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Importando...');

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_importar_evaluaciones',
                    nonce: cppFrontendData.nonce,
                    clase_origen_id: claseOrigenId,
                    clase_destino_id: claseDestinoId,
                    copiar_sistema_y_criterios: copiarSistemaYCriterios,
                    modo_importacion: modoImportacion
                },
                success: (response) => {
                    if (response.success) {
                        cpp.utils.showToast(response.data.message || 'Evaluaciones importadas correctamente.');
                        this.loadEvaluacionesData(claseDestinoId);
                        $(document).trigger('cpp:forceGradebookReload');
                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudieron importar las evaluaciones.'));
                        $btn.prop('disabled', false).html(originalBtnHtml);
                    }
                },
                error: () => {
                    alert('Error de conexión al importar evaluaciones.');
                    $btn.prop('disabled', false).html(originalBtnHtml);
                }
            });
        }
    };

})(jQuery);
