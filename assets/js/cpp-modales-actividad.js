// assets/js/cpp-modales-actividad.js (v1.5.4 - FINAL)

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-modales-actividad.js no puede inicializarse.");
        return;
    }
    cpp.modals = cpp.modals || {}; 

    cpp.modals.actividades = {
        init: function() {
            console.log("CPP Modals Actividades Module Initializing...");
        },

        resetForm: function() {
            const $form = $('#cpp-form-actividad-evaluable-cuaderno');
            if ($form.length) {
                $form.trigger('reset');
                $form.find('#actividad_id_editar_cuaderno').val('');
                // Mostramos todos los campos por defecto al resetear, la lógica de mostrar/ocultar se hará después
                $form.find('.cpp-form-group').show();
                $form.find('#cpp-eliminar-actividad-btn-modal').hide(); 
                $('#cpp-modal-actividad-titulo-cuaderno').text('Añadir Actividad Evaluable');
                $('#cpp-submit-actividad-btn-cuaderno-form').html('<span class="dashicons dashicons-saved"></span> Guardar Actividad');
            }
        },

        mostrarAnadir: function() { 
            if (!cpp.currentClaseIdCuaderno || !cpp.currentEvaluacionId) {
                alert('Por favor, selecciona una clase y una evaluación válidas para añadir la actividad.');
                return;
            }
            
            this.resetForm(); 
            $('#clase_id_actividad_cuaderno_form').val(cpp.currentClaseIdCuaderno);
            const $form = $('#cpp-form-actividad-evaluable-cuaderno');
            const $selectCategoriasGroup = $form.find('[name="categoria_id_actividad"]').closest('.cpp-form-group');

            // Lógica principal: decidir si mostrar el selector de categoría
            if (cpp.gradebook.currentCalculoNota === 'ponderada') {
                $selectCategoriasGroup.show();
                if (cpp.gradebook && typeof cpp.gradebook.actualizarSelectCategoriasActividad === 'function') {
                    cpp.gradebook.actualizarSelectCategoriasActividad(cpp.currentEvaluacionId, function(success) {
                        if (!success) {
                             alert("Error al cargar las categorías. Inténtalo de nuevo.");
                        }
                    });
                }
            } else {
                // Si el modo es 'total', simplemente ocultamos el campo.
                $selectCategoriasGroup.hide();
            }

            $('#cpp-modal-actividad-evaluable-cuaderno').fadeIn().find('#nombre_actividad_cuaderno_input').focus();
        },
        
        cargarParaEditar: function(elementClicked, event) { 
            if (event && ($(event.target).is('button, a, input, .dashicons') || $(event.target).closest('button, a, input').length)) {
                return; 
            }
            if(event) event.preventDefault(); 

            const $actividadTh = $(elementClicked); 
            const $actividadDataContainer = $actividadTh.find('.cpp-editable-activity-name'); 
            
            if (!$actividadDataContainer.length) { return; }
            const actividadId = $actividadDataContainer.data('actividad-id'); 
            if (!actividadId) { alert('Error: No se pudo obtener el ID de la actividad.'); return; }

            const nombreActividad = $actividadDataContainer.data('nombre-actividad'); 
            const categoriaId = $actividadDataContainer.data('categoria-id'); 
            const notaMaxima = $actividadDataContainer.data('nota-maxima'); 
            const fechaActividad = $actividadDataContainer.data('fecha-actividad'); 
            const descripcionActividad = $actividadDataContainer.data('descripcion-actividad'); 
            
            this.resetForm(); 

            const $modal = $('#cpp-modal-actividad-evaluable-cuaderno'); 
            const $form = $modal.find('#cpp-form-actividad-evaluable-cuaderno'); 
            if (!$modal.length || !$form.length) { alert("Error: Formulario de actividades no disponible."); return; } 

            const $selectCategoriasGroup = $form.find('[name="categoria_id_actividad"]').closest('.cpp-form-group');

            // Lógica para mostrar/ocultar el campo al editar
            if (cpp.gradebook.currentCalculoNota === 'ponderada') {
                $selectCategoriasGroup.show();
                if (cpp.gradebook && typeof cpp.gradebook.actualizarSelectCategoriasActividad === 'function') {
                    cpp.gradebook.actualizarSelectCategoriasActividad(cpp.currentEvaluacionId, function(success) {
                        if (success) {
                            $form.find('#categoria_id_actividad_cuaderno_select').val(categoriaId);
                        }
                    });
                }
            } else {
                $selectCategoriasGroup.hide();
            }

            $form.find('#actividad_id_editar_cuaderno').val(actividadId); 
            $form.find('#nombre_actividad_cuaderno_input').val(nombreActividad); 
            $form.find('#nota_maxima_actividad_cuaderno_input').val(parseFloat(notaMaxima).toFixed(2)); 
            $form.find('#fecha_actividad_cuaderno_input').val(fechaActividad ? fechaActividad.split(' ')[0] : ''); 
            $form.find('#descripcion_actividad_cuaderno_textarea').val(descripcionActividad); 
            $form.find('#clase_id_actividad_cuaderno_form').val(cpp.currentClaseIdCuaderno); 
            
            $modal.find('#cpp-modal-actividad-titulo-cuaderno').text('Editar Actividad Evaluable'); 
            $modal.find('#cpp-submit-actividad-btn-cuaderno-form').html('<span class="dashicons dashicons-edit"></span> Actualizar Actividad'); 
            $form.find('#cpp-eliminar-actividad-btn-modal').show();
            $modal.fadeIn(); 
            $form.find('#nombre_actividad_cuaderno_input').focus();
        },

        guardar: function(eventForm) { 
            eventForm.preventDefault(); 
            const $form = $(eventForm.target); 
            const $btn = $form.find('button[type="submit"]'); 
            const nombreActividad = $form.find('[name="nombre_actividad"]').val().trim(); 
            const claseId = $form.find('[name="clase_id_actividad"]').val(); 
            const notaMaxima = $form.find('[name="nota_maxima_actividad"]').val(); 
            const actividadIdEditar = $form.find('#actividad_id_editar_cuaderno').val(); 
            
            const $selectCategoria = $form.find('[name="categoria_id_actividad"]');
            const $formGroupCategoria = $selectCategoria.closest('.cpp-form-group');
            let categoriaId = $selectCategoria.val();

            if ($formGroupCategoria.is(':hidden')) {
                categoriaId = '0';
            }
            
            if (!nombreActividad) {
                alert('El nombre de la actividad es obligatorio.'); 
                return; 
            }
            if ($formGroupCategoria.is(':visible') && (categoriaId === '' || categoriaId === null)) { 
                alert('Por favor, selecciona una categoría de la lista.'); 
                return; 
            } 
            if (parseFloat(notaMaxima) <= 0 || isNaN(parseFloat(notaMaxima))) { 
                alert('La nota máxima debe ser un número positivo.'); 
                return; 
            } 
            
            const originalBtnHtml = $btn.html(); 
            $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...'); 
            const ajaxData = { 
                action: 'cpp_guardar_actividad_evaluable', 
                nonce: cppFrontendData.nonce, 
                clase_id_actividad: claseId,
                evaluacion_id: cpp.currentEvaluacionId,
                categoria_id_actividad: categoriaId,
                nombre_actividad: nombreActividad, 
                nota_maxima_actividad: notaMaxima, 
                fecha_actividad: $form.find('[name="fecha_actividad"]').val(), 
                descripcion_actividad: $form.find('[name="descripcion_actividad"]').val(),
            }; 
            if (actividadIdEditar) {
                ajaxData.actividad_id_editar = actividadIdEditar; 
            }

            $.ajax({ 
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json', data: ajaxData, 
                success: function(response) { 
                    if (response.success) { 
                        $('#cpp-modal-actividad-evaluable-cuaderno').fadeOut(); 
                        if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function' && cpp.currentClaseIdCuaderno) {
                            let currentClassName = "Cuaderno";
                            const $classNameSpan = $('#cpp-cuaderno-nombre-clase-activa-a1.cpp-top-bar-class-name');
                            if($classNameSpan.length && $classNameSpan.text().trim()){ currentClassName = $classNameSpan.text().trim(); }
                            cpp.gradebook.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, currentClassName, cpp.currentEvaluacionId); 
                        }
                    } else { 
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo guardar.')); 
                    }
                }, 
                error: function() { alert('Error de conexión al guardar.'); }, 
                complete: function() { $btn.prop('disabled', false).html(originalBtnHtml); } 
            }); 
        },

        eliminar: function() {
            const $form = $('#cpp-form-actividad-evaluable-cuaderno');
            const actividadId = $form.find('#actividad_id_editar_cuaderno').val();
            const actividadNombre = $form.find('#nombre_actividad_cuaderno_input').val();
            if (!actividadId) { alert('No se ha podido identificar la actividad a eliminar.'); return; }
            if (confirm(`¿Estás SEGURO de que quieres eliminar la actividad "${actividadNombre}"?\n\n¡Esta acción borrará también TODAS las calificaciones asociadas y no se puede deshacer!`)) {
                const $btnEliminar = $('#cpp-eliminar-actividad-btn-modal');
                const originalBtnHtml = $btnEliminar.html();
                $btnEliminar.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span>');
                $.ajax({
                    url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                    data: { action: 'cpp_eliminar_actividad', nonce: cppFrontendData.nonce, actividad_id: actividadId },
                    success: function(response) {
                        if (response.success) {
                            $('#cpp-modal-actividad-evaluable-cuaderno').fadeOut();
                            if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function' && cpp.currentClaseIdCuaderno) {
                                let currentClassName = $('#cpp-cuaderno-nombre-clase-activa-a1.cpp-top-bar-class-name').text().trim() || "Cuaderno";
                                cpp.gradebook.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, currentClassName, cpp.currentEvaluacionId);
                            }
                        } else {
                            alert('Error al eliminar: ' + (response.data && response.data.message ? response.data.message : 'Error desconocido.'));
                        }
                    },
                    error: function() { alert('Error de conexión al intentar eliminar la actividad.'); },
                    complete: function() { $btnEliminar.prop('disabled', false).html(originalBtnHtml); }
                });
            }
        },

        bindEvents: function() {
            console.log("Binding Modals Actividades events...");
            const $modal = $('#cpp-modal-actividad-evaluable-cuaderno');
            
            $modal.on('submit', '#cpp-form-actividad-evaluable-cuaderno', (e) => { 
                this.guardar(e); 
            });

            $modal.on('click', '#cpp-eliminar-actividad-btn-modal', (e) => {
                e.preventDefault();
                this.eliminar();
            });
        }
    };

})(jQuery);