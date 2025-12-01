// assets/js/cpp-cuaderno.js (VERSIÓN FINAL)

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-cuaderno.js no puede inicializarse.");
        return;
    }
    
    cpp.cuaderno = {
        localStorageKey_lastEval: 'cpp_last_opened_eval_clase_',
        currentCalculoNota: 'total',
        isDraggingSelection: false,
        selectionStartCellInput: null,
        currentSelectedInputs: [],
        finalGradeSortState: 'none', // none, desc, asc
        failedStudentsHighlighted: false,
        notaAprobado: 50, // Default, se actualiza al cargar la clase
        programadorInicializado: false,
        lastActiveTab: 'cuaderno',

        // --- Propiedades para la paleta de símbolos ---
        availableSymbols: ['👍', '✅', '🏃‍♂️', '⌛', '❌', '📝', '❓', '⭐'],
        symbolLegends: {}, // Se cargará desde localStorage
        localStorageKey_symbolLegends: 'cpp_symbol_legends_user_',
        lastFocusedCell: null,

        openSymbolPalette: function() {
            const self = this;
            const userId = (cppFrontendData && cppFrontendData.userId) ? cppFrontendData.userId : '0';
            const storageKey = self.localStorageKey_symbolLegends + userId;

            // Cargar leyendas desde localStorage o usar valores por defecto
            const defaultLegends = {
                '👍': 'Buen trabajo / Positivo',
                '✅': 'Tarea entregada',
                '🏃‍♂️': 'Falta injustificada',
                '⌛': 'Retraso',
                '❌': 'No se presenta / No entrega',
                '📝': 'Falta justificada',
                '❓': 'Duda / Necesita revisión',
                '⭐': 'Trabajo destacado'
            };
            let savedLegends = {};
            try {
                const savedLegendsRaw = localStorage.getItem(storageKey);
                if (savedLegendsRaw) {
                    savedLegends = JSON.parse(savedLegendsRaw);
                }
            } catch (e) {
                console.error("Error al leer las leyendas de los símbolos desde localStorage:", e);
            }
            // Unir los defaults con los guardados por el usuario
            self.symbolLegends = Object.assign({}, defaultLegends, savedLegends);

            const $listContainer = $('#cpp-symbol-list-container');
            $listContainer.empty();

            self.availableSymbols.forEach(symbol => {
                const legendText = self.symbolLegends[symbol] || '';

                const row = $('<div class="cpp-symbol-row"></div>');

                const symbolItem = $('<div class="cpp-symbol-item"></div>').text(symbol).data('symbol', symbol);
                const legendInput = $(`<input type="text" class="cpp-legend-input" data-symbol="${symbol}" value="${legendText}" placeholder="Significado...">`);

                row.append(symbolItem);
                row.append(legendInput);

                $listContainer.append(row);
            });

            // Mostrar el modal
            $('#cpp-modal-symbol-palette').css('display', 'flex');
        },

        init: function() {
            this.bindEvents();
        },

        formatearNotaDisplay: function(nota_raw, decimales = 2) {
            if (nota_raw === null || typeof nota_raw === 'undefined' || nota_raw === '') {
                return '';
            }

            let nota_str = String(nota_raw).replace(',', '.');

            if (/^[0-9.]*$/.test(nota_str) && nota_str.indexOf('.') === nota_str.lastIndexOf('.')) {
                let nota_num = parseFloat(nota_str);
                if (!isNaN(nota_num)) {
                    return nota_num.toLocaleString('es-ES', {
                        minimumFractionDigits: decimales,
                        maximumFractionDigits: decimales
                    }).replace('.', ',');
                }
            }

            return nota_raw;
        },

        actualizarHeaderActividad: function(actividad) {
            if (!actividad || typeof actividad.id === 'undefined') {
                console.error("actualizarHeaderActividad: Datos de actividad no válidos.", actividad);
                return;
            }

            const $headerContainer = $(`.cpp-cuaderno-th-actividad .cpp-editable-activity-name[data-actividad-id="${actividad.id}"]`).closest('th');

            if ($headerContainer.length) {
                const $editableDiv = $headerContainer.find('.cpp-editable-activity-name');

                // Actualizar atributos de datos solo si existen en el objeto de respuesta
                if (typeof actividad.nombre_actividad !== 'undefined') {
                    $editableDiv.data('nombre-actividad', actividad.nombre_actividad).attr('data-nombre-actividad', actividad.nombre_actividad);
                }
                if (typeof actividad.categoria_id !== 'undefined') {
                    $editableDiv.data('categoria-id', actividad.categoria_id).attr('data-categoria-id', actividad.categoria_id);
                }
                if (typeof actividad.nota_maxima !== 'undefined') {
                    $editableDiv.data('nota-maxima', actividad.nota_maxima).attr('data-nota-maxima', actividad.nota_maxima);
                }
                if (typeof actividad.fecha_actividad !== 'undefined') {
                    $editableDiv.data('fecha-actividad', actividad.fecha_actividad).attr('data-fecha-actividad', actividad.fecha_actividad);
                }
                if (typeof actividad.descripcion_actividad !== 'undefined') {
                    $editableDiv.data('descripcion-actividad', actividad.descripcion_actividad).attr('data-descripcion-actividad', actividad.descripcion_actividad);
                }
                if (typeof actividad.sesion_id !== 'undefined') {
                    $editableDiv.data('sesion-id', actividad.sesion_id).attr('data-sesion-id', actividad.sesion_id);
                }

                // Actualizar contenido visual
                if (typeof actividad.nombre_actividad !== 'undefined') {
                    $editableDiv.text(actividad.nombre_actividad).attr('title', `Editar Actividad: ${actividad.nombre_actividad}`);
                }

                if (typeof actividad.nota_maxima !== 'undefined') {
                    const $notaMaxContainer = $headerContainer.find('.cpp-actividad-notamax');
                    if ($notaMaxContainer.length) {
                        $notaMaxContainer.text(`(Sobre ${this.formatearNotaDisplay(actividad.nota_maxima)})`);
                    }
                }

                const $fechaContainer = $headerContainer.find('.cpp-actividad-fecha');
                if ($fechaContainer.length) {
                    if (actividad.fecha_actividad) {
                        const fecha = new Date(actividad.fecha_actividad.split(' ')[0] + 'T00:00:00');
                        const formattedDate = `${('0' + fecha.getDate()).slice(-2)}/${('0' + (fecha.getMonth() + 1)).slice(-2)}/${fecha.getFullYear()}`;
                        $fechaContainer.text(formattedDate);
                    } else {
                        $fechaContainer.text('');
                    }
                }

            } else {
                console.warn(`No se encontró la cabecera para la actividad con ID ${actividad.id} para actualizar.`);
            }
        },

        bindEvents: function() {
            console.log("Binding Gradebook (cuaderno) events...");
            const $document = $(document);
            const self = this;

            $document.on('click', '#cpp-close-fullscreen-tab-btn', function() {
                const $fullscreenContainer = $('#cpp-fullscreen-tab-container');
                const $fullscreenContent = $('#cpp-fullscreen-tab-content');
                const $originalParent = $('.cpp-main-tabs-content');

                if ($fullscreenContent.children().length > 0) {
                    $originalParent.append($fullscreenContent.children().removeClass('active'));
                }

                $fullscreenContainer.hide();
                $('#cpp-cuaderno-main-content').show();
                $('body').removeClass('cpp-fullscreen-active');

                // Restaurar la pestaña activa
                if (self.lastActiveTab) {
                    $('.cpp-main-tab-link[data-tab="' + self.lastActiveTab + '"]').trigger('click');
                }
            });

            // --- Listener para las pestañas principales (Cuaderno/Programador) ---
            $document.on('click', '.cpp-main-tab-link', function(e) {
                e.preventDefault();
                self.handleMainTabSwitch($(this));
            });
            const $cuadernoContenido = $('#cpp-cuaderno-contenido');

            // Botón para crear la primera clase desde la pantalla de bienvenida
            $document.on('click', '#cpp-btn-crear-primera-clase', function(e) {
                if (cpp.modals && cpp.modals.clase && typeof cpp.modals.clase.showParaCrear === 'function') {
                    cpp.modals.clase.showParaCrear(e);
                }
            });

            $document.on('change', '#cpp-global-evaluacion-selector', function(e) {
                const nuevaEvaluacionId = $(this).val();
                if (cpp.currentClaseIdCuaderno && nuevaEvaluacionId) {
                    const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();

                    // Guardar la nueva evaluación en localStorage para persistencia
                    const localStorageKey = self.localStorageKey_lastEval + cpp.currentClaseIdCuaderno;
                    try {
                        localStorage.setItem(localStorageKey, nuevaEvaluacionId);
                    } catch (err) {
                        console.warn("No se pudo guardar la evaluación en localStorage:", err);
                    }

                    // Determinar qué vista está activa y recargarla
                    const activeTab = $('.cpp-main-tab-link.active').data('tab');

                    if (activeTab === 'cuaderno') {
                        const sortOrder = $('#cpp-a1-sort-students-btn').data('sort');
                        self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, claseNombre, nuevaEvaluacionId, sortOrder);
                    } else if (activeTab === 'programacion') {
                        if (typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.loadClass === 'function') {
                            // Cargar la nueva evaluación en el programador.
                            // La función loadClass ya se encarga de actualizar el currentEvaluacionId y renderizar.
                            CppProgramadorApp.loadClass(cpp.currentClaseIdCuaderno, nuevaEvaluacionId);
                        }
                    }
                }
            });

            $document.on('click', '#cpp-a1-sort-students-btn', function(e) {
                e.preventDefault();
                const $button = $(this);
                const currentSort = $button.data('sort');
                const newSort = currentSort === 'apellidos' ? 'nombre' : 'apellidos';
                $button.data('sort', newSort);

                if (cpp.currentClaseIdCuaderno) {
                    const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();
                    self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, claseNombre, cpp.currentEvaluacionId, newSort);
                }
            });

            // User Menu Dropdown Logic
            $document.on('click', '.cpp-user-menu-avatar-btn', function(e) {
                e.stopPropagation();
                $('.cpp-user-menu-dropdown').toggleClass('show-dropdown');
            });

            $document.on('click', '#cpp-toggle-fullscreen-btn', function() {
                const viewport = document.querySelector('.cpp-cuaderno-viewport-classroom');
                const btn = this;
                const exitIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';
                const enterIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';

                if (!document.fullscreenElement) {
                    if (viewport.requestFullscreen) {
                        viewport.requestFullscreen();
                    } else if (viewport.webkitRequestFullscreen) { /* Safari */
                        viewport.webkitRequestFullscreen();
                    } else if (viewport.msRequestFullscreen) { /* IE11 */
                        viewport.msRequestFullscreen();
                    }
                    $(btn).html(exitIcon).attr('title', 'Salir de Pantalla Completa');
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) { /* Safari */
                        document.webkitExitFullscreen();
                    } else if (document.msExitFullscreen) { /* IE11 */
                        document.msExitFullscreen();
                    }
                    $(btn).html(enterIcon).attr('title', 'Pantalla Completa');
                }
            });

            $document.on('click', function(e) {
                if (!$(e.target).closest('.cpp-user-menu-container').length) {
                    $('.cpp-user-menu-dropdown').removeClass('show-dropdown');
                }
            });

            $cuadernoContenido.on('click', '#cpp-final-grade-sort-btn', function(e) { self.handleFinalGradeSort.call(self, e); });
            $cuadernoContenido.on('click', '#cpp-final-grade-highlight-btn', function(e) { self.toggleHighlightFailed.call(self, e); });

            $document.on('keydown', '.cpp-input-nota', function(e) { self.manejarNavegacionTablaNotas.call(this, e); });
            $cuadernoContenido.on('blur', '.cpp-input-nota', function(e) { self.guardarNotaDesdeInput.call(this, e, null); });
            $cuadernoContenido.on('focusin', '.cpp-input-nota', function(e){ self.lastFocusedCell = this; self.limpiarErrorNotaInput(this); this.select(); if (typeof $(this).data('original-nota-set') === 'undefined' || !$(this).data('original-nota-set')) { $(this).data('original-nota', $(this).val().trim()); $(this).data('original-nota-set', true); } });
            $cuadernoContenido.on('focusout', '.cpp-input-nota', function(e){ $(this).removeData('original-nota-set'); });
            $cuadernoContenido.on('dragstart', '.cpp-input-nota', function(e) { e.preventDefault(); });
            $cuadernoContenido.on('click', 'td.cpp-cuaderno-td-alumno', function(e){ self.handleClickAlumnoCell.call(this, e); });
            $cuadernoContenido.on('click', 'th.cpp-cuaderno-th-final', function(e){ self.handleClickNotaFinalHeader.call(this, e); });

            // Listener para el aviso de nota final incompleta
            $cuadernoContenido.on('click', 'td.cpp-cuaderno-td-final', function(e) {
                const $cell = $(this);
                if ($cell.attr('data-is-incomplete')) {
                    e.stopPropagation(); // Evitar que se disparen otros eventos
                    try {
                        const usedCategories = JSON.parse($cell.attr('data-used-categories') || '[]');
                        const missingCategories = JSON.parse($cell.attr('data-missing-categories') || '[]');

                        let message = "🧙‍♂️ ¡Ojo al dato! La nota final es provisional.\n\n";

                        if (usedCategories.length > 0) {
                            message += "Para este cálculo, hemos tenido en cuenta estas categorías:\n✅ " + usedCategories.join('\n✅ ') + "\n\n";
                        } else {
                            message += "¡Aún no se ha calificado ninguna categoría! La nota es un lienzo en blanco.\n\n";
                        }

                        if (missingCategories.length > 0) {
                            message += "Para tener la foto completa, falta por añadir notas en:\n👉 " + missingCategories.join('\n👉 ');
                        }

                        alert(message);
                    } catch (err) {
                        console.error("Error al parsear los datos de las categorías:", err);
                        alert("Error al mostrar los detalles de la nota. Revisa la consola para más información.");
                    }
                }
            });

            $cuadernoContenido.on('click', '.cpp-cuaderno-th-actividad', function(e){
                const $header = $(this);
                const evaluacionId = $header.data('evaluacion-id');

                if (evaluacionId) {
                    if (cpp.currentClaseIdCuaderno) {
                        const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();
                        self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, claseNombre, evaluacionId);
                    }
                } else {
                    if (cpp.modals && cpp.modals.actividades && typeof cpp.modals.actividades.cargarParaEditar === 'function') {
                        cpp.modals.actividades.cargarParaEditar(this, e);
                    } else {
                        console.error("Función cpp.modals.actividades.cargarParaEditar no encontrada.");
                    }
                }
            });

            $document.on('click', '#cpp-a1-add-activity-btn', function(e) { e.stopPropagation(); if (cpp.modals && cpp.modals.actividades && typeof cpp.modals.actividades.mostrarAnadir === 'function') { cpp.modals.actividades.mostrarAnadir(); } else { console.error("Función cpp.modals.actividades.mostrarAnadir no encontrada."); } });
            $document.on('click', '#cpp-a1-import-students-btn', function(e){ if (cpp.modals && cpp.modals.excel && typeof cpp.modals.excel.showImportStudents === 'function') { cpp.modals.excel.showImportStudents(e); } else { console.error("Función cpp.modals.excel.showImportStudents no encontrada.");} });
            $document.on('click', '#cpp-btn-importar-alumnos-excel', function(e){ if (cpp.modals && cpp.modals.excel && typeof cpp.modals.excel.showImportStudents === 'function') { cpp.modals.excel.showImportStudents(e); } else { console.error("Función cpp.modals.excel.showImportStudents no encontrada.");} });
            $document.on('click', '#cpp-btn-agregar-alumnos-mano', function(e){ if (cpp.modals && cpp.modals.alumnos && typeof cpp.modals.alumnos.mostrar === 'function') { cpp.modals.alumnos.mostrar(e); } else { console.error("Función cpp.modals.alumnos.mostrar no encontrada.");} });
            $document.on('click', '#cpp-a1-download-excel-btn', function(e){ if (cpp.modals && cpp.modals.excel && typeof cpp.modals.excel.showDownloadOptions === 'function') { cpp.modals.excel.showDownloadOptions(e); } else { console.error("Función cpp.modals.excel.showDownloadOptions no encontrada.");} });
            $document.on('click', '#cpp-a1-take-attendance-btn', function(e) { e.preventDefault(); e.stopPropagation(); if (cpp.modals && cpp.modals.asistencia && typeof cpp.modals.asistencia.mostrar === 'function') { if (cpp.currentClaseIdCuaderno) { cpp.modals.asistencia.mostrar(cpp.currentClaseIdCuaderno); } else { alert("Por favor, selecciona o carga una clase primero."); } } else { console.error("Función cpp.modals.asistencia.mostrar no encontrada."); } });
            $document.on('mousedown', '.cpp-cuaderno-tabla .cpp-input-nota', function(e) { self.handleCellMouseDown.call(this, e); });
            $document.on('copy', function(e) { const activeElement = document.activeElement; if ((activeElement && $(activeElement).closest('.cpp-cuaderno-tabla').length) || (self.currentSelectedInputs && self.currentSelectedInputs.length > 0)) { self.handleCopyCells(e); } });
            $document.on('paste', '.cpp-cuaderno-tabla .cpp-input-nota', function(e) { self.handlePasteCells.call(this, e); });

            // --- INICIO: Listeners para la Paleta de Símbolos ---

            // Abrir la paleta
            $document.on('click', '#cpp-a1-symbol-palette-btn', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (self.lastFocusedCell) {
                    self.openSymbolPalette();
                } else {
                    alert("Por favor, selecciona una celda de nota primero.");
                }
            });

            // Cerrar la paleta (genérico para todos los modales)
            $document.on('click', '#cpp-modal-symbol-palette .cpp-modal-close', function() {
                $('#cpp-modal-symbol-palette').hide();
            });

            // Guardar la leyenda
            $document.on('click', '#cpp-save-symbol-legend-btn', function() {
                const userId = (cppFrontendData && cppFrontendData.userId) ? cppFrontendData.userId : '0';
                const storageKey = self.localStorageKey_symbolLegends + userId;
                let newLegends = {};
                $('#cpp-symbol-list-container .cpp-legend-input').each(function() {
                    const symbol = $(this).data('symbol');
                    const legendText = $(this).val();
                    newLegends[symbol] = legendText;
                });
                try {
                    localStorage.setItem(storageKey, JSON.stringify(newLegends));
                    self.symbolLegends = newLegends;
                    const $button = $(this);
                    const originalText = $button.text();
                    $button.text('¡Guardado!').css('background-color', '#28a745');
                    setTimeout(function() {
                        $button.text(originalText).css('background-color', '');
                    }, 1500);
                } catch (e) {
                    console.error("Error al guardar las leyendas en localStorage:", e);
                    alert("Hubo un error al guardar la leyenda.");
                }
            });

            // Insertar un símbolo en la celda activa
            $document.on('click', '#cpp-symbol-list-container .cpp-symbol-item', function() {
                const symbol = $(this).data('symbol');

                if (self.lastFocusedCell) {
                    const $targetInput = $(self.lastFocusedCell);
                    const currentValue = $targetInput.val().trim();
                    const newValue = currentValue ? (currentValue + ' ' + symbol) : symbol;
                    $targetInput.val(newValue);
                    self.guardarNotaDesdeInput.call($targetInput[0], { type: 'blur' }, null);
                    $('#cpp-modal-symbol-palette').hide();
                    $targetInput.focus();
                } else {
                    alert("Error: No se encontró una celda de destino. Por favor, selecciona una celda de nuevo.");
                }
            });

            // --- FIN: Listeners para la Paleta de Símbolos ---

            // Listeners for cross-component updates
            $document.on('cpp:forceGradebookReload', function() {
                console.log('Event detected: cpp:forceGradebookReload. Reloading gradebook...');
                if (cpp.currentClaseIdCuaderno) {
                    const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();
                    // Usar cpp.currentEvaluacionId que ya debería estar actualizado
                    self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, claseNombre, cpp.currentEvaluacionId);
                }
            });

            $document.on('cpp:forceProgramadorReload', function() {
                console.log('Event detected: cpp:forceProgramadorReload. Reloading scheduler...');
                if (typeof CppProgramadorApp !== 'undefined' && CppProgramadorApp.programadorInicializado && CppProgramadorApp.currentClase) {
                    CppProgramadorApp.fetchData(CppProgramadorApp.currentClase.id);
                }
            });

            // Restaurar la pestaña al cargar la página
            try {
                const lastTab = localStorage.getItem('cpp_last_opened_tab');
                if (lastTab) {
                    const $tabLink = $('.cpp-main-tab-link[data-tab="' + lastTab + '"]');
                    if ($tabLink.length) {
                        // Usar un pequeño retardo para asegurar que todo esté cargado
                        setTimeout(() => $tabLink.trigger('click'), 100);
                    }
                }
            } catch (e) {
                console.warn("No se pudo restaurar la última pestaña abierta desde localStorage:", e);
            }
        },

        updateSortButton: function(sortOrder) {
            const $button = $('#cpp-a1-sort-students-btn');
            if (!$button.length) return;

            const icons = {
                apellidos: '<svg class="icon-sort-alpha" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 18l-4-4h3V4h2v10h3l-4 4zM4.75 5.5H10c.83 0 1.5-.67 1.5-1.5S10.83 2.5 10 2.5H4.75c-.83 0-1.5.67-1.5 1.5S3.92 5.5 4.75 5.5zM10.25 8.5H4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.75c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5zM10.25 14.5H4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.75c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/></svg>',
                nombre: '<svg class="icon-sort-alpha" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 18l-4-4h3V4h2v10h3l-4 4zM4.5 11.5h5.75c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5H4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5zM4.75 5.5H10c.83 0 1.5-.67 1.5-1.5S10.83 2.5 10 2.5H4.75c-.83 0-1.5.67-1.5 1.5S3.92 5.5 4.75 5.5zM10.25 14.5H4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.75c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/></svg>'
            };

            if (sortOrder === 'nombre') {
                $button.html(icons.nombre);
                $button.attr('title', 'Ordenado por Nombre (clic para cambiar a Apellidos)');
                $button.data('sort', 'nombre');
            } else {
                $button.html(icons.apellidos);
                $button.attr('title', 'Ordenado por Apellidos (clic para cambiar a Nombre)');
                $button.data('sort', 'apellidos');
            }
        },

        renderEvaluacionesDropdown: function(evaluaciones, evaluacionActivaId) {
            const $container = $('#cpp-global-evaluacion-selector-container');
            if (!$container.length) return;
            $container.empty();
            if (!evaluaciones || evaluaciones.length === 0) {
                $container.html('<span class="cpp-no-evaluaciones-msg">Sin evaluaciones</span>');
                return;
            }
            let selectHtml = '<select id="cpp-global-evaluacion-selector">';
            evaluaciones.forEach(function(evaluacion) {
                const selected = evaluacion.id == evaluacionActivaId ? 'selected' : '';
                selectHtml += `<option value="${evaluacion.id}" ${selected}>${$('<div>').text(evaluacion.nombre_evaluacion).html()}</option>`;
            });
            selectHtml += '</select>';
            $container.html(selectHtml);
        },
        
        cargarContenidoCuaderno: function(claseId, claseNombre, evaluacionId, sortOrder) {
            const $contenidoCuaderno = $('#cpp-cuaderno-contenido');
            cpp.currentClaseIdCuaderno = claseId;

            const isFinalView = evaluacionId === 'final';
            // Estos botones ahora están en la barra superior, pero podemos mantener la lógica de visibilidad aquí
            // $('#cpp-a1-add-activity-btn').toggle(!isFinalView);
            // $('#cpp-a1-import-students-btn').toggle(!isFinalView);
            // $('#cpp-a1-take-attendance-btn').toggle(!isFinalView);

            if (claseId && typeof localStorage !== 'undefined' && cppFrontendData && cppFrontendData.userId) {
                try { localStorage.setItem('cpp_last_opened_clase_id_user_' + cppFrontendData.userId, claseId); } catch (e) { console.warn("No se pudo guardar la última clase abierta en localStorage:", e); }
                if (!evaluacionId && typeof localStorage !== 'undefined') {
                    evaluacionId = localStorage.getItem(this.localStorageKey_lastEval + claseId);
                }
            }

            if (claseId) {
                $contenidoCuaderno.html('<p class="cpp-cuaderno-cargando">Cargando cuaderno...</p>');
                const self = this;

                const ajaxAction = isFinalView ? 'cpp_cargar_vista_final' : 'cpp_cargar_cuaderno_clase';
                let ajaxData = { nonce: cppFrontendData.nonce, clase_id: claseId, sort_order: sortOrder || 'apellidos' };
                if (!isFinalView && evaluacionId) {
                    ajaxData.evaluacion_id = evaluacionId;
                }

                $.ajax({
                    url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json', data: { ...ajaxData, action: ajaxAction },
                    success: function(response) {
                        if (response && response.success && response.data && typeof response.data.html_cuaderno !== 'undefined') {

                            // Actualizar la barra superior estática con los datos recibidos
                            if (cpp.utils && typeof cpp.utils.updateTopBar === 'function') {
                                cpp.utils.updateTopBar({
                                    nombre: response.data.nombre_clase,
                                    color: response.data.color_clase
                                });
                            }

                            // Cargar solo el contenido de la tabla en su contenedor
                            $contenidoCuaderno.empty().html(response.data.html_cuaderno);
                            $contenidoCuaderno.attr('data-active-eval', response.data.evaluacion_activa_id);

                            cpp.currentEvaluacionId = response.data.evaluacion_activa_id;
                            self.currentCalculoNota = response.data.calculo_nota || 'total';
                            if (typeof response.data.nota_aprobado !== 'undefined') {
                                self.notaAprobado = parseFloat(response.data.nota_aprobado);
                            }
                            if (typeof localStorage !== 'undefined' && cpp.currentClaseIdCuaderno && cpp.currentEvaluacionId) {
                                localStorage.setItem(self.localStorageKey_lastEval + cpp.currentClaseIdCuaderno, cpp.currentEvaluacionId);
                            }
                            self.renderEvaluacionesDropdown(response.data.evaluaciones, response.data.evaluacion_activa_id);
                            if (typeof response.data.base_nota_final !== 'undefined') { cpp.currentBaseNotaFinal = parseFloat(response.data.base_nota_final) || 100; }
                            $('#clase_id_actividad_cuaderno_form').val(claseId);

                            self.updateSortButton(response.data.sort_order);
                            self.clearCellSelection();
                            self.selectionStartCellInput = null;
                        } else {
                            let errorMsg = 'Error al cargar el contenido del cuaderno. Respuesta inesperada.';
                            if (response && response.data && response.data.message) { errorMsg = response.data.message; }
                            $contenidoCuaderno.html(`<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">${errorMsg}</p></div>`);
                        }
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        console.error("Error AJAX cargando cuaderno. Status:", textStatus, "Error:", errorThrown, jqXHR.responseText);
                        $contenidoCuaderno.html('<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">Error de conexión al cargar el cuaderno.</p></div>');
                    }
                });
            } else {
                $contenidoCuaderno.html('<div class="cpp-cuaderno-mensaje-vacio"><p>Selecciona una clase para ver el cuaderno.</p></div>');
                if (cpp.cuaderno && typeof cpp.cuaderno.actualizarSelectCategoriasActividad === 'function') { cpp.cuaderno.actualizarSelectCategoriasActividad(0, null); }
                $('#clase_id_actividad_cuaderno_form').val('');
                if (cpp.utils && typeof cpp.utils.updateTopBar === 'function') {
                    cpp.utils.updateTopBar({ nombre: 'Selecciona una clase', color: '#6c757d' });
                }
            }
        },

        actualizarSelectCategoriasActividad: function(evaluacionId, callback) {
            const $select = $('#categoria_id_actividad_cuaderno_select');
            const $formGroup = $select.closest('.cpp-form-group');
            if (!$select.length || !$formGroup.length) { if (typeof callback === 'function') callback(false); return; }
            $select.empty();
            $formGroup.hide();
            if (!evaluacionId) { if (typeof callback === 'function') callback(false); return; }
            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                data: { action: 'cpp_get_json_categorias_por_evaluacion', nonce: cppFrontendData.nonce, evaluacion_id: evaluacionId },
                success: function(response) {
                    if (response.success && typeof response.data.categorias !== 'undefined' && Array.isArray(response.data.categorias)) {
                        const categorias = response.data.categorias;
                        if (categorias.length > 1 || (categorias.length === 1 && categorias[0].nombre_categoria !== 'General' && categorias[0].nombre_categoria !== 'Sin categoría')) {
                            $formGroup.show();
                            $select.append($('<option>', { value: '', text: '-- Selecciona una categoría --' }));
                            $.each(categorias, function(i, categoria) {
                                $select.append($('<option>', { value: categoria.id, text: `${$('<div>').text(categoria.nombre_categoria).html()} (${categoria.porcentaje}%)` }));
                            });
                        }
                        if (typeof callback === 'function') callback(true);
                    } else { if (typeof callback === 'function') callback(false); }
                },
                error: function() { if (typeof callback === 'function') callback(false); }
            });
        },
        
        limpiarErrorNotaInput: function(inputElement){ const $input = $(inputElement); $input.removeClass('cpp-nota-error cpp-nota-guardada'); $input.closest('td').find('.cpp-nota-validation-message').hide().text(''); },
        guardarNotaDesdeInput: function(event, callbackFn) { const $input = $(this); const alumnoId = $input.data('alumno-id'); const actividadId = $input.data('actividad-id'); const notaMaxima = parseFloat($input.data('nota-maxima')); let notaStr = $input.val().trim(); const $td = $input.closest('td'); const $validationMessage = $td.find('.cpp-nota-validation-message'); cpp.cuaderno.limpiarErrorNotaInput(this); if (notaStr !== '') { const match = notaStr.match(/[0-9,.]+/); const notaNum = match ? parseFloat(match[0].replace(',', '.')) : NaN; if (!isNaN(notaNum)) { if (notaNum < 0 || notaNum > notaMaxima) { $validationMessage.text(`Nota 0-${notaMaxima}`).show(); $input.addClass('cpp-nota-error'); if (typeof callbackFn === 'function') callbackFn(false); return; } } } const originalNota = $input.data('original-nota') || ''; if (notaStr === originalNota && event && event.type === 'blur') { if (typeof callbackFn === 'function') callbackFn(true, false); return; } $input.prop('disabled', true); $validationMessage.hide().text(''); const ajaxData = { action: 'cpp_guardar_calificacion_alumno', nonce: cppFrontendData.nonce, alumno_id: alumnoId, actividad_id: actividadId, nota: notaStr, evaluacion_id: cpp.currentEvaluacionId }; $.ajax({ url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json', data: ajaxData, success: function(response) { if (response && response.success) { $input.addClass('cpp-nota-guardada'); if (response.data) { const $notaFinalCell = $(`#cpp-nota-final-alumno-${alumnoId}`); $notaFinalCell.text(response.data.nota_final_alumno_display); if (response.data.is_incomplete) { $notaFinalCell.attr('data-is-incomplete', 'true'); $notaFinalCell.attr('data-used-categories', JSON.stringify(response.data.used_categories)); $notaFinalCell.attr('data-missing-categories', JSON.stringify(response.data.missing_categories)); if ($notaFinalCell.find('.cpp-warning-icon').length === 0) { $notaFinalCell.append(' <span class="cpp-warning-icon" title="Nota incompleta">⚠️</span>'); } } else { $notaFinalCell.removeAttr('data-is-incomplete'); $notaFinalCell.removeAttr('data-used-categories'); $notaFinalCell.removeAttr('data-missing-categories'); $notaFinalCell.find('.cpp-warning-icon').remove(); } } let displayNota = notaStr; const numMatch = notaStr.match(/^[0-9,.]*$/); if (numMatch) { const num = parseFloat(notaStr.replace(',', '.')); if (!isNaN(num)) { displayNota = (num % 1 !== 0) ? num.toFixed(2) : String(parseInt(num)); } } $input.val(displayNota); $input.data('original-nota', displayNota); setTimeout(function() { $input.removeClass('cpp-nota-guardada'); }, 1500); if (typeof callbackFn === 'function') callbackFn(true, true); } else { const errorMsg = (response && response.data && response.data.message) ? response.data.message : 'Error desconocido al guardar.'; $validationMessage.text(errorMsg).show(); $input.addClass('cpp-nota-error'); if (typeof callbackFn === 'function') callbackFn(false); } }, error: function() { $validationMessage.text('Error de conexión').show(); $input.addClass('cpp-nota-error'); if (typeof callbackFn === 'function') callbackFn(false); }, complete: function() { $input.prop('disabled', false); } }); },
        manejarNavegacionTablaNotas: function(e) { const $thisInput = $(this); const $td = $thisInput.closest('td'); const $tr = $td.closest('tr'); let $nextCell; if (e.key === 'Enter') { e.preventDefault(); cpp.cuaderno.guardarNotaDesdeInput.call(this, e, function(isValid, wasSaved) { if (isValid) { $nextCell = $tr.next('tr').find(`td:eq(${$td.index()})`); if ($nextCell && $nextCell.length) { $nextCell.find('input.cpp-input-nota').focus().select(); } } }); } else if (e.key === 'Tab') { e.preventDefault(); cpp.cuaderno.guardarNotaDesdeInput.call(this, e, function(isValid, wasSaved) { if (isValid) { if (e.shiftKey) { $nextCell = $td.prevAll('td:has(input.cpp-input-nota)').first(); if (!$nextCell.length) { $nextCell = $tr.prev('tr').find('td:has(input.cpp-input-nota)').last(); } } else { $nextCell = $td.nextAll('td:has(input.cpp-input-nota)').first(); if (!$nextCell.length) { $nextCell = $tr.next('tr').find('td:has(input.cpp-input-nota)').first(); } } if ($nextCell && $nextCell.length) { $nextCell.find('input.cpp-input-nota').focus().select(); } } }); } else if (e.key === 'ArrowUp') { e.preventDefault(); $nextCell = $tr.prev('tr').find(`td:eq(${$td.index()})`); if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select(); } else if (e.key === 'ArrowDown') { e.preventDefault(); $nextCell = $tr.next('tr').find(`td:eq(${$td.index()})`); if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select(); } else if (e.key === 'ArrowLeft') { if (this.selectionStart === 0 && this.selectionEnd === 0) { e.preventDefault(); $nextCell = $td.prevAll('td:has(input.cpp-input-nota)').first(); if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select(); } } else if (e.key === 'ArrowRight') { if (this.selectionStart === this.value.length && this.selectionEnd === this.value.length) { e.preventDefault(); $nextCell = $td.nextAll('td:has(input.cpp-input-nota)').first(); if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select(); } } else if (e.key === 'Escape') { $thisInput.val($thisInput.data('original-nota') || ''); cpp.cuaderno.limpiarErrorNotaInput(this); $thisInput.blur(); cpp.cuaderno.clearCellSelection(); } },
        clearCellSelection: function() { $('.cpp-input-nota.cpp-cell-selected').removeClass('cpp-cell-selected'); this.currentSelectedInputs = []; },
        updateSelectionRange: function(startInputDom, currentInputDom) { $('.cpp-input-nota.cpp-cell-selected').removeClass('cpp-cell-selected'); this.currentSelectedInputs = []; const $startTd = $(startInputDom).closest('td'); const $currentTd = $(currentInputDom).closest('td'); const $startTr = $startTd.closest('tr'); const $currentTr = $currentTd.closest('tr'); const allTrs = $('.cpp-cuaderno-tabla tbody tr:visible'); const startRowIndex = allTrs.index($startTr); const currentRowIndex = allTrs.index($currentTr); const startColRelIndex = $startTr.find('td.cpp-cuaderno-td-nota').index($startTd.filter('.cpp-cuaderno-td-nota')); const currentColRelIndex = $currentTr.find('td.cpp-cuaderno-td-nota').index($currentTd.filter('.cpp-cuaderno-td-nota')); if (startRowIndex === -1 || currentRowIndex === -1 || startColRelIndex === -1 || currentColRelIndex === -1) { $(startInputDom).addClass('cpp-cell-selected'); this.currentSelectedInputs.push(startInputDom); return; } const minRow = Math.min(startRowIndex, currentRowIndex); const maxRow = Math.max(startRowIndex, currentRowIndex); const minColRel = Math.min(startColRelIndex, currentColRelIndex); const maxColRel = Math.max(startColRelIndex, currentColRelIndex); for (let r = minRow; r <= maxRow; r++) { const $row = $(allTrs[r]); const $tdsInRow = $row.find('td.cpp-cuaderno-td-nota'); for (let c = minColRel; c <= maxColRel; c++) { if (c < $tdsInRow.length) { const $td = $($tdsInRow[c]); const $inputInCell = $td.find('.cpp-input-nota'); if ($inputInCell.length) { $inputInCell.addClass('cpp-cell-selected'); this.currentSelectedInputs.push($inputInCell[0]); } } } } },
        handleCellMouseDown: function(e) { const clickedInput = this; const self = cpp.cuaderno; if (e.shiftKey && self.selectionStartCellInput) { self.updateSelectionRange(self.selectionStartCellInput, clickedInput); e.preventDefault(); } else { if (self.currentSelectedInputs.length > 1 || (self.currentSelectedInputs.length === 1 && self.currentSelectedInputs[0] !== clickedInput)) { self.clearCellSelection(); } self.selectionStartCellInput = clickedInput; if (!$(clickedInput).hasClass('cpp-cell-selected')) { if (!(self.currentSelectedInputs.length === 1 && self.currentSelectedInputs[0] === clickedInput)) { self.clearCellSelection(); } $(clickedInput).addClass('cpp-cell-selected'); self.currentSelectedInputs = [clickedInput]; } } let dragHasStarted = false; $(document).off('mousemove.cppCellSelection mouseup.cppCellSelection'); $(document).on('mousemove.cppCellSelection', function(moveEvent) { if (!self.selectionStartCellInput) { return; } if (!dragHasStarted) { dragHasStarted = true; self.isDraggingSelection = true; $('body').addClass('cpp-no-text-select'); } if (self.isDraggingSelection) { moveEvent.preventDefault(); let $hoveredTd = $(moveEvent.target).closest('td.cpp-cuaderno-td-nota'); if ($hoveredTd.length) { let hoveredInput = $hoveredTd.find('.cpp-input-nota')[0]; if (hoveredInput) { self.updateSelectionRange(self.selectionStartCellInput, hoveredInput); } } } }); $(document).on('mouseup.cppCellSelection', function(upEvent) { if (dragHasStarted) { $('body').removeClass('cpp-no-text-select'); } self.isDraggingSelection = false; $(document).off('mousemove.cppCellSelection mouseup.cppCellSelection'); }); },
        handleCopyCells: function(e) { if (cpp.cuaderno.currentSelectedInputs && cpp.cuaderno.currentSelectedInputs.length > 0) { let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity; const cellData = []; const $tbody = $('.cpp-cuaderno-tabla tbody'); $(cpp.cuaderno.currentSelectedInputs).each(function() { const $input = $(this); const $td = $input.closest('td'); const $tr = $td.closest('tr'); const r = $tbody.find('tr:visible').index($tr); const c = $tr.find('td.cpp-cuaderno-td-nota').index($td); if (r !== -1 && c !== -1) { minRow = Math.min(minRow, r); maxRow = Math.max(maxRow, r); minCol = Math.min(minCol, c); maxCol = Math.max(maxCol, c); cellData.push({ row: r, col: c, value: $input.val() }); } }); if (cellData.length === 0) return; const numRows = maxRow - minRow + 1; const numCols = maxCol - minCol + 1; const dataMatrix = Array(numRows).fill(null).map(() => Array(numCols).fill('')); cellData.forEach(cell => { dataMatrix[cell.row - minRow][cell.col - minCol] = cell.value; }); const tsvString = dataMatrix.map(row => row.join('\t')).join('\n'); if (e.originalEvent && e.originalEvent.clipboardData) { e.originalEvent.clipboardData.setData('text/plain', tsvString); e.preventDefault(); console.log("Celdas copiadas al portapapeles (TSV):", tsvString); } else { console.warn("Clipboard API no disponible directamente. No se pudo copiar."); } } },
        handlePasteCells: function(e) { e.preventDefault(); const self = cpp.cuaderno; const $startInput = $(this); const $startTd = $startInput.closest('td'); const $startTr = $startInput.closest('tr'); const $tbody = $('.cpp-cuaderno-tabla tbody'); const startRowVisibleIndex = $tbody.find('tr:visible').index($startTr); const startColVisibleIndex = $startTr.find('td.cpp-cuaderno-td-nota').index($startTd); if (startRowVisibleIndex === -1 || startColVisibleIndex === -1) { console.error("Celda de inicio para pegar no válida."); return; } let pastedData = ''; if (e.originalEvent && e.originalEvent.clipboardData) { pastedData = e.originalEvent.clipboardData.getData('text/plain'); } else if (window.clipboardData) { pastedData = window.clipboardData.getData('Text'); } if (!pastedData) return; const rows = pastedData.split(/\r\n|\n|\r/); self.clearCellSelection(); const $allVisibleTrs = $tbody.find('tr:visible'); const newSelectedInputs = []; for (let i = 0; i < rows.length; i++) { const cells = rows[i].split('\t'); const targetRowIndex = startRowVisibleIndex + i; if (targetRowIndex >= $allVisibleTrs.length) break; const $targetTr = $($allVisibleTrs[targetRowIndex]); const $targetTdsNotas = $targetTr.find('td.cpp-cuaderno-td-nota'); for (let j = 0; j < cells.length; j++) { const targetColIndex = startColVisibleIndex + j; if (targetColIndex >= $targetTdsNotas.length) break; const $targetTd = $($targetTdsNotas[targetColIndex]); const $targetInput = $targetTd.find('.cpp-input-nota'); if ($targetInput.length) { const pastedValue = cells[j]; $targetInput.val(pastedValue); newSelectedInputs.push($targetInput[0]); const mockEvent = { type: 'paste', target: $targetInput[0] }; self.guardarNotaDesdeInput.call($targetInput[0], mockEvent, function(success, saved) {}); } } } if (newSelectedInputs.length > 0) { self.currentSelectedInputs = newSelectedInputs; $(newSelectedInputs).addClass('cpp-cell-selected'); } },
        handleClickAlumnoCell: function(e) {
            e.preventDefault();
            const $td = $(this);
            const $tr = $td.closest('tr');
            const alumnoId = $tr.data('alumno-id');

            if (!alumnoId) {
                console.warn("No se pudo obtener el ID del alumno para abrir la ficha.");
                return;
            }

            // 1. Cambiar a la pestaña de Alumnos
            $('.cpp-main-tab-link[data-tab="alumnos"]').trigger('click');

            // 2. Abrir la ficha del alumno.
            // Usamos un timeout para dar tiempo a la pestaña de alumnos a inicializarse
            // y cargar la lista de alumnos si es la primera vez.
            setTimeout(() => {
                if (cpp.alumnos && typeof cpp.alumnos.displayAlumnoFicha === 'function') {
                    cpp.alumnos.displayAlumnoFicha(alumnoId);

                    // Opcional: hacer scroll para asegurar que la ficha sea visible si es necesario
                    const $fichaContainer = $('#cpp-alumnos-view-main');
                    if ($fichaContainer.length) {
                        $('html, body').animate({
                            scrollTop: $fichaContainer.offset().top - 100 // 100px offset from top
                        }, 300);
                    }
                } else {
                    console.error("Función cpp.alumnos.displayAlumnoFicha no encontrada.");
                }
            }, 150); // Un pequeño retardo es suficiente
        },
        handleClickNotaFinalHeader: function(e) { if (e.target !== this && $(e.target).closest(this).length) { if ($(e.target).is('button, a, input') || $(e.target).closest('button, a, input').length) { return; } } e.preventDefault(); if (!cpp.currentClaseIdCuaderno) { alert('Por favor, selecciona una clase primero.'); return; } if (cpp.modals && cpp.modals.clase && typeof cpp.modals.clase.showParaEditar === 'function') { cpp.modals.clase.showParaEditar(null, true, cpp.currentClaseIdCuaderno); } else { console.error("Función cpp.modals.clase.showParaEditar no encontrada."); } },

        handleFinalGradeSort: function(e) {
            e.preventDefault();
            e.stopPropagation();
            const self = cpp.cuaderno;
            let nextSortState;
            let sortOrderForAjax;

            if (self.finalGradeSortState === 'none') {
                nextSortState = 'desc';
                sortOrderForAjax = 'nota_desc';
            } else if (self.finalGradeSortState === 'desc') {
                nextSortState = 'asc';
                sortOrderForAjax = 'nota_asc';
            } else { // asc
                nextSortState = 'none';
                sortOrderForAjax = $('#cpp-a1-sort-students-btn').data('sort') || 'apellidos';
            }
            self.finalGradeSortState = nextSortState;

            if (cpp.currentClaseIdCuaderno) {
                const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();
                self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, claseNombre, cpp.currentEvaluacionId, sortOrderForAjax);
            }
        },

        toggleHighlightFailed: function(e) {
            e.preventDefault();
            e.stopPropagation();
            const self = this;
            self.failedStudentsHighlighted = !self.failedStudentsHighlighted;
            const $button = $('#cpp-final-grade-highlight-btn');
            const $rows = $('.cpp-cuaderno-tabla tbody tr[data-nota-final]');

            $button.toggleClass('active', self.failedStudentsHighlighted);

            if (self.failedStudentsHighlighted) {
                $rows.each(function() {
                    const $row = $(this);
                    const finalGrade = parseFloat($row.data('nota-final'));
                    if (!isNaN(finalGrade) && finalGrade < self.notaAprobado) {
                        $row.addClass('cpp-fila-suspenso');
                    } else {
                        $row.removeClass('cpp-fila-suspenso');
                    }
                });
            } else {
                $rows.removeClass('cpp-fila-suspenso');
            }
        },

        handleMainTabSwitch: function($tab) {
            const tabName = $tab.data('tab');

            if ($tab.hasClass('active') && !$tab.hasClass('cpp-main-tab-right')) {
                return;
            }

            const isRightTab = ['semana', 'horario', 'alumnos', 'resumen'].includes(tabName);

            // Control de visibilidad de los botones de la barra superior
            $('#cpp-alumnos-top-bar-actions').hide();
            $('#cpp-semana-top-bar-actions').hide();

            if (tabName === 'alumnos') {
                $('#cpp-alumnos-top-bar-actions').css('display', 'flex');
            } else if (tabName === 'semana') {
                $('#cpp-semana-top-bar-actions').css('display', 'block');
            }

            if (isRightTab) {
                const $content = $('#cpp-main-tab-' + tabName);
                const $fullscreenContent = $('#cpp-fullscreen-tab-content');
                const $fullscreenContainer = $('#cpp-fullscreen-tab-container');

                if ($content.length && $fullscreenContent.length) {
                    // Limpiar el contenedor antes de añadir nuevo contenido
                    $fullscreenContent.empty();
                    // Mover el contenido y añadir la clase 'active' para asegurar que sea visible
                    $fullscreenContent.append($content.addClass('active'));
                    $('#cpp-fullscreen-tab-title').text($tab.text());
                    $('#cpp-cuaderno-main-content').hide();
                    $fullscreenContainer.show();
                    $('body').addClass('cpp-fullscreen-active');
                }

                // No activar/desactivar visualmente las pestañas derechas
            } else {
                this.lastActiveTab = tabName;
                // Lógica original para pestañas izquierdas
                $('.cpp-main-tab-link').removeClass('active');
                $('.cpp-main-tab-content').removeClass('active');
                $tab.addClass('active');
                $('#cpp-main-tab-' + tabName).addClass('active');
            }

            // 2. Guardar estado en localStorage
            try {
                localStorage.setItem('cpp_last_opened_tab', tabName);
            } catch (e) {
                console.warn("No se pudo guardar la última pestaña abierta en localStorage:", e);
            }

            // 3. Lógica específica de la pestaña (efectos secundarios)
            const globalEvalId = $('#cpp-global-evaluacion-selector').val();
            const isProgramadorTab = ['programacion', 'semana', 'horario'].includes(tabName);

            if (tabName === 'alumnos') {
                if (cpp.alumnos && typeof cpp.alumnos.enter === 'function') {
                    cpp.alumnos.enter();
                }
            } else if (isProgramadorTab) {
                // Inicializar el programador si es la primera vez
                if (!this.programadorInicializado) {
                    if (typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.init === 'function') {
                        if (cpp.currentClaseIdCuaderno) {
                            CppProgramadorApp.init(cpp.currentClaseIdCuaderno);
                            this.programadorInicializado = true;
                        } else {
                            $('#cpp-main-tab-programacion, #cpp-main-tab-semana, #cpp-main-tab-horario').html('<p class="cpp-empty-panel">Por favor, selecciona una clase primero.</p>');
                        }
                    } else {
                        console.error("Error: El objeto CppProgramadorApp no está disponible.");
                        $('#cpp-main-tab-programacion, #cpp-main-tab-semana, #cpp-main-tab-horario').html('<p class="cpp-empty-panel" style="color:red;">Error: No se pudo cargar el componente del programador.</p>');
                    }
                }

                // --- Lógica de Sincronización ---
                if (globalEvalId === 'final') {
                    // Si es la Evaluación Final, forzar el renderizado del mensaje especial
                    if (typeof CppProgramadorApp !== 'undefined') {
                        CppProgramadorApp.currentEvaluacionId = 'final';
                        CppProgramadorApp.renderProgramacionTab();
                    }
                } else {
                    // Para cualquier otra evaluación, usar la lógica de carga normal
                    if (typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.loadClass === 'function') {
                        const claseNoCoincide = !CppProgramadorApp.currentClase || CppProgramadorApp.currentClase.id != cpp.currentClaseIdCuaderno;
                        const evaluacionNoCoincide = CppProgramadorApp.currentEvaluacionId != globalEvalId;

                        if (claseNoCoincide || evaluacionNoCoincide) {
                            CppProgramadorApp.loadClass(cpp.currentClaseIdCuaderno, globalEvalId);
                        }
                    }
                }

                // Renderizar la pestaña de la semana bajo demanda, si aplica
                if (tabName === 'semana' && typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.renderSemanaTab === 'function') {
                    CppProgramadorApp.renderSemanaTab();
                }
            } else if (tabName === 'cuaderno') {
                // Forzar recarga del cuaderno si la evaluación activa del contenedor no coincide con la del selector global
                const activeEvalInCuaderno = $('#cpp-cuaderno-contenido').attr('data-active-eval');
                if (cpp.currentClaseIdCuaderno && activeEvalInCuaderno && activeEvalInCuaderno != globalEvalId) {
                    const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();
                    this.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, claseNombre, globalEvalId);
                }
            } else if (tabName === 'resumen') {
                if (window.cppResumenApp && typeof window.cppResumenApp.render === 'function') {
                    window.cppResumenApp.render();
                } else {
                    console.error("Error: El objeto cppResumenApp no está disponible o no se pudo cargar.");
                    $('#cpp-main-tab-resumen').html('<p class="cpp-empty-panel" style="color:red;">Error: No se pudo cargar el componente de resumen.</p>');
                }
            } else if (tabName === 'alumnos') {
                if (cpp.alumnos && typeof cpp.alumnos.enter === 'function') {
                    cpp.alumnos.enter();
                }
            }
        },

        bindEvents: function() {
            console.log("Binding Gradebook (cuaderno) events...");
            const $document = $(document);
            const self = this;

            $document.on('click', '#cpp-close-fullscreen-tab-btn', function() {
                const $fullscreenContainer = $('#cpp-fullscreen-tab-container');
                const $fullscreenContent = $('#cpp-fullscreen-tab-content');
                const $originalParent = $('.cpp-main-tabs-content');

                if ($fullscreenContent.children().length > 0) {
                    $originalParent.append($fullscreenContent.children().removeClass('active'));
                }

                $fullscreenContainer.hide();
                $('#cpp-cuaderno-main-content').show();
                $('body').removeClass('cpp-fullscreen-active');

                // Restaurar la pestaña activa
                if (self.lastActiveTab) {
                    $('.cpp-main-tab-link[data-tab="' + self.lastActiveTab + '"]').trigger('click');
                }
            });

            // --- Listener para las pestañas principales (Cuaderno/Programador) ---
            $document.on('click', '.cpp-main-tab-link', function(e) {
                e.preventDefault();
                self.handleMainTabSwitch($(this));
            });
            const $cuadernoContenido = $('#cpp-cuaderno-contenido');

            // Botón para crear la primera clase desde la pantalla de bienvenida
            $document.on('click', '#cpp-btn-crear-primera-clase', function(e) {
                if (cpp.modals && cpp.modals.clase && typeof cpp.modals.clase.showParaCrear === 'function') {
                    cpp.modals.clase.showParaCrear(e);
                }
            });

            $document.on('change', '#cpp-global-evaluacion-selector', function(e) {
                const nuevaEvaluacionId = $(this).val();
                if (cpp.currentClaseIdCuaderno && nuevaEvaluacionId) {
                    const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();

                    // Guardar la nueva evaluación en localStorage para persistencia
                    const localStorageKey = self.localStorageKey_lastEval + cpp.currentClaseIdCuaderno;
                    try {
                        localStorage.setItem(localStorageKey, nuevaEvaluacionId);
                    } catch (err) {
                        console.warn("No se pudo guardar la evaluación en localStorage:", err);
                    }

                    // Determinar qué vista está activa y recargarla
                    const activeTab = $('.cpp-main-tab-link.active').data('tab');

                    if (activeTab === 'cuaderno') {
                        const sortOrder = $('#cpp-a1-sort-students-btn').data('sort');
                        self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, claseNombre, nuevaEvaluacionId, sortOrder);
                    } else if (activeTab === 'programacion') {
                        if (typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.loadClass === 'function') {
                            // Cargar la nueva evaluación en el programador.
                            // La función loadClass ya se encarga de actualizar el currentEvaluacionId y renderizar.
                            CppProgramadorApp.loadClass(cpp.currentClaseIdCuaderno, nuevaEvaluacionId);
                        }
                    }
                }
            });

            $document.on('click', '#cpp-a1-sort-students-btn', function(e) {
                e.preventDefault();
                const $button = $(this);
                const currentSort = $button.data('sort');
                const newSort = currentSort === 'apellidos' ? 'nombre' : 'apellidos';
                $button.data('sort', newSort);

                if (cpp.currentClaseIdCuaderno) {
                    const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();
                    self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, claseNombre, cpp.currentEvaluacionId, newSort);
                }
            });

            // User Menu Dropdown Logic
            $document.on('click', '.cpp-user-menu-avatar-btn', function(e) {
                e.stopPropagation();
                $('.cpp-user-menu-dropdown').toggleClass('show-dropdown');
            });

            $document.on('click', '#cpp-toggle-fullscreen-btn', function() {
                const viewport = document.querySelector('.cpp-cuaderno-viewport-classroom');
                const btn = this;
                const exitIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';
                const enterIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';

                if (!document.fullscreenElement) {
                    if (viewport.requestFullscreen) {
                        viewport.requestFullscreen();
                    } else if (viewport.webkitRequestFullscreen) { /* Safari */
                        viewport.webkitRequestFullscreen();
                    } else if (viewport.msRequestFullscreen) { /* IE11 */
                        viewport.msRequestFullscreen();
                    }
                    $(btn).html(exitIcon).attr('title', 'Salir de Pantalla Completa');
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) { /* Safari */
                        document.webkitExitFullscreen();
                    } else if (document.msExitFullscreen) { /* IE11 */
                        document.msExitFullscreen();
                    }
                    $(btn).html(enterIcon).attr('title', 'Pantalla Completa');
                }
            });

            $document.on('click', function(e) {
                if (!$(e.target).closest('.cpp-user-menu-container').length) {
                    $('.cpp-user-menu-dropdown').removeClass('show-dropdown');
                }
            });

            $cuadernoContenido.on('click', '#cpp-final-grade-sort-btn', function(e) { self.handleFinalGradeSort.call(self, e); });
            $cuadernoContenido.on('click', '#cpp-final-grade-highlight-btn', function(e) { self.toggleHighlightFailed.call(self, e); });

            $document.on('keydown', '.cpp-input-nota', function(e) { self.manejarNavegacionTablaNotas.call(this, e); });
            $cuadernoContenido.on('blur', '.cpp-input-nota', function(e) { self.guardarNotaDesdeInput.call(this, e, null); });
            $cuadernoContenido.on('focusin', '.cpp-input-nota', function(e){ self.lastFocusedCell = this; self.limpiarErrorNotaInput(this); this.select(); if (typeof $(this).data('original-nota-set') === 'undefined' || !$(this).data('original-nota-set')) { $(this).data('original-nota', $(this).val().trim()); $(this).data('original-nota-set', true); } });
            $cuadernoContenido.on('focusout', '.cpp-input-nota', function(e){ $(this).removeData('original-nota-set'); });
            $cuadernoContenido.on('dragstart', '.cpp-input-nota', function(e) { e.preventDefault(); });
            $cuadernoContenido.on('click', 'td.cpp-cuaderno-td-alumno', function(e){ self.handleClickAlumnoCell.call(this, e); });
            $cuadernoContenido.on('click', 'th.cpp-cuaderno-th-final', function(e){ self.handleClickNotaFinalHeader.call(this, e); });

            // Listener para el aviso de nota final incompleta
            $cuadernoContenido.on('click', 'td.cpp-cuaderno-td-final', function(e) {
                const $cell = $(this);
                if ($cell.attr('data-is-incomplete')) {
                    e.stopPropagation(); // Evitar que se disparen otros eventos
                    try {
                        const usedCategories = JSON.parse($cell.attr('data-used-categories') || '[]');
                        const missingCategories = JSON.parse($cell.attr('data-missing-categories') || '[]');

                        let message = "🧙‍♂️ ¡Ojo al dato! La nota final es provisional.\n\n";

                        if (usedCategories.length > 0) {
                            message += "Para este cálculo, hemos tenido en cuenta estas categorías:\n✅ " + usedCategories.join('\n✅ ') + "\n\n";
                        } else {
                            message += "¡Aún no se ha calificado ninguna categoría! La nota es un lienzo en blanco.\n\n";
                        }

                        if (missingCategories.length > 0) {
                            message += "Para tener la foto completa, falta por añadir notas en:\n👉 " + missingCategories.join('\n👉 ');
                        }

                        alert(message);
                    } catch (err) {
                        console.error("Error al parsear los datos de las categorías:", err);
                        alert("Error al mostrar los detalles de la nota. Revisa la consola para más información.");
                    }
                }
            });

            $cuadernoContenido.on('click', '.cpp-cuaderno-th-actividad', function(e){
                const $header = $(this);
                const evaluacionId = $header.data('evaluacion-id');

                if (evaluacionId) {
                    if (cpp.currentClaseIdCuaderno) {
                        const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();
                        self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, claseNombre, evaluacionId);
                    }
                } else {
                    if (cpp.modals && cpp.modals.actividades && typeof cpp.modals.actividades.cargarParaEditar === 'function') {
                        cpp.modals.actividades.cargarParaEditar(this, e);
                    } else {
                        console.error("Función cpp.modals.actividades.cargarParaEditar no encontrada.");
                    }
                }
            });

            $document.on('click', '#cpp-a1-add-activity-btn', function(e) { e.stopPropagation(); if (cpp.modals && cpp.modals.actividades && typeof cpp.modals.actividades.mostrarAnadir === 'function') { cpp.modals.actividades.mostrarAnadir(); } else { console.error("Función cpp.modals.actividades.mostrarAnadir no encontrada."); } });
            $document.on('click', '#cpp-a1-import-students-btn', function(e){ if (cpp.modals && cpp.modals.excel && typeof cpp.modals.excel.showImportStudents === 'function') { cpp.modals.excel.showImportStudents(e); } else { console.error("Función cpp.modals.excel.showImportStudents no encontrada.");} });
            $document.on('click', '#cpp-btn-importar-alumnos-excel', function(e){ if (cpp.modals && cpp.modals.excel && typeof cpp.modals.excel.showImportStudents === 'function') { cpp.modals.excel.showImportStudents(e); } else { console.error("Función cpp.modals.excel.showImportStudents no encontrada.");} });
            $document.on('click', '#cpp-btn-agregar-alumnos-mano', function(e){ if (cpp.modals && cpp.modals.alumnos && typeof cpp.modals.alumnos.mostrar === 'function') { cpp.modals.alumnos.mostrar(e); } else { console.error("Función cpp.modals.alumnos.mostrar no encontrada.");} });
            $document.on('click', '#cpp-a1-download-excel-btn', function(e){ if (cpp.modals && cpp.modals.excel && typeof cpp.modals.excel.showDownloadOptions === 'function') { cpp.modals.excel.showDownloadOptions(e); } else { console.error("Función cpp.modals.excel.showDownloadOptions no encontrada.");} });
            $document.on('click', '#cpp-a1-take-attendance-btn', function(e) { e.preventDefault(); e.stopPropagation(); if (cpp.modals && cpp.modals.asistencia && typeof cpp.modals.asistencia.mostrar === 'function') { if (cpp.currentClaseIdCuaderno) { cpp.modals.asistencia.mostrar(cpp.currentClaseIdCuaderno); } else { alert("Por favor, selecciona o carga una clase primero."); } } else { console.error("Función cpp.modals.asistencia.mostrar no encontrada."); } });
            $document.on('mousedown', '.cpp-cuaderno-tabla .cpp-input-nota', function(e) { self.handleCellMouseDown.call(this, e); });
            $document.on('copy', function(e) { const activeElement = document.activeElement; if ((activeElement && $(activeElement).closest('.cpp-cuaderno-tabla').length) || (self.currentSelectedInputs && self.currentSelectedInputs.length > 0)) { self.handleCopyCells(e); } });
            $document.on('paste', '.cpp-cuaderno-tabla .cpp-input-nota', function(e) { self.handlePasteCells.call(this, e); });

            // --- INICIO: Listeners para la Paleta de Símbolos ---

            // Abrir la paleta
            $document.on('click', '#cpp-a1-symbol-palette-btn', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (self.lastFocusedCell) {
                    self.openSymbolPalette();
                } else {
                    alert("Por favor, selecciona una celda de nota primero.");
                }
            });

            // Cerrar la paleta (genérico para todos los modales)
            $document.on('click', '#cpp-modal-symbol-palette .cpp-modal-close', function() {
                $('#cpp-modal-symbol-palette').hide();
            });

            // Guardar la leyenda
            $document.on('click', '#cpp-save-symbol-legend-btn', function() {
                const userId = (cppFrontendData && cppFrontendData.userId) ? cppFrontendData.userId : '0';
                const storageKey = self.localStorageKey_symbolLegends + userId;
                let newLegends = {};
                $('#cpp-symbol-list-container .cpp-legend-input').each(function() {
                    const symbol = $(this).data('symbol');
                    const legendText = $(this).val();
                    newLegends[symbol] = legendText;
                });
                try {
                    localStorage.setItem(storageKey, JSON.stringify(newLegends));
                    self.symbolLegends = newLegends;
                    const $button = $(this);
                    const originalText = $button.text();
                    $button.text('¡Guardado!').css('background-color', '#28a745');
                    setTimeout(function() {
                        $button.text(originalText).css('background-color', '');
                    }, 1500);
                } catch (e) {
                    console.error("Error al guardar las leyendas en localStorage:", e);
                    alert("Hubo un error al guardar la leyenda.");
                }
            });

            // Insertar un símbolo en la celda activa
            $document.on('click', '#cpp-symbol-list-container .cpp-symbol-item', function() {
                const symbol = $(this).data('symbol');

                if (self.lastFocusedCell) {
                    const $targetInput = $(self.lastFocusedCell);
                    const currentValue = $targetInput.val().trim();
                    const newValue = currentValue ? (currentValue + ' ' + symbol) : symbol;
                    $targetInput.val(newValue);
                    self.guardarNotaDesdeInput.call($targetInput[0], { type: 'blur' }, null);
                    $('#cpp-modal-symbol-palette').hide();
                    $targetInput.focus();
                } else {
                    alert("Error: No se encontró una celda de destino. Por favor, selecciona una celda de nuevo.");
                }
            });

            // --- FIN: Listeners para la Paleta de Símbolos ---

            // Listeners for cross-component updates
            $document.on('cpp:forceGradebookReload', function() {
                console.log('Event detected: cpp:forceGradebookReload. Reloading gradebook...');
                if (cpp.currentClaseIdCuaderno) {
                    const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();
                    // Usar cpp.currentEvaluacionId que ya debería estar actualizado
                    self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, claseNombre, cpp.currentEvaluacionId);
                }
            });

            $document.on('cpp:forceProgramadorReload', function() {
                console.log('Event detected: cpp:forceProgramadorReload. Reloading scheduler...');
                if (typeof CppProgramadorApp !== 'undefined' && CppProgramadorApp.programadorInicializado && CppProgramadorApp.currentClase) {
                    CppProgramadorApp.fetchData(CppProgramadorApp.currentClase.id);
                }
            });
        }
    };

})(jQuery);