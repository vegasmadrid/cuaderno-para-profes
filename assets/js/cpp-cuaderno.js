// assets/js/cpp-cuaderno.js (VERSIÓN FINAL)

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-cuaderno.js no puede inicializarse.");
        return;
    }
    
    cpp.gradebook = {
        enterKeyDirection: 'down', 
        localStorageKey_enterDirection: 'cpp_enter_key_direction_user_', 
        localStorageKey_lastEval: 'cpp_last_opened_eval_clase_',
        currentCalculoNota: 'total',
        isDraggingSelection: false,
        selectionStartCellInput: null,
        currentSelectedInputs: [],
        finalGradeSortState: 'none', // none, desc, asc
        failedStudentsHighlighted: false,
        notaAprobado: 50, // Default, se actualiza al cargar la clase
        programadorInicializado: false,

        init: function() {
            console.log("CPP Gradebook Module Initializing...");
            if (typeof localStorage !== 'undefined' && cppFrontendData && cppFrontendData.userId && cppFrontendData.userId !== '0') {
                const savedDirection = localStorage.getItem(this.localStorageKey_enterDirection + cppFrontendData.userId);
                if (savedDirection === 'right' || savedDirection === 'down') { this.enterKeyDirection = savedDirection; }
            }
            this.bindEvents();
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

        updateEnterDirectionButton: function() {
            const $button = $('#cpp-a1-enter-direction-btn');
            if (!$button.length) return;

            const icons = {
                down: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/></svg>',
                right: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/></svg>'
            };

            if (this.enterKeyDirection === 'down') {
                $button.html(icons.down);
                $button.attr('title', 'Desplazar hacia abajo al pulsar Intro (clic para cambiar a derecha)');
            } else {
                $button.html(icons.right);
                $button.attr('title', 'Desplazar hacia la derecha al pulsar Intro (clic para cambiar a abajo)');
            }
        },
        
        renderEvaluacionesDropdown: function(evaluaciones, evaluacionActivaId) {
            const $container = $('#cpp-evaluacion-selector-container');
            if (!$container.length) return;
            $container.empty();
            if (!evaluaciones || evaluaciones.length === 0) {
                $container.html('<span class="cpp-no-evaluaciones-msg">Sin evaluaciones</span>');
                return;
            }
            let selectHtml = '<select id="cpp-evaluacion-selector">';
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
                            self.updateEnterDirectionButton();
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
                if (cpp.gradebook && typeof cpp.gradebook.actualizarSelectCategoriasActividad === 'function') { cpp.gradebook.actualizarSelectCategoriasActividad(0, null); }
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
        guardarNotaDesdeInput: function(event, callbackFn) { const $input = $(this); const alumnoId = $input.data('alumno-id'); const actividadId = $input.data('actividad-id'); const notaMaxima = parseFloat($input.data('nota-maxima')); let notaStr = $input.val().trim(); const $td = $input.closest('td'); const $validationMessage = $td.find('.cpp-nota-validation-message'); cpp.gradebook.limpiarErrorNotaInput(this); if (notaStr !== '') { notaStr = notaStr.replace(',', '.'); const notaNum = parseFloat(notaStr); if (isNaN(notaNum)) { $validationMessage.text('No es un nº').show(); $input.addClass('cpp-nota-error'); if (typeof callbackFn === 'function') callbackFn(false); return; } if (notaNum < 0 || notaNum > notaMaxima) { $validationMessage.text(`Nota 0-${notaMaxima}`).show(); $input.addClass('cpp-nota-error'); if (typeof callbackFn === 'function') callbackFn(false); return; } } const originalNota = $input.data('original-nota') || ''; if (notaStr === originalNota && event && event.type === 'blur') { if (typeof callbackFn === 'function') callbackFn(true, false); return; } $input.prop('disabled', true); $validationMessage.hide().text(''); const ajaxData = { action: 'cpp_guardar_calificacion_alumno', nonce: cppFrontendData.nonce, alumno_id: alumnoId, actividad_id: actividadId, nota: notaStr, evaluacion_id: cpp.currentEvaluacionId }; $.ajax({ url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json', data: ajaxData, success: function(response) { if (response && response.success) { $input.addClass('cpp-nota-guardada'); if (response.data && typeof response.data.nota_final_alumno !== 'undefined') { $(`#cpp-nota-final-alumno-${alumnoId}`).text(response.data.nota_final_alumno); } let displayNota = ''; if (notaStr !== '') { const num = parseFloat(notaStr.replace(',', '.')); if (!isNaN(num)) { displayNota = (num % 1 !== 0) ? num.toFixed(2) : String(parseInt(num)); } } $input.val(displayNota); $input.data('original-nota', displayNota); setTimeout(function() { $input.removeClass('cpp-nota-guardada'); }, 1500); if (typeof callbackFn === 'function') callbackFn(true, true); } else { const errorMsg = (response && response.data && response.data.message) ? response.data.message : 'Error desconocido al guardar.'; $validationMessage.text(errorMsg).show(); $input.addClass('cpp-nota-error'); if (typeof callbackFn === 'function') callbackFn(false); } }, error: function() { $validationMessage.text('Error de conexión').show(); $input.addClass('cpp-nota-error'); if (typeof callbackFn === 'function') callbackFn(false); }, complete: function() { $input.prop('disabled', false); } }); },
        manejarNavegacionTablaNotas: function(e) { const $thisInput = $(this); const $td = $thisInput.closest('td'); const $tr = $td.closest('tr'); let $nextCell; if (e.key === 'Enter') { e.preventDefault(); cpp.gradebook.guardarNotaDesdeInput.call(this, e, function(isValid, wasSaved) { if (isValid) { if (cpp.gradebook.enterKeyDirection === 'down') { $nextCell = $tr.next('tr').find(`td:eq(${$td.index()})`); } else { $nextCell = $td.nextAll('td:has(input.cpp-input-nota)').first(); if (!$nextCell.length) { $nextCell = $tr.next('tr').find('td:has(input.cpp-input-nota)').first(); } } if ($nextCell && $nextCell.length) { $nextCell.find('input.cpp-input-nota').focus().select(); } } }); } else if (e.key === 'Tab') { e.preventDefault(); cpp.gradebook.guardarNotaDesdeInput.call(this, e, function(isValid, wasSaved) { if (isValid) { if (e.shiftKey) { $nextCell = $td.prevAll('td:has(input.cpp-input-nota)').first(); if (!$nextCell.length) { $nextCell = $tr.prev('tr').find('td:has(input.cpp-input-nota)').last(); } } else { $nextCell = $td.nextAll('td:has(input.cpp-input-nota)').first(); if (!$nextCell.length) { $nextCell = $tr.next('tr').find('td:has(input.cpp-input-nota)').first(); } } if ($nextCell && $nextCell.length) { $nextCell.find('input.cpp-input-nota').focus().select(); } } }); } else if (e.key === 'ArrowUp') { e.preventDefault(); $nextCell = $tr.prev('tr').find(`td:eq(${$td.index()})`); if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select(); } else if (e.key === 'ArrowDown') { e.preventDefault(); $nextCell = $tr.next('tr').find(`td:eq(${$td.index()})`); if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select(); } else if (e.key === 'ArrowLeft') { if (this.selectionStart === 0 && this.selectionEnd === 0) { e.preventDefault(); $nextCell = $td.prevAll('td:has(input.cpp-input-nota)').first(); if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select(); } } else if (e.key === 'ArrowRight') { if (this.selectionStart === this.value.length && this.selectionEnd === this.value.length) { e.preventDefault(); $nextCell = $td.nextAll('td:has(input.cpp-input-nota)').first(); if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select(); } } else if (e.key === 'Escape') { $thisInput.val($thisInput.data('original-nota') || ''); cpp.gradebook.limpiarErrorNotaInput(this); $thisInput.blur(); cpp.gradebook.clearCellSelection(); } },
        clearCellSelection: function() { $('.cpp-input-nota.cpp-cell-selected').removeClass('cpp-cell-selected'); this.currentSelectedInputs = []; },
        updateSelectionRange: function(startInputDom, currentInputDom) { $('.cpp-input-nota.cpp-cell-selected').removeClass('cpp-cell-selected'); this.currentSelectedInputs = []; const $startTd = $(startInputDom).closest('td'); const $currentTd = $(currentInputDom).closest('td'); const $startTr = $startTd.closest('tr'); const $currentTr = $currentTd.closest('tr'); const allTrs = $('.cpp-cuaderno-tabla tbody tr:visible'); const startRowIndex = allTrs.index($startTr); const currentRowIndex = allTrs.index($currentTr); const startColRelIndex = $startTr.find('td.cpp-cuaderno-td-nota').index($startTd.filter('.cpp-cuaderno-td-nota')); const currentColRelIndex = $currentTr.find('td.cpp-cuaderno-td-nota').index($currentTd.filter('.cpp-cuaderno-td-nota')); if (startRowIndex === -1 || currentRowIndex === -1 || startColRelIndex === -1 || currentColRelIndex === -1) { $(startInputDom).addClass('cpp-cell-selected'); this.currentSelectedInputs.push(startInputDom); return; } const minRow = Math.min(startRowIndex, currentRowIndex); const maxRow = Math.max(startRowIndex, currentRowIndex); const minColRel = Math.min(startColRelIndex, currentColRelIndex); const maxColRel = Math.max(startColRelIndex, currentColRelIndex); for (let r = minRow; r <= maxRow; r++) { const $row = $(allTrs[r]); const $tdsInRow = $row.find('td.cpp-cuaderno-td-nota'); for (let c = minColRel; c <= maxColRel; c++) { if (c < $tdsInRow.length) { const $td = $($tdsInRow[c]); const $inputInCell = $td.find('.cpp-input-nota'); if ($inputInCell.length) { $inputInCell.addClass('cpp-cell-selected'); this.currentSelectedInputs.push($inputInCell[0]); } } } } },
        handleCellMouseDown: function(e) { const clickedInput = this; const self = cpp.gradebook; if (e.shiftKey && self.selectionStartCellInput) { self.updateSelectionRange(self.selectionStartCellInput, clickedInput); e.preventDefault(); } else { if (self.currentSelectedInputs.length > 1 || (self.currentSelectedInputs.length === 1 && self.currentSelectedInputs[0] !== clickedInput)) { self.clearCellSelection(); } self.selectionStartCellInput = clickedInput; if (!$(clickedInput).hasClass('cpp-cell-selected')) { if (!(self.currentSelectedInputs.length === 1 && self.currentSelectedInputs[0] === clickedInput)) { self.clearCellSelection(); } $(clickedInput).addClass('cpp-cell-selected'); self.currentSelectedInputs = [clickedInput]; } } let dragHasStarted = false; $(document).off('mousemove.cppCellSelection mouseup.cppCellSelection'); $(document).on('mousemove.cppCellSelection', function(moveEvent) { if (!self.selectionStartCellInput) { return; } if (!dragHasStarted) { dragHasStarted = true; self.isDraggingSelection = true; $('body').addClass('cpp-no-text-select'); } if (self.isDraggingSelection) { moveEvent.preventDefault(); let $hoveredTd = $(moveEvent.target).closest('td.cpp-cuaderno-td-nota'); if ($hoveredTd.length) { let hoveredInput = $hoveredTd.find('.cpp-input-nota')[0]; if (hoveredInput) { self.updateSelectionRange(self.selectionStartCellInput, hoveredInput); } } } }); $(document).on('mouseup.cppCellSelection', function(upEvent) { if (dragHasStarted) { $('body').removeClass('cpp-no-text-select'); } self.isDraggingSelection = false; $(document).off('mousemove.cppCellSelection mouseup.cppCellSelection'); }); },
        handleCopyCells: function(e) { if (cpp.gradebook.currentSelectedInputs && cpp.gradebook.currentSelectedInputs.length > 0) { let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity; const cellData = []; const $tbody = $('.cpp-cuaderno-tabla tbody'); $(cpp.gradebook.currentSelectedInputs).each(function() { const $input = $(this); const $td = $input.closest('td'); const $tr = $td.closest('tr'); const r = $tbody.find('tr:visible').index($tr); const c = $tr.find('td.cpp-cuaderno-td-nota').index($td); if (r !== -1 && c !== -1) { minRow = Math.min(minRow, r); maxRow = Math.max(maxRow, r); minCol = Math.min(minCol, c); maxCol = Math.max(maxCol, c); cellData.push({ row: r, col: c, value: $input.val() }); } }); if (cellData.length === 0) return; const numRows = maxRow - minRow + 1; const numCols = maxCol - minCol + 1; const dataMatrix = Array(numRows).fill(null).map(() => Array(numCols).fill('')); cellData.forEach(cell => { dataMatrix[cell.row - minRow][cell.col - minCol] = cell.value; }); const tsvString = dataMatrix.map(row => row.join('\t')).join('\n'); if (e.originalEvent && e.originalEvent.clipboardData) { e.originalEvent.clipboardData.setData('text/plain', tsvString); e.preventDefault(); console.log("Celdas copiadas al portapapeles (TSV):", tsvString); } else { console.warn("Clipboard API no disponible directamente. No se pudo copiar."); } } },
        handlePasteCells: function(e) { e.preventDefault(); const self = cpp.gradebook; const $startInput = $(this); const $startTd = $startInput.closest('td'); const $startTr = $startInput.closest('tr'); const $tbody = $('.cpp-cuaderno-tabla tbody'); const startRowVisibleIndex = $tbody.find('tr:visible').index($startTr); const startColVisibleIndex = $startTr.find('td.cpp-cuaderno-td-nota').index($startTd); if (startRowVisibleIndex === -1 || startColVisibleIndex === -1) { console.error("Celda de inicio para pegar no válida."); return; } let pastedData = ''; if (e.originalEvent && e.originalEvent.clipboardData) { pastedData = e.originalEvent.clipboardData.getData('text/plain'); } else if (window.clipboardData) { pastedData = window.clipboardData.getData('Text'); } if (!pastedData) return; const rows = pastedData.split(/\r\n|\n|\r/); self.clearCellSelection(); const $allVisibleTrs = $tbody.find('tr:visible'); const newSelectedInputs = []; for (let i = 0; i < rows.length; i++) { const cells = rows[i].split('\t'); const targetRowIndex = startRowVisibleIndex + i; if (targetRowIndex >= $allVisibleTrs.length) break; const $targetTr = $($allVisibleTrs[targetRowIndex]); const $targetTdsNotas = $targetTr.find('td.cpp-cuaderno-td-nota'); for (let j = 0; j < cells.length; j++) { const targetColIndex = startColVisibleIndex + j; if (targetColIndex >= $targetTdsNotas.length) break; const $targetTd = $($targetTdsNotas[targetColIndex]); const $targetInput = $targetTd.find('.cpp-input-nota'); if ($targetInput.length) { const pastedValue = cells[j]; $targetInput.val(pastedValue); newSelectedInputs.push($targetInput[0]); const mockEvent = { type: 'paste', target: $targetInput[0] }; self.guardarNotaDesdeInput.call($targetInput[0], mockEvent, function(success, saved) {}); } } } if (newSelectedInputs.length > 0) { self.currentSelectedInputs = newSelectedInputs; $(newSelectedInputs).addClass('cpp-cell-selected'); } },
        handleClickAlumnoCell: function(e) { e.preventDefault(); const $td = $(this); const $tr = $td.closest('tr'); const alumnoId = $tr.data('alumno-id'); if (alumnoId && cpp.currentClaseIdCuaderno) { if (cpp.modals && cpp.modals.fichaAlumno && typeof cpp.modals.fichaAlumno.mostrar === 'function') { console.log(`Abriendo ficha para alumno ID: ${alumnoId}, Clase ID: ${cpp.currentClaseIdCuaderno}`); cpp.modals.fichaAlumno.mostrar(alumnoId, cpp.currentClaseIdCuaderno); } else { console.error("Función cpp.modals.fichaAlumno.mostrar no encontrada."); } } else { console.warn("No se pudo obtener alumnoId o claseId actual para abrir ficha."); } },
        handleClickNotaFinalHeader: function(e) { if (e.target !== this && $(e.target).closest(this).length) { if ($(e.target).is('button, a, input') || $(e.target).closest('button, a, input').length) { return; } } e.preventDefault(); if (!cpp.currentClaseIdCuaderno) { alert('Por favor, selecciona una clase primero.'); return; } if (cpp.modals && cpp.modals.clase && typeof cpp.modals.clase.showParaEditar === 'function') { cpp.modals.clase.showParaEditar(null, true, cpp.currentClaseIdCuaderno); } else { console.error("Función cpp.modals.clase.showParaEditar no encontrada."); } },

        handleFinalGradeSort: function(e) {
            e.preventDefault();
            e.stopPropagation();
            const self = cpp.gradebook;
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
            const self = cpp.gradebook;
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
            if (tabName === 'cuaderno' || tabName === 'configuracion') {
                return;
            }
            if ($tab.hasClass('active')) {
                return; // Ya está activo
            }

            $('.cpp-main-tab-link').removeClass('active');
            $('.cpp-main-tab-content').removeClass('active');

            $tab.addClass('active');
            $('#cpp-main-tab-' + tabName).addClass('active');

            const isProgramadorTab = ['programacion', 'semana', 'horario'].includes(tabName);

            if (isProgramadorTab) {
                // Inicializar el programador si es la primera vez que se accede a una de sus pestañas
                if (!this.programadorInicializado) {
                    if (typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.init === 'function') {
                        if (cpp.currentClaseIdCuaderno) {
                            CppProgramadorApp.init(cpp.currentClaseIdCuaderno);
                            this.programadorInicializado = true;
                        } else {
                            // Mostrar mensaje en todas las pestañas del programador si no hay clase
                            $('#cpp-main-tab-programacion, #cpp-main-tab-semana, #cpp-main-tab-horario').html('<p class="cpp-empty-panel">Por favor, selecciona una clase primero.</p>');
                        }
                    } else {
                        console.error("Error: El objeto CppProgramadorApp no está disponible.");
                         $('#cpp-main-tab-programacion, #cpp-main-tab-semana, #cpp-main-tab-horario').html('<p class="cpp-empty-panel" style="color:red;">Error: No se pudo cargar el componente del programador.</p>');
                    }
                } else {
                    // Si ya está inicializado, solo asegúrate de que tiene la clase correcta
                    if (typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.loadClass === 'function') {
                        // Solo cargar la clase si es diferente a la actual para no perder el estado
                        if (!CppProgramadorApp.currentClase || CppProgramadorApp.currentClase.id != cpp.currentClaseIdCuaderno) {
                            CppProgramadorApp.loadClass(cpp.currentClaseIdCuaderno);
                        }
                    }
                }
            }
        },

        bindEvents: function() {
            console.log("Binding Gradebook (cuaderno) events...");
            const $document = $(document);
            const self = this;

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

            $document.on('change', '#cpp-evaluacion-selector', function(e) {
                const nuevaEvaluacionId = $(this).val();
                if (cpp.currentClaseIdCuaderno && nuevaEvaluacionId) {
                    const claseNombre = $('#cpp-cuaderno-nombre-clase-activa-a1').text();
                    const sortOrder = $('#cpp-a1-sort-students-btn').data('sort');
                    self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, claseNombre, nuevaEvaluacionId, sortOrder);
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

            $document.on('click', function(e) {
                if (!$(e.target).closest('.cpp-user-menu-container').length) {
                    $('.cpp-user-menu-dropdown').removeClass('show-dropdown');
                }
            });

            $cuadernoContenido.on('click', '#cpp-final-grade-sort-btn', function(e) { self.handleFinalGradeSort.call(self, e); });
            $cuadernoContenido.on('click', '#cpp-final-grade-highlight-btn', function(e) { self.toggleHighlightFailed.call(self, e); });

            $document.on('keydown', '.cpp-input-nota', function(e) { self.manejarNavegacionTablaNotas.call(this, e); });
            $cuadernoContenido.on('blur', '.cpp-input-nota', function(e) { self.guardarNotaDesdeInput.call(this, e, null); });
            $cuadernoContenido.on('focusin', '.cpp-input-nota', function(e){ self.limpiarErrorNotaInput(this); this.select(); if (typeof $(this).data('original-nota-set') === 'undefined' || !$(this).data('original-nota-set')) { $(this).data('original-nota', $(this).val().trim()); $(this).data('original-nota-set', true); } });
            $cuadernoContenido.on('focusout', '.cpp-input-nota', function(e){ $(this).removeData('original-nota-set'); });
            $cuadernoContenido.on('dragstart', '.cpp-input-nota', function(e) { e.preventDefault(); });
            $cuadernoContenido.on('click', 'td.cpp-cuaderno-td-alumno', function(e){ self.handleClickAlumnoCell.call(this, e); });
            $cuadernoContenido.on('click', 'th.cpp-cuaderno-th-final', function(e){ self.handleClickNotaFinalHeader.call(this, e); });

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
            $document.on('click', '#cpp-a1-enter-direction-btn', function(e) { e.preventDefault(); e.stopPropagation(); if (self.enterKeyDirection === 'down') { self.enterKeyDirection = 'right'; } else { self.enterKeyDirection = 'down'; } self.updateEnterDirectionButton(); if (typeof localStorage !== 'undefined' && cppFrontendData && cppFrontendData.userId && cppFrontendData.userId !== '0') { try { localStorage.setItem(self.localStorageKey_enterDirection + cppFrontendData.userId, self.enterKeyDirection); } catch (lsError) { console.warn("No se pudo guardar la preferencia de dirección de Enter en localStorage:", lsError); } } });
            $document.on('mousedown', '.cpp-cuaderno-tabla .cpp-input-nota', function(e) { self.handleCellMouseDown.call(this, e); });
            $document.on('copy', function(e) { const activeElement = document.activeElement; if ((activeElement && $(activeElement).closest('.cpp-cuaderno-tabla').length) || (self.currentSelectedInputs && self.currentSelectedInputs.length > 0)) { self.handleCopyCells(e); } });
            $document.on('paste', '.cpp-cuaderno-tabla .cpp-input-nota', function(e) { self.handlePasteCells.call(this, e); });
        }
    };

})(jQuery);