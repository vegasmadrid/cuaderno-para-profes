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
            
            $modal.find('#cpp-ficha-alumno-foto').attr('src', '').hide();
            $modal.find('#cpp-ficha-alumno-avatar-inicial').text('').show();
            $modal.find('#cpp-ficha-display-nombre').text('-');
            $modal.find('#cpp-ficha-display-apellidos').text('-');
            
            const $form = $modal.find('#cpp-form-editar-alumno-ficha');
            $form.trigger('reset');
            $form.find('#ficha_alumno_id_editar').val('');
            $form.hide();
            $modal.find('#cpp-ficha-alumno-info-display').show();
            $modal.find('.cpp-edit-info-alumno-btn').show();

            $modal.find('#cpp-ficha-clase-nombre-notas').text('-');
            $modal.find('#cpp-ficha-nota-final-alumno').text('-');
            $modal.find('#cpp-ficha-base-nota-clase').text('-');
            $modal.find('#cpp-ficha-lista-categorias-notas').html('<p>Cargando notas por categoría...</p>'); // Actualizado placeholder
            // $modal.find('#cpp-ficha-lista-actividades-notas').html('<p>Cargando notas...</p>'); // Este se reemplaza por el de categorías

            $modal.find('#cpp-ficha-clase-nombre-asistencia').text('-');
            $modal.find('#cpp-ficha-stats-asistencia').html('<p>Cargando estadísticas...</p>'); // Placeholder para stats
            $modal.find('#cpp-ficha-lista-asistencia').html('<p>Cargando historial...</p>');
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
                    clase_id: self.currentClaseId
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

            // Información del Alumno
            if (data.alumno_info) {
                $modal.find('#cpp-modal-ficha-alumno-titulo').text(`Ficha de: ${data.alumno_info.nombre} ${data.alumno_info.apellidos}`);
                $modal.find('#cpp-ficha-display-nombre').text(data.alumno_info.nombre);
                $modal.find('#cpp-ficha-display-apellidos').text(data.alumno_info.apellidos);

                if (data.alumno_info.foto) {
                    $modal.find('#cpp-ficha-alumno-foto').attr('src', data.alumno_info.foto).show();
                    $modal.find('#cpp-ficha-alumno-avatar-inicial').hide();
                } else {
                    $modal.find('#cpp-ficha-alumno-foto').hide();
                    const inicial = data.alumno_info.nombre ? data.alumno_info.nombre.charAt(0).toUpperCase() : '';
                    $modal.find('#cpp-ficha-alumno-avatar-inicial').text(inicial).show();
                }
                $modal.find('#ficha_alumno_id_editar').val(data.alumno_info.id);
                $modal.find('#ficha_nombre_alumno').val(data.alumno_info.nombre);
                $modal.find('#ficha_apellidos_alumno').val(data.alumno_info.apellidos);
            }

            // Información de la Clase para contexto
            if (data.clase_info) {
                $modal.find('#cpp-ficha-clase-nombre-notas').text(data.clase_info.nombre);
                $modal.find('#cpp-ficha-clase-nombre-asistencia').text(data.clase_info.nombre);
                $modal.find('#cpp-ficha-base-nota-clase').text(data.clase_info.base_nota_final);
            }

            // Resumen de Notas
            if (data.resumen_notas) {
                $modal.find('#cpp-ficha-nota-final-alumno').text(data.resumen_notas.nota_final_formateada || '-');
                
                // NUEVO: Mostrar notas medias por categoría
                let htmlCategoriasNotas = '<ul>';
                if (data.resumen_notas.notas_medias_por_categoria && data.resumen_notas.notas_medias_por_categoria.length > 0) {
                    data.resumen_notas.notas_medias_por_categoria.forEach(function(cat) {
                        htmlCategoriasNotas += `<li>
                            <span class="cpp-category-color-indicator" style="background-color:${cat.color_categoria || '#eee'};"></span>
                            <strong>${$('<div>').text(cat.nombre_categoria).html()}</strong> (${cat.porcentaje_categoria}%): 
                            <span>${cat.nota_media_formateada}</span> (sobre ${data.clase_info.base_nota_final || 'N/A'})
                        </li>`;
                    });
                } else {
                    htmlCategoriasNotas += '<li>No hay desglose por categorías disponible.</li>';
                }
                htmlCategoriasNotas += '</ul>';
                $modal.find('#cpp-ficha-lista-categorias-notas').html(htmlCategoriasNotas);
            }

            // Historial y Estadísticas de Asistencia
            if (data.stats_asistencia) {
                let htmlStatsAsistencia = '<p>';
                htmlStatsAsistencia += `<strong>Presente:</strong> ${data.stats_asistencia.presente || 0} | `;
                htmlStatsAsistencia += `<strong>Ausente:</strong> ${data.stats_asistencia.ausente || 0} | `;
                htmlStatsAsistencia += `<strong>Retraso:</strong> ${data.stats_asistencia.retraso || 0} | `;
                htmlStatsAsistencia += `<strong>Justificado:</strong> ${data.stats_asistencia.justificado || 0}`;
                // Puedes añadir más estados aquí si los manejas
                htmlStatsAsistencia += '</p>';
                $modal.find('#cpp-ficha-stats-asistencia').html(htmlStatsAsistencia);
            }

            if (data.historial_asistencia) {
                let htmlAsistencia = '<ul>';
                if (data.historial_asistencia.length > 0) {
                    data.historial_asistencia.forEach(function(asistencia) {
                        const fechaFormateada = asistencia.fecha_asistencia ? new Date(asistencia.fecha_asistencia + 'T00:00:00').toLocaleDateString() : 'Fecha desconocida';
                        htmlAsistencia += `<li><strong>${fechaFormateada}</strong>: ${$('<div>').text(asistencia.estado).html()} 
                                          ${asistencia.observaciones ? `<em>(${ $('<div>').text(asistencia.observaciones).html()})</em>` : ''}</li>`;
                    });
                } else {
                    htmlAsistencia += '<li>No hay registros de asistencia para esta clase.</li>';
                }
                htmlAsistencia += '</ul>';
                $modal.find('#cpp-ficha-lista-asistencia').html(htmlAsistencia);
            }
        },

        toggleEditInfoAlumno: function(showForm) {
            const $modal = $('#cpp-modal-ficha-alumno');
            const $displayDiv = $modal.find('#cpp-ficha-alumno-info-display');
            const $form = $modal.find('#cpp-form-editar-alumno-ficha');
            const $editBtn = $modal.find('.cpp-edit-info-alumno-btn');

            if (showForm) {
                $displayDiv.hide();
                $form.show();
                $editBtn.hide();
                $form.find('#ficha_nombre_alumno').val($modal.find('#cpp-ficha-display-nombre').text());
                $form.find('#ficha_apellidos_alumno').val($modal.find('#cpp-ficha-display-apellidos').text());
            } else {
                $form.hide();
                $displayDiv.show();
                $editBtn.show();
                $form.trigger('reset'); 
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