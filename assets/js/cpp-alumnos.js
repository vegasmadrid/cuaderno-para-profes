// assets/js/cpp-alumnos.js

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-alumnos.js no puede inicializarse.");
        return;
    }

    cpp.alumnos = {
        _charts: [], // Almacenar instancias de gráficos para destruirlas después

        init: function() {
            console.log("CPP Alumnos Module Initializing...");
            this.bindEvents();
            this.loadClasesIntoFilter();
        },

        // --- Función para destruir gráficos ---
        destroyCharts: function() {
            this._charts.forEach(chart => chart.destroy());
            this._charts = [];
        },

        loadClasesIntoFilter: function() {
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_get_all_clases_for_user',
                    nonce: cppFrontendData.nonce
                },
                success: function(response) {
                    if (response.success) {
                        const $select = $('#cpp-alumnos-filter-clase');
                        response.data.clases.forEach(function(clase) {
                            $select.append($('<option>', {
                                value: clase.id,
                                text: clase.nombre
                            }));
                        });
                    }
                }
            });
        },

        debounce: function(func, delay) {
            let timeout;
            return function(...args) {
                const context = this;
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(context, args), delay);
            };
        },

        bindEvents: function() {
            console.log("Binding Alumnos events...");
            const $document = $(document);

            const debouncedSearch = this.debounce(this.handleSearch, 300);

            $document.on('click', '#cpp-alumnos-search-btn', this.handleSearch.bind(this));
            $document.on('keyup', '#cpp-alumnos-search-input', debouncedSearch.bind(this));

            $document.on('change', '#cpp-alumnos-filter-clase', this.handleSearch.bind(this));

            $document.on('click', '.cpp-alumno-list-item', function(e) {
                const alumnoId = $(e.target).data('alumno-id');
                this.displayAlumnoFicha(alumnoId);
            }.bind(this));

            $document.on('click', '#cpp-edit-alumno-btn', this.toggleEditMode.bind(this, true));
            $document.on('click', '#cpp-cancel-edit-alumno-btn', this.toggleEditMode.bind(this, false));
            $document.on('submit', '#cpp-edit-alumno-form', this.handleSaveAlumno.bind(this));
        },

        toggleEditMode: function(isEditMode) {
            $('#cpp-alumno-ficha-view-mode').toggle(!isEditMode);
            $('#cpp-alumno-ficha-edit-mode').toggle(isEditMode);
        },

        handleSaveAlumno: function(e) {
            e.preventDefault();
            const alumnoId = $('#cpp-edit-alumno-id').val();
            const nombre = $('#cpp-edit-alumno-nombre').val();
            const apellidos = $('#cpp-edit-alumno-apellidos').val();

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_update_alumno',
                    nonce: cppFrontendData.nonce,
                    alumno_id: alumnoId,
                    nombre: nombre,
                    apellidos: apellidos
                },
                success: function(response) {
                    if (response.success) {
                        this.displayAlumnoFicha(alumnoId); // Refresh the view
                    } else {
                        alert('Error al guardar: ' + response.data.message);
                    }
                }.bind(this),
                error: function() {
                    alert('Error de conexión al guardar.');
                }
            });
        },

        handleSearch: function() {
            const searchTerm = $('#cpp-alumnos-search-input').val();
            const claseId = $('#cpp-alumnos-filter-clase').val();
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
                success: function(response) {
                    if (response.success) {
                        this.renderSearchResults(response.data.alumnos);
                    } else {
                        $resultsContainer.html(`<p class="cpp-error-message">${response.data.message}</p>`);
                    }
                }.bind(this),
                error: function() {
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
            alumnos.forEach(function(alumno) {
                const $li = $('<li>', {
                    class: 'cpp-alumno-list-item',
                    'data-alumno-id': alumno.id,
                    text: `${alumno.nombre} ${alumno.apellidos} (${alumno.clase_nombre})`
                });
                $ul.append($li);
            });

            $resultsContainer.append($ul);
        },

        displayAlumnoFicha: function(alumnoId) {
            const $fichaContainer = $('#cpp-alumnos-view-main');
            $fichaContainer.html('<p class="cpp-cuaderno-cargando">Cargando ficha...</p>');

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_get_alumno_ficha',
                    nonce: cppFrontendData.nonce,
                    alumno_id: alumnoId
                },
                success: function(response) {
                    if (response.success) {
                        this.renderAlumnoFicha(response.data.ficha);
                    } else {
                        $fichaContainer.html(`<p class="cpp-error-message">${response.data.message}</p>`);
                    }
                }.bind(this),
                error: function() {
                    $fichaContainer.html('<p class="cpp-error-message">Error de conexión.</p>');
                }
            });
        },

        renderAlumnoFicha: function(fichaData) {
            this.destroyCharts(); // Destruir gráficos antiguos antes de renderizar nuevos
            const $fichaContainer = $('#cpp-alumnos-view-main');

            let anotacionesHtml = '<p>No hay anotaciones registradas.</p>';
            if (fichaData.anotaciones.length > 0) {
                anotacionesHtml = '<ul>';
                fichaData.anotaciones.forEach(function(anotacion) {
                    anotacionesHtml += `<li><strong>${anotacion.fecha}:</strong> ${anotacion.anotacion}</li>`;
                });
                anotacionesHtml += '</ul>';
            }

            let ausenciasHtml = '<p>No hay ausencias registradas.</p>';
            if (fichaData.ausencias.length > 0) {
                ausenciasHtml = '<ul>';
                fichaData.ausencias.forEach(function(ausencia) {
                    ausenciasHtml += `<li><strong>${ausencia.fecha}:</strong> ${ausencia.estado}</li>`;
                });
                ausenciasHtml += '</ul>';
            }

            const fotoHtml = fichaData.foto ? `<img src="${fichaData.foto}" alt="Foto del alumno" class="cpp-alumno-foto">` : `<div class="cpp-alumno-avatar-inicial">${fichaData.nombre.charAt(0)}</div>`;

            const promediosHtml = fichaData.estadisticas.promedios_por_evaluacion.map((p, index) => `
                <div class="cpp-promedio-eval-wrapper">
                    <canvas id="cpp-promedio-chart-${index}" width="100" height="100"></canvas>
                    <div class="cpp-promedio-eval-label">${p.evaluacion_nombre}</div>
                </div>
            `).join('');

            const fichaHtml = `
            <div class="cpp-alumno-ficha-card">
                <div id="cpp-alumno-ficha-view-mode" class="cpp-ficha-container">

                    <div class="cpp-alumno-ficha-header">
                        ${fotoHtml}
                        <div class="cpp-alumno-info-header">
                            <h2 class="cpp-alumno-ficha-nombre">${fichaData.nombre} ${fichaData.apellidos}</h2>
                            <div class="cpp-alumno-meta">
                                <span><strong>Clase:</strong> ${fichaData.clase_nombre}</span>
                                <span class="cpp-alumno-ranking"><strong>Ranking:</strong> ${fichaData.ranking} de ${fichaData.total_alumnos}</span>
                            </div>
                        </div>
                        <button id="cpp-edit-alumno-btn" class="cpp-btn-icon" title="Editar Alumno" data-alumno-id="${fichaData.id}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit-2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
                    </div>

                    <div class="cpp-divider"></div>

                    <h3>Rendimiento Académico</h3>
                    <div class="cpp-rendimiento-chart-container">
                            <canvas id="cpp-alumno-rendimiento-chart"></canvas>
                    </div>

                    <div class="cpp-divider"></div>

                    <h3>Promedio por Evaluación</h3>
                    <div class="cpp-promedios-container">
                        ${promediosHtml}
                    </div>

                    <div class="cpp-divider"></div>

                    <div class="cpp-alumno-ficha-section">
                        <h3>Anotaciones</h3>
                        <div class="cpp-ficha-lista-scroll">
                            ${anotacionesHtml}
                        </div>
                    </div>

                    <div class="cpp-divider"></div>

                    <div class="cpp-alumno-ficha-section">
                        <h3>Registro de Ausencias</h3>
                        <div class="cpp-ficha-lista-scroll">
                            ${ausenciasHtml}
                        </div>
                    </div>
                </div>

                <!-- Modo Edición (oculto por defecto) -->
                <div id="cpp-alumno-ficha-edit-mode" style="display: none;">
                    <h3>Editando Alumno</h3>
                    <form id="cpp-edit-alumno-form">
                        <input type="hidden" id="cpp-edit-alumno-id" value="${fichaData.id}">
                        <div class="cpp-form-group">
                            <label for="cpp-edit-alumno-nombre">Nombre:</label>
                            <input type="text" id="cpp-edit-alumno-nombre" value="${fichaData.nombre}">
                        </div>
                        <div class="cpp-form-group">
                            <label for="cpp-edit-alumno-apellidos">Apellidos:</label>
                            <input type="text" id="cpp-edit-alumno-apellidos" value="${fichaData.apellidos}">
                        </div>
                        <button type="submit" class="cpp-btn cpp-btn-primary">Guardar</button>
                        <button type="button" id="cpp-cancel-edit-alumno-btn" class="cpp-btn cpp-btn-secondary">Cancelar</button>
                    </form>
                </div>
            `;
            $fichaContainer.html(fichaHtml);

            this.renderPromedioCharts(fichaData.estadisticas.promedios_por_evaluacion);
            this.renderRendimientoChart(fichaData.estadisticas.rendimiento_data);
        },

        renderRendimientoChart: function(rendimientoData) {
            const ctx = document.getElementById('cpp-alumno-rendimiento-chart');
            if (!ctx || rendimientoData.length === 0) return;

            const labels = rendimientoData.map(d => new Date(d.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
            const data = rendimientoData.map(d => d.nota_percent);
            const pointColors = rendimientoData.map(d => this.getNotaColor(d.nota_percent));

            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Rendimiento',
                        data: data,
                        borderColor: '#5a98d3',
                        backgroundColor: 'rgba(90, 152, 211, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointBackgroundColor: pointColors,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const dataPoint = rendimientoData[context.dataIndex];
                                    return `${dataPoint.nombre_actividad}: ${dataPoint.nota_percent}%`;
                                }
                            }
                        }
                    }
                }
            });
            this._charts.push(chart);
        },

        renderPromedioCharts: function(promedios) {
            promedios.forEach((p, index) => {
                const ctx = document.getElementById(`cpp-promedio-chart-${index}`);
                if (!ctx) return;

                const promedio = p.promedio;
                const color = this.getNotaColor(promedio);

                const chart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        datasets: [{
                            data: [promedio, 100 - promedio],
                            backgroundColor: [color, '#f0f0f0'],
                            borderWidth: 0,
                            hoverBackgroundColor: [color, '#e9e9e9']
                        }]
                    },
                    options: {
                        responsive: true,
                        cutout: '75%',
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: false },
                            title: {
                                display: true,
                                text: `${Math.round(promedio)}%`,
                                position: 'bottom',
                                align: 'center',
                                font: {
                                    size: 18,
                                    weight: 'bold'
                                },
                                color: color,
                                padding: { top: -45 }
                            }
                        }
                    }
                });
                this._charts.push(chart);
            });
        },

        getNotaColor: function(nota) {
            if (nota >= 90) return '#4CAF50'; // Verde oscuro (sobresaliente)
            if (nota >= 70) return '#8BC34A'; // Verde claro (notable)
            if (nota >= 50) return '#FFC107'; // Ámbar (aprobado)
            return '#F44336'; // Rojo (suspenso)
        }
    };

    // Inicializar el módulo cuando el DOM esté listo
    $(function() {
        if (cpp.alumnos) {
            cpp.alumnos.init();
        }
    });

})(jQuery);
