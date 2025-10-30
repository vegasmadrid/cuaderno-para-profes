// assets/js/cpp-alumnos.js

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-alumnos.js no puede inicializarse.");
        return;
    }

    cpp.alumnos = {
        init: function() {
            console.log("CPP Alumnos Module Initializing...");
            this.bindEvents();
            this.loadClasesIntoFilter();
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

        bindEvents: function() {
            console.log("Binding Alumnos events...");
            const $document = $(document);

            $document.on('click', '#cpp-alumnos-search-btn', this.handleSearch.bind(this));
            $document.on('keyup', '#cpp-alumnos-search-input', function(e) {
                if (e.key === 'Enter') {
                    this.handleSearch();
                }
            }.bind(this));

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
            const $fichaContainer = $('#cpp-alumnos-view-main');
            // TODO: Fetch and display anotaciones, ausencias, and statistics
            const fichaHtml = `
                <div id="cpp-alumno-ficha-view-mode">
                    <button id="cpp-edit-alumno-btn" class="cpp-btn cpp-btn-secondary" data-alumno-id="${fichaData.id}">Editar</button>
                    <h2>${fichaData.nombre} ${fichaData.apellidos}</h2>
                    <p><strong>Clase:</strong> ${fichaData.clase_nombre}</p>
                    <div class="cpp-alumno-ficha-section">
                        <h3>Anotaciones</h3>
                        <p>No hay anotaciones registradas.</p>
                    </div>
                    <div class="cpp-alumno-ficha-section">
                        <h3>Ausencias</h3>
                        <p>No hay ausencias registradas.</p>
                    </div>
                    <div class="cpp-alumno-ficha-section">
                        <h3>Estadísticas</h3>
                        <p>Las estadísticas no están disponibles.</p>
                    </div>
                </div>
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
        }
    };

    // Inicializar el módulo cuando el DOM esté listo
    $(function() {
        if (cpp.alumnos) {
            cpp.alumnos.init();
        }
    });

})(jQuery);
