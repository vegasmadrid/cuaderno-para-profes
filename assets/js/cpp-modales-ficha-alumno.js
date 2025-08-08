// assets/js/cpp-modales-ficha-alumno.js
(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-modales-ficha-alumno.js no puede inicializarse.");
        return;
    }
    cpp.modals = cpp.modals || {};

    cpp.modals.fichaAlumno = {
        currentAlumnoId: null,
        currentClaseId: null,

        init: function() {
            console.log("CPP Modals Ficha Alumno Module Initializing...");
        },

        resetModal: function() {
            const $modal = $('#cpp-modal-ficha-alumno');
            if (!$modal.length) return;

            $modal.find('#cpp-modal-ficha-alumno-titulo').text('Ficha del Alumno');
            $modal.find('#cpp-ficha-clase-nombre-contexto').text('-');
            
            $modal.find('#cpp-ficha-alumno-foto').attr('src', '').hide();
            $modal.find('#cpp-ficha-alumno-avatar-inicial').text('').show();
            
            // Ocultar formulario de edición y mostrar display
            this.toggleEditInfoAlumno(false);

            // Resetear valores de notas
            $modal.find('#cpp-ficha-nota-final-valor').text('-');
            $modal.find('#cpp-ficha-base-nota-clase').text('100');
            $modal.find('#cpp-ficha-lista-categorias-notas').html('<p class="cpp-cargando-placeholder">Cargando...</p>');
            $modal.find('#cpp-ficha-lista-actividades-notas').html('<p class="cpp-cargando-placeholder">Cargando...</p>');

            // Resetear valores de asistencia
            $modal.find('#cpp-ficha-stats-asistencia').html('<p class="cpp-cargando-placeholder">Cargando...</p>');
            $modal.find('#cpp-ficha-lista-asistencia').html('<p class="cpp-cargando-placeholder">Cargando...</p>');
        },

        mostrar: function(alumnoId, claseId) {
            if (!alumnoId || !claseId) {
                alert('Error: Se requiere ID de alumno y ID de clase para ver la ficha.');
                return;
            }
            this.currentAlumnoId = alumnoId;
            this.currentClaseId = claseId;

            if (cpp.modals && cpp.modals.general && typeof cpp.modals.general.hideAll === 'function') {
                cpp.modals.general.hideAll();
            }

            const $modal = $('#cpp-modal-ficha-alumno');
            this.resetModal(); 
            $modal.fadeIn();

            const self = this;

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_obtener_datos_ficha_alumno',
                    nonce: cppFrontendData.nonce,
                    alumno_id: self.currentAlumnoId,
                    clase_id: self.currentClaseId,
                    evaluacion_id: cpp.currentEvaluacionId
                },
                success: function(response) {
                    if (response.success) {
                        self.renderizarFicha(response.data);
                    } else {
                        alert('Error al cargar datos de la ficha: ' + (response.data && response.data.message ? response.data.message : 'Error desconocido.'));
                        $modal.fadeOut(); 
                    }
                },
                error: function() {
                    alert('Error de conexión al cargar datos de la ficha.');
                    $modal.fadeOut();
                }
            });
        },

        renderizarFicha: function(data) {
            const $modal = $('#cpp-modal-ficha-alumno');
            if (!$modal.length || !data) return;

            // --- Cabecera e Información General ---
            if (data.alumno_info) {
                $modal.find('#cpp-modal-ficha-alumno-titulo').text(`${data.alumno_info.nombre} ${data.alumno_info.apellidos}`);
                if (data.alumno_info.foto) {
                    $modal.find('#cpp-ficha-alumno-foto').attr('src', data.alumno_info.foto).show();
                    $modal.find('#cpp-ficha-alumno-avatar-inicial').hide();
                } else {
                    $modal.find('#cpp-ficha-alumno-foto').hide();
                    const inicial = data.alumno_info.nombre ? data.alumno_info.nombre.charAt(0).toUpperCase() : '';
                    $modal.find('#cpp-ficha-alumno-avatar-inicial').text(inicial).show();
                }
                // Precargar el formulario de edición
                $modal.find('#ficha_alumno_id_editar').val(data.alumno_info.id);
                $modal.find('#ficha_nombre_alumno').val(data.alumno_info.nombre);
                $modal.find('#ficha_apellidos_alumno').val(data.alumno_info.apellidos);
            }

            if (data.clase_info) {
                $modal.find('#cpp-ficha-clase-nombre-contexto').text(data.clase_info.nombre);
                $modal.find('#cpp-ficha-base-nota-clase').text(data.clase_info.base_nota_final);
            }

            // --- Sección de Calificaciones ---
            if (data.resumen_notas) {
                $modal.find('#cpp-ficha-nota-final-valor').text(data.resumen_notas.nota_final_formateada || '-');

                // Desglose por Categorías
                let htmlCategorias = '<ul>';
                if (data.resumen_notas.notas_medias_por_categoria && data.resumen_notas.notas_medias_por_categoria.length > 0) {
                    data.resumen_notas.notas_medias_por_categoria.forEach(cat => {
                        htmlCategorias += `<li>
                            <span class="cpp-ficha-list-item-main">
                                <span class="cpp-category-color-indicator" style="background-color:${cat.color_categoria || '#ccc'};"></span>
                                ${$('<div>').text(cat.nombre_categoria).html()} (${cat.porcentaje_categoria}%)
                            </span>
                            <span class="cpp-ficha-list-item-side">${cat.nota_media_formateada}</span>
                        </li>`;
                    });
                } else {
                    htmlCategorias += '<li>No hay desglose por categorías.</li>';
                }
                htmlCategorias += '</ul>';
                $modal.find('#cpp-ficha-lista-categorias-notas').html(htmlCategorias);

                // Desglose por Actividades
                let htmlActividades = '<ul>';
                if (data.resumen_notas.calificaciones_individuales && data.resumen_notas.calificaciones_individuales.length > 0) {
                    data.resumen_notas.calificaciones_individuales.forEach(act => {
                        htmlActividades += `<li>
                            <span class="cpp-ficha-list-item-main">${$('<div>').text(act.nombre_actividad).html()}</span>
                            <span class="cpp-ficha-list-item-side"><strong>${act.calificacion}</strong> / ${act.nota_maxima}</span>
                        </li>`;
                    });
                } else {
                    htmlActividades += '<li>No hay actividades en esta evaluación.</li>';
                }
                htmlActividades += '</ul>';
                $modal.find('#cpp-ficha-lista-actividades-notas').html(htmlActividades);
            }

            // --- Sección de Asistencia ---
            if (data.stats_asistencia) {
                let htmlStats = '<div class="cpp-ficha-stats-grid">';
                htmlStats += `<div><span class="stat-value">${data.stats_asistencia.presente || 0}</span><span class="stat-label">Presente</span></div>`;
                htmlStats += `<div><span class="stat-value ausente">${data.stats_asistencia.ausente || 0}</span><span class="stat-label">Ausente</span></div>`;
                htmlStats += `<div><span class="stat-value retraso">${data.stats_asistencia.retraso || 0}</span><span class="stat-label">Retraso</span></div>`;
                htmlStats += `<div><span class="stat-value justificado">${data.stats_asistencia.justificado || 0}</span><span class="stat-label">Justificado</span></div>`;
                htmlStats += '</div>';
                $modal.find('#cpp-ficha-stats-asistencia').html(htmlStats);
            }

            if (data.historial_asistencia) {
                let htmlHistorial = '<ul>';
                if (data.historial_asistencia.length > 0) {
                    data.historial_asistencia.forEach(item => {
                        const fecha = new Date(item.fecha_asistencia + 'T00:00:00').toLocaleDateString();
                        htmlHistorial += `<li>
                            <span class="cpp-ficha-list-item-main">${fecha}</span>
                            <span class="cpp-ficha-list-item-side estado-${item.estado.toLowerCase()}">${$('<div>').text(item.estado).html()}</span>
                        </li>`;
                        if (item.observaciones) {
                            htmlHistorial += `<li class="observacion">↳ <small><em>${$('<div>').text(item.observaciones).html()}</em></small></li>`;
                        }
                    });
                } else {
                    htmlHistorial += '<li>No hay historial de asistencia.</li>';
                }
                htmlHistorial += '</ul>';
                $modal.find('#cpp-ficha-lista-asistencia').html(htmlHistorial);
            }
        },

        toggleEditInfoAlumno: function(showForm) {
            const $modal = $('#cpp-modal-ficha-alumno');
            const $displayContainer = $modal.find('#cpp-ficha-display-container');
            const $formContainer = $modal.find('#cpp-ficha-form-container');
            const $editBtn = $modal.find('.cpp-edit-info-alumno-btn');

            if (showForm) {
                $displayContainer.hide();
                $formContainer.show();
                $editBtn.hide();
            } else {
                $formContainer.hide();
                $displayContainer.show();
                $editBtn.show();
                $formContainer.find('form').trigger('reset');
            }
        },

        guardarInfoAlumno: function(eventForm) {
            eventForm.preventDefault();
            const $form = $(eventForm.target);
            const $btn = $form.find('button[type="submit"]');
            const formData = new FormData(eventForm.target); 

            formData.append('action', 'cpp_guardar_alumno'); 
            formData.append('nonce', cppFrontendData.nonce);
            formData.append('clase_id_form_alumno', this.currentClaseId); 


            const originalBtnHtml = $btn.html();
            $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...');
            const self = this;

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        alert(response.data.message || 'Información guardada.');
                        self.toggleEditInfoAlumno(false); 
                        self.mostrar(self.currentAlumnoId, self.currentClaseId); 
                        if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function') {
                            const $claseActiva = $('.cpp-sidebar-clase-item.cpp-sidebar-item-active');
                            if ($claseActiva.length) {
                                cpp.gradebook.cargarContenidoCuaderno($claseActiva.data('clase-id'), $claseActiva.data('clase-nombre'));
                            }
                        }
                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo guardar.'));
                    }
                },
                error: function() {
                    alert('Error de conexión al guardar la información del alumno.');
                },
                complete: function() {
                    $btn.prop('disabled', false).html(originalBtnHtml);
                }
            });
        },

        bindEvents: function() {
            console.log("Binding Modals Ficha Alumno events...");
            const $modal = $('#cpp-modal-ficha-alumno');
            const self = this;

            $modal.on('click', '.cpp-edit-info-alumno-btn', function() {
                self.toggleEditInfoAlumno(true);
            });

            $modal.on('click', '.cpp-cancel-edit-info-alumno-btn', function() {
                self.toggleEditInfoAlumno(false);
            });

            $modal.on('submit', '#cpp-form-editar-alumno-ficha', function(e) {
                self.guardarInfoAlumno(e);
            });
        }
    };

})(jQuery);