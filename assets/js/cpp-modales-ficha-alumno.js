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
            const $modal = $('#cpp-modal-ficha-alumno');
            if (!$modal.length) return;
            $modal.find('#cpp-ficha-display-nombre-completo').text('Ficha del Alumno');
            $modal.find('#cpp-ficha-alumno-main-content').html('<p class="cpp-cuaderno-cargando">Cargando datos...</p>');
            const $form = $modal.find('#cpp-form-editar-alumno-ficha');
            $form.trigger('reset').hide();
            $modal.find('#cpp-ficha-alumno-main-content').show();
            $modal.find('.cpp-edit-info-alumno-btn').show();
        },

        mostrar: function(alumnoId, claseId) {
            // DEBUGGING VERSION 2
            alert('DEBUG-2: `mostrar` function called. This tests if the error is in the HTML-building functions.');
            // The original AJAX call is commented out to prevent `renderizarFicha` from being called.
        },

        _buildResumenAcademicoHTML: function(resumen, claseInfo) {
            // Function body commented out for debugging
            console.log("DEBUG-2: _buildResumenAcademicoHTML called, but is disabled.");
            return "<!-- Academic Summary Disabled for Debugging -->";
        },

        _buildResumenAsistenciaHTML: function(resumen) {
            // Function body commented out for debugging
            console.log("DEBUG-2: _buildResumenAsistenciaHTML called, but is disabled.");
            return "<!-- Attendance Summary Disabled for Debugging -->";
        },

        renderizarFicha: function(data) {
            // Function body commented out for debugging
            console.log("DEBUG-2: renderizarFicha called, but is disabled.");
        },

        toggleEditInfoAlumno: function(showForm) {
            const $modal = $('#cpp-modal-ficha-alumno');
            const $mainContent = $modal.find('#cpp-ficha-alumno-main-content');
            const $form = $modal.find('#cpp-form-editar-alumno-ficha');
            const $editBtn = $modal.find('.cpp-edit-info-alumno-btn');

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