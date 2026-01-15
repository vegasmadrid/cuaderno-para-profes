// assets/js/cpp-resumen.js

class CppResumenApp {
    constructor() {
        this.container = document.getElementById('cpp-main-tab-resumen');
    }

    render() {
        if (!this.container) {
            console.error('El contenedor para la pestaña de resumen no se ha encontrado.');
            return;
        }

        if (typeof cpp !== 'undefined' && cpp.utils && typeof cpp.utils.showLoader === 'function') {
            cpp.utils.showLoader();
        }

        this.fetchResumenData();
    }

    fetchResumenData() {
        if (typeof cppFrontendData === 'undefined' || !cppFrontendData.ajaxUrl || !cppFrontendData.nonce) {
            console.error('Los datos de frontend (ajaxUrl, nonce) no están disponibles.');
            this.container.innerHTML = '<p class="cpp-error-message">Error de configuración. No se pueden cargar los datos.</p>';
            return;
        }

        const data = new URLSearchParams();
        data.append('action', 'cpp_get_resumen_data');
        data.append('nonce', cppFrontendData.nonce);

        fetch(cppFrontendData.ajaxUrl, {
            method: 'POST',
            body: data
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                this.renderContent(result.data);
            } else {
                throw new Error(result.data.message || 'Error desconocido al cargar los datos del resumen.');
            }
        })
        .catch(error => {
            console.error('Error en la llamada AJAX:', error);
            this.container.innerHTML = `<p class="cpp-error-message">Error: ${error.message}</p>`;
        })
        .finally(() => {
            if (typeof cpp !== 'undefined' && cpp.utils && typeof cpp.utils.hideLoader === 'function') {
                cpp.utils.hideLoader();
            }
        });
    }

    renderContent(data) {
        if (!data) {
            this.container.innerHTML = '<p class="cpp-empty-panel">No hay datos de resumen disponibles.</p>';
            return;
        }

        const { alumnosSuspensos, rankingClases, estadisticasAdicionales } = data;

        this.container.innerHTML = `
            <div class="cpp-resumen-container">
                <h2 class="cpp-resumen-main-title">Resumen Global de Clases</h2>

                <div class="cpp-resumen-grid">
                    <!-- Estadísticas Generales -->
                    <div class="cpp-resumen-card">
                        <h3>Estadísticas Generales</h3>
                        <div class="cpp-stats-general">
                            <div class="cpp-stat-item">
                                <span class="cpp-stat-value">${estadisticasAdicionales.totalAlumnos}</span>
                                <span class="cpp-stat-label">Alumnos Totales</span>
                            </div>
                            <div class="cpp-stat-item">
                                <span class="cpp-stat-value">${estadisticasAdicionales.promedioGeneral.toFixed(2)}</span>
                                <span class="cpp-stat-label">Nota Media General</span>
                            </div>
                            <div class="cpp-stat-item">
                                <span class="cpp-stat-value">${estadisticasAdicionales.tasaAprobados.toFixed(2)}%</span>
                                <span class="cpp-stat-label">Tasa de Aprobados</span>
                            </div>
                        </div>
                    </div>

                    <!-- Ranking de Clases -->
                    <div class="cpp-resumen-card">
                        <h3>Ranking de Clases (por Nota Media)</h3>
                        <ul class="cpp-ranking-list">
                            ${rankingClases.map((clase, index) => `
                                <li class="cpp-ranking-item">
                                    <span class="cpp-ranking-position">${index + 1}</span>
                                    <span class="cpp-ranking-name">${this.escapeHTML(clase.nombre)}</span>
                                    <span class="cpp-ranking-score">${clase.notaMedia.toFixed(2)}%</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>

                    <!-- Gráfico de Distribución de Notas -->
                    <div class="cpp-resumen-card">
                        <h3>Distribución de Notas General</h3>
                        <canvas id="cpp-resumen-chart-distribucion"></canvas>
                    </div>

                    <!-- Gráfico de Tasa de Aprobados por Clase -->
                    <div class="cpp-resumen-card">
                        <h3>Tasa de Aprobados por Clase</h3>
                        <canvas id="cpp-resumen-chart-aprobados"></canvas>
                    </div>
                </div>

                <!-- Tabla de Alumnos con Necesidad de Refuerzo -->
                <div class="cpp-resumen-card">
                    <h3>Alumnos con Necesidad de Refuerzo (Nota < 50%)</h3>
                    <div class="cpp-table-responsive-wrapper">
                        <table class="cpp-resumen-table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Apellidos</th>
                                    <th>Clase</th>
                                    <th>Nota Final</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${alumnosSuspensos.length > 0 ? alumnosSuspensos.map(alumno => `
                                    <tr>
                                        <td>${this.escapeHTML(alumno.nombre)}</td>
                                        <td>${this.escapeHTML(alumno.apellidos)}</td>
                                        <td>${this.escapeHTML(alumno.clase)}</td>
                                        <td><span class="cpp-nota-suspenso">${alumno.notaFinal.toFixed(2)}%</span></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4">¡Felicidades! No hay alumnos suspensos.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Después de renderizar el HTML, inicializamos los gráficos.
        this.initCharts(data);
    }

    initCharts(data) {
        // --- Gráfico 1: Distribución de Notas General ---
        const ctxDistribucion = document.getElementById('cpp-resumen-chart-distribucion');
        if (ctxDistribucion && data.distribucionNotas) {
            new Chart(ctxDistribucion, {
                type: 'doughnut',
                data: {
                    labels: ['Sobresaliente (90-100)', 'Notable (70-89)', 'Bien (60-69)', 'Suficiente (50-59)', 'Insuficiente (<50)'],
                    datasets: [{
                        label: 'Distribución de Notas',
                        data: data.distribucionNotas,
                        backgroundColor: ['#4CAF50', '#8BC34A', '#FFC107', '#FF9800', '#F44336'],
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'top' },
                        title: { display: false, text: 'Distribución de Notas General' }
                    }
                }
            });
        }

        // --- Gráfico 2: Tasa de Aprobados por Clase ---
        const ctxAprobados = document.getElementById('cpp-resumen-chart-aprobados');
        if (ctxAprobados && data.rankingClases) {
            const labels = data.rankingClases.map(c => this.escapeHTML(c.nombre));
            const tasasAprobados = data.rankingClases.map(c => c.tasaAprobados);

            new Chart(ctxAprobados, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Tasa de Aprobados (%)',
                        data: tasasAprobados,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y', // Eje principal ahora es Y
                    responsive: true,
                    scales: {
                        x: { // Configuramos el eje X
                            beginAtZero: true,
                            max: 100
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        title: { display: false }
                    }
                }
            });
        }
    }

    escapeHTML(str) {
        if (!str) return '';
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(str));
        return p.innerHTML;
    }
}

// La inicialización se hace en cpp-cuaderno.js para asegurar que el objeto cpp esté disponible.
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('cpp-main-tab-resumen')) {
        // Aseguramos que el objeto global esté disponible para ser llamado por el gestor de pestañas.
        window.cppResumenApp = new CppResumenApp();
    }
});
