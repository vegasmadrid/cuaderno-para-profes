// assets/js/cpp-modales-actividad.js (NUEVA VERSIÓN CON FLUJO DE BORRADO)

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-modales-actividad.js no puede inicializarse.");
        return;
    }
    cpp.modals = cpp.modals || {};

    cpp.modals.actividades = {
        init: function() {
            this.bindEvents();
        },

        resetForm: function() {
            const $form = $('#cpp-form-actividad-evaluable-cuaderno');
            if ($form.length) {
                $form.trigger('reset');
                $form.find('#actividad_id_editar_cuaderno').val('');
                $form.find('#sesion_id_cuaderno').val('');
                $form.find('.cpp-form-group').show();
                $form.find('#cpp-eliminar-actividad-btn-modal').hide();
                $('#cpp-modal-actividad-titulo-cuaderno').text('Añadir Actividad Evaluable');
                $('#cpp-submit-actividad-btn-cuaderno-form').html('<span class="dashicons dashicons-saved"></span> Guardar Actividad');
            }
        },

        mostrarAnadir: function(sesionId = null) {
            if (!cpp.currentClaseIdCuaderno || !cpp.currentEvaluacionId) {
                alert('Por favor, selecciona una clase y una evaluación válidas para añadir la actividad.');
                return;
            }
            this.resetForm();
            $('#clase_id_actividad_cuaderno_form').val(cpp.currentClaseIdCuaderno);
            // --- MODIFICADO: Añadir el sesion_id al input hidden del formulario ---
            if (sesionId) {
                $('#sesion_id_cuaderno').val(sesionId);
            }
            const $form = $('#cpp-form-actividad-evaluable-cuaderno');
            const $selectCategoriasGroup = $form.find('[name="categoria_id_actividad"]').closest('.cpp-form-group');
            if (cpp.gradebook.currentCalculoNota === 'ponderada') {
                $selectCategoriasGroup.show();
                if (cpp.gradebook && typeof cpp.gradebook.actualizarSelectCategoriasActividad === 'function') {
                    cpp.gradebook.actualizarSelectCategoriasActividad(cpp.currentEvaluacionId, null);
                }
            } else {
                $selectCategoriasGroup.hide();
            }
            $('#cpp-modal-actividad-evaluable-cuaderno').fadeIn(function() {
                $(this).find('#nombre_actividad_cuaderno_input').focus();
            });
        },
        
        cargarParaEditar: function(elementClicked, event) {
            if (event && ($(event.target).is('button, a, input, .dashicons') || $(event.target).closest('button, a, input').length)) { return; }
            if(event) event.preventDefault();
            const $actividadTh = $(elementClicked);
            const $actividadDataContainer = $actividadTh.find('.cpp-editable-activity-name');
            if (!$actividadDataContainer.length) { return; }
            const actividadId = $actividadDataContainer.data('actividad-id');
            if (!actividadId) { alert('Error: No se pudo obtener el ID de la actividad.'); return; }

            this.cargarParaEditarId(actividadId);
        },

        cargarParaEditarId: function(actividadId) {
            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                data: { action: 'cpp_get_evaluable_activity_data', nonce: cppFrontendData.nonce, actividad_id: actividadId },
                success: (response) => {
                    if (response.success) { this.cargarConDatos(response.data); }
                    else { alert(response.data.message || 'Error al cargar los datos de la actividad.'); }
                },
                error: () => { alert('Error de conexión al cargar la actividad.'); }
            });
        },

        cargarConDatos: function(actividad) {
            if (!actividad || !actividad.id) { alert('Error: Datos de actividad no válidos.'); return; }
            this.resetForm();
            const $modal = $('#cpp-modal-actividad-evaluable-cuaderno');
            const $form = $modal.find('#cpp-form-actividad-evaluable-cuaderno');
            if (!$modal.length || !$form.length) { return; }

            const $selectCategoriasGroup = $form.find('[name="categoria_id_actividad"]').closest('.cpp-form-group');
            if (cpp.gradebook.currentCalculoNota === 'ponderada') {
                $selectCategoriasGroup.show();
                if (cpp.gradebook && typeof cpp.gradebook.actualizarSelectCategoriasActividad === 'function') {
                    cpp.gradebook.actualizarSelectCategoriasActividad(cpp.currentEvaluacionId, (success) => {
                        if (success) { $form.find('#categoria_id_actividad_cuaderno_select').val(actividad.categoria_id); }
                    });
                }
            } else { $selectCategoriasGroup.hide(); }

            $form.find('#actividad_id_editar_cuaderno').val(actividad.id);
            $form.find('#sesion_id_cuaderno').val(actividad.sesion_id || ''); // Asegurarse de que sea un string vacío si es null
            $form.find('#nombre_actividad_cuaderno_input').val(actividad.nombre_actividad);
            $form.find('#nota_maxima_actividad_cuaderno_input').val(parseFloat(actividad.nota_maxima).toFixed(2));
            $form.find('#fecha_actividad_cuaderno_input').val(actividad.fecha_actividad ? actividad.fecha_actividad.split(' ')[0] : '');
            $form.find('#descripcion_actividad_cuaderno_textarea').val(actividad.descripcion_actividad);
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
            if (!nombreActividad) { alert('El nombre de la actividad es obligatorio.'); return; }
            // ... (resto de validaciones)

            const originalBtnHtml = $btn.html();
            $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...');

            const ajaxData = {
                action: 'cpp_guardar_actividad_evaluable',
                nonce: cppFrontendData.nonce,
                clase_id_actividad: $form.find('[name="clase_id_actividad"]').val(),
                evaluacion_id: cpp.currentEvaluacionId,
                categoria_id_actividad: $form.find('[name="categoria_id_actividad"]').val() || '0',
                nombre_actividad: nombreActividad,
                nota_maxima_actividad: $form.find('[name="nota_maxima_actividad"]').val(),
                fecha_actividad: $form.find('[name="fecha_actividad"]').val(),
                descripcion_actividad: $form.find('[name="descripcion_actividad"]').val(),
                sesion_id: $form.find('[name="sesion_id"]').val(),
                actividad_id_editar: $form.find('#actividad_id_editar_cuaderno').val()
            };

            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json', data: ajaxData,
                success: (response) => {
                    if (response.success) {
                        $('#cpp-modal-actividad-evaluable-cuaderno').fadeOut();
                        $(document).trigger('cpp:forceGradebookReload');
                        $(document).trigger('cpp:forceProgramadorReload');
                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo guardar.'));
                    }
                },
                error: () => { alert('Error de conexión al guardar.'); },
                complete: () => { $btn.prop('disabled', false).html(originalBtnHtml); }
            });
        },

        // --- NUEVA LÓGICA DE BORRADO ---
        eliminar: function() {
            const $form = $('#cpp-form-actividad-evaluable-cuaderno');
            const actividadId = $form.find('#actividad_id_editar_cuaderno').val();
            const actividadNombre = $form.find('#nombre_actividad_cuaderno_input').val();
            const sesionId = $form.find('#sesion_id_cuaderno').val();

            if (!actividadId) {
                alert('No se ha podido identificar la actividad a eliminar.');
                return;
            }

            const $confirmModal = $('#cpp-modal-confirmar-borrado');
            $confirmModal.data('actividadId', actividadId).data('actividadNombre', actividadNombre);

            const $unlinkBtn = $confirmModal.find('#cpp-confirm-unlink-btn');
            const $explanation = $confirmModal.find('#cpp-confirm-delete-explanation');

            if (sesionId) {
                $unlinkBtn.show();
                $confirmModal.find('#cpp-confirm-delete-message').text(`La actividad "${actividadNombre}" está vinculada a una sesión de la programación.`);
                $explanation.html('<b>Desvincular:</b> la actividad se convertirá en una tarea no evaluable en la programación y se eliminará del cuaderno.<br><b>Eliminar de todas partes:</b> la actividad se borrará permanentemente del cuaderno y de la programación.');
            } else {
                $unlinkBtn.hide();
                $confirmModal.find('#cpp-confirm-delete-message').text(`¿Seguro que quieres eliminar "${actividadNombre}"?`);
                $explanation.text('Esta acción es irreversible y borrará todas las notas asociadas.');
            }

            $confirmModal.fadeIn();
        },

        ejecutarBorrado: function(esDesvincular) {
            const $confirmModal = $('#cpp-modal-confirmar-borrado');
            const actividadId = $confirmModal.data('actividadId');
            if (!actividadId) return;

            const action = esDesvincular ? 'cpp_unlink_actividad_evaluable' : 'cpp_eliminar_actividad';
            
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: { action: action, nonce: cppFrontendData.nonce, actividad_id: actividadId },
                success: function(response) {
                    if (response.success) {
                        $confirmModal.fadeOut();
                        $('#cpp-modal-actividad-evaluable-cuaderno').fadeOut();
                        $(document).trigger('cpp:forceGradebookReload');
                        $(document).trigger('cpp:forceProgramadorReload');
                    } else {
                        alert('Error al procesar la solicitud: ' + (response.data?.message || 'Error desconocido.'));
                    }
                },
                error: function() {
                    alert('Error de conexión al intentar procesar la solicitud.');
                }
            });
        },

        bindEvents: function() {
            const $modal = $('#cpp-modal-actividad-evaluable-cuaderno');
            $modal.on('submit', '#cpp-form-actividad-evaluable-cuaderno', (e) => { this.guardar(e); });

            // --- MODIFICADO: El botón de eliminar ahora llama a la nueva función ---
            $modal.on('click', '#cpp-eliminar-actividad-btn-modal', (e) => {
                e.preventDefault();
                this.eliminar();
            });

            // --- NUEVO: Listeners para el nuevo modal de confirmación ---
            const $confirmModal = $('#cpp-modal-confirmar-borrado');
            $confirmModal.on('click', '.cpp-modal-close', function() { $confirmModal.fadeOut(); });
            $confirmModal.on('click', '#cpp-confirm-unlink-btn', () => { this.ejecutarBorrado(true); });
            $confirmModal.on('click', '#cpp-confirm-delete-btn', () => { this.ejecutarBorrado(false); });
        }
    };

})(jQuery);