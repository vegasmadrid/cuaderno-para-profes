// assets/js/cpp-actividades.js

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        return;
    }

    cpp.actividades = {
        currentSort: { key: null, direction: 'asc' },

        init: function() {
            this.bindEvents();
        },

        render: function() {
            const self = this;
            const $container = $('#cpp-main-tab-actividades');

            if (!cpp.currentClaseIdCuaderno || !cpp.currentEvaluacionId) {
                $container.html('<div class="cpp-empty-panel"><p>Selecciona una clase y una evaluación para ver las actividades.</p></div>');
                return;
            }

            // Limpiamos el contenedor para evitar ver datos de la clase anterior durante la carga
            $container.empty();

            // No mostramos el spinner individual si el loader principal ya está activo
            const mainLoaderVisible = $('#cpp-main-loader').is(':visible');
            if (!mainLoaderVisible && cpp.utils && typeof cpp.utils.showSpinner === 'function') {
                cpp.utils.showSpinner();
            }

            return $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_get_actividades_tab_content',
                    nonce: cppFrontendData.nonce,
                    clase_id: cpp.currentClaseIdCuaderno,
                    evaluacion_id: cpp.currentEvaluacionId
                },
                success: function(response) {
                    if (response.success) {
                        $container.html(response.data.html);
                        // Auto-resize textareas
                        $container.find('textarea.cpp-inline-edit').each(function() {
                            this.style.height = 'auto';
                            this.style.height = (this.scrollHeight) + 'px';
                        });
                    } else {
                        $container.html('<div class="cpp-empty-panel"><p>Error al cargar las actividades: ' + response.data.message + '</p></div>');
                    }
                },
                error: function() {
                    $container.html('<div class="cpp-empty-panel"><p>Error de conexión al cargar las actividades.</p></div>');
                },
                complete: function() {
                    if (cpp.utils && typeof cpp.utils.hideSpinner === 'function') {
                        cpp.utils.hideSpinner();
                    }
                }
            });
        },

        handleInLineUpdate: function(inputElement) {
            const $input = $(inputElement);
            const $row = $input.closest('tr');
            const actividadId = $row.data('actividad-id');
            const field = $input.data('field');
            const value = $input.val();
            const originalValue = $input.data('original-value');

            if (value === originalValue) return;

            $input.addClass('cpp-loading-pulse');

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_actualizar_actividad_inline',
                    nonce: cppFrontendData.nonce,
                    actividad_id: actividadId,
                    evaluacion_id: cpp.currentEvaluacionId,
                    field: field,
                    value: value
                },
                success: function(response) {
                    if (response.success) {
                        $input.data('original-value', value);
                        $input.addClass('cpp-success-flash');
                        setTimeout(() => $input.removeClass('cpp-success-flash'), 1000);

                        if (cpp.utils && typeof cpp.utils.showToast === 'function') {
                            cpp.utils.showToast('Cambio guardado ✨', 'success');
                        }

                        // Si cambiamos el nombre, categoría o nota máxima, el cuaderno debe saberlo
                        if (['nombre_actividad', 'categoria_id', 'nota_maxima'].includes(field)) {
                            $(document).trigger('cpp:forceGradebookReload');
                        }
                    } else {
                        alert('Error: ' + response.data.message);
                        $input.val(originalValue);
                    }
                },
                error: function() {
                    alert('Error de conexión al actualizar.');
                    $input.val(originalValue);
                },
                complete: function() {
                    $input.removeClass('cpp-loading-pulse');
                }
            });
        },

        handleDelete: function(buttonElement) {
            const $row = $(buttonElement).closest('tr');
            const actividadId = $row.data('actividad-id');
            const nombre = $row.find('[data-field="nombre_actividad"]').val();

            if (!confirm(`¿Estás seguro de que quieres eliminar la actividad "${nombre}"?\n\n¡Esta acción borrará todas las notas de los alumnos para esta actividad y no se puede deshacer!`)) {
                return;
            }

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_eliminar_actividad',
                    nonce: cppFrontendData.nonce,
                    actividad_id: actividadId
                },
                success: function(response) {
                    if (response.success) {
                        $row.fadeOut(function() { $(this).remove(); });

                        if (cpp.utils && typeof cpp.utils.showToast === 'function') {
                            cpp.utils.showToast('Actividad eliminada', 'success');
                        }

                        $(document).trigger('cpp:forceGradebookReload');
                        if (typeof CppProgramadorApp !== 'undefined' && CppProgramadorApp.currentClase) {
                            CppProgramadorApp.fetchData(CppProgramadorApp.currentClase.id);
                        }
                    } else {
                        alert('Error al eliminar: ' + response.data.message);
                    }
                },
                error: function() {
                    alert('Error de conexión al eliminar.');
                }
            });
        },

        bindEvents: function() {
            const self = this;
            const $document = $(document);

            $document.on('focus', '.cpp-inline-edit', function() {
                $(this).data('original-value', $(this).val());
            });

            $document.on('blur', '.cpp-inline-edit', function() {
                self.handleInLineUpdate(this);
                // Also update data-sort-value of the parent cell
                const $input = $(this);
                $input.closest('td').attr('data-sort-value', $input.val());
            });

            $document.on('keypress', '.cpp-inline-edit', function(e) {
                if (e.which === 13 && !$(this).is('textarea')) {
                    e.preventDefault();
                    $(this).blur();
                }
            });

            // Auto-resize textarea on input
            $document.on('input', 'textarea.cpp-inline-edit', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });

            $document.on('click', '.cpp-btn-delete-actividad', function() {
                self.handleDelete(this);
            });

            $document.on('change', 'select[data-field="categoria_id"]', function() {
                const $select = $(this);
                const $selectedOption = $select.find('option:selected');
                const color = $selectedOption.data('color');
                const catName = $selectedOption.text().trim();
                $select.closest('.cpp-actividad-categoria-cell').find('.cpp-category-dot').css('background-color', color);
                // Update sort value for category
                $select.closest('td').attr('data-sort-value', catName);
            });

            $document.on('click', '.cpp-sortable-header', function() {
                const key = $(this).data('sort-key');
                self.sortTable(key);
            });
        },

        sortTable: function(key) {
            const self = this;
            const $table = $('#cpp-actividades-main-table');
            if (!$table.length) return;

            const $tbody = $table.find('tbody');
            const $rows = $tbody.find('tr').get();
            const $headers = $table.find('.cpp-sortable-header');
            const $currentHeader = $headers.filter(`[data-sort-key="${key}"]`);

            // Determine direction
            let direction = 'asc';
            if (self.currentSort.key === key && self.currentSort.direction === 'asc') {
                direction = 'desc';
            }
            self.currentSort = { key, direction };

            // Update UI headers
            $headers.removeClass('active-sort asc desc');
            $headers.find('.dashicons').attr('class', 'dashicons dashicons-sort');

            $currentHeader.addClass('active-sort ' + direction);
            $currentHeader.find('.dashicons').attr('class', 'dashicons dashicons-arrow-' + (direction === 'asc' ? 'up' : 'down') + '-alt2');

            // Sort rows
            $rows.sort(function(a, b) {
                let valA = $(a).find(`td[data-sort-key="${key}"], td:eq(${$currentHeader.index()})`).attr('data-sort-value');
                let valB = $(b).find(`td[data-sort-key="${key}"], td:eq(${$currentHeader.index()})`).attr('data-sort-value');

                // Try numeric sort if applicable
                let numA = parseFloat(valA);
                let numB = parseFloat(valB);

                if (!isNaN(numA) && !isNaN(numB)) {
                    return direction === 'asc' ? numA - numB : numB - numA;
                }

                // String sort
                valA = (valA || '').toLowerCase();
                valB = (valB || '').toLowerCase();

                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });

            // Re-append sorted rows
            $.each($rows, function(index, row) {
                $tbody.append(row);
            });
        }
    };

})(jQuery);
