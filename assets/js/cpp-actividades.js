// assets/js/cpp-actividades.js

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        return;
    }

    cpp.actividades = {
        currentSort: { key: null, direction: 'asc' },
        isUpdatingFilters: false,

        init: function() {
            this.bindEvents();
        },

        render: function() {
            const self = this;
            const $container = $('#cpp-main-tab-actividades');

            const claseId = $('#cpp-actividades-filter-clase').val() || 0;
            const evaluacionId = $('#cpp-actividades-filter-evaluacion').val() || 0;
            const criterioId = $('#cpp-actividades-filter-criterio').val() || 0;
            const limit = $('#cpp-actividades-filter-limit').val();

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
                    clase_id: claseId,
                    evaluacion_id: evaluacionId,
                    criterio_id: criterioId,
                    limit: limit
                },
                success: function(response) {
                    if (response.success) {
                        $container.html(response.data.html);

                        // Sincronizar el dropdown de criterios con los contadores actualizados
                        self.updateCriterionDropdownLabels(response.data.criterios, response.data.num_sin_criterio, response.data.num_no_aplica, response.data.num_no_evaluables);

                        // Aplicar tooltips o lógica adicional si fuera necesario para los badges de "No aplica"

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

        updateCriterionDropdownLabels: function(criterios, numSinCriterio, numNoAplica, numNoEvaluables) {
            if (!criterios) return;

            const $filterCriterio = $('#cpp-actividades-filter-criterio');
            const currentValue = $filterCriterio.val();

            this.isUpdatingFilters = true; // Guard to prevent recursive render()

            let html = '<option value="0">Todos los criterios</option>';

            // Opción Sin asignar criterio (activities in weighted evals without criterion)
            const sinCritCount = numSinCriterio || 0;
            html += `<option value="-1" ${currentValue == -1 ? 'selected' : ''}>Sin asignar criterio (${sinCritCount})</option>`;

            // Opción No aplica (activities in non-weighted evals)
            const noAplicaCount = numNoAplica || 0;
            html += `<option value="-2" ${currentValue == -2 ? 'selected' : ''}>No aplica (${noAplicaCount})</option>`;

            // Opción Tareas no evaluables
            const noEvalCount = numNoEvaluables || 0;
            html += `<option value="-3" ${currentValue == -3 ? 'selected' : ''}>Tareas no evaluables (${noEvalCount})</option>`;

            criterios.forEach(crit => {
                html += `<option value="${crit.id}" ${crit.id == currentValue ? 'selected' : ''}>${crit.nombre} (${crit.num_actividades})</option>`;
            });
            $filterCriterio.html(html);

            this.isUpdatingFilters = false;
        },

        handleInLineUpdate: function(inputElement) {
            const self = this;
            const $input = $(inputElement);
            const $row = $input.closest('tr');
            const actividadId = $row.data('actividad-id');
            const evaluacionId = $row.data('evaluacion-id');
            const tipo = $row.data('tipo');
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
                    evaluacion_id: evaluacionId,
                    tipo: tipo,
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

                        // Actualizar contadores del dropdown con la info que viene en la respuesta
                        self.updateCriterionDropdownLabels(response.data.criterios, response.data.num_sin_criterio, response.data.num_no_aplica, response.data.num_no_evaluables);

                        // Si cambiamos el nombre, categoría o nota máxima, el cuaderno debe saberlo
                        if (['nombre_actividad', 'categoria_id', 'criterio_id', 'nota_maxima'].includes(field)) {
                            $(document).trigger('cpp:forceGradebookReload');
                        }

                        // Si hay un filtro de criterio activo y hemos cambiado el criterio, la fila debe desaparecer
                        if (field === 'criterio_id') {
                            const filterCriterioId = $('#cpp-actividades-filter-criterio').val();

                            // Normalizar value para comparación (criterio_id puede ser "" para sin categoría)
                            const normalizedValue = (value === "" || value === 0) ? -1 : value;

                            if (filterCriterioId != 0 && normalizedValue != filterCriterioId) {
                                $row.fadeOut(600, function() {
                                    $(this).remove();
                                    // Si después de borrar la fila la tabla está vacía, podríamos mostrar el panel de vacío
                                    if ($('#cpp-actividades-main-table tbody tr').length === 0) {
                                        self.render();
                                    }
                                });
                            }
                        }
                    } else {
                        if (cpp.utils && typeof cpp.utils.showToast === 'function') {
                            cpp.utils.showToast('Error: ' + response.data.message, 'error');
                        } else {
                            alert('Error: ' + response.data.message);
                        }
                        $input.val(originalValue);
                    }
                },
                error: function() {
                    if (cpp.utils && typeof cpp.utils.showToast === 'function') {
                        cpp.utils.showToast('Error de conexión al actualizar.', 'error');
                    } else {
                        alert('Error de conexión al actualizar.');
                    }
                    $input.val(originalValue);
                },
                complete: function() {
                    $input.removeClass('cpp-loading-pulse');
                }
            });
        },

        handleToggleEvaluable: function(buttonElement) {
            const self = this;
            const $row = $(buttonElement).closest('tr');
            const actividadId = $row.data('actividad-id');
            const tipo = $row.data('tipo');
            const nombre = $row.find('[data-field="nombre_actividad"]').val() || 'Actividad';
            const isEvaluable = tipo === 'evaluable';

            if (isEvaluable) {
                if (!confirm(`¿Estás seguro de que quieres convertir la actividad "${nombre}" en una tarea no evaluable?\n\n¡Se borrarán todas las notas registradas en el cuaderno para esta actividad y no se puede deshacer!`)) {
                    return;
                }
                this.executeToggleEvaluable(actividadId, 0, null, $row, tipo);
            } else {
                // Convertir a evaluable. Necesitamos el criterio si la evaluación es ponderada.
                const evaluacionId = $row.data('evaluacion-id');
                const $claseSelect = $('#cpp-actividades-filter-clase');
                const claseId = $row.data('clase-id') || $claseSelect.val();

                // Intentamos obtener info de la evaluación desde el objeto CppProgramadorApp si está disponible,
                // o hacemos una pequeña petición para saber si es ponderada y qué criterios tiene.
                // Para simplificar y mantener consistencia con el programador, usaremos un prompt si detectamos que es necesario.

                // NOTA: En la vista de Actividades, el objeto 'actividades' devuelto por el servidor ya tiene 'calculo_nota'.
                // Pero no tenemos la lista de criterios de esa evaluación específica fácilmente a mano sin otra petición.
                // Vamos a usar la lista global de criterios que ya tenemos en el dropdown de filtros.

                const $filterCriterio = $('#cpp-actividades-filter-criterio');
                const criterios = [];
                $filterCriterio.find('option').each(function() {
                    const val = parseInt($(this).val());
                    if (val > 0) {
                        criterios.push({ id: val, nombre: $(this).text().split(' (')[0] });
                    }
                });

                if (criterios.length === 0) {
                     // Si no hay criterios globales, puede que no se hayan cargado.
                     // En este caso el backend usará el primero que encuentre.
                     this.executeToggleEvaluable(actividadId, 1, null, $row, tipo);
                     return;
                }

                let message = `Convirtiendo "${nombre}" a evaluable.\nSelecciona un criterio:\n\n`;
                criterios.forEach((crit, index) => {
                    message += `${index + 1}. ${crit.nombre}\n`;
                });

                const choice = prompt(message, "1");
                if (choice === null) return;

                const index = parseInt(choice) - 1;
                if (isNaN(index) || !criterios[index]) {
                    if (cpp.utils && typeof cpp.utils.showToast === 'function') {
                        cpp.utils.showToast('Opción no válida.', 'error');
                    }
                    return;
                }

                this.executeToggleEvaluable(actividadId, 1, criterios[index].id, $row, tipo);
            }
        },

        executeToggleEvaluable: function(actividadId, esEvaluable, criterioId, $row, tipo) {
            const self = this;
            if (cpp.utils && typeof cpp.utils.showSpinner === 'function') cpp.utils.showSpinner();

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_toggle_actividad_evaluable',
                    nonce: cppFrontendData.nonce,
                    actividad_id: actividadId,
                    es_evaluable: esEvaluable,
                    criterio_id: criterioId || '',
                    tipo: tipo || ''
                },
                success: function(response) {
                    if (response.success) {
                        if (cpp.utils && typeof cpp.utils.showToast === 'function') {
                            cpp.utils.showToast(esEvaluable ? 'Convertido a Actividad Evaluable' : 'Convertido a Tarea', 'success');
                        }
                        // Recargar la vista para reflejar los cambios
                        self.render();
                        $(document).trigger('cpp:forceGradebookReload');
                    } else {
                        if (cpp.utils && typeof cpp.utils.showToast === 'function') {
                            cpp.utils.showToast('Error: ' + response.data.message, 'error');
                        }
                    }
                },
                error: function() {
                    if (cpp.utils && typeof cpp.utils.showToast === 'function') {
                        cpp.utils.showToast('Error de conexión.', 'error');
                    }
                },
                complete: function() {
                    if (cpp.utils && typeof cpp.utils.hideSpinner === 'function') cpp.utils.hideSpinner();
                }
            });
        },

        handleDelete: function(buttonElement) {
            const self = this;
            const $row = $(buttonElement).closest('tr');
            const actividadId = $row.data('actividad-id');
            const tipo = $row.data('tipo');
            const nombre = $row.find('[data-field="nombre_actividad"]').val();

            const isEvaluable = tipo === 'evaluable';
            const confirmMsg = isEvaluable
                ? `¿Estás seguro de que quieres eliminar la actividad "${nombre}"?\n\n¡Esta acción borrará todas las notas de los alumnos para esta actividad y no se puede deshacer!`
                : `¿Estás seguro de que quieres eliminar la tarea "${nombre}"?`;

            if (!confirm(confirmMsg)) {
                return;
            }

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_eliminar_actividad',
                    nonce: cppFrontendData.nonce,
                    actividad_id: actividadId,
                    tipo: tipo
                },
                success: function(response) {
                    if (response.success) {
                        $row.fadeOut(function() { $(this).remove(); });

                        if (cpp.utils && typeof cpp.utils.showToast === 'function') {
                            cpp.utils.showToast('Actividad eliminada', 'success');
                        }

                        // Actualizar contadores del dropdown
                        self.updateCriterionDropdownLabels(response.data.criterios, response.data.num_sin_criterio, response.data.num_no_aplica, response.data.num_no_evaluables);

                        $(document).trigger('cpp:forceGradebookReload');
                        if (typeof CppProgramadorApp !== 'undefined' && CppProgramadorApp.currentClase) {
                            CppProgramadorApp.fetchData(CppProgramadorApp.currentClase.id);
                        }
                    } else {
                        if (cpp.utils && typeof cpp.utils.showToast === 'function') {
                            cpp.utils.showToast('Error al eliminar: ' + response.data.message, 'error');
                        } else {
                            alert('Error al eliminar: ' + response.data.message);
                        }
                    }
                },
                error: function() {
                    if (cpp.utils && typeof cpp.utils.showToast === 'function') {
                        cpp.utils.showToast('Error de conexión al eliminar.', 'error');
                    } else {
                        alert('Error de conexión al eliminar.');
                    }
                }
            });
        },

        bindEvents: function() {
            const self = this;
            const $document = $(document);

            // Filtros de la vista global
            $document.on('change', '#cpp-actividades-filter-clase', function() {
                const claseId = $(this).val();
                const $evalSelect = $('#cpp-actividades-filter-evaluacion');

                if (claseId == 0) {
                    $evalSelect.val(0).prop('disabled', true);
                    self.render();
                } else {
                    $evalSelect.prop('disabled', true).html('<option value="0">Cargando...</option>');
                    $.ajax({
                        url: cppFrontendData.ajaxUrl,
                        type: 'POST',
                        dataType: 'json',
                        data: {
                            action: 'cpp_obtener_evaluaciones',
                            nonce: cppFrontendData.nonce,
                            clase_id: claseId
                        },
                        success: function(response) {
                            if (response.success) {
                                let html = '<option value="0">Todas</option>';
                                response.data.evaluaciones.forEach(ev => {
                                    html += `<option value="${ev.id}">${ev.nombre_evaluacion}</option>`;
                                });
                                $evalSelect.html(html).prop('disabled', false);
                            } else {
                                $evalSelect.html('<option value="0">Error</option>');
                            }
                            self.render();
                        }
                    });
                }
            });

            $document.on('change', '#cpp-actividades-filter-evaluacion, #cpp-actividades-filter-limit, #cpp-actividades-filter-criterio', function() {
                if (self.isUpdatingFilters) return;
                self.render();
            });

            $document.on('focus', '.cpp-inline-edit', function() {
                $(this).data('original-value', $(this).val());
            });

            $document.on('blur', '.cpp-inline-edit', function() {
                if ($(this).is('select')) return; // handled by change event

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

            $document.on('click', '.cpp-btn-toggle-actividad', function() {
                self.handleToggleEvaluable(this);
            });

            $document.on('change', 'select[data-field="categoria_id"], select[data-field="criterio_id"]', function() {
                const $select = $(this);
                const $selectedOption = $select.find('option:selected');
                const color = $selectedOption.data('color');
                const catName = $selectedOption.text().trim();
                $select.closest('.cpp-actividad-categoria-cell').find('.cpp-category-dot').css('background-color', color);

                // Update sort value for category
                $select.closest('td').attr('data-sort-value', catName);

                // Trigger update immediately
                self.handleInLineUpdate(this);
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
