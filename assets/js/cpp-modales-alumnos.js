// assets/js/cpp-modales-alumnos.js
(function($) { // Envolvemos en IIFE y pasamos jQuery como $
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-modales-alumnos.js no puede inicializarse.");
        return;
    }
    cpp.modals = cpp.modals || {}; // Asegura que cpp.modals exista

    cpp.modals.alumnos = {
        currentClaseIdForStudentModal: null, 

        init: function() {
            console.log("CPP Modals Alumnos Module Initializing...");
            this.bindEvents();
        },

        // Llamado por cpp.modals.general.hideAll() y al mostrar/refrescar el modal
        resetForm: function() {
            // console.log("Reseteando formulario de modal de alumnos.");
            const $formAlumno = $('#cpp-form-nuevo-alumno'); 
            if ($formAlumno.length) {
                $formAlumno.trigger('reset');
                $formAlumno.find('#alumno_id_editar').val('');
                const $fotoPreview = $formAlumno.find('#cpp-foto-actual-preview'); // Asegurar que el selector es correcto
                if ($fotoPreview.length) {
                    $fotoPreview.empty().hide();
                }
                $('#cpp-form-alumno-titulo').text('Añadir Nuevo Alumno');
                $('#cpp-submit-alumno-btn').html('<span class="dashicons dashicons-saved"></span> Guardar Alumno');
            }
            // Asegurar que el formulario está oculto y la lista visible por defecto al resetear el modal
            $('#cpp-form-alumno').hide();
            const $alumnosContainer = $('#cpp-alumnos-container');
            if ($alumnosContainer.length) {
                 $alumnosContainer.find('.cpp-alumnos-list').show();
                 $alumnosContainer.find('.cpp-alumnos-header').show();
            }
        },

        mostrar: function(eventOrClaseId, claseNombreParam = null) {
            let claseId, claseNombre;

            if (typeof eventOrClaseId === 'object' && eventOrClaseId !== null && eventOrClaseId.currentTarget) {
                if (eventOrClaseId) eventOrClaseId.preventDefault();
                claseId = $(eventOrClaseId.currentTarget).data('clase-id');
                claseNombre = $(eventOrClaseId.currentTarget).data('clase-nombre') || "la clase";
            } else {
                claseId = eventOrClaseId;
                claseNombre = claseNombreParam || "la clase";
            }

            if (!claseId) {
                alert('Error: No se especificó la clase para gestionar alumnos.');
                return;
            }
            this.currentClaseIdForStudentModal = claseId;
            
            const $modal = $('#cpp-modal-alumnos');
            const $container = $modal.find('#cpp-alumnos-container');
            
            $modal.find('#cpp-modal-alumnos-title').text(`Gestión de Alumnos: ${claseNombre}`);
            $container.html('<p class="cpp-cuaderno-cargando">Cargando alumnos...</p>');
            
            this.resetForm();

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_obtener_alumnos',
                    nonce: cppFrontendData.nonce,
                    clase_id: this.currentClaseIdForStudentModal
                },
                success: function(response) {
                    if (response.success) {
                        $container.html(response.data.html);
                        $container.find('#cpp-form-alumno').hide(); 
                    } else {
                        $container.html(`<p class="cpp-error-message">${response.data.message || 'Error al cargar alumnos.'}</p>`);
                    }
                },
                error: function() {
                    $container.html('<p class="cpp-error-message">Error de conexión al cargar alumnos.</p>');
                },
                complete: function() {
                    $modal.fadeIn(function() {
                        // Hook para el tutorial: se ejecuta DESPUÉS de que el modal es visible.
                        if (cpp.tutorial && cpp.tutorial.isActive && cpp.tutorial.currentStep === 3) {
                            cpp.tutorial.nextStep();
                        }
                    });
                }
            });
        },

        refreshList: function() {
            if (!this.currentClaseIdForStudentModal) {
                console.error("No hay ID de clase para refrescar la lista de alumnos.");
                return;
            }
            const $container = $('#cpp-alumnos-container');
            this.resetForm(); // Oculta el formulario y prepara para mostrar la lista

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_obtener_alumnos',
                    nonce: cppFrontendData.nonce,
                    clase_id: this.currentClaseIdForStudentModal
                },
                success: function(response) {
                    if (response.success) {
                        $container.html(response.data.html);
                        $container.find('#cpp-form-alumno').hide();
                    } else {
                        $container.html(`<p class="cpp-error-message">${response.data.message || 'Error al refrescar.'}</p>`);
                    }
                },
                error: function() {
                    $container.html('<p class="cpp-error-message">Error de conexión al refrescar.</p>');
                }
            });
        },

        mostrarForm: function(event, alumnoData = null) {
            if(event) event.preventDefault();
            
            const $modalContent = $('#cpp-modal-alumnos .cpp-modal-content');
            const $formContainer = $modalContent.find('#cpp-form-alumno');
            const $form = $formContainer.find('form#cpp-form-nuevo-alumno');
            const $tituloForm = $formContainer.find('#cpp-form-alumno-titulo');
            const $submitBtn = $formContainer.find('#cpp-submit-alumno-btn');
            const $fotoPreview = $formContainer.find('#cpp-foto-actual-preview'); // Asegurar selector correcto

            $form.trigger('reset');
            $fotoPreview.empty().hide();
            $form.find('[name="clase_id_form_alumno"]').val(this.currentClaseIdForStudentModal);

            if (alumnoData && alumnoData.id) { // Editando
                $tituloForm.text(`Editar Alumno: ${alumnoData.nombre} ${alumnoData.apellidos}`);
                $form.find('#alumno_id_editar').val(alumnoData.id);
                $form.find('[name="nombre_alumno"]').val(alumnoData.nombre);
                $form.find('[name="apellidos_alumno"]').val(alumnoData.apellidos);
                if (alumnoData.foto) {
                    $fotoPreview.html(`<p><small>Foto actual:</small></p><img src="${$('<div>').text(alumnoData.foto).html()}" alt="Foto actual" style="max-width:100px; max-height:100px; border-radius:50%;">`).show();
                }
                $submitBtn.html('<span class="dashicons dashicons-edit"></span> Actualizar Alumno');
            } else { // Creando
                $tituloForm.text('Añadir Nuevo Alumno');
                $form.find('#alumno_id_editar').val('');
                $submitBtn.html('<span class="dashicons dashicons-saved"></span> Guardar Alumno');
            }

            $modalContent.find('.cpp-alumnos-list').hide();
            $modalContent.find('.cpp-alumnos-header').hide();
            $formContainer.show().find('[name="nombre_alumno"]').focus();
        },

        guardar: function(event) {
            event.preventDefault();
            const formElement = event.target; 
            const $form = $(formElement);
            const $btn = $form.find('button[type="submit"]');
            const formData = new FormData(formElement);
            
            formData.append('action', 'cpp_guardar_alumno');
            formData.append('nonce', cppFrontendData.nonce);

            const originalBtnHtml = $btn.html();
            $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...');
            const self = this;

            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', data: formData,
                processData: false, contentType: false, dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        if (cpp.tutorial && cpp.tutorial.isActive && cpp.tutorial.currentStep === 6) {
                            cpp.tutorial.nextStep();
                        }
                        self.refreshList(); 
                        if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function' && 
                            cpp.currentClaseIdCuaderno && 
                            self.currentClaseIdForStudentModal == cpp.currentClaseIdCuaderno) {
                            
                            let currentClassName = "Clase"; 
                            const $classNameSpan = $('#cpp-cuaderno-nombre-clase-activa-a1.cpp-top-bar-class-name');
                            if($classNameSpan.length && $classNameSpan.text().trim()){
                                currentClassName = $classNameSpan.text().trim();
                            }
                            cpp.gradebook.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, currentClassName);
                        }
                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo guardar.'));
                    }
                },
                error: function() { alert('Error de conexión al guardar alumno.'); },
                complete: function() { $btn.prop('disabled', false).html(originalBtnHtml); }
            });
        },

        cargarParaEditar: function(event) {
            event.preventDefault();
            const alumnoId = $(event.currentTarget).data('alumno-id');
            if (!alumnoId) return;
            const self = this;

            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                data: {
                    action: 'cpp_obtener_datos_alumno',
                    nonce: cppFrontendData.nonce,
                    alumno_id: alumnoId
                },
                success: function(response) {
                    if (response.success && response.data.alumno) {
                        self.mostrarForm(null, response.data.alumno);
                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo cargar.'));
                    }
                },
                error: function() { alert('Error de conexión al cargar datos.'); }
            });
        },

        eliminar: function(event) {
            event.preventDefault();
            const $btn = $(event.currentTarget);
            const alumnoId = $btn.data('alumno-id');
            const alumnoNombre = $btn.closest('.cpp-alumno-card').find('.cpp-alumno-info h4').text() || 'este alumno';
            const self = this;

            if (!alumnoId || !this.currentClaseIdForStudentModal) {
                alert('Error: Falta información para eliminar al alumno.');
                return;
            }

            if (confirm(`¿Estás seguro de que quieres eliminar a ${alumnoNombre}?\nEsta acción también eliminará todas sus calificaciones.`)) {
                const originalBtnHtml = $btn.html();
                $btn.prop('disabled',true).html('<span class="dashicons dashicons-update dashicons-spin"></span>');
                
                $.ajax({
                    url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                    data: {
                        action: 'cpp_eliminar_alumno',
                        nonce: cppFrontendData.nonce,
                        alumno_id: alumnoId,
                        clase_id_actual: self.currentClaseIdForStudentModal 
                    },
                    success: function(response) {
                        if (response.success) {
                            self.refreshList();
                            if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function' && 
                                cpp.currentClaseIdCuaderno &&
                                self.currentClaseIdForStudentModal == cpp.currentClaseIdCuaderno) {
                                
                                let currentClassName = "Clase";
                                const $classNameSpan = $('#cpp-cuaderno-nombre-clase-activa-a1.cpp-top-bar-class-name');
                                if($classNameSpan.length && $classNameSpan.text().trim()){
                                     currentClassName = $classNameSpan.text().trim();
                                }
                                cpp.gradebook.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, currentClassName);
                            }
                        } else {
                            alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo eliminar.'));
                            $btn.prop('disabled',false).html(originalBtnHtml);
                        }
                    },
                    error: function() {
                        alert('Error de conexión al eliminar alumno.');
                        $btn.prop('disabled',false).html(originalBtnHtml);
                    }
                });
            }
        },

        bindEvents: function() {
            console.log("Binding Modals Alumnos events...");
            const $document = $(document);
            const self = this;

            $document.on('click', '#cpp-nuevo-alumno-btn', function(e) {
                if (cpp.tutorial && cpp.tutorial.isActive && cpp.tutorial.currentStep === 4) {
                    cpp.tutorial.nextStep();
                }
                self.mostrarForm.call(self, e, null);
            });

            $document.on('submit', '#cpp-form-nuevo-alumno', function(e) {
                self.guardar.call(self, e);
            });

            $document.on('click', '#cpp-alumnos-container .cpp-alumno-actions .cpp-btn-editar', function(e) {
                self.cargarParaEditar.call(self, e);
            });

            $document.on('click', '#cpp-alumnos-container .cpp-alumno-actions .cpp-btn-eliminar-alumno', function(e) {
                self.eliminar.call(self, e);
            });
        }
    };

})(jQuery);