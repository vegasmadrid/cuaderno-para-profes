// assets/js/cpp-modales-ficha-alumno.js
(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-modales-ficha-alumno.js no puede inicializarse.");
        return;
    }
    cpp.modals = cpp.modals || {};

    cpp.modals.fichaAlumno = {
        currentAlumnoId: null,
        currentClaseId: null,

        init: function() {
            console.log("CPP Modals Ficha Alumno Module Initializing...");
            this.bindEvents();
        },

        resetModal: function() {
            const $modal = $('#cpp-modal-ficha-alumno');
            if (!$modal.length) return;
            $modal.find('#cpp-ficha-display-nombre-completo').text('Ficha del Alumno');
            $modal.find('#cpp-ficha-alumno-main-content').html('<p class="cpp-cuaderno-cargando">Cargando datos...</p>');
            const $form = $modal.find('#cpp-form-editar-alumno-ficha');
            $form.trigger('reset').hide();
            $modal.find('#cpp-ficha-alumno-main-content').show();
            $modal.find('.cpp-edit-info-alumno-btn').show();
        },

        mostrar: function(alumnoId, claseId) {
            if (!alumnoId || !claseId) {
                alert('Error: Se requiere ID de alumno y ID de clase para ver la ficha.');
                return;
            }
            this.currentAlumnoId = alumnoId;
            this.currentClaseId = claseId;

            if (cpp.modals && cpp.modals.general && typeof cpp.modals.general.hideAll === 'function') {
                cpp.modals.general.hideAll();
            }

            const $modal = $('#cpp-modal-ficha-alumno');
            this.resetModal();
            $modal.fadeIn();

            const self = this;

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_obtener_datos_ficha_alumno',
                    nonce: cppFrontendData.nonce,
                    alumno_id: self.currentAlumnoId,
                    clase_id: self.currentClaseId
                },
                success: function(response) {
                    if (response.success) {
                        self.renderizarFicha(response.data);
                    } else {
                        alert('Error al cargar datos de la ficha: ' + (response.data && response.data.message ? response.data.message : 'Error desconocido.'));
                        $modal.fadeOut();
                    }
                },
                error: function() {
                    alert('Error de conexión al cargar datos de la ficha.');
                    $modal.fadeOut();
                }
            });
        },

        _buildResumenAcademicoHTML: function(resumen, claseInfo) {
            if (!resumen) return '<p>No hay datos académicos disponibles.</p>';
            let html = '<div class="cpp-ficha-seccion">';
            html += '<h3>Resumen Académico</h3>';

            html += '<ul class="cpp-ficha-lista-desglose">';
            if (resumen.desglose_evaluaciones && resumen.desglose_evaluaciones.length > 0) {
                resumen.desglose_evaluaciones.forEach(function(evaluacion) {
                    html += `<li class="cpp-ficha-evaluacion-item">
                                <div class="cpp-ficha-evaluacion-header" data-evaluacion-id="${evaluacion.id}" title="Ir a esta evaluación en el cuaderno">
                                    <span class="cpp-ficha-desglose-nombre">${$('<div>').text(evaluacion.nombre_evaluacion).html()}</span>
                                    <span class="cpp-ficha-desglose-nota">${evaluacion.nota_final_formateada}</span>
                                </div>`;

                    // Contenedor para el gráfico y el desglose
                    html += '<div class="cpp-evaluacion-details-container">';

                    if (evaluacion.desglose_categorias && evaluacion.desglose_categorias.length > 0) {
                        // Contenedor del gráfico
                        html += `<div class="cpp-evaluacion-chart-container">
                                    <canvas id="chart-evaluacion-${evaluacion.id}"></canvas>
                                 </div>`;
                        // Contenedor del desglose
                        html += '<div class="cpp-evaluacion-breakdown-container">';
                        html += '<ul class="cpp-ficha-lista-categorias-desglose">';
                        evaluacion.desglose_categorias.forEach(function(categoria) {
                            html += `<li class="cpp-ficha-categoria-item">
                                        <span class="cpp-ficha-categoria-nombre">${$('<div>').text(categoria.nombre_categoria).html()} <small>(${categoria.porcentaje}%)</small></span>
                                        <span class="cpp-ficha-categoria-nota">${categoria.nota_categoria_formateada}</span>
                                     </li>`;
                        });
                        html += '</ul>';
                        html += '</div>'; // Cierre de breakdown-container
                    } else {
                        html += '<div class="cpp-no-breakdown-message"><p>No hay categorías con notas para mostrar en esta evaluación.</p></div>';
                    }

                    html += '</div>'; // Cierre de details-container
                    html += `</li>`;
                });
            } else {
                html += '<li>No hay evaluaciones con notas.</li>';
            }
            html += '</ul>';
            html += '</div>';
            return html;
        },

        _renderizarGraficoEvaluacion: function(evaluacionData, baseNota) {
            const canvasId = `chart-evaluacion-${evaluacionData.id}`;
            const ctx = document.getElementById(canvasId);
            if (!ctx || typeof Chart === 'undefined') {
                console.error("Chart.js no está definido o el canvas no existe.");
                return;
            }

            const labels = evaluacionData.desglose_categorias.map(cat => cat.nombre_categoria);
            const dataPoints = evaluacionData.desglose_categorias.map(cat => {
                const nota = cat.nota_categoria_formateada ? cat.nota_categoria_formateada.replace(',', '.') : '0';
                return parseFloat(nota);
            });

            // Destruir gráfico existente si lo hubiera para evitar conflictos
            const chartInstance = Chart.getChart(canvasId);
            if (chartInstance) {
                chartInstance.destroy();
            }

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Nota',
                        data: dataPoints,
                        backgroundColor: 'rgba(26, 115, 232, 0.5)',
                        borderColor: 'rgba(26, 115, 232, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y', // Barras horizontales
                    scales: {
                        x: {
                            beginAtZero: true,
                            max: parseFloat(baseNota) || 10
                        }
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) { label += ': '; }
                                    if (context.parsed.x !== null) {
                                        label += context.parsed.x.toLocaleString();
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        },

        _buildResumenAsistenciaHTML: function(resumen) {
            if (!resumen) return '<p>No hay datos de asistencia disponibles.</p>';
            let html = '<div class="cpp-ficha-seccion">';
            html += '<h3>Resumen de Asistencia</h3>';

            if (resumen.stats) {
                html += '<div class="cpp-ficha-stats-grid">';
                html += `<div class="stat-item"><span class="stat-icon">✅</span><div><strong>${resumen.stats.presente || 0}</strong><br>Presente</div></div>`;
                html += `<div class="stat-item"><span class="stat-icon">❌</span><div><strong>${resumen.stats.ausente || 0}</strong><br>Ausente</div></div>`;
                html += `<div class="stat-item"><span class="stat-icon">🕒</span><div><strong>${resumen.stats.retraso || 0}</strong><br>Retraso</div></div>`;
                html += `<div class="stat-item"><span class="stat-icon">📄</span><div><strong>${resumen.stats.justificado || 0}</strong><br>Justificado</div></div>`;
                html += '</div>';
            }

            html += '<h4>Historial de Incidencias</h4>';
            html += '<div class="cpp-lista-scrollable cpp-ficha-asistencia-lista">';
            html += '<ul>';
            if (resumen.historial_completo && resumen.historial_completo.length > 0) {
                resumen.historial_completo.forEach(function(item) {
                    const fechaFormateada = item.fecha_asistencia ? new Date(item.fecha_asistencia + 'T00:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
                    let observacionHtml = item.observaciones ? `<small class="cpp-asistencia-observacion-item">${$('<div>').text(item.observaciones).html()}</small>` : '';
                    html += `<li class="cpp-asistencia-fila-item">
                                <div class="cpp-asistencia-info-principal">
                                    <span class="cpp-asistencia-fecha-item">${fechaFormateada}</span>
                                    <span class="cpp-asistencia-estado-item cpp-estado-${$('<div>').text(item.estado).html()}">${$('<div>').text(item.estado).html()}</span>
                                </div>
                                ${observacionHtml}
                             </li>`;
                });
            } else {
                html += '<li class="cpp-no-incidencias">No hay incidencias registradas.</li>';
            }
            html += '</ul>';
            html += '</div>';
            html += '</div>';
            return html;
        },

        renderizarFicha: function(data) {
            const $modal = $('#cpp-modal-ficha-alumno');
            if (!$modal.length || !data) return;

            const $header = $modal.find('.cpp-ficha-alumno-header');
            const $nombreEl = $header.find('#cpp-ficha-display-nombre-completo');
            const $editBtn = $modal.find('.cpp-edit-info-alumno-btn');

            // --- Limpieza de contenido dinámico ---
            $header.find('.cpp-ficha-nota-global-wrapper').remove();

            // --- Reestructuración del DOM (solo si es necesario) ---
            if (!$nombreEl.parent().hasClass('cpp-ficha-nombre-wrapper')) {
                const $nombreWrapper = $('<div class="cpp-ficha-nombre-wrapper"></div>');
                $nombreEl.after($nombreWrapper);
                $nombreWrapper.append($editBtn);
                $nombreWrapper.append($nombreEl);
            }

            // --- Rellenar datos ---
            if (data.alumno_info) {
                $nombreEl.text(`${data.alumno_info.nombre} ${data.alumno_info.apellidos}`);

                if (data.alumno_info.foto) {
                    $header.find('#cpp-ficha-alumno-foto').attr('src', data.alumno_info.foto).show();
                    $header.find('#cpp-ficha-alumno-avatar-inicial').hide();
                } else {
                    $header.find('#cpp-ficha-alumno-foto').hide();
                    const inicial = data.alumno_info.nombre ? data.alumno_info.nombre.charAt(0).toUpperCase() : '';
                    $header.find('#cpp-ficha-alumno-avatar-inicial').text(inicial).show();
                }
                $modal.find('#ficha_alumno_id_editar').val(data.alumno_info.id);
                $modal.find('#ficha_nombre_alumno').val(data.alumno_info.nombre);
                $modal.find('#ficha_apellidos_alumno').val(data.alumno_info.apellidos);
            }

            // 2. Añadir nota final media a la cabecera
            if (data.resumen_academico && data.clase_info) {
                let notaHtml = '<div class="cpp-ficha-nota-global-wrapper">';
                notaHtml += '<div class="cpp-ficha-nota-global-container">';
                notaHtml += '<span class="cpp-ficha-nota-global-valor">' + (data.resumen_academico.nota_final_global_formateada || '-') + '</span>';
                notaHtml += '<span class="cpp-ficha-nota-global-base">/ ' + (data.clase_info.base_nota_final || '100') + '</span>';
                notaHtml += '</div>';
                notaHtml += '<p class="cpp-ficha-nota-global-label">Nota Final Media</p>';
                notaHtml += '</div>';
                $header.append(notaHtml);
            }

            const $mainContent = $modal.find('#cpp-ficha-alumno-main-content');

            // Build tab navigation
            let tabsHtml = '<div class="cpp-ficha-tabs">';
            tabsHtml += '<button class="cpp-ficha-tab-btn active" data-tab="academico">Resumen Académico</button>';
            tabsHtml += '<button class="cpp-ficha-tab-btn" data-tab="asistencia">Asistencia</button>';
            tabsHtml += '</div>';

            // Build tab content
            let tabContentHtml = '<div class="cpp-ficha-tab-content-container">';

            // Academic tab
            tabContentHtml += '<div id="cpp-ficha-tab-academico" class="cpp-ficha-tab-content active">';
            tabContentHtml += this._buildResumenAcademicoHTML(data.resumen_academico, data.clase_info);
            tabContentHtml += '</div>';

            // Attendance tab
            tabContentHtml += '<div id="cpp-ficha-tab-asistencia" class="cpp-ficha-tab-content">';
            tabContentHtml += this._buildResumenAsistenciaHTML(data.resumen_asistencia);
            tabContentHtml += '</div>';

            tabContentHtml += '</div>';

            $mainContent.html(tabsHtml + tabContentHtml);

            // Renderizar los gráficos después de que el HTML esté en el DOM
            if (data.resumen_academico && data.resumen_academico.desglose_evaluaciones) {
                const baseNotaFinal = parseFloat(data.clase_info.base_nota_final.replace(',', '.')) || 10;
                const self = this;
                setTimeout(function() {
                    data.resumen_academico.desglose_evaluaciones.forEach(evaluacion => {
                        if (evaluacion.desglose_categorias && evaluacion.desglose_categorias.length > 0) {
                            self._renderizarGraficoEvaluacion(evaluacion, baseNotaFinal);
                        }
                    });
                }, 100); // Pequeño delay para asegurar que el DOM está listo
            }
        },

        toggleEditInfoAlumno: function(showForm) {
            const $modal = $('#cpp-modal-ficha-alumno');
            const $mainContent = $modal.find('#cpp-ficha-alumno-main-content');
            const $form = $modal.find('#cpp-form-editar-alumno-ficha');
            const $editBtn = $modal.find('.cpp-edit-info-alumno-btn');

            if (showForm) {
                $mainContent.hide();
                $form.show();
                $editBtn.hide();
            } else {
                $form.hide();
                $mainContent.show();
                $editBtn.show();
            }
        },

        guardarInfoAlumno: function(eventForm) {
            eventForm.preventDefault();
            const $form = $(eventForm.target);
            const $btn = $form.find('button[type="submit"]');
            const formData = new FormData(eventForm.target);

            formData.append('action', 'cpp_guardar_alumno');
            formData.append('nonce', cppFrontendData.nonce);
            formData.append('clase_id_form_alumno', this.currentClaseId);


            const originalBtnHtml = $btn.html();
            $btn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...');
            const self = this;

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        alert(response.data.message || 'Información guardada.');
                        self.toggleEditInfoAlumno(false);
                        self.mostrar(self.currentAlumnoId, self.currentClaseId);
                        if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function') {
                            const $claseActiva = $('.cpp-sidebar-clase-item.cpp-sidebar-item-active');
                            if ($claseActiva.length) {
                                cpp.gradebook.cargarContenidoCuaderno($claseActiva.data('clase-id'), $claseActiva.data('clase-nombre'));
                            }
                        }
                    } else {
                        alert('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudo guardar.'));
                    }
                },
                error: function() {
                    alert('Error de conexión al guardar la información del alumno.');
                },
                complete: function() {
                    $btn.prop('disabled', false).html(originalBtnHtml);
                }
            });
        },

        bindEvents: function() {
            console.log("Binding Modals Ficha Alumno events...");
            const $modal = $('#cpp-modal-ficha-alumno');
            const self = this;

            // Tab switching logic
            $modal.on('click', '.cpp-ficha-tab-btn', function() {
                const $this = $(this);
                const tabId = $this.data('tab');

                // Update active state on buttons
                $modal.find('.cpp-ficha-tab-btn').removeClass('active');
                $this.addClass('active');

                // Update active state on content panes
                $modal.find('.cpp-ficha-tab-content').removeClass('active');
                $modal.find('#cpp-ficha-tab-' + tabId).addClass('active');
            });

            $modal.on('click', '.cpp-edit-info-alumno-btn', function() {
                self.toggleEditInfoAlumno(true);
            });

            $modal.on('click', '.cpp-cancel-edit-info-alumno-btn', function() {
                self.toggleEditInfoAlumno(false);
            });

            $modal.on('submit', '#cpp-form-editar-alumno-ficha', function(e) {
                self.guardarInfoAlumno(e);
            });

            // Navegación al cuaderno desde el desglose de evaluaciones
            $modal.on('click', '.cpp-ficha-evaluacion-header', function() {
                const evaluacionId = $(this).data('evaluacion-id');
                const claseId = self.currentClaseId;
                if (evaluacionId && claseId) {
                    if (cpp.modals && cpp.modals.general && typeof cpp.modals.general.hideAll === 'function') {
                        cpp.modals.general.hideAll();
                    }
                    if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function') {
                        const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();
                        cpp.gradebook.cargarContenidoCuaderno(claseId, claseNombre, evaluacionId);
                    }
                }
            });
        }
    };

})(jQuery);