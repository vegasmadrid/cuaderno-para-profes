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

            // Eventos delegados para la ficha del alumno
            $document.on('submit', '#cpp-ficha-alumno-form', this.handleSaveAlumnoDetails.bind(this));
            $document.on('click', '#cpp-guardar-clases-alumno-btn', this.handleUpdateAlumnoClases.bind(this));
            $document.on('click', '#cpp-eliminar-alumno-global-btn', this.handleDeleteAlumno.bind(this));

            // Importación
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
            this.renderAlumnoFicha(null); // Renderizar formulario vacío
        },

        displayAlumnoFicha: function(alumnoId) {
            const $fichaContainer = $('#cpp-alumnos-view-main');
            $fichaContainer.html('<p class="cpp-cuaderno-cargando">Cargando ficha...</p>');

            if (!alumnoId) {
                this.renderAlumnoFicha(null); // Llamada directa para formulario vacío
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

        renderAlumnoFicha: function(fichaData) {
            const isNew = fichaData === null;
            const alumno = isNew ? {} : fichaData.alumno;
            const $fichaContainer = $('#cpp-alumnos-view-main');

            // Guardar datos iniciales para la lógica de confirmación
            if (!isNew) {
                const mapNombreClaseAId = fichaData.todas_las_clases.reduce((acc, clase) => {
                    acc[clase.nombre] = clase.id;
                    return acc;
                }, {});

                const classIdsWithGrades = fichaData.calificaciones_agrupadas
                    .map(claseData => mapNombreClaseAId[claseData.clase_nombre])
                    .filter(id => id !== undefined);

                // Adjuntar datos al botón de guardar para usarlos en el handler
                setTimeout(() => {
                    $('#cpp-guardar-clases-alumno-btn')
                        .data('initial-ids', fichaData.clases_del_alumno_ids)
                        .data('ids-with-grades', classIdsWithGrades);
                }, 0);
            }

            // --- HTML para el formulario de detalles del alumno ---
            const formDetailsHtml = `
                <form id="cpp-ficha-alumno-form" class="cpp-modern-form">
                    <input type="hidden" name="alumno_id" value="${isNew ? '0' : alumno.id}">
                    <div class="cpp-form-grid">
                        <div class="cpp-form-group">
                            <label for="nombre_alumno">Nombre</label>
                            <input type="text" id="nombre_alumno" name="nombre" value="${isNew ? '' : alumno.nombre}" required>
                        </div>
                        <div class="cpp-form-group">
                            <label for="apellidos_alumno">Apellidos</label>
                            <input type="text" id="apellidos_alumno" name="apellidos" value="${isNew ? '' : alumno.apellidos}" required>
                        </div>
                    </div>
                    <div class="cpp-form-group">
                        <label for="foto_alumno">URL de la foto (opcional)</label>
                        <input type="text" id="foto_alumno" name="foto" value="${isNew ? '' : alumno.foto}">
                    </div>
                    <div class="cpp-form-actions">
                        <button type="submit" class="cpp-btn cpp-btn-primary"><span class="dashicons dashicons-saved"></span> ${isNew ? 'Crear Alumno' : 'Guardar Cambios'}</button>
                        ${!isNew ? `<button type="button" id="cpp-eliminar-alumno-global-btn" class="cpp-btn cpp-btn-danger" data-alumno-id="${alumno.id}"><span class="dashicons dashicons-trash"></span> Eliminar Alumno</button>` : ''}
                    </div>
                </form>
            `;

            // --- HTML para la asignación de clases (solo para alumnos existentes) ---
            let clasesHtml = '';
            if (!isNew) {
                const checkboxesHtml = fichaData.todas_las_clases.map(clase => {
                    const isChecked = fichaData.clases_del_alumno_ids.includes(clase.id);
                    return `
                        <label class="cpp-clase-checkbox-label">
                            <input type="checkbox" name="clases_ids[]" value="${clase.id}" ${isChecked ? 'checked' : ''}>
                            ${clase.nombre}
                        </label>`;
                }).join('');

                clasesHtml = `
                    <div class="cpp-ficha-section">
                        <h3>Asignar a Clases</h3>
                        <div class="cpp-clases-checkbox-container">${checkboxesHtml}</div>
                        <div class="cpp-form-actions">
                            <button type="button" id="cpp-guardar-clases-alumno-btn" class="cpp-btn cpp-btn-primary" data-alumno-id="${alumno.id}">
                                <span class="dashicons dashicons-saved"></span> Guardar Asignaciones
                            </button>
                        </div>
                    </div>
                `;
            }

            // --- HTML para las calificaciones (solo para alumnos existentes) ---
            let calificacionesHtml = '';
            if (!isNew && fichaData.calificaciones_agrupadas.length > 0) {
                const calificacionesContent = fichaData.calificaciones_agrupadas.map(claseData => {
                    const evaluacionesContent = claseData.evaluaciones.map(evalData => {
                        const actividadesContent = evalData.actividades.map(act => `<li>${act.nombre_actividad}: <strong>${act.nota || '-'}</strong></li>`).join('');
                        const notaFinal = evalData.nota_final.is_incomplete ? `${evalData.nota_final.nota}% ⚠️` : `${evalData.nota_final.nota}%`;
                        return `
                            <div class="cpp-evaluacion-block">
                                <h4>${evalData.evaluacion_nombre} (Nota: ${notaFinal})</h4>
                                <ul>${actividadesContent}</ul>
                            </div>`;
                    }).join('');
                    return `<div class="cpp-clase-block"><h3>${claseData.clase_nombre}</h3>${evaluacionesContent}</div>`;
                }).join('');

                calificacionesHtml = `
                    <div class="cpp-ficha-section">
                        <h3>Calificaciones</h3>
                        <div class="cpp-calificaciones-container">${calificacionesContent}</div>
                    </div>
                `;
            } else if (!isNew) {
                calificacionesHtml = `<div class="cpp-ficha-section"><p>Este alumno no tiene calificaciones registradas.</p></div>`;
            }

            // --- Ensamblar la ficha completa ---
            const fichaCompletaHtml = `
                <div class="cpp-alumno-ficha-card">
                    <h2>${isNew ? 'Nuevo Alumno' : 'Ficha de ' + alumno.nombre}</h2>
                    <div class="cpp-ficha-section">${formDetailsHtml}</div>
                    ${clasesHtml}
                    ${calificacionesHtml}
                </div>
            `;

            $fichaContainer.html(fichaCompletaHtml);
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
                    if (response.success) {
                        cpp.hideSpinner();
                        cpp.showToast(response.data.message);
                        this.handleSearch(); // Recargar lista
                        this.displayAlumnoFicha(response.data.alumno.id); // Mostrar la ficha (nueva o actualizada)
                    } else {
                        cpp.hideSpinner();
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
                if (!confirm('ADVERTENCIA:\n\nEstás a punto de desasignar al alumno de una o más clases donde ya tiene calificaciones. Si guardas los cambios, todas las notas de esas clases se eliminarán PERMANENTEMENTE.\n\n¿Deseas continuar?')) {
                    return; // Abortar si el usuario cancela
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
                    if (response.success) {
                        cpp.hideSpinner();
                        cpp.showToast(response.data.message);
                        this.handleSearch(); // Recargar lista para mostrar nuevos tags de clases
                        this.displayAlumnoFicha(alumnoId); // Recargar ficha para mostrar calificaciones actualizadas
                    } else {
                        cpp.hideSpinner();
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
            if (!confirm('¿Estás seguro de que quieres eliminar a este alumno? Esta acción es PERMANENTE y no se puede deshacer. Se borrarán todas sus notas y datos de todas las clases.')) {
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
                    if (response.success) {
                        cpp.hideSpinner();
                        cpp.showToast(response.data.message);
                        this.handleSearch(); // Recargar lista
                        $('#cpp-alumnos-view-main').html(this.getInitialMainContentHtml()); // Volver a la vista inicial
                    } else {
                        cpp.hideSpinner();
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
