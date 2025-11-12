
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
        },

        exit: function() {
            $('#cpp-alumnos-search-results').empty();
            $('#cpp-alumnos-view-main').html(this.getInitialMainContentHtml());
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
            $document.on('click', '#cpp-crear-nuevo-alumno-global-btn', this.handleNewAlumnoClick.bind(this));
            $document.on('submit', '#cpp-ficha-alumno-form', this.handleSaveAlumnoDetails.bind(this));
            $document.on('click', '#cpp-update-clases-btn', this.handleUpdateAlumnoClases.bind(this));
            $document.on('click', '#cpp-eliminar-alumno-global-btn', this.handleDeleteAlumno.bind(this));
            $document.on('click', '#cpp-importar-alumnos-global-btn', function() {
                cpp.modales.excel.openForGlobalImport();
            });
        },

        loadInitialAlumnosList: function() {
            this.handleSearch();
        },

        handleSearch: function() {
            const searchTerm = $('#cpp-alumnos-search-input').val();
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
                const clasesHtml = alumno.clases.length > 0 ?
                    `<span class="cpp-alumno-list-clases">${alumno.clases.join(', ')}</span>` :
                    `<span class="cpp-alumno-list-clases cpp-no-clases">Sin asignar</span>`;
                const $li = $('<li>', { class: 'cpp-alumno-list-item', 'data-alumno-id': alumno.id })
                    .append(`<span class="cpp-alumno-list-nombre">${alumno.nombre} ${alumno.apellidos}</span>`)
                    .append(clasesHtml);
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

            let personalDataHtml = `
                <div class="cpp-ficha-section">
                    <h3>Datos Personales</h3>
                    <form id="cpp-ficha-alumno-form" class="cpp-modern-form">
                        <input type="hidden" name="alumno_id" value="${isNew ? '0' : alumno.id}">
                        <div class="cpp-form-grid">
                            <div class="cpp-form-group">
                                <label for="nombre">Nombre</label>
                                <input type="text" id="nombre" name="nombre" value="${isNew ? '' : alumno.nombre}" required>
                            </div>
                            <div class="cpp-form-group">
                                <label for="apellidos">Apellidos</label>
                                <input type="text" id="apellidos" name="apellidos" value="${isNew ? '' : alumno.apellidos}" required>
                            </div>
                        </div>
                        <div class="cpp-form-group">
                            <label for="foto">URL de la Foto</label>
                            <input type="url" id="foto" name="foto" value="${isNew ? '' : (alumno.foto || '')}">
                        </div>
                        <div class="cpp-form-actions">
                            <button type="submit" class="cpp-btn cpp-btn-primary"><span class="dashicons dashicons-saved"></span> ${isNew ? 'Crear Alumno' : 'Guardar Cambios'}</button>
                            ${!isNew ? `<button type="button" id="cpp-eliminar-alumno-global-btn" class="cpp-btn cpp-btn-danger" data-alumno-id="${alumno.id}"><span class="dashicons dashicons-trash"></span> Eliminar Alumno</button>` : ''}
                        </div>
                    </form>
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
                calificacionesHtml = '<div class="cpp-ficha-section"><h3>Calificaciones</h3>';
                data.calificaciones_agrupadas.forEach(clase => {
                    calificacionesHtml += `<div class="cpp-calificaciones-clase-block"><h4>${clase.clase_nombre}</h4>`;
                    clase.evaluaciones.forEach(evaluacion => {
                        const notaFinal = evaluacion.nota_final.is_incomplete ?
                            `${evaluacion.nota_final.nota}% <span title="La nota no está sobre el 100% de las actividades">⚠️</span>` :
                            `${evaluacion.nota_final.nota}%`;
                        calificacionesHtml += `<div class="cpp-calificaciones-eval-block"><h5>${evaluacion.evaluacion_nombre} (Nota: ${notaFinal})</h5><ul>`;
                        evaluacion.actividades.forEach(actividad => {
                            calificacionesHtml += `<li>${actividad.nombre_actividad}: <strong>${actividad.calificacion || '-'}</strong></li>`;
                        });
                        calificacionesHtml += '</ul></div>';
                    });
                    calificacionesHtml += '</div>';
                });
                calificacionesHtml += '</div>';
            }

            const finalHtml = `
                <div class="cpp-alumno-ficha-card">
                    <h2>${isNew ? 'Nuevo Alumno' : `${alumno.nombre} ${alumno.apellidos}`}</h2>
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
            }
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

            cpp.showSpinner();
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: data,
                success: (response) => {
                    cpp.hideSpinner();
                    if (response.success) {
                        cpp.showToast(response.data.message);
                        this.handleSearch();
                        this.displayAlumnoFicha(response.data.alumno.id);
                    } else {
                        alert(`Error: ${response.data.message}`);
                    }
                },
                error: () => {
                    cpp.hideSpinner();
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

            cpp.showSpinner();
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
                    cpp.hideSpinner();
                    if (response.success) {
                        cpp.showToast(response.data.message);
                        this.handleSearch();
                        this.displayAlumnoFicha(alumnoId);
                    } else {
                        alert(`Error: ${response.data.message}`);
                    }
                },
                error: () => {
                    cpp.hideSpinner();
                    alert('Error de conexión.');
                }
            });
        },

        handleDeleteAlumno: function(e) {
            const alumnoId = $(e.currentTarget).data('alumno-id');
            if (!confirm('¿Seguro que quieres eliminar este alumno PERMANENTEMENTE? Se borrarán todos sus datos y notas en TODAS las clases.')) {
                return;
            }

            cpp.showSpinner();
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
                    cpp.hideSpinner();
                    if (response.success) {
                        cpp.showToast(response.data.message);
                        this.handleSearch();
                        $('#cpp-alumnos-view-main').html(this.getInitialMainContentHtml());
                    } else {
                        alert(`Error: ${response.data.message}`);
                    }
                },
                error: () => {
                    cpp.hideSpinner();
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
        }
    };

})(jQuery);
