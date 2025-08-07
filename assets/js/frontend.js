jQuery(document).ready(function($) {
    const cpp = {
        currentClaseIdForModal: null,
        currentTotalPorcentajeCategorias: 0,
        currentClaseIdCuaderno: null,
        isSidebarVisible: false,
        currentBaseNotaFinal: 100, 
        pastelColors: [
            '#FFB6C1', '#ADD8E6', '#98FB98', '#E6E6FA', 
            '#FFDAB9', '#FFFFE0', '#AFEEEE', '#F08080', 
            '#D8BFD8', '#EEE8AA', '#FFE4E1', '#B0E0E6'
        ],
        tempUploadedFilePath: null, 
        tempUploadedFileName: null,

        init: function() {
            console.log("CPP Plugin JS Initializing...");
            if (typeof cppFrontendData === 'undefined' || !cppFrontendData.ajaxUrl || !cppFrontendData.nonce) {
                console.error("FATAL: cppFrontendData no está definido o está incompleto. El plugin no funcionará correctamente.");
                $('#cpp-cuaderno-contenido').html('<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">Error crítico: Faltan datos de configuración del plugin. Contacte al administrador.</p></div>');
                return; 
            }
            console.log("cppFrontendData disponible:", cppFrontendData);

            this.bindEvents();
            this.initializeCuadernoView();
            this.initializeColorSwatches();
            this.initSortableClases(); 
        }, 

        initSortableClases: function() {
            const $clasesList = $('.cpp-sidebar-clases-list');
            if ($clasesList.length && typeof $clasesList.sortable === 'function') {
                $clasesList.sortable({
                    axis: 'y', 
                    items: '> li.cpp-sidebar-clase-item', 
                    cursor: 'move',
                    placeholder: 'cpp-sortable-placeholder', 
                    helper: 'clone', 
                    opacity: 0.7,
                    update: function(event, ui) {
                        const orderedClassIds = $(this).find('li.cpp-sidebar-clase-item').map(function() {
                            return $(this).data('clase-id');
                        }).get(); 
                        $.ajax({
                            url: cppFrontendData.ajaxUrl,
                            type: 'POST',
                            dataType: 'json',
                            data: {
                                action: 'cpp_guardar_orden_clases',
                                nonce: cppFrontendData.nonce,
                                orden_clases: orderedClassIds 
                            },
                            success: function(response) {
                                if (response.success) {
                                    console.log("Orden de clases guardado correctamente.");
                                } else {
                                    console.error("Error al guardar el orden de las clases:", response.data.message);
                                    alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo guardar el orden.'));
                                }
                            },
                            error: function(jqXHR, textStatus, errorThrown) {
                                console.error("Error AJAX al guardar orden de clases:", textStatus, errorThrown, jqXHR.responseText);
                                alert('Error de conexión al guardar el orden de las clases.');
                            }
                        });
                    }
                });
            } else {
                if (!$clasesList.length) {
                    // console.warn("Contenedor de lista de clases '.cpp-sidebar-clases-list' no encontrado para sortable.");
                }
                if (typeof $clasesList.sortable !== 'function') {
                    // console.warn("jQuery UI Sortable no está cargado o disponible.");
                }
            }
        },

        initializeCuadernoView: function() {
            if ($('.cpp-cuaderno-viewport-classroom').length === 0) {
                $('html, body').removeClass('cpp-plugin-active'); // Asegura quitarla si el viewport no está
                $('body').removeClass('cpp-cuaderno-page-active');
                return;
            }
            
            console.log("Cuaderno Classroom View Initializing.");
            $('html, body').addClass('cpp-plugin-active'); // Añade clase para control de overflow global
            $('body').addClass('cpp-cuaderno-page-active');

            let claseIdToLoad = null;
            let claseNombreToLoad = null;
            let $itemToActivate = null;
            const $clasesSidebarItems = $('.cpp-sidebar-clases-list .cpp-sidebar-clase-item');

            if (typeof localStorage !== 'undefined' && cppFrontendData && cppFrontendData.userId && cppFrontendData.userId !== '0') {
                const lastOpenedClaseId = localStorage.getItem('cpp_last_opened_clase_id_user_' + cppFrontendData.userId);
                if (lastOpenedClaseId) {
                    $itemToActivate = $clasesSidebarItems.filter(`[data-clase-id="${lastOpenedClaseId}"]`);
                    if ($itemToActivate.length > 0) {
                        claseIdToLoad = lastOpenedClaseId;
                        claseNombreToLoad = $itemToActivate.data('clase-nombre');
                        const baseNotaFinal = $itemToActivate.data('base-nota-final');
                        if (typeof baseNotaFinal !== 'undefined') {
                            cpp.currentBaseNotaFinal = parseFloat(baseNotaFinal) || 100;
                        }
                    } else {
                        localStorage.removeItem('cpp_last_opened_clase_id_user_' + cppFrontendData.userId);
                    }
                }
            }

            if (!claseIdToLoad && $clasesSidebarItems.length > 0) {
                $itemToActivate = $clasesSidebarItems.first();
                claseIdToLoad = $itemToActivate.data('clase-id');
                claseNombreToLoad = $itemToActivate.data('clase-nombre');
                const baseNotaFinal = $itemToActivate.data('base-nota-final');
                if (typeof baseNotaFinal !== 'undefined') {
                    cpp.currentBaseNotaFinal = parseFloat(baseNotaFinal) || 100;
                }
            }

            if (claseIdToLoad && $itemToActivate && $itemToActivate.length > 0) {
                $clasesSidebarItems.removeClass('cpp-sidebar-item-active');
                $itemToActivate.addClass('cpp-sidebar-item-active');
                this.cargarContenidoCuaderno(claseIdToLoad, claseNombreToLoad);
            } else if ($clasesSidebarItems.length === 0) {
                // Si #cpp-cuaderno-nombre-clase-activa-a1 está en la barra superior, se actualiza desde cargarContenidoCuaderno
                // o se deja el texto por defecto de la barra.
                // $('#cpp-cuaderno-nombre-clase-activa-a1').text('Cuaderno'); // Ya no está en A1
                $('#cpp-cuaderno-contenido').html('<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-mensaje">No tienes clases creadas.</p></div>');
            } else {
                // $('#cpp-cuaderno-nombre-clase-activa-a1').text('Error'); // Ya no está en A1
                $('#cpp-cuaderno-contenido').html('<p class="cpp-cuaderno-cargando">Error al seleccionar una clase para cargar.</p>');
            }
        },

        initializeColorSwatches: function() {
            $(document).on('click', '.cpp-color-swatches-container .cpp-color-swatch', function() {
                const $swatch = $(this);
                const color = $swatch.data('color');
                const $container = $swatch.closest('.cpp-color-swatches-container');
                let $hiddenInput;

                if ($container.hasClass('cpp-category-color-swatches')) {
                    $hiddenInput = $container.closest('.cpp-form-group').find('#color_nueva_categoria_hidden_modal');
                    if (!$hiddenInput.length) { // Fallback si la estructura es más plana
                        $hiddenInput = $('#color_nueva_categoria_hidden_modal');
                    }
                } else { // Asume que es para el color de la clase
                    $hiddenInput = $('#color_clase_hidden_modal');
                }

                if ($hiddenInput && $hiddenInput.length) {
                    $hiddenInput.val(color);
                }
                
                $container.find('.cpp-color-swatch').removeClass('selected');
                $swatch.addClass('selected');
            });
        },

        bindEvents: function() {
            console.log("Binding CPP events...");
            
            $(document).on('click', '#cpp-nueva-clase-btn, #cpp-btn-nueva-clase-sidebar', function(e){ cpp.showModalClaseParaCrear.call(this, e); });
            $(document).on('click', '.cpp-modal-close', function(e){ cpp.hideModals.call(this, e); });
            
            $(document).on('click', function(event) { 
                if ($(event.target).is('.cpp-modal') || $(event.target).is('#cpp-sidebar-overlay')) {
                    cpp.hideModals(); 
                    if (cpp.isSidebarVisible && $(event.target).is('#cpp-sidebar-overlay')) {
                        cpp.toggleSidebar(); 
                    }
                }
            });

            $(document).on('submit', '#cpp-form-clase', function(e){ cpp.guardarClase.call(this, e); });
            $(document).on('click', '#cpp-eliminar-clase-modal-btn', function(e){ cpp.handleEliminarClaseDesdeModal.call(this, e); });
            
            $(document).on('click', '.cpp-sidebar-clase-alumnos-btn', function(e){ cpp.mostrarAlumnos.call(this, e); });
            $(document).on('click', '#cpp-nuevo-alumno-btn', function(e){ cpp.mostrarFormAlumno.call(this, e); }); 
            $(document).on('submit', '#cpp-form-nuevo-alumno', function(e){ cpp.guardarAlumno.call(this, e); });
            $(document).on('click', '.cpp-alumno-actions .cpp-btn-editar', function(e){ cpp.cargarDatosAlumnoParaEditar.call(this, e); }); 
            $(document).on('click', '.cpp-alumno-actions .cpp-btn-eliminar-alumno', function(e){ cpp.eliminarAlumno.call(this, e); });

            $(document).on('click', 'td.cpp-cuaderno-td-alumno', function(e){ cpp.handleClickAlumnoCell.call(this, e); });
            $(document).on('click', 'th.cpp-cuaderno-th-final', function(e){ cpp.handleClickNotaFinalHeader.call(this, e); }); 
            
            $(document).on('click', '.cpp-sidebar-clase-settings-btn', function(e){ cpp.showModalClaseParaEditar.call(this, e); }); 
            
            $(document).on('click', '#cpp-modal-clase .cpp-tab-link', function(e){ cpp.handleTabClick.call(this, e); });

            $(document).on('click', '#cpp-clase-modal-categorias-container #cpp-submit-categoria-btn', function(e){ cpp.submitCategoriaForm.call(this, e); }); 
            $(document).on('click', '#cpp-clase-modal-categorias-container .cpp-btn-eliminar-categoria', function(e){ cpp.eliminarCategoria.call(this, e); }); 
            $(document).on('click', '.cpp-btn-editar-categoria', function(e){ cpp.handleEditarCategoriaBtnClick.call(this, e); });
            $(document).on('click', '#cpp-cancelar-edicion-categoria-btn', function(e) {
                e.preventDefault();
                cpp.resetCategoriaForm();
            });

            $(document).on('click', '.cpp-cuaderno-th-actividad', function(e){ cpp.cargarDatosActividadParaEditarCuaderno.call(this, e); });
            
            $(document).on('click', '#cpp-a1-add-activity-btn', function(e) { 
                e.stopPropagation();
                cpp.mostrarModalAnadirActividadCuaderno();
            });
            $(document).on('submit', '#cpp-form-actividad-evaluable-cuaderno', function(e){ cpp.guardarActividadEvaluableCuaderno.call(this, e); });

            // Manejadores para las notas (ya corregidos)
            $(document).on('keydown', '.cpp-input-nota', function(e){ cpp.manejarNavegacionTablaNotas.call(this, e); });
            $(document).on('blur', '.cpp-input-nota', function(e) { cpp.guardarNotaDesdeInput.call(this, e, null); });
            $(document).on('focusin', '.cpp-input-nota', function(e){
                cpp.limpiarErrorNotaInput.call(this, e);
                if (!$(this).data('original-nota-set')) { 
                    $(this).data('original-nota', $(this).val().trim());
                    $(this).data('original-nota-set', true);
                }
            });
            $(document).on('focusout', '.cpp-input-nota', function(e){
                $(this).removeData('original-nota-set');
            });
            
            // Botón de menú de clases (ahora en la barra superior)
            $(document).on('click', '#cpp-a1-menu-btn-toggle', function(e) { 
                console.log("Botón Menú Clases (#cpp-a1-menu-btn-toggle) CLICADO. Elemento:", this); // DEBUG
                e.preventDefault(); 
                e.stopPropagation(); 
                cpp.toggleSidebar.call(this,e); 
            });
            
            $(document).on('click', '#cpp-sidebar-close-btn', function(e) { 
                console.log("Botón Cerrar Sidebar (#cpp-sidebar-close-btn) CLICADO."); // DEBUG
                e.stopPropagation();
                if (cpp.isSidebarVisible) cpp.toggleSidebar();
            });
            $(document).on('click', '.cpp-sidebar-clases-list .cpp-sidebar-clase-item a', function(e){ cpp.seleccionarClaseDesdeSidebar.call(this, e); });
            
            // Descarga Excel
            $(document).on('click', '#cpp-a1-download-excel-btn', function(e){ cpp.showExcelOptionsModal.call(this, e);});
            $(document).on('click', '#cpp-btn-download-excel-current-class', function(e){ cpp.handleExcelDownload.call(this, e, 'single_class'); });
            $(document).on('click', '#cpp-btn-download-excel-all-classes', function(e){ cpp.handleExcelDownload.call(this, e, 'all_classes'); });

            // Importar Alumnos Excel
            $(document).on('click', '#cpp-a1-import-students-btn', function(e){ cpp.showImportStudentsModal.call(this, e); });
            $(document).on('click', '#cpp-btn-download-student-template', function(e){ cpp.downloadStudentTemplate.call(this, e); });
            $(document).on('change', '#student_excel_file_input', function(e){ cpp.handleStudentFileSelected.call(this, e); });
            $(document).on('click', '#cpp-btn-upload-excel-file', function(e){ cpp.triggerStudentExcelUpload.call(this, e); });
            $(document).on('click', '#cpp-btn-confirm-student-import', function(e){ cpp.confirmStudentImport.call(this, e); });
            $(document).on('click', '#cpp-btn-cancel-excel-import', function(e){ cpp.resetImportStudentsModalToStep1.call(this, e); });

            $(document).on('click', '#cpp-a1-notebook-settings-btn', function(e){ 
                e.stopPropagation(); 
                e.preventDefault();
                if (cpp.currentClaseIdCuaderno) {
                    cpp.mostrarModalPonderaciones(cpp.currentClaseIdCuaderno); 
                } else {
                    alert('Por favor, selecciona una clase primero.');
                }
            });
            console.log("CPP Event binding complete.");
        },
        
        toggleSidebar: function() {
            console.log("cpp.toggleSidebar INVOCADA. Estado actual isSidebarVisible:", cpp.isSidebarVisible); 
            const $sidebar = $('#cpp-cuaderno-sidebar');
            const $overlay = $('#cpp-sidebar-overlay');
            if (!$sidebar.length) { 
                console.error("Elemento Sidebar '#cpp-cuaderno-sidebar' NO ENCONTRADO.");
                return; 
            }
            cpp.isSidebarVisible = !cpp.isSidebarVisible;
            console.log("Nuevo estado isSidebarVisible:", cpp.isSidebarVisible);
            $sidebar.toggleClass('cpp-sidebar-visible', cpp.isSidebarVisible);
            if ($overlay.length) { 
                $overlay.toggleClass('cpp-sidebar-visible', cpp.isSidebarVisible); 
            } else {
                // console.warn("Elemento Overlay '#cpp-sidebar-overlay' NO ENCONTRADO.");
            }
            $('body').toggleClass('cpp-cuaderno-sidebar-is-open', cpp.isSidebarVisible);
            console.log("Visibilidad del Sidebar cambiada. Clases CSS aplicadas.");
        },

        handleTabClick: function(e) { 
            e.preventDefault();
            const $this = $(this);
            const tabId = $this.data('tab');
            $this.closest('.cpp-tabs-container').find('.cpp-tab-content').removeClass('active').hide();
            $this.closest('.cpp-tab-nav').find('.cpp-tab-link').removeClass('active');
            $('#' + tabId).addClass('active').show();
            $this.addClass('active');
            if (tabId === 'cpp-tab-ponderaciones') {
                const claseIdParaPonderaciones = $('#cpp-modal-clase #clase_id_editar').val(); 
                if (claseIdParaPonderaciones && claseIdParaPonderaciones !== '' && claseIdParaPonderaciones !== '0') { 
                    cpp.currentClaseIdForModal = claseIdParaPonderaciones; 
                    cpp.refreshCategoriasList(claseIdParaPonderaciones, '#cpp-clase-modal-categorias-container'); 
                } else {
                    cpp.refreshCategoriasList(0, '#cpp-clase-modal-categorias-container'); 
                }
            }
        },
     
        showModalClaseParaCrear: function(e) { 
            cpp.currentClaseIdForModal = null; 
            const $modal = $('#cpp-modal-clase');
            const $form = $('#cpp-form-clase');
            if ($form.length) {
                $form.trigger('reset'); 
                $form.find('#clase_id_editar').val(''); 
                const $defaultClassColorSwatch = $modal.find('.cpp-color-swatches-container:not(.cpp-category-color-swatches) .cpp-color-swatch.selected');
                if ($defaultClassColorSwatch.length) {
                    $('#color_clase_hidden_modal').val($defaultClassColorSwatch.data('color'));
                } else {
                    const firstClassSwatch = $modal.find('.cpp-color-swatches-container:not(.cpp-category-color-swatches) .cpp-color-swatch:first');
                    if (firstClassSwatch.length) {
                        $('#color_clase_hidden_modal').val(firstClassSwatch.data('color'));
                        $modal.find('.cpp-color-swatches-container:not(.cpp-category-color-swatches) .cpp-color-swatch').removeClass('selected');
                        firstClassSwatch.addClass('selected');
                    }
                }
                
                $form.find('#base_nota_final_clase_modal').val('100.00'); 
                $('#cpp-modal-clase-titulo').text('Crear Nueva Clase');
                $('#cpp-submit-clase-btn-modal').html('<span class="dashicons dashicons-saved"></span> Guardar Clase');
                
                $('#cpp-eliminar-clase-modal-btn').hide();
                $modal.find('.cpp-tab-nav').hide(); 
                $modal.find('#cpp-tab-ponderaciones').hide().removeClass('active');
                $modal.find('.cpp-tab-link').removeClass('active');
                $modal.find('.cpp-tab-link[data-tab="cpp-tab-general"]').addClass('active'); 
                $modal.find('#cpp-tab-general').addClass('active').show();
                cpp.refreshCategoriasList(0, '#cpp-clase-modal-categorias-container'); 
            }
            $modal.fadeIn().find('#nombre_clase_modal').focus();
        },

        showModalClaseParaEditar: function(e, goToPonderaciones = false, claseIdFromParam = null) { 
            if (e && typeof e.preventDefault === 'function') {
                e.preventDefault();
                e.stopPropagation();
            }
            let claseId = claseIdFromParam;
            if (!claseId && typeof this !== 'undefined' && this.nodeType === 1 && $(this).data && typeof $(this).data === 'function' && $(this).data('clase-id')) { 
                claseId = $(this).data('clase-id');
            }
            if (!claseId) { 
                claseId = cpp.currentClaseIdCuaderno;
            }
            
            if (!claseId) {
                alert('Error: No se pudo identificar la clase para editar.');
                return;
            }
            cpp.currentClaseIdForModal = claseId; 

            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                data: { action: 'cpp_obtener_datos_clase_completa', nonce: cppFrontendData.nonce, clase_id: claseId },
                success: function(response) {
                    if (response.success && response.data.clase) {
                        const clase = response.data.clase;
                        const $modal = $('#cpp-modal-clase');
                        const $form = $('#cpp-form-clase');
                        if (!$modal.length || !$form.length) { return; }
                        $form.trigger('reset'); 
                        $form.find('#clase_id_editar').val(clase.id);
                        $form.find('#nombre_clase_modal').val(clase.nombre);
                        
                        const $classColorSwatchesContainer = $modal.find('.cpp-color-swatches-container:not(.cpp-category-color-swatches)');
                        let colorParaSeleccionar = clase.color;
                        let swatchEncontrado = $classColorSwatchesContainer.find(`.cpp-color-swatch[data-color="${(clase.color || '').toUpperCase()}"]`);

                        if (!swatchEncontrado.length || !clase.color) { 
                            colorParaSeleccionar = $classColorSwatchesContainer.find('.cpp-color-swatch:first').data('color') || '#2962FF'; 
                        }
                        
                        $('#color_clase_hidden_modal').val(colorParaSeleccionar);
                        $classColorSwatchesContainer.find('.cpp-color-swatch').removeClass('selected');
                        $classColorSwatchesContainer.find(`.cpp-color-swatch[data-color="${colorParaSeleccionar.toUpperCase()}"]`).addClass('selected');

                        $form.find('#base_nota_final_clase_modal').val(clase.base_nota_final ? parseFloat(clase.base_nota_final).toFixed(2) : '100.00');
                        $('#cpp-modal-clase-titulo').text(`Editar Clase: ${clase.nombre}`);
                        $('#cpp-submit-clase-btn-modal').html('<span class="dashicons dashicons-edit"></span> Actualizar Clase');
                        
                        $('#cpp-eliminar-clase-modal-btn').show();
                        $modal.find('.cpp-tab-nav').show(); 
                        $modal.find('.cpp-tab-link').removeClass('active');
                        $modal.find('.cpp-tab-content').removeClass('active').hide();

                        if (goToPonderaciones) {
                            $modal.find('.cpp-tab-link[data-tab="cpp-tab-ponderaciones"]').addClass('active');
                            $modal.find('#cpp-tab-ponderaciones').addClass('active').show();
                            cpp.refreshCategoriasList(claseId, '#cpp-clase-modal-categorias-container');
                        } else {
                            $modal.find('.cpp-tab-link[data-tab="cpp-tab-general"]').addClass('active');
                            $modal.find('#cpp-tab-general').addClass('active').show();
                            cpp.refreshCategoriasList(claseId, '#cpp-clase-modal-categorias-container'); 
                        }
                        $modal.fadeIn();
                        $form.find('#nombre_clase_modal').focus();
                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudieron cargar los datos de la clase.'));
                    }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    console.error("Error AJAX (obtener datos clase):", textStatus, errorThrown, jqXHR.responseText);
                    alert('Error de conexión al obtener datos de la clase.');
                }
            });
        },
        
        mostrarModalPonderaciones: function(claseId) { 
            if (!claseId) { claseId = cpp.currentClaseIdCuaderno; }
            if (!claseId) { alert('Error: ID de clase no definido para ponderaciones.'); return; }
            cpp.showModalClaseParaEditar(null, true, claseId);
        },

        handleClickNotaFinalHeader: function(e) { 
            if (e.target !== this && $(e.target).closest(this).length) {
                if ($(e.target).is('button, a, input') || $(e.target).closest('button, a, input').length) { return; }
            }
            e.preventDefault();
            if (!cpp.currentClaseIdCuaderno) { alert('Por favor, selecciona una clase primero.'); return; }
            cpp.showModalClaseParaEditar(null, false, cpp.currentClaseIdCuaderno);
        },
        
               
        guardarClase: function(e) { 
            e.preventDefault();
            const $form = $(this); 
            const $btn = $form.find('button[type="submit"]');
            const claseIdEditar = $form.find('#clase_id_editar').val();
            const esEdicion = claseIdEditar && claseIdEditar !== '';

            const nombreClase = $form.find('[name="nombre_clase"]').val().trim();
            const baseNotaFinalClase = $form.find('[name="base_nota_final_clase"]').val().trim();
            const colorClase = $form.find('#color_clase_hidden_modal').val();

            if (nombreClase === '') {
                alert('El nombre de la clase es obligatorio.');
                return;
            }
            if (nombreClase.length > 16) { 
                alert('El nombre de la clase no puede exceder los 16 caracteres.');
                return;
            }
            
            const baseNotaNumerica = parseFloat(baseNotaFinalClase.replace(',', '.'));
            if (baseNotaFinalClase === '' || isNaN(baseNotaNumerica) || baseNotaNumerica <= 0) {
                alert('Por favor, introduce un valor numérico positivo para la Base de Nota Final.');
                return;
            }
            
            const btnTextProcesando = esEdicion ? 'Actualizando...' : 'Guardando...';
            const btnTextOriginal = esEdicion ? '<span class="dashicons dashicons-edit"></span> Actualizar Clase' : '<span class="dashicons dashicons-saved"></span> Guardar Clase';

            $btn.prop('disabled', true).html(`<span class="dashicons dashicons-update dashicons-spin"></span> ${btnTextProcesando}`);
            
            const ajaxData = {
                action: 'cpp_crear_clase', 
                nonce: cppFrontendData.nonce,
                clase_id_editar: claseIdEditar, 
                nombre_clase: nombreClase,
                color_clase: colorClase,
                base_nota_final_clase: baseNotaNumerica.toFixed(2) 
            };

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: ajaxData,
                success: function(response) {
                    if (response.success) {
                        window.location.reload(); 
                    } else {
                        let errorMessage = 'Error desconocido.';
                        if (response.data && response.data.message) { errorMessage = response.data.message; }
                        alert('Error: ' + errorMessage);
                        console.error("Error guardando/actualizando clase:", response);
                    }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    console.error("Error AJAX (guardar/actualizar clase):", textStatus, errorThrown, jqXHR.responseText);
                    alert('Error de conexión.');
                },
                complete: function() {
                    $btn.prop('disabled', false).html(btnTextOriginal);
                }
            });
        },
        
        handleEliminarClaseDesdeModal: function(e) { 
            e.preventDefault();
            const $btnEliminar = $(this);
            const $form = $('#cpp-form-clase');
            const claseId = $form.find('#clase_id_editar').val();
            const claseNombre = $form.find('#nombre_clase_modal').val().trim() || 'esta clase';

            if (!claseId) {
                alert('Error: No se pudo identificar la clase para eliminar. Asegúrate de que la clase está cargada para edición.');
                return;
            }

            if (confirm(`¿Estás SEGURO de que quieres eliminar la clase "${claseNombre}"?\n\nATENCIÓN: Esta acción eliminará permanentemente la clase, todos sus alumnos, actividades evaluables y todas las calificaciones asociadas.\n\nESTA ACCIÓN NO SE PUEDE DESHACER.`)) {
                const originalBtnHtml = $btnEliminar.html();
                $btnEliminar.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Eliminando...');
                $('#cpp-submit-clase-btn-modal').prop('disabled', true); 

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
                            alert(response.data.message || 'Clase eliminada correctamente. La página se recargará.');
                            window.location.reload();
                        } else {
                            alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo eliminar la clase.'));
                            $btnEliminar.prop('disabled', false).html(originalBtnHtml);
                            $('#cpp-submit-clase-btn-modal').prop('disabled', false);
                        }
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        console.error("Error AJAX (eliminar clase modal):", textStatus, errorThrown, jqXHR.responseText);
                        alert('Error de conexión al intentar eliminar la clase.');
                        $btnEliminar.prop('disabled', false).html(originalBtnHtml);
                        $('#cpp-submit-clase-btn-modal').prop('disabled', false);
                    }
                });
            }
        },

        hideModals: function() { 
            const $visibleModal = $('.cpp-modal:visible');
            
            if ($visibleModal.is('#cpp-modal-clase')) {
                const $formClase = $('#cpp-form-clase');
                if ($formClase.length) {
                    $formClase.trigger('reset'); 
                    const $defaultClassColorSwatch = $visibleModal.find('.cpp-color-swatches-container:not(.cpp-category-color-swatches) .cpp-color-swatch.selected');
                    if ($defaultClassColorSwatch.length) {
                        $('#color_clase_hidden_modal').val($defaultClassColorSwatch.data('color'));
                    } else {
                        const firstClassSwatch = $visibleModal.find('.cpp-color-swatches-container:not(.cpp-category-color-swatches) .cpp-color-swatch:first');
                        if(firstClassSwatch.length){
                            $('#color_clase_hidden_modal').val(firstClassSwatch.data('color'));
                            $visibleModal.find('.cpp-color-swatches-container:not(.cpp-category-color-swatches) .cpp-color-swatch').removeClass('selected');
                            firstClassSwatch.addClass('selected');
                        }
                    }
                    
                    cpp.resetCategoriaForm(); 

                    $formClase.find('#base_nota_final_clase_modal').val('100.00');
                    $formClase.find('#clase_id_editar').val('');
                    $('#cpp-modal-clase-titulo').text('Crear Nueva Clase');
                    $('#cpp-submit-clase-btn-modal').html('<span class="dashicons dashicons-saved"></span> Guardar Clase');
                    
                    $('#cpp-eliminar-clase-modal-btn').hide();
                    $visibleModal.find('.cpp-tab-nav').hide(); 
                    $visibleModal.find('.cpp-tab-link').removeClass('active');
                    $visibleModal.find('.cpp-tab-content').removeClass('active').hide();
                    $visibleModal.find('.cpp-tab-link[data-tab="cpp-tab-general"]').addClass('active'); 
                    $visibleModal.find('#cpp-tab-general').addClass('active').show();
                    $('#cpp-clase-modal-categorias-container').html(''); 
                }
            } else if ($visibleModal.is('#cpp-modal-alumnos')) {
                const $alumnosContainer = $('#cpp-alumnos-container');
                $('#cpp-form-alumno').hide(); 
                $alumnosContainer.find('.cpp-alumnos-list').show(); 
                $alumnosContainer.find('.cpp-alumnos-header').show(); 
                cpp.resetAlumnoForm(); 
            } else if ($visibleModal.is('#cpp-modal-actividad-evaluable-cuaderno')) {
                const $formActividadCuaderno = $('#cpp-form-actividad-evaluable-cuaderno');
                if ($formActividadCuaderno.length) {
                    $formActividadCuaderno.trigger('reset');
                    $formActividadCuaderno.find('#actividad_id_editar_cuaderno').val('');
                    $('#cpp-modal-actividad-titulo-cuaderno').text('Añadir Actividad Evaluable');
                    $('#cpp-submit-actividad-btn-cuaderno-form').html('<span class="dashicons dashicons-saved"></span> Guardar Actividad');
                    if(cpp.currentClaseIdCuaderno) { 
                        $('#clase_id_actividad_cuaderno_form').val(cpp.currentClaseIdCuaderno); 
                    }
                }
            } else if ($visibleModal.is('#cpp-modal-excel-options')) {
                // No necesita reseteo especial
            } else if ($visibleModal.is('#cpp-modal-import-students')) {
                cpp.resetImportStudentsModalToStep1();
            }
            $visibleModal.fadeOut(); 
        },

        // --- Funciones para Categorías de Evaluación ---
        handleEditarCategoriaBtnClick: function(e) { 
            e.preventDefault();
            const categoriaId = $(this).data('categoria-id');
            cpp.cargarDatosCategoriaParaEditar(categoriaId);
        },

        cargarDatosCategoriaParaEditar: function(categoriaId) {
            if (!categoriaId) return;
            
            const $formPonderaciones = $('#cpp-clase-modal-categorias-container');
            const $formTitulo = $formPonderaciones.find('#cpp-form-categoria-titulo');
            const $nombreInput = $formPonderaciones.find('#nombre_nueva_categoria_modal');
            const $porcentajeInput = $formPonderaciones.find('#porcentaje_nueva_categoria_modal');
            const $colorHiddenInput = $formPonderaciones.find('#color_nueva_categoria_hidden_modal');
            const $categoriaIdEditarInput = $formPonderaciones.find('#categoria_id_editar_modal'); 
            const $submitBtn = $formPonderaciones.find('#cpp-submit-categoria-btn');
            const $cancelBtn = $formPonderaciones.find('#cpp-cancelar-edicion-categoria-btn');

            if (!$nombreInput.length) { 
                console.warn("Formulario de categorías no encontrado al intentar cargar para editar.");
                return;
            }

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_obtener_datos_categoria',
                    nonce: cppFrontendData.nonce,
                    categoria_id: categoriaId
                },
                success: function(response) {
                    if (response.success && response.data.categoria) {
                        const cat = response.data.categoria;
                        
                        if($categoriaIdEditarInput.length) $categoriaIdEditarInput.val(cat.id); else console.error("Input #categoria_id_editar_modal no encontrado");
                        
                        $nombreInput.val(cat.nombre_categoria).focus();
                        $porcentajeInput.val(cat.porcentaje);
                        
                        const catColor = cat.color || cpp.pastelColors[1];
                        if($colorHiddenInput.length) $colorHiddenInput.val(catColor); else console.error("Input #color_nueva_categoria_hidden_modal no encontrado");
                        
                        const $categorySwatches = $formPonderaciones.find('.cpp-category-color-swatches .cpp-color-swatch');
                        $categorySwatches.removeClass('selected');
                        $categorySwatches.filter(`[data-color="${catColor.toUpperCase()}"]`).addClass('selected');

                        $formTitulo.text('Editar Categoría');
                        $submitBtn.html('<span class="dashicons dashicons-edit"></span> Actualizar Categoría');
                        $cancelBtn.show();
                        $('#cpp-mensaje-error-categorias').hide().text('');
                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudieron cargar los datos de la categoría.'));
                    }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    console.error("Error AJAX (obtener datos categoria):", textStatus, errorThrown, jqXHR.responseText);
                    alert('Error de conexión al cargar datos de la categoría.');
                }
            });
        },
        
        resetCategoriaForm: function() { 
            const $formPonderaciones = $('#cpp-clase-modal-categorias-container'); 
            if (!$formPonderaciones.length) return;

            const $formContainer = $formPonderaciones.find('.cpp-form-categoria-container'); 
            if (!$formContainer.length) return;

            $formContainer.find('#categoria_id_editar_modal').val('');
            $formContainer.find('#nombre_nueva_categoria_modal').val('');
            $formContainer.find('#porcentaje_nueva_categoria_modal').val('');
            
            const defaultCategoryColor = cpp.pastelColors[1]; 
            const $colorHiddenInput = $formContainer.find('#color_nueva_categoria_hidden_modal');
            if ($colorHiddenInput.length) $colorHiddenInput.val(defaultCategoryColor);
            
            const $categorySwatches = $formContainer.find('.cpp-category-color-swatches .cpp-color-swatch');
            if($categorySwatches.length){
                $categorySwatches.removeClass('selected');
                $categorySwatches.filter(`[data-color="${defaultCategoryColor}"]`).addClass('selected');
            }

            $formContainer.find('#cpp-form-categoria-titulo').text('Añadir Categoría');
            $formContainer.find('#cpp-submit-categoria-btn').html('<span class="dashicons dashicons-plus-alt"></span> Añadir');
            $formContainer.find('#cpp-cancelar-edicion-categoria-btn').hide();
            $formContainer.find('#cpp-mensaje-error-categorias').hide().text('');
        },

        submitCategoriaForm: function(e) { 
            e.preventDefault(); 
            const $btn = $(this); 
            const $formContainer = $btn.closest('.cpp-form-categoria-container'); 
            
            const categoriaIdEditar = $formContainer.find('#categoria_id_editar_modal').val();
            const esEdicion = categoriaIdEditar && categoriaIdEditar !== '';

            const nombreCategoria = $formContainer.find('[name="nombre_nueva_categoria"]').val().trim(); 
            const porcentaje = parseInt($formContainer.find('[name="porcentaje_nueva_categoria"]').val()); 
            const claseId = $formContainer.find('[name="clase_id_categoria"]').val(); 
            const colorCategoria = $formContainer.find('[name="color_nueva_categoria"]').val(); 
            const $errorMessageContainer = $formContainer.find('#cpp-mensaje-error-categorias'); 
            
            $errorMessageContainer.hide().text(''); 

            if (!claseId || claseId === '0' || claseId === '') {
                $errorMessageContainer.text('Por favor, guarda primero la información general de la clase.').show();
                return;
            }
            if(nombreCategoria===''){ $errorMessageContainer.text('El nombre no puede estar vacío.').show(); return; } 
            if(isNaN(porcentaje)||porcentaje < 0 ||porcentaje>100){ $errorMessageContainer.text('El porcentaje debe ser entre 0 y 100.').show(); return; } 
            
            const originalBtnHtml = $btn.html(); 
            $btn.prop('disabled',true).html(`<span class="dashicons dashicons-update dashicons-spin"></span> ${esEdicion ? 'Actualizando...' : 'Guardando...'}`); 
            
            const ajaxData = {
                action:'cpp_guardar_o_actualizar_categoria', 
                nonce:cppFrontendData.nonce,
                clase_id_categoria:claseId, 
                nombre_nueva_categoria:nombreCategoria,
                porcentaje_nueva_categoria:porcentaje,
                color_nueva_categoria: colorCategoria
            };
            if (esEdicion) {
                ajaxData.categoria_id_editar = categoriaIdEditar;
            }

            $.ajax({
                url:cppFrontendData.ajaxUrl,type:'POST',dataType:'json', 
                data: ajaxData, 
                success:function(response){ 
                    if(response.success){ 
                        cpp.refreshCategoriasList(claseId, '#cpp-clase-modal-categorias-container'); 
                    } else{ 
                        $errorMessageContainer.text(response.data.message||'Error al procesar la categoría.').show(); 
                    }
                }, 
                error:function(){ $errorMessageContainer.text('Error de conexión.').show(); }, 
                complete:function(){ $btn.prop('disabled',false).html(originalBtnHtml); } 
            }); 
        },

        refreshCategoriasList: function(claseId, containerSelector = '#cpp-clase-modal-categorias-container') { 
            if(!claseId && claseId !== 0){ 
                if (containerSelector === '#cpp-clase-modal-categorias-container') { 
                    $(containerSelector).html('<p>Guarda la clase primero para añadir ponderaciones.</p>'); 
                } 
                cpp.resetCategoriaForm(); 
                return; 
            } 
            const $container=$(containerSelector); 
            $container.html('<p class="cpp-cuaderno-cargando">Cargando categorías...</p>'); 
            $.ajax({
                url:cppFrontendData.ajaxUrl,
                type:'POST',
                dataType:'json',
                data:{action:'cpp_obtener_categorias_evaluacion',nonce:cppFrontendData.nonce,clase_id:claseId}, 
                success:function(response){ 
                    if(response.success){ 
                        $container.html(response.data.html); 
                        cpp.resetCategoriaForm(); 
                        
                        cpp.currentTotalPorcentajeCategorias=0; 
                        const $listaCategorias = $container.find('.cpp-categorias-list li');
                        if ($listaCategorias.length > 0) {
                            $listaCategorias.each(function() {
                                const texto = $(this).find('.cpp-categoria-porcentaje-listado').text() || $(this).text(); 
                                const match = texto.match(/(\d+)%/);
                                if (match && match[1]) {
                                    cpp.currentTotalPorcentajeCategorias += parseInt(match[1]);
                                }
                            });
                        }
                        const $totalDisplay = $container.find('#cpp-total-porcentaje-display');
                        if ($totalDisplay.length) {
                            $totalDisplay.text(cpp.currentTotalPorcentajeCategorias);
                        }
                        $container.find('input[name="clase_id_categoria"]').val(claseId > 0 ? claseId : '0'); 
                        
                        if (claseId !== 0 && claseId === cpp.currentClaseIdCuaderno) {
                            cpp.actualizarSelectCategoriasActividad(claseId);
                        }
                    } else { 
                        $container.html(`<p class="cpp-error-message">${response.data && response.data.message ? response.data.message : 'Error al cargar categorías.'}</p>`); 
                        cpp.resetCategoriaForm();
                    }
                }, 
                error:function(){ 
                    $container.html('<p class="cpp-error-message">Error de conexión.</p>'); 
                    cpp.resetCategoriaForm();
                }
            }); 
        },
        eliminarCategoria: function(e) { 
            e.preventDefault(); 
            const $btn = $(this); 
            const categoriaId = $btn.data('categoria-id'); 
            const categoriaNombre = $btn.closest('li').find('.cpp-categoria-nombre-listado').text() || 'esta categoría';
            const claseId = $('#clase_id_categoria_hidden_field').val(); 
            
            if(!categoriaId || !claseId || claseId === '0'){
                alert('Error: No se pudo identificar la categoría o la clase para la eliminación.');
                return;
            } 
            if(confirm(`¿Eliminar la categoría "${categoriaNombre}"?`)){ 
                const originalBtnHtml=$btn.html(); 
                $btn.prop('disabled',true).html('<span class="dashicons dashicons-update dashicons-spin"></span>'); 
                $.ajax({
                    url:cppFrontendData.ajaxUrl,type:'POST',dataType:'json', 
                    data:{action:'cpp_eliminar_categoria_evaluacion',nonce:cppFrontendData.nonce,categoria_id:categoriaId,clase_id:claseId}, 
                    success:function(response){ 
                        if(response.success){
                            cpp.refreshCategoriasList(claseId, '#cpp-clase-modal-categorias-container');
                        } else{
                            alert('Error: '+(response.data&&response.data.message?response.data.message:'No se pudo eliminar.'));
                            $btn.prop('disabled',false).html(originalBtnHtml);
                        }
                    }, 
                    error:function(){
                        alert('Error de conexión.');
                        $btn.prop('disabled',false).html(originalBtnHtml);
                    }
                }); 
            } 
        },
        
        seleccionarClaseDesdeSidebar: function(e) { 
            e.preventDefault(); const $link = $(this); const $sidebarItem = $link.parent('li.cpp-sidebar-clase-item'); if ($sidebarItem.hasClass('cpp-sidebar-item-active')) { if (cpp.isSidebarVisible) cpp.toggleSidebar(); return; } const claseId = $sidebarItem.data('clase-id'); const claseNombre = $sidebarItem.data('clase-nombre'); const baseNotaFinal = $sidebarItem.data('base-nota-final'); if (typeof baseNotaFinal !== 'undefined') { cpp.currentBaseNotaFinal = parseFloat(baseNotaFinal) || 100; } $('.cpp-sidebar-clases-list .cpp-sidebar-clase-item').removeClass('cpp-sidebar-item-active'); $sidebarItem.addClass('cpp-sidebar-item-active'); cpp.cargarContenidoCuaderno(claseId, claseNombre); if (cpp.isSidebarVisible) cpp.toggleSidebar(); 
        },
        
        cargarContenidoCuaderno: function(claseId, claseNombre) { 
            console.log("DEBUG: cargarContenidoCuaderno - INICIO - Clase ID:", claseId, "Nombre:", claseNombre); 
            const $contenidoCuaderno = $('#cpp-cuaderno-contenido'); 
            cpp.currentClaseIdCuaderno = claseId; 
            if (claseId && typeof localStorage !== 'undefined' && cppFrontendData && cppFrontendData.userId && cppFrontendData.userId !== '0') { 
                try { localStorage.setItem('cpp_last_opened_clase_id_user_' + cppFrontendData.userId, claseId); } 
                catch (e) { console.warn("cargarContenidoCuaderno - No se pudo guardar la última clase abierta en localStorage:", e); } 
            } 
            if (typeof cppFrontendData === 'undefined' || !cppFrontendData.ajaxUrl || !cppFrontendData.nonce) { 
                console.error("DEBUG: cargarContenidoCuaderno - FATAL: cppFrontendData no definido o incompleto."); 
                $contenidoCuaderno.html('<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">Error crítico de configuración del plugin.</p></div>'); 
                if ($('#cpp-cuaderno-nombre-clase-activa-a1').length) $('#cpp-cuaderno-nombre-clase-activa-a1').text('Error Config.'); 
                return;
            } 
            if (claseId) { 
                console.log("DEBUG: cargarContenidoCuaderno - Estableciendo mensaje 'Cargando cuaderno...'");
                $contenidoCuaderno.html('<p class="cpp-cuaderno-cargando">Cargando cuaderno...</p>'); 
                if ($('#cpp-cuaderno-nombre-clase-activa-a1').length) $('#cpp-cuaderno-nombre-clase-activa-a1').text(claseNombre); 
                
                console.log("DEBUG: cargarContenidoCuaderno - Llamando a actualizarSelectCategoriasActividad para claseId:", claseId);
                cpp.actualizarSelectCategoriasActividad(claseId, function(success) {
                    console.log("DEBUG: cargarContenidoCuaderno - Callback de actualizarSelectCategoriasActividad. Success:", success);
                });

                console.log("DEBUG: cargarContenidoCuaderno - Preparando llamada AJAX principal a cpp_cargar_cuaderno_clase...");
                $.ajax({
                    url:cppFrontendData.ajaxUrl,
                    type:'POST',
                    dataType:'json',
                    data:{action:'cpp_cargar_cuaderno_clase',nonce:cppFrontendData.nonce,clase_id:claseId}, 
                    success:function(response){ 
                        console.log("DEBUG: cargarContenidoCuaderno - Éxito en AJAX principal. Respuesta:", response); 
                        if(response && response.success && response.data && typeof response.data.html_cuaderno !== 'undefined'){ 
                            $contenidoCuaderno.empty().html(response.data.html_cuaderno); 
                            if(response.data.nombre_clase && $('#cpp-cuaderno-nombre-clase-activa-a1').length) $('#cpp-cuaderno-nombre-clase-activa-a1').text(response.data.nombre_clase); 
                            if (typeof response.data.base_nota_final !== 'undefined') { 
                                cpp.currentBaseNotaFinal = parseFloat(response.data.base_nota_final) || 100; 
                                const $thFinal = $('.cpp-cuaderno-th-final'); 
                                if ($thFinal.length) { 
                                    $thFinal.data('base-nota-final', cpp.currentBaseNotaFinal); 
                                    let displayBase = cpp.currentBaseNotaFinal; 
                                    if (cpp.currentBaseNotaFinal == Math.floor(cpp.currentBaseNotaFinal)) { displayBase = parseInt(cpp.currentBaseNotaFinal); } 
                                    else { displayBase = parseFloat(cpp.currentBaseNotaFinal).toFixed(2); } 
                                    $thFinal.find('.cpp-nota-final-base-info').text(`(sobre ${displayBase})`); 
                                } 
                            } 
                            $('#clase_id_actividad_cuaderno_form').val(claseId); 
                            console.log("DEBUG: cargarContenidoCuaderno - Contenido del cuaderno cargado y renderizado.");
                        }else{ 
                            let errorMsg = 'Error al cargar el contenido del cuaderno. Respuesta inesperada del servidor.'; 
                            if(response && response.data && response.data.message) { errorMsg = response.data.message; } 
                            console.error("DEBUG: cargarContenidoCuaderno - Error en datos de respuesta AJAX:", errorMsg, response); 
                            $contenidoCuaderno.html(`<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">${errorMsg}</p></div>`); 
                        }
                    }, 
                    error:function(jqXHR, textStatus, errorThrown){ 
                        console.error("DEBUG: cargarContenidoCuaderno - Error en AJAX principal. Status:", textStatus, "Error:", errorThrown, "Respuesta Servidor:", jqXHR.responseText); 
                        $contenidoCuaderno.html('<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">Error de conexión al cargar el cuaderno. Revise la consola del navegador (pestaña Red y Consola) para más detalles.</p></div>');
                    },
                    complete: function() {
                        console.log("DEBUG: cargarContenidoCuaderno - Llamada AJAX principal completada.");
                    }
                }); 
            }else{ 
                console.log("DEBUG: cargarContenidoCuaderno - No se proporcionó claseId. Mostrando mensaje 'Selecciona una clase'.");
                $contenidoCuaderno.html('<div class="cpp-cuaderno-mensaje-vacio"><p>Selecciona una clase para ver el cuaderno.</p></div>'); 
                cpp.actualizarSelectCategoriasActividad(0); 
                $('#clase_id_actividad_cuaderno_form').val(''); 
                if ($('#cpp-cuaderno-nombre-clase-activa-a1').length) $('#cpp-cuaderno-nombre-clase-activa-a1').text('Selecciona clase');
            } 
            console.log("DEBUG: cargarContenidoCuaderno - FIN");
        },
        actualizarSelectCategoriasActividad: function(claseId, callback) {
            const $selectCategoriasActividad = $('#categoria_id_actividad_cuaderno_select');
            if (!$selectCategoriasActividad.length) {
                if (typeof callback === 'function') callback(false);
                return;
            }

            if (!claseId || claseId === '0') {
                $selectCategoriasActividad.empty().append($('<option>', { value: '', text: '-- Selecciona una categoría --' }));
                $selectCategoriasActividad.append($('<option>', { value: '', text: 'No hay categorías (selecciona/guarda clase)', disabled: true }));
                if (typeof callback === 'function') callback(true);
                return;
            }

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_obtener_categorias_por_clase_simple',
                    nonce: cppFrontendData.nonce,
                    clase_id: claseId
                },
                success: function(response) {
                    $selectCategoriasActividad.empty().append($('<option>', { value: '', text: '-- Selecciona una categoría --' }));
                    if (response.success && response.data.categorias && response.data.categorias.length > 0) {
                        $.each(response.data.categorias, function(i, categoria) {
                            $selectCategoriasActividad.append($('<option>', {
                                value: categoria.id,
                                text: `${categoria.nombre_categoria} (${categoria.porcentaje}%)`
                            }));
                        });
                    } else {
                        $selectCategoriasActividad.append($('<option>', { value: '', text: 'No hay categorías definidas', disabled: true }));
                    }
                    if (typeof callback === 'function') callback(true);
                },
                error: function() {
                    $selectCategoriasActividad.empty().append($('<option>', { value: '', text: '-- Error cargando categorías --' }));
                    console.error("Error AJAX al actualizar select de categorías de actividad.");
                    if (typeof callback === 'function') callback(false);
                }
            });
        },

        mostrarModalAnadirActividadCuaderno: function() { 
            if (!cpp.currentClaseIdCuaderno) { 
                alert('Selecciona una clase primero.'); return; 
            } 
            cpp.actualizarSelectCategoriasActividad(cpp.currentClaseIdCuaderno, function() {
                const $form = $('#cpp-form-actividad-evaluable-cuaderno'); 
                if ($form.length) { 
                    $form.trigger('reset'); 
                    $form.find('#actividad_id_editar_cuaderno').val(''); 
                    $('#cpp-modal-actividad-titulo-cuaderno').text('Añadir Actividad'); 
                    $('#cpp-submit-actividad-btn-cuaderno-form').html('<span class="dashicons dashicons-saved"></span> Guardar'); 
                    $('#clase_id_actividad_cuaderno_form').val(cpp.currentClaseIdCuaderno); 
                } 
                $('#cpp-modal-actividad-evaluable-cuaderno').fadeIn().find('#nombre_actividad_cuaderno_input').focus(); 
            });
        },
        
        cargarDatosActividadParaEditarCuaderno: function(e) { 
            console.log("DEBUG: cargarDatosActividadParaEditarCuaderno - Llamada. Evento:", e, "Elemento 'this':", this); 
            if ($(e.target).is('button') || $(e.target).closest('button').length || $(e.target).hasClass('dashicons')) { 
                console.log("DEBUG: Clic en botón o icono dentro de TH, saliendo.");
                return; 
            } 
            e.preventDefault(); 
            const $actividadTh = $(this); 
            const $actividadDataContainer = $actividadTh.find('.cpp-editable-activity-name'); 
            
            if (!$actividadDataContainer.length) { 
                console.warn("Contenedor de datos de actividad (.cpp-editable-activity-name) no encontrado en TH:", $actividadTh);
                return; 
            } 
            const actividadId = $actividadDataContainer.data('actividad-id'); 
            if (!actividadId) { 
                alert('Error: No se pudo obtener el ID de la actividad.'); 
                return; 
            }
            const nombreActividad = $actividadDataContainer.data('nombre-actividad'); 
            const categoriaId = $actividadDataContainer.data('categoria-id'); 
            const notaMaxima = $actividadDataContainer.data('nota-maxima'); 
            const fechaActividad = $actividadDataContainer.data('fecha-actividad'); 
            const descripcionActividad = $actividadDataContainer.data('descripcion-actividad'); 
            
            cpp.actualizarSelectCategoriasActividad(cpp.currentClaseIdCuaderno, function(success) {
                console.log("DEBUG: Callback de actualizarSelectCategoriasActividad para editar. Success:", success);
                if (!success) {
                    alert("Error al cargar las categorías para el modal de actividad. Por favor, inténtalo de nuevo.");
                    return;
                }
                const $modal = $('#cpp-modal-actividad-evaluable-cuaderno'); 
                const $form = $('#cpp-form-actividad-evaluable-cuaderno'); 
                if (!$modal.length || !$form.length) { 
                    alert("Error: El formulario para editar actividades no está disponible."); 
                    return; 
                } 
                $form.trigger('reset'); 
                $form.find('#actividad_id_editar_cuaderno').val(actividadId); 
                $form.find('#nombre_actividad_cuaderno_input').val(nombreActividad); 
                $form.find('#categoria_id_actividad_cuaderno_select').val(categoriaId); 
                $form.find('#nota_maxima_actividad_cuaderno_input').val(parseFloat(notaMaxima).toFixed(2)); 
                $form.find('#fecha_actividad_cuaderno_input').val(fechaActividad ? fechaActividad.split(' ')[0] : ''); 
                $form.find('#descripcion_actividad_cuaderno_textarea').val(descripcionActividad); 
                $form.find('#clase_id_actividad_cuaderno_form').val(cpp.currentClaseIdCuaderno); 
                $modal.find('#cpp-modal-actividad-titulo-cuaderno').text('Editar Actividad Evaluable'); 
                $modal.find('#cpp-submit-actividad-btn-cuaderno-form').html('<span class="dashicons dashicons-edit"></span> Actualizar Actividad'); 
                $modal.fadeIn(); 
                $form.find('#nombre_actividad_cuaderno_input').focus();
            });
        },
        resetActividadForm: function() { /* No action needed if modal is unique */ },
        guardarActividadEvaluableCuaderno: function(e) { 
            e.preventDefault(); const $form = $(this); const $btn = $form.find('#cpp-submit-actividad-btn-cuaderno-form'); const nombreActividad = $form.find('[name="nombre_actividad"]').val().trim(); const categoriaId = $form.find('[name="categoria_id_actividad"]').val(); const claseId = $form.find('[name="clase_id_actividad"]').val(); const notaMaxima = $form.find('[name="nota_maxima_actividad"]').val(); const actividadIdEditar = $form.find('#actividad_id_editar_cuaderno').val(); if (!claseId || !nombreActividad || !categoriaId) { alert('Nombre y categoría son obligatorios.'); return; } if (parseFloat(notaMaxima) <= 0 || isNaN(parseFloat(notaMaxima))) { alert('Nota máxima debe ser positiva.'); return; } const originalBtnHtml = $btn.html(); $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...'); const ajaxData = { action: 'cpp_guardar_actividad_evaluable', nonce: cppFrontendData.nonce, clase_id_actividad: claseId, categoria_id_actividad: categoriaId, nombre_actividad: nombreActividad, nota_maxima_actividad: notaMaxima, fecha_actividad: $form.find('[name="fecha_actividad"]').val(), descripcion_actividad: $form.find('[name="descripcion_actividad"]').val(),}; if (actividadIdEditar) ajaxData.actividad_id_editar = actividadIdEditar; $.ajax({ url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json', data: ajaxData, success: function(response) { if (response.success) { $('#cpp-modal-actividad-evaluable-cuaderno').fadeOut(); if (cpp.currentClaseIdCuaderno) cpp.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, $('#cpp-cuaderno-nombre-clase-activa-a1').text() || 'Cuaderno'); } else { alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo guardar.')); }}, error: function() { alert('Error de conexión.'); }, complete: function() { $btn.prop('disabled', false).html(originalBtnHtml); } }); 
        },
        
        // --- NUEVAS FUNCIONES PARA DESCARGA EXCEL ---
        showExcelOptionsModal: function(e) {
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }
            cpp.hideModals(); 
            $('#cpp-modal-excel-options').fadeIn();
        },

        handleExcelDownload: function(e, downloadType) {
            e.preventDefault();
            let url = cppFrontendData.ajaxUrl + 
                        '?action=cpp_download_excel' +
                        '&nonce=' + cppFrontendData.nonce +
                        '&download_type=' + downloadType;
            let fileName = (downloadType === 'all_classes') ? 'cuaderno_completo_profesor.xlsx' : 'clase_actual.xlsx';

            if (downloadType === 'single_class') {
                if (!cpp.currentClaseIdCuaderno) {
                    alert('Por favor, selecciona una clase primero para descargarla.');
                    return;
                }
                url += '&clase_id=' + cpp.currentClaseIdCuaderno;
                
                let claseNombre = 'clase_' + cpp.currentClaseIdCuaderno;
                const $claseNombreSpan = $('#cpp-cuaderno-nombre-clase-activa-a1');
                if ($claseNombreSpan.length && $claseNombreSpan.text().trim() !== '') {
                    claseNombre = $claseNombreSpan.text().trim();
                }
                const sanitisedClassName = claseNombre.replace(/[^a-z0-9_\-\s\.]/gi, '_').replace(/\s+/g, '_').toLowerCase();
                fileName = sanitisedClassName + '.xlsx'; 
            }
            
            url += '&filename=' + encodeURIComponent(fileName);
            window.location.href = url;
            cpp.hideModals();
        },

        // --- NUEVAS FUNCIONES PARA IMPORTAR ALUMNOS ---
        showImportStudentsModal: function(e) {
            if (e && typeof e.preventDefault === 'function') { // Asegurar que 'e' existe antes de usarlo
                e.stopPropagation();
                e.preventDefault();
            }
            if (!cpp.currentClaseIdCuaderno) {
                alert("Por favor, selecciona primero una clase para importar alumnos.");
                return;
            }
            cpp.hideModals();
            cpp.resetImportStudentsModalToStep1(); 
            $('#cpp-modal-import-students').fadeIn();
        },

        downloadStudentTemplate: function(e) {
            e.preventDefault();
            const url = cppFrontendData.ajaxUrl + 
                            '?action=cpp_download_student_template' +
                            '&nonce=' + cppFrontendData.nonce +
                            '&filename=plantilla_alumnos.xlsx';
            window.location.href = url;
        },

        handleStudentFileSelected: function(e) { // 'this' es el input file
            const file = this.files[0]; // Usar this.files
            if (file) {
                $('#cpp-upload-status-message').text(`Archivo seleccionado: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`).removeClass('cpp-error-message cpp-success-message');
                $('#cpp-btn-upload-excel-file').prop('disabled', false);
            } else {
                $('#cpp-upload-status-message').text('');
                $('#cpp-btn-upload-excel-file').prop('disabled', true);
            }
        },
        
        triggerStudentExcelUpload: function(e) { // 'this' es el botón de subir
            e.preventDefault();
            const fileInput = document.getElementById('student_excel_file_input');
            if (!fileInput.files || fileInput.files.length === 0) {
                $('#cpp-upload-status-message').text('Por favor, selecciona un archivo primero.').addClass('cpp-error-message').removeClass('cpp-success-message');
                return;
            }
            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append('student_excel_file', file);
            formData.append('action', 'cpp_upload_student_excel');
            formData.append('nonce', cppFrontendData.nonce);

            const $uploadBtn = $(this);
            const originalBtnHtml = $uploadBtn.html();
            $uploadBtn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Subiendo...');
            $('#cpp-upload-status-message').text('Subiendo archivo...').removeClass('cpp-error-message cpp-success-message');

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        cpp.tempUploadedFilePath = response.data.filePath; 
                        cpp.tempUploadedFileName = response.data.fileName || file.name;
                        $('#cpp-upload-status-message').text(`Archivo "${cpp.tempUploadedFileName}" subido. Elige el modo de importación.`).addClass('cpp-success-message').removeClass('cpp-error-message');
                        
                        $('#cpp-import-step-1-upload').hide();
                        $('#cpp-uploaded-file-name-display').text(cpp.tempUploadedFileName);
                        const currentClassName = $('#cpp-cuaderno-nombre-clase-activa-a1').text() || 'la clase actual';
                        $('#cpp-import-target-class-name').text(currentClassName);
                        $('#cpp-import-step-2-options').show();
                        $('#cpp-import-results').hide().find('#cpp-import-results-message, #cpp-import-errors-list').empty(); 
                    } else {
                        $('#cpp-upload-status-message').text('Error: ' + (response.data.message || 'No se pudo subir el archivo.')).addClass('cpp-error-message').removeClass('cpp-success-message');
                    }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    $('#cpp-upload-status-message').text('Error de conexión al subir el archivo.').addClass('cpp-error-message').removeClass('cpp-success-message');
                    console.error("Error AJAX subiendo archivo:", textStatus, errorThrown, jqXHR.responseText);
                },
                complete: function() {
                    $uploadBtn.html(originalBtnHtml); 
                }
            });
        },

        confirmStudentImport: function(e) { // 'this' es el botón de confirmar
            e.preventDefault();
            if (!cpp.currentClaseIdCuaderno) {
                alert("Error: No hay una clase activa seleccionada para la importación.");
                cpp.resetImportStudentsModalToStep1();
                return;
            }
            if (!cpp.tempUploadedFilePath) {
                alert("Error: No hay un archivo subido para importar.");
                cpp.resetImportStudentsModalToStep1();
                return;
            }

            const importMode = $('input[name="import_mode"]:checked').val();
            const $confirmBtn = $(this);
            const originalBtnHtml = $confirmBtn.html();

            $confirmBtn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Importando...');
            $('#cpp-btn-cancel-excel-import').prop('disabled', true);
            $('#cpp-import-results').hide();
            $('#cpp-import-results-message').empty();
            $('#cpp-import-errors-list').empty();

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_import_students_from_file',
                    nonce: cppFrontendData.nonce,
                    clase_id: cpp.currentClaseIdCuaderno,
                    temp_file_path: cpp.tempUploadedFilePath,
                    import_mode: importMode
                },
                success: function(response) {
                    $('#cpp-import-results').show();
                    let resultHtml = '';
                    if (response.success || (response.data && response.data.status === 'warning')) { 
                        resultHtml = `<strong style="color:${response.success ? 'green' : '#e65100'};">${response.data.message || 'Proceso de importación completado.'}</strong>`;
                        if (typeof response.data.imported_count !== 'undefined') {
                            resultHtml += `<br>Alumnos procesados/importados: ${response.data.imported_count}.`;
                        }
                        if (typeof response.data.skipped_duplicates !== 'undefined' && response.data.skipped_duplicates > 0) {
                            resultHtml += `<br>Duplicados omitidos (en modo añadir): ${response.data.skipped_duplicates}.`;
                        }
                        $('#cpp-import-results-message').html(resultHtml);

                        if (response.data.errors && response.data.errors.length > 0) {
                            $('#cpp-import-results-message').append('<br>Se encontraron los siguientes problemas durante la importación:');
                            response.data.errors.forEach(function(errorMsg){
                                $('#cpp-import-errors-list').append(`<li>${errorMsg}</li>`);
                            });
                        }
                        cpp.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, $('#cpp-cuaderno-nombre-clase-activa-a1').text());
                        if ($('#cpp-modal-alumnos').is(':visible')) {
                            cpp.refreshAlumnosList(cpp.currentClaseIdCuaderno);
                        }
                    } else { // Error
                        $('#cpp-import-results-message').html(`<strong style="color:red;">Error: ${response.data.message || 'No se pudo completar la importación.'}</strong>`);
                        if (response.data.errors && response.data.errors.length > 0) {
                            $('#cpp-import-results-message').append('<br>Detalles:');
                            response.data.errors.forEach(function(errorMsg){
                                $('#cpp-import-errors-list').append(`<li>${errorMsg}</li>`);
                            });
                        }
                    }
                    $('#cpp-btn-cancel-excel-import').text('Cerrar'); 
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    $('#cpp-import-results').show();
                    $('#cpp-import-results-message').html('<strong style="color:red;">Error de conexión durante la importación.</strong>');
                    console.error("Error AJAX procesando importación:", textStatus, errorThrown, jqXHR.responseText);
                },
                complete: function() {
                    $confirmBtn.prop('disabled', false).html('<span class="dashicons dashicons-database-import"></span> Confirmar Importación');
                    $('#cpp-btn-cancel-excel-import').prop('disabled', false);
                    cpp.tempUploadedFilePath = null; 
                    cpp.tempUploadedFileName = null;
                }
            });
        },

        resetImportStudentsModalToStep1: function() { 
            console.log("DEBUG: resetImportStudentsModalToStep1 llamado");
            $('#cpp-modal-import-students #student_excel_file_input').val(''); 
            $('#cpp-modal-import-students #cpp-upload-status-message').text('').removeClass('cpp-error-message cpp-success-message');
            $('#cpp-modal-import-students #cpp-btn-upload-excel-file').prop('disabled', true);
            $('#cpp-modal-import-students #cpp-import-step-1-upload').show();
            $('#cpp-modal-import-students #cpp-import-step-2-options').hide();
            $('#cpp-modal-import-students #cpp-import-results').hide();
            $('#cpp-modal-import-students #cpp-import-results-message').empty();
            $('#cpp-modal-import-students #cpp-import-errors-list').empty();
            $('#cpp-modal-import-students #cpp-btn-cancel-excel-import').text('Cancelar / Subir otro archivo');
            cpp.tempUploadedFilePath = null;
            cpp.tempUploadedFileName = null;
        },
        // FIN DE FUNCIONES QUE DEBES COPIAR DE TU ORIGINAL




        // --- Funciones para la gestión de Notas en la Tabla (Versión que funcionaba) ---
        limpiarErrorNotaInput: function(inputElement) {
            const $input = $(inputElement || this);
            $input.removeClass('cpp-nota-error cpp-nota-guardada');
            $input.closest('td').find('.cpp-nota-validation-message').hide().text('');
        },

        guardarNotaDesdeInput: function(event, callbackFn) {
            const $input = $(event.target);
            const alumnoId = $input.data('alumno-id');
            const actividadId = $input.data('actividad-id');
            const notaMaxima = parseFloat($input.data('nota-maxima'));
            let notaStr = $input.val().trim();
            const $td = $input.closest('td');
            const $validationMessage = $td.find('.cpp-nota-validation-message');

            cpp.limpiarErrorNotaInput($input); 

            if (notaStr === '') {
                // permitido para borrar
            } else {
                notaStr = notaStr.replace(',', '.');
                const notaNum = parseFloat(notaStr);

                if (isNaN(notaNum)) {
                    $validationMessage.text('No es un nº').show();
                    $input.addClass('cpp-nota-error');
                    if (typeof callbackFn === 'function') callbackFn(false);
                    return;
                }
                if (notaNum < 0 || notaNum > notaMaxima) {
                    $validationMessage.text(`Nota 0-${notaMaxima}`).show();
                    $input.addClass('cpp-nota-error');
                    if (typeof callbackFn === 'function') callbackFn(false);
                    return;
                }
            }

            const originalNota = $input.data('original-nota') || '';
            if (notaStr === originalNota && event.type === 'blur') {
                if (typeof callbackFn === 'function') callbackFn(true, false); 
                return;
            }

            $input.prop('disabled', true); 
            $validationMessage.hide().text(''); 

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_guardar_calificacion_alumno',
                    nonce: cppFrontendData.nonce,
                    alumno_id: alumnoId,
                    actividad_id: actividadId,
                    nota: notaStr 
                },
                success: function(response) {
                    if (response.success) {
                        $input.addClass('cpp-nota-guardada');
                        if (response.data && typeof response.data.nota_final_alumno !== 'undefined') {
                            $(`#cpp-nota-final-alumno-${alumnoId}`).text(response.data.nota_final_alumno);
                        }
                        let displayNota = '';
                        if (notaStr !== '') {
                            const num = parseFloat(notaStr.replace(',', '.'));
                            if (!isNaN(num)) {
                                if (num % 1 !== 0) { 
                                    displayNota = num.toFixed(2);
                                } else { 
                                    displayNota = String(parseInt(num));
                                }
                            }
                        }
                        $input.val(displayNota);
                        $input.data('original-nota', displayNota); 

                        setTimeout(function() { $input.removeClass('cpp-nota-guardada'); }, 1500);
                        if (typeof callbackFn === 'function') callbackFn(true, true);
                    } else {
                        $validationMessage.text(response.data.message || 'Error guardado').show();
                        $input.addClass('cpp-nota-error');
                        if (typeof callbackFn === 'function') callbackFn(false);
                    }
                },
                error: function(jqXHR) {
                    $validationMessage.text('Error conexión').show();
                    $input.addClass('cpp-nota-error');
                    console.error("Error AJAX (guardar nota):", jqXHR.responseText);
                    if (typeof callbackFn === 'function') callbackFn(false);
                },
                complete: function() {
                    $input.prop('disabled', false);
                }
            });
        },

        manejarNavegacionTablaNotas: function(e) {
            const $this = $(this); 
            const $td = $this.closest('td');
            const $tr = $td.closest('tr');
            let $nextCell;
            
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                cpp.guardarNotaDesdeInput(e, function(isValid, wasSaved) { 
                    if (isValid) { 
                        if (e.shiftKey && e.key === 'Tab') { 
                            $nextCell = $td.prevAll('td:has(input.cpp-input-nota)').first();
                            if (!$nextCell.length) { 
                                $nextCell = $tr.prev('tr').find('td:has(input.cpp-input-nota)').last();
                            }
                        } else { 
                            $nextCell = $td.nextAll('td:has(input.cpp-input-nota)').first();
                            if (!$nextCell.length) { 
                                $nextCell = $tr.next('tr').find('td:has(input.cpp-input-nota)').first();
                            }
                        }
                        if ($nextCell && $nextCell.length) {
                            $nextCell.find('input.cpp-input-nota').focus().select();
                        }
                    }
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                $nextCell = $tr.prev('tr').find(`td:eq(${$td.index()})`);
                if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                $nextCell = $tr.next('tr').find(`td:eq(${$td.index()})`);
                if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select();
            } else if (e.key === 'ArrowLeft') {
                if ($this[0].selectionStart === 0 && $this[0].selectionEnd === 0) {
                    e.preventDefault();
                    $nextCell = $td.prevAll('td:has(input.cpp-input-nota)').first();
                    if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select();
                }
            } else if (e.key === 'ArrowRight') {
                if ($this[0].selectionStart === $this.val().length && $this[0].selectionEnd === $this.val().length) {
                    e.preventDefault();
                    $nextCell = $td.nextAll('td:has(input.cpp-input-nota)').first();
                    if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select();
                }
            } else if (e.key === 'Escape') {
                $this.val($this.data('original-nota') || '');
                cpp.limpiarErrorNotaInput($this);
                $this.blur();
            }
        }

    }; // Fin del objeto cpp

    cpp.init();
});