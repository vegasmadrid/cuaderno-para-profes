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
            this.bindEvents();
        },

        resetModal: function() {
            var $modal = $('#cpp-modal-ficha-alumno');
            if (!$modal.length) return;
            $modal.find('#cpp-ficha-display-nombre-completo').text('Ficha del Alumno');
            $modal.find('#cpp-ficha-alumno-main-content').html('<p class="cpp-cuaderno-cargando">Cargando datos...</p>');
            var $form = $modal.find('#cpp-form-editar-alumno-ficha');
            $form.trigger('reset').hide();
            $modal.find('#cpp-ficha-alumno-main-content').show();
            $modal.find('.cpp-edit-info-alumno-btn').show();
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

            var $modal = $('#cpp-modal-ficha-alumno');
            this.resetModal();
            $modal.fadeIn();

            var self = this;

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

        _buildResumenAcademicoHTML: function(resumen, claseInfo) {
            if (!resumen) return '<p>No hay datos académicos disponibles.</p>';
            var html = '<div class="cpp-ficha-seccion">';
            html += '<h3>Resumen Académico</h3>';

            html += '<div class="cpp-ficha-nota-global-container">';
            html += '<span class="cpp-ficha-nota-global-valor">' + (resumen.nota_final_global_formateada || '-') + '</span>';
            html += '<span class="cpp-ficha-nota-global-base">/ ' + (claseInfo.base_nota_final || '100') + '</span>';
            html += '</div>';
            html += '<p class="cpp-ficha-nota-global-label">Nota Final Media</p>';

            html += '<h4>Desglose por Evaluaciones</h4>';
            html += '<ul class="cpp-ficha-lista-desglose">';
            if (resumen.desglose_evaluaciones && resumen.desglose_evaluaciones.length > 0) {
                resumen.desglose_evaluaciones.forEach(function(eval) {
                    html += '<li>' +
                                '<span class="cpp-ficha-desglose-nombre">' + $('<div>').text(eval.nombre_evaluacion).html() + '</span>' +
                                '<span class="cpp-ficha-desglose-nota">' + eval.nota_final_formateada + '</span>' +
                             '</li>';
                });
            } else {
                html += '<li>No hay evaluaciones con notas.</li>';
            }
            html += '</ul>';
            html += '</div>';
            return html;
        },

        _buildResumenAsistenciaHTML: function(resumen) {
            if (!resumen) return '<p>No hay datos de asistencia disponibles.</p>';
            var html = '<div class="cpp-ficha-seccion">';
            html += '<h3>Resumen de Asistencia</h3>';

            if (resumen.stats) {
                html += '<div class="cpp-ficha-stats-grid">';
                html += '<div class="stat-item"><span class="stat-icon">(P)</span><div><strong>' + (resumen.stats.presente || 0) + '</strong><br>Presente</div></div>';
                html += '<div class="stat-item"><span class="stat-icon">(A)</span><div><strong>' + (resumen.stats.ausente || 0) + '</strong><br>Ausente</div></div>';
                html += '<div class="stat-item"><span class="stat-icon">(R)</span><div><strong>' + (resumen.stats.retraso || 0) + '</strong><br>Retraso</div></div>';
                html += '<div class="stat-item"><span class="stat-icon">(J)</span><div><strong>' + (resumen.stats.justificado || 0) + '</strong><br>Justificado</div></div>';
                html += '</div>';
            }

            html += '<h4>Incidencias Recientes</h4>';
            html += '<ul class="cpp-ficha-lista-desglose">';
            if (resumen.historial_reciente && resumen.historial_reciente.length > 0) {
                resumen.historial_reciente.forEach(function(item) {
                    var fechaFormateada = item.fecha_asistencia ? new Date(item.fecha_asistencia + 'T00:00:00').toLocaleDateString() : 'N/A';
                    html += '<li>' +
                                '<span class="cpp-ficha-desglose-nombre">' + fechaFormateada + '</span>' +
                                '<span class="cpp-ficha-desglose-nota">' + $('<div>').text(item.estado).html() + '</span>' +
                             '</li>';
                });
            } else {
                html += '<li>No hay incidencias recientes.</li>';
            }
            html += '</ul>';
            html += '</div>';
            return html;
        },

        renderizarFicha: function(data) {
            var $modal = $('#cpp-modal-ficha-alumno');
            if (!$modal.length || !data) return;

            var $header = $modal.find('.cpp-ficha-alumno-header');
            if (data.alumno_info) {
                $header.find('#cpp-ficha-display-nombre-completo').text(data.alumno_info.nombre + ' ' + data.alumno_info.apellidos);
                if (data.alumno_info.foto) {
                    $header.find('#cpp-ficha-alumno-foto').attr('src', data.alumno_info.foto).show();
                    $header.find('#cpp-ficha-alumno-avatar-inicial').hide();
                } else {
                    $header.find('#cpp-ficha-alumno-foto').hide();
                    var inicial = data.alumno_info.nombre ? data.alumno_info.nombre.charAt(0).toUpperCase() : '';
                    $header.find('#cpp-ficha-alumno-avatar-inicial').text(inicial).show();
                }
                $modal.find('#ficha_alumno_id_editar').val(data.alumno_info.id);
                $modal.find('#ficha_nombre_alumno').val(data.alumno_info.nombre);
                $modal.find('#ficha_apellidos_alumno').val(data.alumno_info.apellidos);
            }

            var $mainContent = $modal.find('#cpp-ficha-alumno-main-content');
            var mainHtml = '<div class="cpp-ficha-grid">';

            mainHtml += '<div class="cpp-ficha-col-izq">';
            mainHtml += this._buildResumenAcademicoHTML(data.resumen_academico, data.clase_info);
            mainHtml += '</div>';

            mainHtml += '<div class="cpp-ficha-col-der">';
            mainHtml += this._buildResumenAsistenciaHTML(data.resumen_asistencia);
            mainHtml += '</div>';

            mainHtml += '</div>';
            $mainContent.html(mainHtml);
        },

        toggleEditInfoAlumno: function(showForm) {
            var $modal = $('#cpp-modal-ficha-alumno');
            var $mainContent = $modal.find('#cpp-ficha-alumno-main-content');
            var $form = $modal.find('#cpp-form-editar-alumno-ficha');
            var $editBtn = $modal.find('.cpp-edit-info-alumno-btn');

            if (showForm) {
                $mainContent.hide();
                $form.show();
                $editBtn.hide();
            } else {
                $form.hide();
                $mainContent.show();
                $editBtn.show();
            }
        },

        guardarInfoAlumno: function(eventForm) {
            eventForm.preventDefault();
            var $form = $(eventForm.target);
            var $btn = $form.find('button[type="submit"]');
            var formData = new FormData(eventForm.target);

            formData.append('action', 'cpp_guardar_alumno');
            formData.append('nonce', cppFrontendData.nonce);
            formData.append('clase_id_form_alumno', this.currentClaseId);


            var originalBtnHtml = $btn.html();
            $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...');
            var self = this;

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
                            var $claseActiva = $('.cpp-sidebar-clase-item.cpp-sidebar-item-active');
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
            var $modal = $('#cpp-modal-ficha-alumno');
            var self = this;

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