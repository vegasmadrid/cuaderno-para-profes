// assets/js/cpp-cuaderno.js (NUEVA VERSIÓN CORREGIDA)

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-cuaderno.js no puede inicializarse.");
        return;
    }
    
    cpp.gradebook = {
        // --- PROPIEDADES ---
        enterKeyDirection: 'down', 
        localStorageKey_enterDirection: 'cpp_enter_key_direction_user_', 
        localStorageKey_lastEval: 'cpp_last_opened_eval_clase_',
        localStorageKey_lastTab: 'cpp_last_opened_tab',
        currentCalculoNota: 'total',
        isDraggingSelection: false,
        selectionStartCellInput: null,
        currentSelectedInputs: [],
        finalGradeSortState: 'none', // none, desc, asc
        failedStudentsHighlighted: false,
        notaAprobado: 5, // Default, se actualiza al cargar la clase
        programadorInicializado: false, // <-- NUEVO: Flag para controlar la inicialización del programador

        // --- INICIALIZACIÓN ---
        init: function() {
            console.log("CPP Gradebook Module Initializing...");
            if (typeof localStorage !== 'undefined' && cppFrontendData && cppFrontendData.userId && cppFrontendData.userId !== '0') {
                const savedDirection = localStorage.getItem(this.localStorageKey_enterDirection + cppFrontendData.userId);
                if (savedDirection === 'right' || savedDirection === 'down') { this.enterKeyDirection = savedDirection; }
            }
            this.bindEvents();

            // --- NUEVO: Restaurar la última pestaña abierta ---
            try {
                const lastTab = localStorage.getItem(this.localStorageKey_lastTab);
                if (lastTab) {
                    const $targetTab = $(`.cpp-main-tab-link[data-tab="${lastTab}"]`);
                    if ($targetTab.length) {
                        this.handleMainTabSwitch($targetTab, true); // true para forzar la carga silenciosa
                    }
                }
            } catch(e) {
                console.warn("No se pudo restaurar la última pestaña desde localStorage:", e);
            }
        },

        // --- LÓGICA DE LA INTERFAZ (UI) ---
        updateSortButton: function(sortOrder) {
            const $button = $('#cpp-a1-sort-students-btn');
            if (!$button.length) return;
            const icons = {
                apellidos: '<svg class="icon-sort-alpha" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 18l-4-4h3V4h2v10h3l-4 4zM4.75 5.5H10c.83 0 1.5-.67 1.5-1.5S10.83 2.5 10 2.5H4.75c-.83 0-1.5.67-1.5 1.5S3.92 5.5 4.75 5.5zM10.25 8.5H4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.75c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5zM10.25 14.5H4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.75c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/></svg>',
                nombre: '<svg class="icon-sort-alpha" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 18l-4-4h3V4h2v10h3l-4 4zM4.5 11.5h5.75c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5H4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5zM4.75 5.5H10c.83 0 1.5-.67 1.5-1.5S10.83 2.5 10 2.5H4.75c-.83 0-1.5.67-1.5 1.5S3.92 5.5 4.75 5.5zM10.25 14.5H4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.75c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/></svg>'
            };
            if (sortOrder === 'nombre') {
                $button.html(icons.nombre).attr('title', 'Ordenado por Nombre (clic para cambiar a Apellidos)').data('sort', 'nombre');
            } else {
                $button.html(icons.apellidos).attr('title', 'Ordenado por Apellidos (clic para cambiar a Nombre)').data('sort', 'apellidos');
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
                $button.html(icons.down).attr('title', 'Desplazar hacia abajo al pulsar Intro (clic para cambiar a derecha)');
            } else {
                $button.html(icons.right).attr('title', 'Desplazar hacia la derecha al pulsar Intro (clic para cambiar a abajo)');
            }
        },
        
        renderEvaluacionesDropdown: function(evaluaciones, evaluacionActivaId) {
            const $container = $('.cpp-a1-evaluacion-selector');
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

        // --- LÓGICA DE DATOS Y AJAX ---
        cargarContenidoCuaderno: function(claseId, claseNombre, evaluacionId, sortOrder) {
            const $contenidoCuaderno = $('#cpp-cuaderno-tabla-area'); // Target a higher-level container
            cpp.currentClaseIdCuaderno = claseId;

            if (claseId && typeof localStorage !== 'undefined' && cppFrontendData && cppFrontendData.userId) {
                try { localStorage.setItem('cpp_last_opened_clase_id_user_' + cppFrontendData.userId, claseId); } catch (e) { console.warn("No se pudo guardar la última clase abierta en localStorage:", e); }
                if (!evaluacionId && typeof localStorage !== 'undefined') {
                    evaluacionId = localStorage.getItem(this.localStorageKey_lastEval + claseId);
                }
            }

            // --- NUEVO: Informar al programador del cambio de clase ---
            if (this.programadorInicializado && typeof CppProgramadorApp !== 'undefined') {
                if (!CppProgramadorApp.currentClase || CppProgramadorApp.currentClase.id != claseId) {
                    CppProgramadorApp.loadClass(claseId);
                }
            }

            if (claseId) {
                $contenidoCuaderno.html('<p class="cpp-cuaderno-cargando">Cargando cuaderno...</p>');
                const self = this;
                $.ajax({
                    url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                    data: { action: 'cpp_cargar_cuaderno_clase', nonce: cppFrontendData.nonce, clase_id: claseId, evaluacion_id: evaluacionId, sort_order: sortOrder || 'apellidos' },
                    success: function(response) {
                        if (response && response.success && response.data && typeof response.data.html_cuaderno !== 'undefined') {
                            if (cpp.utils && typeof cpp.utils.updateTopBar === 'function') {
                                cpp.utils.updateTopBar({ nombre: response.data.nombre_clase, color: response.data.color_clase });
                            }
                            $contenidoCuaderno.empty().html(response.data.html_cuaderno);
                            cpp.currentEvaluacionId = response.data.evaluacion_activa_id;
                            self.currentCalculoNota = response.data.calculo_nota || 'total';
                            self.notaAprobado = parseFloat(response.data.nota_aprobado) || 5;
                            if (typeof localStorage !== 'undefined' && cpp.currentClaseIdCuaderno && cpp.currentEvaluacionId) {
                                localStorage.setItem(self.localStorageKey_lastEval + cpp.currentClaseIdCuaderno, cpp.currentEvaluacionId);
                            }
                            self.renderEvaluacionesDropdown(response.data.evaluaciones, response.data.evaluacion_activa_id);
                            cpp.currentBaseNotaFinal = parseFloat(response.data.base_nota_final) || 100;
                            $('#clase_id_actividad_cuaderno_form').val(claseId);
                            self.updateSortButton(response.data.sort_order);
                            self.updateEnterDirectionButton();
                            self.clearCellSelection();
                            self.selectionStartCellInput = null;
                        } else {
                            let errorMsg = (response && response.data && response.data.message) ? response.data.message : 'Error al cargar el contenido del cuaderno.';
                            $contenidoCuaderno.html(`<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">${errorMsg}</p></div>`);
                        }
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        console.error("Error AJAX cargando cuaderno. Status:", textStatus, "Error:", errorThrown, jqXHR.responseText);
                        $contenidoCuaderno.html('<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">Error de conexión al cargar el cuaderno.</p></div>');
                    }
                });
            } else {
                $contenidoCuaderno.html('<div class="cpp-welcome-screen">...</div>'); // Welcome screen
                if (cpp.utils && typeof cpp.utils.updateTopBar === 'function') {
                    cpp.utils.updateTopBar({ nombre: 'Cuaderno de Profe', color: '#6c757d' });
                }
            }
        },

        // ... (el resto de funciones como guardarNotaDesdeInput, manejarNavegacionTablaNotas, etc. se mantienen igual)
        // ... (copiando las funciones de la versión antigua que son relevantes y correctas)
        limpiarErrorNotaInput: function(inputElement){ const $input = $(inputElement); $input.removeClass('cpp-nota-error cpp-nota-guardada'); $input.closest('td').find('.cpp-nota-validation-message').hide().text(''); },
        guardarNotaDesdeInput: function(event, callbackFn) { const $input = $(this); const alumnoId = $input.data('alumno-id'); const actividadId = $input.data('actividad-id'); const notaMaxima = parseFloat($input.data('nota-maxima')); let notaStr = $input.val().trim(); const $td = $input.closest('td'); const $validationMessage = $td.find('.cpp-nota-validation-message'); cpp.gradebook.limpiarErrorNotaInput(this); if (notaStr !== '') { notaStr = notaStr.replace(',', '.'); const notaNum = parseFloat(notaStr); if (isNaN(notaNum)) { $validationMessage.text('No es un nº').show(); $input.addClass('cpp-nota-error'); if (typeof callbackFn === 'function') callbackFn(false); return; } if (notaNum < 0 || notaNum > notaMaxima) { $validationMessage.text(`Nota 0-${notaMaxima}`).show(); $input.addClass('cpp-nota-error'); if (typeof callbackFn === 'function') callbackFn(false); return; } } const originalNota = $input.data('original-nota') || ''; if (notaStr === originalNota && event && event.type === 'blur') { if (typeof callbackFn === 'function') callbackFn(true, false); return; } $input.prop('disabled', true); $validationMessage.hide().text(''); const ajaxData = { action: 'cpp_guardar_calificacion_alumno', nonce: cppFrontendData.nonce, alumno_id: alumnoId, actividad_id: actividadId, nota: notaStr, evaluacion_id: cpp.currentEvaluacionId }; $.ajax({ url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json', data: ajaxData, success: function(response) { if (response && response.success) { $input.addClass('cpp-nota-guardada'); if (response.data && typeof response.data.nota_final_alumno !== 'undefined') { $(`#cpp-nota-final-alumno-${alumnoId}`).text(response.data.nota_final_alumno); } let displayNota = ''; if (notaStr !== '') { const num = parseFloat(notaStr.replace(',', '.')); if (!isNaN(num)) { displayNota = (num % 1 !== 0) ? num.toFixed(2) : String(parseInt(num)); } } $input.val(displayNota); $input.data('original-nota', displayNota); setTimeout(function() { $input.removeClass('cpp-nota-guardada'); }, 1500); if (typeof callbackFn === 'function') callbackFn(true, true); } else { const errorMsg = (response && response.data && response.data.message) ? response.data.message : 'Error desconocido al guardar.'; $validationMessage.text(errorMsg).show(); $input.addClass('cpp-nota-error'); if (typeof callbackFn === 'function') callbackFn(false); } }, error: function() { $validationMessage.text('Error de conexión').show(); $input.addClass('cpp-nota-error'); if (typeof callbackFn === 'function') callbackFn(false); }, complete: function() { $input.prop('disabled', false); } }); },
        manejarNavegacionTablaNotas: function(e) { const $thisInput = $(this); const $td = $thisInput.closest('td'); const $tr = $td.closest('tr'); let $nextCell; if (e.key === 'Enter') { e.preventDefault(); cpp.gradebook.guardarNotaDesdeInput.call(this, e, function(isValid, wasSaved) { if (isValid) { if (cpp.gradebook.enterKeyDirection === 'down') { $nextCell = $tr.next('tr').find(`td:eq(${$td.index()})`); } else { $nextCell = $td.nextAll('td:has(input.cpp-input-nota)').first(); if (!$nextCell.length) { $nextCell = $tr.next('tr').find('td:has(input.cpp-input-nota)').first(); } } if ($nextCell && $nextCell.length) { $nextCell.find('input.cpp-input-nota').focus().select(); } } }); } else if (e.key === 'Tab') { e.preventDefault(); cpp.gradebook.guardarNotaDesdeInput.call(this, e, function(isValid, wasSaved) { if (isValid) { if (e.shiftKey) { $nextCell = $td.prevAll('td:has(input.cpp-input-nota)').first(); if (!$nextCell.length) { $nextCell = $tr.prev('tr').find('td:has(input.cpp-input-nota)').last(); } } else { $nextCell = $td.nextAll('td:has(input.cpp-input-nota)').first(); if (!$nextCell.length) { $nextCell = $tr.next('tr').find('td:has(input.cpp-input-nota)').first(); } } if ($nextCell && $nextCell.length) { $nextCell.find('input.cpp-input-nota').focus().select(); } } }); } else if (e.key === 'ArrowUp') { e.preventDefault(); $nextCell = $tr.prev('tr').find(`td:eq(${$td.index()})`); if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select(); } else if (e.key === 'ArrowDown') { e.preventDefault(); $nextCell = $tr.next('tr').find(`td:eq(${$td.index()})`); if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select(); } else if (e.key === 'ArrowLeft') { if (this.selectionStart === 0 && this.selectionEnd === 0) { e.preventDefault(); $nextCell = $td.prevAll('td:has(input.cpp-input-nota)').first(); if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select(); } } else if (e.key === 'ArrowRight') { if (this.selectionStart === this.value.length && this.selectionEnd === this.value.length) { e.preventDefault(); $nextCell = $td.nextAll('td:has(input.cpp-input-nota)').first(); if ($nextCell.length) $nextCell.find('input.cpp-input-nota').focus().select(); } } else if (e.key === 'Escape') { $thisInput.val($thisInput.data('original-nota') || ''); cpp.gradebook.limpiarErrorNotaInput(this); $thisInput.blur(); cpp.gradebook.clearCellSelection(); } },
        clearCellSelection: function() { $('.cpp-input-nota.cpp-cell-selected').removeClass('cpp-cell-selected'); this.currentSelectedInputs = []; },
        updateSelectionRange: function(startInputDom, currentInputDom) { $('.cpp-input-nota.cpp-cell-selected').removeClass('cpp-cell-selected'); this.currentSelectedInputs = []; const $startTd = $(startInputDom).closest('td'); const $currentTd = $(currentInputDom).closest('td'); const $startTr = $startTd.closest('tr'); const $currentTr = $currentTd.closest('tr'); const allTrs = $('.cpp-cuaderno-tabla tbody tr:visible'); const startRowIndex = allTrs.index($startTr); const currentRowIndex = allTrs.index($currentTr); const startColRelIndex = $startTr.find('td.cpp-cuaderno-td-nota').index($startTd.filter('.cpp-cuaderno-td-nota')); const currentColRelIndex = $currentTr.find('td.cpp-cuaderno-td-nota').index($currentTd.filter('.cpp-cuaderno-td-nota')); if (startRowIndex === -1 || currentRowIndex === -1 || startColRelIndex === -1 || currentColRelIndex === -1) { $(startInputDom).addClass('cpp-cell-selected'); this.currentSelectedInputs.push(startInputDom); return; } const minRow = Math.min(startRowIndex, currentRowIndex); const maxRow = Math.max(startRowIndex, currentRowIndex); const minColRel = Math.min(startColRelIndex, currentColRelIndex); const maxColRel = Math.max(startColRelIndex, currentColRelIndex); for (let r = minRow; r <= maxRow; r++) { const $row = $(allTrs[r]); const $tdsInRow = $row.find('td.cpp-cuaderno-td-nota'); for (let c = minColRel; c <= maxColRel; c++) { if (c < $tdsInRow.length) { const $td = $($tdsInRow[c]); const $inputInCell = $td.find('.cpp-input-nota'); if ($inputInCell.length) { $inputInCell.addClass('cpp-cell-selected'); this.currentSelectedInputs.push($inputInCell[0]); } } } } },
        handleCellMouseDown: function(e) { const clickedInput = this; const self = cpp.gradebook; if (e.shiftKey && self.selectionStartCellInput) { self.updateSelectionRange(self.selectionStartCellInput, clickedInput); e.preventDefault(); } else { if (self.currentSelectedInputs.length > 1 || (self.currentSelectedInputs.length === 1 && self.currentSelectedInputs[0] !== clickedInput)) { self.clearCellSelection(); } self.selectionStartCellInput = clickedInput; if (!$(clickedInput).hasClass('cpp-cell-selected')) { if (!(self.currentSelectedInputs.length === 1 && self.currentSelectedInputs[0] === clickedInput)) { self.clearCellSelection(); } $(clickedInput).addClass('cpp-cell-selected'); self.currentSelectedInputs = [clickedInput]; } } let dragHasStarted = false; $(document).off('mousemove.cppCellSelection mouseup.cppCellSelection'); $(document).on('mousemove.cppCellSelection', function(moveEvent) { if (!self.selectionStartCellInput) { return; } if (!dragHasStarted) { dragHasStarted = true; self.isDraggingSelection = true; $('body').addClass('cpp-no-text-select'); } if (self.isDraggingSelection) { moveEvent.preventDefault(); let $hoveredTd = $(moveEvent.target).closest('td.cpp-cuaderno-td-nota'); if ($hoveredTd.length) { let hoveredInput = $hoveredTd.find('.cpp-input-nota')[0]; if (hoveredInput) { self.updateSelectionRange(self.selectionStartCellInput, hoveredInput); } } } }); $(document).on('mouseup.cppCellSelection', function(upEvent) { if (dragHasStarted) { $('body').removeClass('cpp-no-text-select'); } self.isDraggingSelection = false; $(document).off('mousemove.cppCellSelection mouseup.cppCellSelection'); }); },
        handleCopyCells: function(e) { if (cpp.gradebook.currentSelectedInputs && cpp.gradebook.currentSelectedInputs.length > 0) { let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity; const cellData = []; const $tbody = $('.cpp-cuaderno-tabla tbody'); $(cpp.gradebook.currentSelectedInputs).each(function() { const $input = $(this); const $td = $input.closest('td'); const $tr = $td.closest('tr'); const r = $tbody.find('tr:visible').index($tr); const c = $tr.find('td.cpp-cuaderno-td-nota').index($td); if (r !== -1 && c !== -1) { minRow = Math.min(minRow, r); maxRow = Math.max(maxRow, r); minCol = Math.min(minCol, c); maxCol = Math.max(maxCol, c); cellData.push({ row: r, col: c, value: $input.val() }); } }); if (cellData.length === 0) return; const numRows = maxRow - minRow + 1; const numCols = maxCol - minCol + 1; const dataMatrix = Array(numRows).fill(null).map(() => Array(numCols).fill('')); cellData.forEach(cell => { dataMatrix[cell.row - minRow][cell.col - minCol] = cell.value; }); const tsvString = dataMatrix.map(row => row.join('\t')).join('\n'); if (e.originalEvent && e.originalEvent.clipboardData) { e.originalEvent.clipboardData.setData('text/plain', tsvString); e.preventDefault(); } } },
        handlePasteCells: function(e) { e.preventDefault(); const self = cpp.gradebook; const $startInput = $(this); const $startTd = $startInput.closest('td'); const $startTr = $startInput.closest('tr'); const $tbody = $('.cpp-cuaderno-tabla tbody'); const startRowVisibleIndex = $tbody.find('tr:visible').index($startTr); const startColVisibleIndex = $startTr.find('td.cpp-cuaderno-td-nota').index($startTd); if (startRowVisibleIndex === -1 || startColVisibleIndex === -1) { return; } let pastedData = (e.originalEvent.clipboardData || window.clipboardData).getData('text/plain'); if (!pastedData) return; const rows = pastedData.split(/\r\n|\n|\r/); self.clearCellSelection(); const $allVisibleTrs = $tbody.find('tr:visible'); const newSelectedInputs = []; for (let i = 0; i < rows.length; i++) { const cells = rows[i].split('\t'); const targetRowIndex = startRowVisibleIndex + i; if (targetRowIndex >= $allVisibleTrs.length) break; const $targetTr = $($allVisibleTrs[targetRowIndex]); const $targetTdsNotas = $targetTr.find('td.cpp-cuaderno-td-nota'); for (let j = 0; j < cells.length; j++) { const targetColIndex = startColVisibleIndex + j; if (targetColIndex >= $targetTdsNotas.length) break; const $targetTd = $($targetTdsNotas[targetColIndex]); const $targetInput = $targetTd.find('.cpp-input-nota'); if ($targetInput.length) { $targetInput.val(cells[j]); newSelectedInputs.push($targetInput[0]); self.guardarNotaDesdeInput.call($targetInput[0], { type: 'paste' }, function() {}); } } } if (newSelectedInputs.length > 0) { self.currentSelectedInputs = newSelectedInputs; $(newSelectedInputs).addClass('cpp-cell-selected'); } },
        handleClickAlumnoCell: function(e) { e.preventDefault(); const $td = $(this); const $tr = $td.closest('tr'); const alumnoId = $tr.data('alumno-id'); if (alumnoId && cpp.currentClaseIdCuaderno) { if (cpp.modals && cpp.modals.fichaAlumno && typeof cpp.modals.fichaAlumno.mostrar === 'function') { cpp.modals.fichaAlumno.mostrar(alumnoId, cpp.currentClaseIdCuaderno); } } },
        handleClickNotaFinalHeader: function(e) { if ($(e.target).closest('button, a, input').length) return; e.preventDefault(); if (cpp.currentClaseIdCuaderno) { if (cpp.modals && cpp.modals.clase && typeof cpp.modals.clase.showParaEditar === 'function') { cpp.modals.clase.showParaEditar(null, true, cpp.currentClaseIdCuaderno); } } },
        handleFinalGradeSort: function(e) { e.preventDefault(); e.stopPropagation(); const self = cpp.gradebook; let nextSortState = self.finalGradeSortState === 'none' ? 'desc' : (self.finalGradeSortState === 'desc' ? 'asc' : 'none'); self.finalGradeSortState = nextSortState; let sortOrderForAjax = nextSortState === 'none' ? ($('#cpp-a1-sort-students-btn').data('sort') || 'apellidos') : `nota_${nextSortState}`; if (cpp.currentClaseIdCuaderno) { self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, null, cpp.currentEvaluacionId, sortOrderForAjax); } },
        toggleHighlightFailed: function(e) { e.preventDefault(); e.stopPropagation(); const self = cpp.gradebook; self.failedStudentsHighlighted = !self.failedStudentsHighlighted; $(e.currentTarget).toggleClass('active', self.failedStudentsHighlighted); if (self.failedStudentsHighlighted) { $('.cpp-cuaderno-tabla tbody tr[data-nota-final]').each(function() { const $row = $(this); const finalGrade = parseFloat($row.data('nota-final')); if (!isNaN(finalGrade) && finalGrade < self.notaAprobado) { $row.addClass('cpp-fila-suspenso'); } else { $row.removeClass('cpp-fila-suspenso'); } }); } else { $('.cpp-cuaderno-tabla tbody tr').removeClass('cpp-fila-suspenso'); } },

        // --- NUEVO: GESTIÓN DE PESTAÑAS PRINCIPALES ---
        handleMainTabSwitch: function($tab, isInitialLoad = false) {
            const tabName = $tab.data('tab');
            if ($tab.hasClass('active') && !isInitialLoad) return;

            $('.cpp-main-tab-link').removeClass('active');
            $('.cpp-main-tab-content').removeClass('active');
            $tab.addClass('active');
            $('#cpp-main-tab-' + tabName).addClass('active');

            try { localStorage.setItem(this.localStorageKey_lastTab, tabName); }
            catch (e) { console.warn("No se pudo guardar la última pestaña en localStorage:", e); }

            const isProgramadorTab = ['programacion', 'semana', 'horario'].includes(tabName);

            if (isProgramadorTab) {
                if (!this.programadorInicializado) {
                    if (typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.init === 'function') {
                        if (cpp.currentClaseIdCuaderno) {
                            CppProgramadorApp.init(cpp.currentClaseIdCuaderno);
                            this.programadorInicializado = true;
                        } else {
                            $('#cpp-programador-app').html('<p class="cpp-mensaje-vacio">Por favor, selecciona una clase primero.</p>');
                        }
                    } else {
                        console.error("Error: CppProgramadorApp no está disponible.");
                        $('#cpp-programador-app').html('<p class="cpp-mensaje-vacio" style="color:red;">Error: No se pudo cargar el componente del programador.</p>');
                    }
                } else {
                    if (typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.loadClass === 'function') {
                        if (!CppProgramadorApp.currentClase || CppProgramadorApp.currentClase.id != cpp.currentClaseIdCuaderno) {
                            CppProgramadorApp.loadClass(cpp.currentClaseIdCuaderno);
                        }
                    }
                }
            } else if (tabName === 'configuracion' && cpp.currentClaseIdCuaderno) {
                if (cpp.config && typeof cpp.config.showParaEditar === 'function') {
                    cpp.config.showParaEditar(null, false, cpp.currentClaseIdCuaderno);
                }
            }
        },

        // --- REGISTRO DE EVENTOS ---
        bindEvents: function() {
            const $document = $(document);
            const self = this;

            // --- NUEVO: Listener para pestañas principales ---
            $document.on('click', '.cpp-main-tab-link', function(e) {
                e.preventDefault();
                self.handleMainTabSwitch($(this));
            });

            const $cuadernoContenido = $('#cpp-cuaderno-tabla-area');

            $document.on('click', '#cpp-btn-crear-primera-clase', function(e) { if (cpp.modals && cpp.modals.clase) cpp.modals.clase.showParaCrear(e); });
            $document.on('change', '.cpp-a1-evaluacion-selector > select', function(e) {
                const nuevaEvaluacionId = $(this).val();
                if (cpp.currentClaseIdCuaderno && nuevaEvaluacionId) {
                    const sortOrder = $('#cpp-a1-sort-students-btn').data('sort');
                    self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, null, nuevaEvaluacionId, sortOrder);
                }
            });
            $document.on('click', '#cpp-a1-sort-students-btn', function(e) {
                e.preventDefault();
                const $button = $(this);
                const newSort = ($button.data('sort') === 'apellidos') ? 'nombre' : 'apellidos';
                if (cpp.currentClaseIdCuaderno) { self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, null, cpp.currentEvaluacionId, newSort); }
            });

            // Eventos del cuaderno (existentes)
            $cuadernoContenido.on('click', '#cpp-final-grade-sort-btn', function(e) { self.handleFinalGradeSort.call(self, e); });
            $cuadernoContenido.on('click', '#cpp-final-grade-highlight-btn', function(e) { self.toggleHighlightFailed.call(self, e); });
            $cuadernoContenido.on('keydown', '.cpp-input-nota', function(e) { self.manejarNavegacionTablaNotas.call(this, e); });
            $cuadernoContenido.on('blur', '.cpp-input-nota', function(e) { self.guardarNotaDesdeInput.call(this, e, null); });
            $cuadernoContenido.on('focusin', '.cpp-input-nota', function(e){ self.limpiarErrorNotaInput(this); this.select(); if (typeof $(this).data('original-nota-set') === 'undefined' || !$(this).data('original-nota-set')) { $(this).data('original-nota', $(this).val().trim()); $(this).data('original-nota-set', true); } });
            $cuadernoContenido.on('mousedown', '.cpp-input-nota', function(e) { self.handleCellMouseDown.call(this, e); });
            $document.on('copy', function(e) { if ((document.activeElement && $(document.activeElement).closest('.cpp-cuaderno-tabla').length) || (self.currentSelectedInputs && self.currentSelectedInputs.length > 0)) { self.handleCopyCells(e); } });
            $document.on('paste', '.cpp-cuaderno-tabla .cpp-input-nota', function(e) { self.handlePasteCells.call(this, e); });
            $cuadernoContenido.on('click', 'td.cpp-cuaderno-td-alumno', function(e){ self.handleClickAlumnoCell.call(this, e); });
            $cuadernoContenido.on('click', 'th.cpp-cuaderno-th-final', function(e){ self.handleClickNotaFinalHeader.call(this, e); });
            $cuadernoContenido.on('click', '.cpp-cuaderno-th-actividad', function(e){ if (cpp.modals && cpp.modals.actividades) cpp.modals.actividades.cargarParaEditar(this, e); });

            // Eventos de los botones de la cabecera A1
            $document.on('click', '#cpp-a1-add-activity-btn', function(e) { e.stopPropagation(); if (cpp.modals && cpp.modals.actividades) cpp.modals.actividades.mostrarAnadir(); });
            $document.on('click', '#cpp-a1-import-students-btn', function(e){ if (cpp.modals && cpp.modals.excel) cpp.modals.excel.showImportStudents(e); });
            $document.on('click', '#cpp-a1-download-excel-btn', function(e){ if (cpp.modals && cpp.modals.excel) cpp.modals.excel.showDownloadOptions(e); });
            $document.on('click', '#cpp-a1-take-attendance-btn', function(e) { e.preventDefault(); e.stopPropagation(); if (cpp.modals && cpp.modals.asistencia && cpp.currentClaseIdCuaderno) { cpp.modals.asistencia.mostrar(cpp.currentClaseIdCuaderno); } });
            $document.on('click', '#cpp-a1-enter-direction-btn', function(e) { e.preventDefault(); e.stopPropagation(); self.enterKeyDirection = self.enterKeyDirection === 'down' ? 'right' : 'down'; self.updateEnterDirectionButton(); if (typeof localStorage !== 'undefined' && cppFrontendData && cppFrontendData.userId) { try { localStorage.setItem(self.localStorageKey_enterDirection + cppFrontendData.userId, self.enterKeyDirection); } catch (lsError) { console.warn("No se pudo guardar la preferencia de dirección de Enter en localStorage:", lsError); } } });

            // --- NUEVO: Listeners para eventos entre componentes ---
            $document.on('cpp:forceGradebookReload', function() {
                console.log('Event detected: cpp:forceGradebookReload. Reloading gradebook...');
                if (cpp.currentClaseIdCuaderno) {
                    self.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, null, cpp.currentEvaluacionId);
                }
            });

            $document.on('cpp:forceProgramadorReload', function() {
                console.log('Event detected: cpp:forceProgramadorReload. Reloading scheduler...');
                if (self.programadorInicializado && typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.refreshCurrentView === 'function') {
                    CppProgramadorApp.refreshCurrentView();
                }
            });
        }
    };

})(jQuery);