// assets/js/cpp-modales-evaluacion.js (v1.5.0 - FINAL)

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' no está definido. El módulo cpp-modales-evaluacion.js no puede inicializarse.");
        return;
    }
    cpp.modals = cpp.modals || {};

    cpp.modals.evaluacion = {
        
        currentEvaluacionId: null,

        init: function() {
            console.log("CPP Modals Evaluacion Module Initializing...");
        },

        toggleSettingsButton: function(show) {
            const $btn = $('#cpp-btn-evaluacion-settings');
            if (show && cpp.currentEvaluacionId) {
                $btn.show();
            } else {
                $btn.hide();
            }
        },

        mostrar: function() {
            this.currentEvaluacionId = cpp.currentEvaluacionId;
            if (!this.currentEvaluacionId) {
                alert('Error: No se ha seleccionado ninguna evaluación.');
                return;
            }

            const $modal = $('#cpp-modal-evaluacion-settings');
            const $container = $modal.find('#cpp-evaluacion-settings-container');
            const evaluacionNombre = $('#cpp-evaluacion-selector option:selected').text();

            $modal.find('#cpp-modal-evaluacion-settings-titulo').text(`Ajustes de Ponderación: ${evaluacionNombre}`);
            $container.html('<p class="cpp-cuaderno-cargando">Cargando...</p>');
            $modal.fadeIn();
            
            this.refreshCategoriasList();
        },
        
        refreshCategoriasList: function() {
            const $container = $('#cpp-evaluacion-settings-container');
            if (!this.currentEvaluacionId) {
                $container.html('<p class="cpp-error-message">Error: ID de evaluación no encontrado.</p>');
                return;
            }

            const self = this;
            
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_obtener_categorias_evaluacion',
                    nonce: cppFrontendData.nonce,
                    evaluacion_id: this.currentEvaluacionId
                },
                success: function(response) {
                    if (response.success) {
                        $container.html(response.data.html);
                        self.resetCategoriaForm();
                    } else {
                        $container.html(`<p class="cpp-error-message">${response.data.message || 'Error al cargar las categorías.'}</p>`);
                    }
                },
                error: function() {
                    $container.html('<p class="cpp-error-message">Error de conexión.</p>');
                }
            });
        },

        resetCategoriaForm: function() {
            const $formContainer = $('#cpp-evaluacion-settings-container .cpp-form-categoria-container');
            if (!$formContainer.length) return;

            $formContainer.find('#categoria_id_editar_modal').val('');
            $formContainer.find('#nombre_nueva_categoria_modal').val('');
            $formContainer.find('#porcentaje_nueva_categoria_modal').val('');
            
            const defaultColor = (cpp.pastelColors && cpp.pastelColors.length > 1) ? cpp.pastelColors[1] : '#ADD8E6';
            $formContainer.find('#color_nueva_categoria_hidden_modal').val(defaultColor);
            const $swatches = $formContainer.find('.cpp-category-color-swatches .cpp-color-swatch');
            $swatches.removeClass('selected');
            $swatches.filter(`[data-color="${defaultColor.toUpperCase()}"]`).addClass('selected');

            $formContainer.find('#cpp-form-categoria-titulo').text('Añadir Categoría');
            $formContainer.find('#cpp-submit-categoria-btn').html('<span class="dashicons dashicons-plus-alt"></span> Añadir');
            $formContainer.find('#cpp-cancelar-edicion-categoria-btn').hide();
        },

        cargarParaEditar: function(categoriaId) {
            const $formContainer = $('#cpp-evaluacion-settings-container .cpp-form-categoria-container');
            
            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                data: { action: 'cpp_obtener_datos_categoria', nonce: cppFrontendData.nonce, categoria_id: categoriaId },
                success: function(response) {
                    if (response.success && response.data.categoria) {
                        const cat = response.data.categoria;
                        $formContainer.find('#categoria_id_editar_modal').val(cat.id);
                        $formContainer.find('#nombre_nueva_categoria_modal').val(cat.nombre_categoria).focus();
                        $formContainer.find('#porcentaje_nueva_categoria_modal').val(cat.porcentaje);
                        $formContainer.find('#color_nueva_categoria_hidden_modal').val(cat.color);
                        
                        const $swatches = $formContainer.find('.cpp-category-color-swatches .cpp-color-swatch');
                        $swatches.removeClass('selected');
                        $swatches.filter(`[data-color="${cat.color.toUpperCase()}"]`).addClass('selected');
                        
                        $formContainer.find('#cpp-form-categoria-titulo').text('Editar Categoría');
                        $formContainer.find('#cpp-submit-categoria-btn').html('<span class="dashicons dashicons-edit"></span> Actualizar');
                        $formContainer.find('#cpp-cancelar-edicion-categoria-btn').show();
                    } else {
                        alert('Error al cargar los datos de la categoría.');
                    }
                }
            });
        },
        
        submitCategoriaForm: function($btn) {
            const $formContainer = $btn.closest('.cpp-form-categoria-container');
            const categoriaId = $formContainer.find('#categoria_id_editar_modal').val();
            const nombre = $formContainer.find('#nombre_nueva_categoria_modal').val().trim();
            const porcentaje = $formContainer.find('#porcentaje_nueva_categoria_modal').val();
            const color = $formContainer.find('#color_nueva_categoria_hidden_modal').val();
            const $errorContainer = $formContainer.find('#cpp-mensaje-error-categorias');

            $errorContainer.hide().text('');
            if (!nombre || !porcentaje) {
                $errorContainer.text('Nombre y porcentaje son obligatorios.').show();
                return;
            }
            if (this.currentEvaluacionId === null) {
                $errorContainer.text('Error: No se ha seleccionado una evaluación.').show();
                return;
            }

            const originalBtnHtml = $btn.html();
            $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span>');

            const self = this;
            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                data: {
                    action: 'cpp_guardar_o_actualizar_categoria',
                    nonce: cppFrontendData.nonce,
                    evaluacion_id: self.currentEvaluacionId,
                    categoria_id_editar: categoriaId,
                    nombre_nueva_categoria: nombre,
                    porcentaje_nueva_categoria: porcentaje,
                    color_nueva_categoria: color
                },
                success: function(response) {
                    if (response.success) {
                        self.refreshCategoriasList();
                        cpp.gradebook.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, null, self.currentEvaluacionId);
                    } else {
                        $errorContainer.text(response.data.message || 'Error desconocido').show();
                    }
                },
                error: function() {
                    $errorContainer.text('Error de conexión.').show();
                },
                complete: function() {
                    $btn.prop('disabled', false).html(originalBtnHtml);
                }
            });
        },

        eliminarCategoria: function($btn) {
            const categoriaId = $btn.data('categoria-id');
            const categoriaNombre = $btn.closest('li').find('.cpp-categoria-nombre-listado').text();
            
            if (confirm(`¿Seguro que quieres eliminar la categoría "${categoriaNombre}"?`)) {
                const self = this;
                $.ajax({
                    url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                    data: { action: 'cpp_eliminar_categoria_evaluacion', nonce: cppFrontendData.nonce, categoria_id: categoriaId },
                    success: function(response) {
                        if (response.success) {
                            self.refreshCategoriasList();
                            cpp.gradebook.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, null, self.currentEvaluacionId);
                        } else {
                            alert('Error: ' + (response.data.message || 'No se pudo eliminar.'));
                        }
                    }
                });
            }
        },

        bindEvents: function() {
            const $document = $(document);
            const self = this;

            // Abrir el modal
            $document.on('click', '#cpp-btn-evaluacion-settings', function() {
                self.mostrar();
            });

            const containerSelector = '#cpp-evaluacion-settings-container';

            // ====================================================================
            // --- INICIO DE LA NUEVA LÓGICA DE EVENTOS ---
            // ====================================================================
            
            // Evento para el cambio en los botones de radio
            $document.on('change', `${containerSelector} input[name="metodo_calculo_evaluacion"]`, function() {
                const nuevoMetodo = $(this).val();
                const $categoriasWrapper = $('#cpp-gestion-categorias-wrapper');

                // Ocultar o mostrar la sección de categorías al instante
                if (nuevoMetodo === 'ponderada') {
                    $categoriasWrapper.slideDown();
                } else {
                    $categoriasWrapper.slideUp();
                }

                // Guardar el cambio en la base de datos
                $.ajax({
                    url: cppFrontendData.ajaxUrl,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        action: 'cpp_guardar_metodo_calculo',
                        nonce: cppFrontendData.nonce,
                        evaluacion_id: self.currentEvaluacionId,
                        metodo: nuevoMetodo
                    },
                    success: function(response) {
                        if (!response.success) {
                            alert('Error al guardar el método de cálculo.');
                        }
                        // Recargar el cuaderno para que la nota final se actualice con el nuevo método
                        cpp.gradebook.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, null, self.currentEvaluacionId);
                    }
                });
            });

            // Eventos para el CRUD de categorías (dentro del nuevo modal)
            $document.on('click', `${containerSelector} #cpp-submit-categoria-btn`, function() {
                self.submitCategoriaForm($(this));
            });

            $document.on('click', `${containerSelector} .cpp-btn-editar-categoria`, function() {
                self.cargarParaEditar($(this).data('categoria-id'));
            });

            $document.on('click', `${containerSelector} #cpp-cancelar-edicion-categoria-btn`, function() {
                self.resetCategoriaForm();
            });

            $document.on('click', `${containerSelector} .cpp-btn-eliminar-categoria`, function() {
                self.eliminarCategoria($(this));
            });
            // ====================================================================
            // --- FIN DE LA NUEVA LÓGICA DE EVENTOS ---
            // ====================================================================
        }
    };

})(jQuery);