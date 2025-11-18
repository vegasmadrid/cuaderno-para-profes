
// assets/js/cpp-alumnos.js
// --- REFACTORIZADO PARA GESTIÓN GLOBAL DE ALUMNOS ---

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: 'cpp' no está definido.");
        return;
    }

    cpp.alumnos = {
        init: function() {
            this.activeTab = 'alumnos';
            this.bindEvents();
        },

        enter: function() {
            this.loadInitialAlumnosList();
            this.populateClassFilter();
        },

        exit: function() {
            $('#cpp-alumnos-search-results').empty();
            $('#cpp-alumnos-view-main').html(this.getInitialMainContentHtml());
            // Opcional: resetear el filtro al salir
            $('#cpp-alumnos-class-filter').empty().append('<option value="all">Todas mis clases</option>');
        },

        debounce: function(func, delay) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), delay);
            };
        },

        bindEvents: function() {
            const $document = $(document);
            const debouncedSearch = this.debounce(this.handleSearch.bind(this), 300);

            $document.on('keyup', '#cpp-alumnos-search-input', debouncedSearch);
            $document.on('click', '.cpp-alumno-list-item', this.handleAlumnoClick.bind(this));
            $document.on('click', '#cpp-crear-nuevo-alumno-global-btn, #cpp-crear-nuevo-alumno-global-btn-top', this.handleNewAlumnoClick.bind(this));
            $document.on('submit', '#cpp-ficha-alumno-form', this.handleSaveAlumnoDetails.bind(this)); // Para nuevos alumnos
            $document.on('click', '#cpp-update-clases-btn', this.handleUpdateAlumnoClases.bind(this));
            $document.on('click', '#cpp-eliminar-alumno-global-btn', this.handleDeleteAlumno.bind(this));
            $document.on('change', '#cpp-alumnos-class-filter', this.handleSearch.bind(this));

            // Listeners para edición en el sitio
            $document.on('click', '#cpp-edit-alumno-btn', this.toggleEditMode.bind(this, true));
            $document.on('click', '#cpp-cancel-edit-btn', this.toggleEditMode.bind(this, false));
            $document.on('click', '#cpp-save-alumno-btn', this.handleSaveInline.bind(this));
            $document.on('click', '#cpp-alumno-foto-editable', this.handleChangeFoto.bind(this));
            $document.on('change', '#cpp-alumno-foto-input', this.handleUploadFoto.bind(this));

            // Listeners para el acordeón y edición de notas
            $document.on('click', '.cpp-accordion-header', function() {
                $(this).next('.cpp-accordion-content').slideToggle('fast');
                $(this).toggleClass('active');
            });
            $document.on('click', '.cpp-calificacion-editable span', function() {
                const $span = $(this);
                const $td = $span.parent();
                if ($td.find('input').length > 0) return; // Ya está en modo edición

                const currentValue = $span.text();
                const $input = $('<input type="text">').val(currentValue);
                $span.hide();
                $td.append($input);
                $input.focus().select();
            });

            $document.on('blur', '.cpp-calificacion-editable input', function() {
                const $input = $(this);
                const $td = $input.parent();
                const $span = $td.find('span');
                const newValue = $input.val();
                const actividadId = $td.data('actividad-id');
                const alumnoId = $td.data('alumno-id');
                const evaluacionId = $td.closest('.cpp-accordion-content').data('evaluacion-id');

                $span.text(newValue).show();
                $input.remove();

                // Guardar la nota
                $.ajax({
                    url: cppFrontendData.ajaxUrl,
                    type: 'POST',
                    data: {
                        action: 'cpp_guardar_calificacion_alumno',
                        nonce: cppFrontendData.nonce,
                        alumno_id: alumnoId,
                        actividad_id: actividadId,
                        nota: newValue,
                        evaluacion_id: evaluacionId
                    },
                    success: function(response) {
                        if (response.success) {
                            cpp.utils.showToast('Nota guardada');
                            // Podríamos actualizar la nota final si la tuviéramos a mano
                        } else {
                            cpp.utils.showToast('Error al guardar', 'error');
                            $span.text($input.data('original-value')); // Revertir
                        }
                    },
                    error: function() {
                        cpp.utils.showToast('Error de conexión', 'error');
                        $span.text($input.data('original-value')); // Revertir
                    }
                });
            });

            $document.on('click', '#cpp-importar-alumnos-global-btn, #cpp-importar-alumnos-global-btn-top', function() {
                if (cpp.modals && cpp.modals.excel) {
                    cpp.modals.excel.openForGlobalImport();
                } else {
                    console.error("Error: Módulo de importación de Excel no encontrado.");
                }
            });
        },

        populateClassFilter: function() {
            const $select = $('#cpp-alumnos-class-filter');
            // Evitar recargar si ya tiene opciones
            if ($select.children().length > 1) {
                return;
            }

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_get_clases_for_filter',
                    nonce: cppFrontendData.nonce,
                },
                success: (response) => {
                    if (response.success && response.data.clases) {
                        response.data.clases.forEach(clase => {
                            $select.append($('<option>', {
                                value: clase.id,
                                text: clase.nombre
                            }));
                        });
                    }
                },
                error: () => {
                    console.error("Error al cargar el filtro de clases.");
                }
            });
        },

        loadInitialAlumnosList: function() {
            this.handleSearch();
        },

        handleSearch: function() {
            const searchTerm = $('#cpp-alumnos-search-input').val();
            const claseId = $('#cpp-alumnos-class-filter').val();
            const $resultsContainer = $('#cpp-alumnos-search-results');
            $resultsContainer.html('<p class="cpp-cuaderno-cargando">Buscando...</p>');

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_search_alumnos',
                    nonce: cppFrontendData.nonce,
                    search_term: searchTerm,
                    clase_id: claseId
                },
                success: (response) => {
                    if (response.success) {
                        this.renderSearchResults(response.data.alumnos);
                    } else {
                        $resultsContainer.html(`<p class="cpp-error-message">${response.data.message}</p>`);
                    }
                },
                error: () => {
                    $resultsContainer.html('<p class="cpp-error-message">Error de conexión.</p>');
                }
            });
        },

        renderSearchResults: function(alumnos) {
            const $resultsContainer = $('#cpp-alumnos-search-results');
            $resultsContainer.empty();

            if (alumnos.length === 0) {
                $resultsContainer.html('<p class="cpp-empty-panel">No se encontraron alumnos.</p>');
                return;
            }

            const $ul = $('<ul>', { class: 'cpp-alumnos-list-ul' });
            alumnos.forEach(alumno => {
                const $li = $('<li>', { class: 'cpp-alumno-list-item', 'data-alumno-id': alumno.id })
                    .append(`<span class="cpp-alumno-list-nombre">${alumno.nombre} ${alumno.apellidos}</span>`);
                $ul.append($li);
            });
            $resultsContainer.append($ul);
        },

        handleAlumnoClick: function(e) {
            const $target = $(e.currentTarget);
            $('.cpp-alumno-list-item.active').removeClass('active');
            $target.addClass('active');
            const alumnoId = $target.data('alumno-id');
            this.displayAlumnoFicha(alumnoId);
        },

        handleNewAlumnoClick: function() {
            $('.cpp-alumno-list-item.active').removeClass('active');
            this.renderAlumnoFicha(null);
        },

        displayAlumnoFicha: function(alumnoId) {
            const $fichaContainer = $('#cpp-alumnos-view-main');
            $fichaContainer.html('<p class="cpp-cuaderno-cargando">Cargando ficha...</p>');

            if (!alumnoId) {
                this.renderAlumnoFicha(null);
                return;
            }

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_get_alumno_ficha',
                    nonce: cppFrontendData.nonce,
                    alumno_id: alumnoId
                },
                success: (response) => {
                    if (response.success) {
                        this.renderAlumnoFicha(response.data.ficha);
                    } else {
                        $fichaContainer.html(`<p class="cpp-error-message">${response.data.message}</p>`);
                    }
                },
                error: () => {
                    $fichaContainer.html('<p class="cpp-error-message">Error de conexión.</p>');
                }
            });
        },

        renderAlumnoFicha: function(data) {
            const isNew = data === null;
            const alumno = isNew ? {} : data.alumno;
            const $container = $('#cpp-alumnos-view-main');

            // Si es un nuevo alumno, mostramos el formulario tradicional
            if (isNew) {
                const newAlumnoFormHtml = `
                    <div class="cpp-alumno-ficha-card">
                        <h2>Nuevo Alumno</h2>
                        <div class="cpp-ficha-section">
                            <form id="cpp-ficha-alumno-form" class="cpp-modern-form">
                                <input type="hidden" name="alumno_id" value="0">
                                <div class="cpp-form-grid">
                                    <div class="cpp-form-group">
                                        <label for="nombre">Nombre</label>
                                        <input type="text" id="nombre" name="nombre" value="" required>
                                    </div>
                                    <div class="cpp-form-group">
                                        <label for="apellidos">Apellidos</label>
                                        <input type="text" id="apellidos" name="apellidos" value="" required>
                                    </div>
                                </div>
                                <div class="cpp-form-group">
                                    <label for="foto">URL de la Foto (Opcional)</label>
                                    <input type="url" id="foto" name="foto" value="">
                                </div>
                                <div class="cpp-form-actions">
                                    <button type="submit" class="cpp-btn cpp-btn-primary"><span class="dashicons dashicons-saved"></span> Crear Alumno</button>
                                </div>
                            </form>
                        </div>
                    </div>`;
                $container.html(newAlumnoFormHtml);
                return;
            }

            // --- Renderizado para un alumno existente ---

            const seed = alumno.id || encodeURIComponent(alumno.nombre) + '+' + encodeURIComponent(alumno.apellidos);
            const fotoUrl = alumno.foto || `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}`;

            let personalDataHtml = `
                <div class="cpp-alumno-ficha-header">
                    <div class="cpp-alumno-avatar-container">
                        <img src="${fotoUrl}" alt="Foto de ${alumno.nombre}" class="cpp-alumno-avatar-large" id="cpp-alumno-foto-editable" data-alumno-id="${alumno.id}" title="Haz clic para cambiar la foto">
                        <input type="file" id="cpp-alumno-foto-input" data-alumno-id="${alumno.id}" style="display: none;" accept="image/*">
                    </div>
                    <div class="cpp-alumno-name-container editing">
                        <input type="text" class="cpp-editable-field-input" data-field="nombre" value="${alumno.nombre}" placeholder="Nombre">
                        <input type="text" class="cpp-editable-field-input" data-field="apellidos" value="${alumno.apellidos}" placeholder="Apellidos">
                    </div>
                    <div id="cpp-edit-actions-container">
                         <button id="cpp-save-alumno-btn" class="cpp-btn cpp-btn-primary" data-alumno-id="${alumno.id}"><span class="dashicons dashicons-saved"></span> Guardar</button>
                    </div>
                </div>
                <div id="cpp-alumno-visual-data" class="cpp-ficha-section">
                    <!-- Los rankings y gráficos se insertarán aquí -->
                </div>`;

            let clasesHtml = '';
            if (!isNew) {
                const checkboxes = data.todas_las_clases.map(clase => `
                    <label>
                        <input type="checkbox" name="clases_ids[]" value="${clase.id}" ${data.clases_del_alumno_ids.includes(clase.id) ? 'checked' : ''}>
                        ${clase.nombre}
                    </label>
                `).join('');

                clasesHtml = `
                    <div class="cpp-ficha-section">
                        <h3>Asignar a Clases</h3>
                        <div class="cpp-clases-checkbox-container">${checkboxes}</div>
                        <div class="cpp-form-actions">
                            <button type="button" id="cpp-update-clases-btn" class="cpp-btn" data-alumno-id="${alumno.id}">Actualizar Clases</button>
                        </div>
                    </div>`;
            }

            let calificacionesHtml = '';
            if (!isNew && data.calificaciones_agrupadas.length > 0) {
                calificacionesHtml = '<div class="cpp-ficha-section"><h3>Calificaciones</h3><div class="cpp-calificaciones-accordion">';

                data.calificaciones_agrupadas.forEach(clase => {
                    calificacionesHtml += `<div class="cpp-accordion-item">
                        <button class="cpp-accordion-header">${clase.clase_nombre}</button>
                        <div class="cpp-accordion-content">`;

                    clase.evaluaciones.forEach(evaluacion => {
                        const notaFinal = evaluacion.nota_final.is_incomplete ?
                            `${evaluacion.nota_final.nota}% <span title="La nota no está sobre el 100% de las actividades">⚠️</span>` :
                            `${evaluacion.nota_final.nota}%`;

                        calificacionesHtml += `<div class="cpp-accordion-item">
                            <button class="cpp-accordion-header sub-header">${evaluacion.evaluacion_nombre} <span class="nota-final-pill">${notaFinal}</span></button>
                            <div class="cpp-accordion-content" data-evaluacion-id="${evaluacion.evaluacion_id}">
                                <table class="cpp-calificaciones-table">
                                    <tbody>`;

                        if (evaluacion.actividades.length > 0) {
                            evaluacion.actividades.forEach(actividad => {
                                const calificacion = actividad.calificacion || '-';
                                const colorCategoria = actividad.categoria_color || 'transparent';
                                calificacionesHtml += `<tr style="background-color: ${colorCategoria};">
                                    <td>${actividad.nombre_actividad}</td>
                                    <td class="cpp-calificacion-editable" data-actividad-id="${actividad.id}" data-alumno-id="${alumno.id}">
                                        <span>${calificacion}</span>
                                    </td>
                                </tr>`;
                            });
                        } else {
                            calificacionesHtml += '<tr><td colspan="2">No hay actividades.</td></tr>';
                        }

                        calificacionesHtml += `</tbody></table></div></div>`;
                    });

                    calificacionesHtml += `</div></div>`;
                });

                calificacionesHtml += '</div></div>';
            }

            const finalHtml = `
                <div class="cpp-alumno-ficha-card">
                    ${personalDataHtml}
                    ${clasesHtml}
                    ${calificacionesHtml}
                </div>`;

            $container.html(finalHtml);

            if (!isNew) {
                const mapNombreClaseAId = data.todas_las_clases.reduce((acc, clase) => {
                    acc[clase.nombre] = clase.id;
                    return acc;
                }, {});
                const idsWithGrades = data.calificaciones_agrupadas
                    .map(claseData => mapNombreClaseAId[claseData.clase_nombre])
                    .filter(id => id !== undefined);

                $('#cpp-update-clases-btn').data({
                    'initial-ids': data.clases_del_alumno_ids,
                    'ids-with-grades': idsWithGrades
                });

                this.renderRankingWidgets(alumno.id, data.clases_del_alumno_ids, data.todas_las_clases);
                this.renderEvolutionCharts(alumno.id, data.clases_del_alumno_ids, data.todas_las_clases);
            }
        },

        renderEvolutionCharts: function(alumnoId, clasesDelAlumnoIds, todasLasClases) {
            const $container = $('#cpp-alumno-visual-data');
            $container.append('<h3 style="margin-top: 30px;">Evolución de Calificaciones</h3>');

            const clasesMap = todasLasClases.reduce((acc, clase) => {
                acc[clase.id] = clase.nombre;
                return acc;
            }, {});

            clasesDelAlumnoIds.forEach(claseId => {
                const claseNombre = clasesMap[claseId] || 'Clase desconocida';
                const $chartWidget = $(`
                    <div class="cpp-chart-widget">
                        <strong>${claseNombre}</strong>
                        <div class="cpp-chart-container">
                            <canvas id="chart-clase-${claseId}"></canvas>
                        </div>
                    </div>
                `);
                $container.append($chartWidget);

                $.ajax({
                    url: cppFrontendData.ajaxUrl,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        action: 'cpp_get_alumno_calificaciones_evolucion',
                        nonce: cppFrontendData.nonce,
                        alumno_id: alumnoId,
                        clase_id: claseId
                    },
                    success: (response) => {
                        if (response.success && response.data.length > 0) {
                            const labels = response.data.map(d => new Date(d.fecha).toLocaleDateString());
                            const dataPoints = response.data.map(d => d.nota);

                            const ctx = document.getElementById(`chart-clase-${claseId}`).getContext('2d');
                            this.charts[claseId] = new Chart(ctx, {
                                type: 'line',
                                data: {
                                    labels: labels,
                                    datasets: [{
                                        label: 'Calificación (0-100)',
                                        data: dataPoints,
                                        borderColor: '#007bff',
                                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                                        fill: true,
                                        tension: 0.1
                                    }]
                                },
                                options: {
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            max: 100
                                        }
                                    },
                                    plugins: {
                                        legend: {
                                            display: false
                                        }
                                    }
                                }
                            });
                        } else {
                             $(`#chart-clase-${claseId}`).closest('.cpp-chart-container').html('<p class="cpp-empty-panel-small">No hay suficientes datos para mostrar un gráfico.</p>');
                        }
                    },
                    error: () => {
                        $(`#chart-clase-${claseId}`).closest('.cpp-chart-container').html('<p class="cpp-error-message">Error al cargar el gráfico.</p>');
                    }
                });
            });
        },

        renderRankingWidgets: function(alumnoId, clasesDelAlumnoIds, todasLasClases) {
            const $container = $('#cpp-alumno-visual-data');
            $container.html('<h3>Ranking en Clase</h3>');

            this.charts = this.charts || {}; // Almacenar instancias de gráficos
            // Limpiar gráficos anteriores
            Object.values(this.charts).forEach(chart => chart.destroy());
            this.charts = {};

            const clasesMap = todasLasClases.reduce((acc, clase) => {
                acc[clase.id] = clase.nombre;
                return acc;
            }, {});

            if (clasesDelAlumnoIds.length === 0) {
                $container.append('<p>Este alumno no está asignado a ninguna clase.</p>');
                return;
            }

            clasesDelAlumnoIds.forEach(claseId => {
                const claseNombre = clasesMap[claseId] || 'Clase desconocida';
                const $rankingWidget = $(`
                    <div class="cpp-ranking-widget">
                        <div class="cpp-ranking-header">
                            <strong>${claseNombre}</strong>
                            <span id="ranking-text-${claseId}">Cargando...</span>
                        </div>
                        <div class="cpp-ranking-bar-container">
                            <div class="cpp-ranking-bar">
                                <div class="cpp-ranking-dot" id="ranking-dot-${claseId}" style="left: 50%;"></div>
                            </div>
                        </div>
                    </div>
                `);
                $container.append($rankingWidget);

                $.ajax({
                    url: cppFrontendData.ajaxUrl,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        action: 'cpp_get_alumno_ranking_in_clase',
                        nonce: cppFrontendData.nonce,
                        alumno_id: alumnoId,
                        clase_id: claseId
                    },
                    success: (response) => {
                        if (response.success) {
                            const ranking = response.data.ranking;
                            const total = response.data.total_alumnos;
                            const percentage = total > 1 ? ((ranking - 1) / (total - 1)) * 100 : 50;

                            $(`#ranking-text-${claseId}`).text(`Posición: ${ranking} de ${total}`);
                            $(`#ranking-dot-${claseId}`).css('left', `${percentage}%`);
                        } else {
                             $(`#ranking-text-${claseId}`).text('No disponible');
                        }
                    },
                    error: () => {
                        $(`#ranking-text-${claseId}`).text('Error');
                    }
                });
            });
        },

        handleSaveAlumnoDetails: function(e) {
            e.preventDefault();
            const $form = $(e.currentTarget);
            const data = $form.serializeArray().reduce((obj, item) => {
                obj[item.name] = item.value;
                return obj;
            }, {});
            data.action = 'cpp_save_alumno_details';
            data.nonce = cppFrontendData.nonce;

            cpp.utils.showSpinner();

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: data,
                success: (response) => {
                    cpp.utils.hideSpinner();
                    if (response.success) {
                        cpp.utils.showToast(response.data.message);
                        this.handleSearch();
                        this.displayAlumnoFicha(response.data.alumno.id);
                    } else {
                        alert(`Error: ${response.data.message}`);
                    }
                },
                error: () => {
                    cpp.utils.hideSpinner();
                    alert('Error de conexión.');
                }
            });
        },

        handleUpdateAlumnoClases: function(e) {
            const $button = $(e.currentTarget);
            const alumnoId = $button.data('alumno-id');
            const initialIds = $button.data('initial-ids') || [];
            const idsWithGrades = $button.data('ids-with-grades') || [];
            const newClasesIds = $('input[name="clases_ids[]"]:checked').map(function() {
                return parseInt($(this).val(), 10);
            }).get();
            const unselectedIds = initialIds.filter(id => !newClasesIds.includes(id));
            const unselectedWithGrades = unselectedIds.filter(id => idsWithGrades.includes(id));

            if (unselectedWithGrades.length > 0) {
                if (!confirm('ADVERTENCIA:\n\nEstás a punto de desasignar al alumno de clases donde ya tiene calificaciones. Si guardas, esas notas se eliminarán PERMANENTEMENTE.\n\n¿Continuar?')) {
                    return;
                }
            }

            cpp.utils.showSpinner();
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_update_alumno_clases',
                    nonce: cppFrontendData.nonce,
                    alumno_id: alumnoId,
                    clases_ids: newClasesIds
                },
                success: (response) => {
                    cpp.utils.hideSpinner();
                    if (response.success) {
                        cpp.utils.showToast(response.data.message);
                        this.handleSearch();
                        this.displayAlumnoFicha(alumnoId);
                    } else {
                        alert(`Error: ${response.data.message}`);
                    }
                },
                error: () => {
                    cpp.utils.hideSpinner();
                    alert('Error de conexión.');
                }
            });
        },

        handleDeleteAlumno: function(e) {
            const alumnoId = $(e.currentTarget).data('alumno-id');
            if (!confirm('¿Seguro que quieres eliminar este alumno PERMANENTEMENTE? Se borrarán todos sus datos y notas en TODAS las clases.')) {
                return;
            }

            cpp.utils.showSpinner();
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_delete_alumno_globally',
                    nonce: cppFrontendData.nonce,
                    alumno_id: alumnoId
                },
                success: (response) => {
                    cpp.utils.hideSpinner();
                    if (response.success) {
                        cpp.utils.showToast(response.data.message);
                        this.handleSearch();
                        $('#cpp-alumnos-view-main').html(this.getInitialMainContentHtml());
                    } else {
                        alert(`Error: ${response.data.message}`);
                    }
                },
                error: () => {
                    cpp.utils.hideSpinner();
                    alert('Error de conexión.');
                }
            });
        },

        getInitialMainContentHtml: function() {
            return `
                <div class="cpp-empty-panel">
                    <span class="dashicons dashicons-groups"></span>
                    <h2>Gestión Global de Alumnos</h2>
                    <p>Selecciona un alumno de la lista para ver su ficha, editar sus datos y asignarlo a tus clases.</p>
                    <p>O pulsa <strong>"Nuevo Alumno"</strong> para empezar.</p>
                </div>`;
        },

        toggleEditMode: function(enable) {
            const $nameContainer = $('.cpp-alumno-name-container');
            if (enable) {
                // Entrar en modo edición
                $nameContainer.addClass('editing');
                $('.cpp-editable-field').each(function() {
                    const $h2 = $(this);
                    const currentValue = $h2.text();
                    const fieldName = $h2.data('field');
                    const $input = $(`<input type="text" class="cpp-editable-field-input" data-field="${fieldName}" value="${currentValue}">`);
                    $input.data('original-value', currentValue); // Guardar valor original
                    $h2.after($input);
                });
                $('#cpp-edit-alumno-btn').hide();
                $('#cpp-edit-actions-container').show();
            } else {
                // Salir del modo edición (Cancelar)
                $nameContainer.removeClass('editing');
                $('.cpp-editable-field-input').each(function() {
                    const $input = $(this);
                    const originalValue = $input.data('original-value');
                    const fieldName = $input.data('field');
                    $(`#cpp-alumno-${fieldName}-display`).text(originalValue); // Restaurar texto original
                    $input.remove();
                });
                $('#cpp-edit-alumno-btn').show();
                $('#cpp-edit-actions-container').hide();
            }
        },

        handleSaveInline: function(e) {
            const $button = $(e.currentTarget);
            const alumnoId = $button.data('alumno-id');

            const newData = {
                nombre: $('.cpp-editable-field-input[data-field="nombre"]').val(),
                apellidos: $('.cpp-editable-field-input[data-field="apellidos"]').val(),
            };

            cpp.utils.showSpinner();
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_save_alumno_details',
                    nonce: cppFrontendData.nonce,
                    alumno_id: alumnoId,
                    ...newData
                },
                success: (response) => {
                    cpp.utils.hideSpinner();
                    if (response.success) {
                        cpp.utils.showToast(response.data.message);
                        // Actualizar UI sin recargar todo
                        $('#cpp-alumno-nombre-display').text(newData.nombre);
                        $('#cpp-alumno-apellidos-display').text(newData.apellidos);
                        this.toggleEditMode(false); // Salir del modo edición
                        this.handleSearch(); // Actualizar la lista de la izquierda
                    } else {
                        alert(`Error: ${response.data.message}`);
                    }
                },
                error: () => {
                    cpp.utils.hideSpinner();
                    alert('Error de conexión.');
                }
            });
        },

        handleChangeFoto: function(e) {
            // Simula un clic en el input de archivo oculto
            $('#cpp-alumno-foto-input').click();
        },

        handleUploadFoto: function(e) {
            const fileInput = e.currentTarget;
            if (fileInput.files.length === 0) {
                return;
            }

            const alumnoId = $(fileInput).data('alumno-id');
            const file = fileInput.files[0];
            const formData = new FormData();

            formData.append('action', 'cpp_upload_alumno_foto');
            formData.append('nonce', cppFrontendData.nonce);
            formData.append('alumno_id', alumnoId);
            formData.append('foto', file);

            cpp.utils.showSpinner();

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                dataType: 'json',
                success: (response) => {
                    cpp.utils.hideSpinner();
                    if (response.success) {
                        cpp.utils.showToast('Foto actualizada.');
                        // Actualizar la imagen en la UI
                        $('#cpp-alumno-foto-editable').attr('src', response.data.new_foto_url);
                    } else {
                        alert(`Error: ${response.data.message}`);
                    }
                },
                error: () => {
                    cpp.utils.hideSpinner();
                    alert('Error de conexión al subir la foto.');
                }
            });
        }
    };

})(jQuery);
