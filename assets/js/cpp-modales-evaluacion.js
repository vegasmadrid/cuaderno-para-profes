// assets/js/cpp-modales-evaluacion.js

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
            this.bindEvents();
        },

        refreshCategoriasList: function(evaluacionId, containerSelector) {
            const $container = $(containerSelector);
            if (!evaluacionId) {
                $container.html('<p class="cpp-error-message">Error: ID de evaluación no encontrado.</p>');
                return;
            }
            $container.data('evaluacion-id', evaluacionId);

            const self = this;
            
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_obtener_categorias_evaluacion',
                    nonce: cppFrontendData.nonce,
                    evaluacion_id: evaluacionId
                },
                success: function(response) {
                    if (response.success) {
                        $container.html(response.data.html);
                        self.resetCategoriaForm(containerSelector);
                    } else {
                        $container.html(`<p class="cpp-error-message">${response.data.message || 'Error al cargar las categorías.'}</p>`);
                    }
                },
                error: function() {
                    $container.html('<p class="cpp-error-message">Error de conexión.</p>');
                }
            });
        },

        resetCategoriaForm: function(containerSelector) {
            const $formContainer = $(`${containerSelector} .cpp-form-categoria-container`);
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

        cargarParaEditar: function(button) {
            const $settingsContainer = $(button).closest('#cpp-ponderaciones-settings-content');
            const $formContainer = $settingsContainer.find('.cpp-form-categoria-container');
            const categoriaId = $(button).data('categoria-id');
            
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
            const $settingsContainer = $btn.closest('#cpp-ponderaciones-settings-content');
            const evaluacionId = $settingsContainer.data('evaluacion-id');

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
            if (!evaluacionId) {
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
                    evaluacion_id: evaluacionId,
                    categoria_id_editar: categoriaId,
                    nombre_nueva_categoria: nombre,
                    porcentaje_nueva_categoria: porcentaje,
                    color_nueva_categoria: color
                },
                success: function(response) {
                    if (response.success) {
                        self.refreshCategoriasList(evaluacionId, '#cpp-ponderaciones-settings-content');
                        cpp.cuaderno.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, null, evaluacionId);
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
            const $settingsContainer = $btn.closest('#cpp-ponderaciones-settings-content');
            const evaluacionId = $settingsContainer.data('evaluacion-id');
            
            if (confirm(`¿Seguro que quieres eliminar la categoría "${categoriaNombre}"?`)) {
                const self = this;
                $.ajax({
                    url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                    data: { action: 'cpp_eliminar_categoria_evaluacion', nonce: cppFrontendData.nonce, categoria_id: categoriaId },
                    success: function(response) {
                        if (response.success) {
                            self.refreshCategoriasList(evaluacionId, '#cpp-ponderaciones-settings-content');
                            cpp.cuaderno.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, null, evaluacionId);
                        } else {
                            alert('Error: ' + (response.data.message || 'No se pudo eliminar.'));
                        }
                    }
                });
            }
        },

        showManageFinalGradeModal: function(event) {
            event.preventDefault();
            const $btn = $(event.currentTarget);
            const claseId = $btn.data('clase-id');
            if (!claseId) {
                alert('Error: No se encontró el ID de la clase.');
                return;
            }

            const $modal = $('#cpp-modal-manage-final-grade-evals');
            const $container = $modal.find('#cpp-manage-final-grade-evals-container');
            const $title = $modal.find('#cpp-modal-manage-final-grade-evals-title');

            const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();
            $title.text(`Configurar Media para: ${claseNombre}`);

            $container.html('<p class="cpp-cuaderno-cargando">Cargando...</p>');
            $modal.fadeIn();

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_get_final_grade_evals_config',
                    nonce: cppFrontendData.nonce,
                    clase_id: claseId
                },
                success: function(response) {
                    if (response.success) {
                        $container.html(response.data.html);
                    } else {
                        $container.html(`<p class="cpp-error-message">${response.data.message || 'Error al cargar la configuración.'}</p>`);
                    }
                },
                error: function() {
                    $container.html('<p class="cpp-error-message">Error de conexión.</p>');
                }
            });
        },

        saveFinalGradeConfig: function(event) {
            event.preventDefault();
            const $btn = $(event.currentTarget);
            const $form = $('#cpp-form-final-grade-evals');
            if (!$form.length) {
                alert('Error: No se encontró el formulario de configuración.');
                return;
            }

            const formData = $form.serialize();
            const originalBtnHtml = $btn.html();
            $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...');

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                data: formData + '&action=cpp_save_final_grade_evals_config' + '&nonce=' + cppFrontendData.nonce,
                dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        $('#cpp-modal-manage-final-grade-evals').fadeOut();
                        cpp.cuaderno.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, null, 'final');
                    } else {
                        alert('Error: ' + (response.data.message || 'No se pudo guardar la configuración.'));
                    }
                },
                error: function() {
                    alert('Error de conexión al guardar.');
                },
                complete: function() {
                    $btn.prop('disabled', false).html(originalBtnHtml);
                }
            });
        },

        bindEvents: function() {
            const $document = $(document);
            const self = this;

            // Evento para abrir el modal de configuración de la nota final
            $document.on('click', '#cpp-manage-final-grade-evals-btn', function(e) {
                self.showManageFinalGradeModal.call(self, e);
            });

            // Evento para guardar la configuración del modal de nota final
            $document.on('click', '#cpp-save-final-grade-evals-btn', function(e) {
                self.saveFinalGradeConfig.call(self, e);
            });

            const containerSelector = '#cpp-config-ponderaciones-container';
            
            $document.on('change', `${containerSelector} input[name="metodo_calculo_evaluacion"]`, function() {
                const nuevoMetodo = $(this).val();
                const $mainContainer = $(this).closest(containerSelector);
                const $settingsContainer = $mainContainer.find('#cpp-ponderaciones-settings-content');
                const evaluacionId = $settingsContainer.data('evaluacion-id');
                const $categoriasWrapper = $settingsContainer.find('#cpp-gestion-categorias-wrapper');

                if (!evaluacionId) {
                    alert('Error: No se pudo encontrar el ID de la evaluación.');
                    return;
                }

                if (nuevoMetodo === 'ponderada') {
                    $categoriasWrapper.slideDown();
                } else {
                    $categoriasWrapper.slideUp();
                }

                $.ajax({
                    url: cppFrontendData.ajaxUrl,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        action: 'cpp_guardar_metodo_calculo',
                        nonce: cppFrontendData.nonce,
                        evaluacion_id: evaluacionId,
                        metodo: nuevoMetodo
                    },
                    success: function(response) {
                        if (!response.success) {
                            alert('Error al guardar el método de cálculo.');
                        }
                        cpp.cuaderno.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, null, evaluacionId);
                    }
                });
            });

            $document.on('click', `${containerSelector} #cpp-submit-categoria-btn`, function() {
                self.submitCategoriaForm($(this));
            });

            $document.on('click', `${containerSelector} .cpp-btn-editar-categoria`, function(e) {
                e.stopPropagation();
                self.cargarParaEditar(this);
            });

            $document.on('click', `${containerSelector} #cpp-cancelar-edicion-categoria-btn`, function() {
                self.resetCategoriaForm('#cpp-ponderaciones-settings-content');
            });

            $document.on('click', `${containerSelector} .cpp-btn-eliminar-categoria`, function() {
                self.eliminarCategoria($(this));
            });
        }
    };

})(jQuery);