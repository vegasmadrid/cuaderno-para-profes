// /assets/js/cpp-programador.js

(function($) {
    'use strict';
    let listenersAttached = false;

    // La inicialización ahora es controlada por cpp-cuaderno.js
    window.CppProgramadorApp = {
    // --- Propiedades ---
    appElement: null, tabs: {}, tabContents: {}, sesionModal: {}, configModal: {},
    clases: [], config: { time_slots: [], horario: {}, calendar_config: {} }, sesiones: [],
    currentClase: null, currentEvaluacionId: null, currentSesion: null,
    originalContent: '', semanaDate: new Date(),
    isProcessing: false,

    // --- Inicialización ---
    init(initialClaseId) {
        this.appElement = document.getElementById('cpp-programador-app');
        // Los selectores de pestañas y contenidos ahora son manejados por el cuaderno principal.
        // Solo necesitamos los contenedores de contenido para renderizar.
        this.tabContents = {
            programacion: document.getElementById('cpp-main-tab-programacion'),
            semana: document.getElementById('cpp-main-tab-semana'),
            horario: document.getElementById('cpp-main-tab-horario')
        };
        this.sesionModal = {
            element: document.querySelector('#cpp-sesion-modal'),
            form: document.querySelector('#cpp-sesion-form'),
            title: document.querySelector('#cpp-sesion-modal-title'),
            idInput: document.querySelector('#cpp-sesion-id'),
            claseIdInput: document.querySelector('#cpp-sesion-clase-id'),
            evaluacionIdInput: document.querySelector('#cpp-sesion-evaluacion-id'),
            tituloInput: document.querySelector('#cpp-sesion-titulo'),
            descripcionInput: document.querySelector('#cpp-sesion-descripcion')
        };
        this.configModal = {
            element: document.querySelector('#cpp-config-modal'),
            form: document.querySelector('#cpp-config-form')
        };
        this.attachEventListeners();
        this.fetchData(initialClaseId);
    },

    attachEventListeners() {
        if (listenersAttached) return;
        listenersAttached = true;
        const $document = $(document);
        const self = this;

        // --- Delegated events for robustness ---

        // Sesiones
        $document.on('click', '#cpp-programador-app .cpp-delete-sesion-btn', function(e) { e.stopPropagation(); self.deleteSesion(this.dataset.sesionId); });
        $document.on('click', '#cpp-programador-app .cpp-add-sesion-btn', () => self.openSesionModal());
        $document.on('click', '#cpp-programador-app .cpp-add-inline-sesion-btn', function() { self.addInlineSesion(this.dataset.afterSesionId); });
        $document.on('click', '#cpp-programador-app .cpp-sesion-list-item', function() {
            self.currentSesion = self.sesiones.find(s => s.id == this.dataset.sesionId);
            self.renderProgramacionTab();
        });

        // Actividades
        $document.on('click', '#cpp-add-actividad-no-evaluable-btn', function() { self.addNonEvaluableActividad(this.dataset.sesionId); });
        $document.on('click', '#cpp-add-actividad-evaluable-btn', function() { self.addEvaluableActividad(this.dataset.sesionId); });
        $document.on('click', '.cpp-edit-evaluable-btn', function() { self.editEvaluableActividad(this.dataset.actividadId); });
        $document.on('click', '#cpp-programador-app .cpp-delete-actividad-btn', function() { self.deleteActividad(this.dataset.actividadId, this.dataset.tipo); });
        $document.on('focusout', '#cpp-programador-app .cpp-actividad-titulo', function() { self.updateActividadTitle(this, this.dataset.actividadId); });


        // Horario
        $document.on('click', '#cpp-programador-app .cpp-delete-slot-btn', function() { self.deleteTimeSlot(this.dataset.slot); });
        $document.on('click', '#cpp-programador-app #cpp-horario-add-slot-btn', () => self.addTimeSlot());
        $document.on('change', '#cpp-programador-app #cpp-horario-table select', function() { self.updateHorarioCellColor(this); self.saveHorario(true); });
        $document.on('focusout', '#cpp-programador-app .cpp-horario-notas-input', function() { self.saveHorario(true); });
        $document.on('focusout', '#cpp-programador-app .cpp-horario-time-slot', function() { self.handleTimeSlotEdit(this); });

        // Navegación y Controles Generales
        $document.on('click', '#cpp-programador-app #cpp-horario-config-btn', function() {
            $('.cpp-main-tab-link[data-tab="configuracion"]').click();
            if (cpp.config && typeof cpp.config.handleConfigTabClick === 'function') {
                cpp.config.handleConfigTabClick(null, 'calendario');
            }
        });
        $document.on('click', '#cpp-programador-app .cpp-semana-prev-btn', () => { self.semanaDate.setDate(self.semanaDate.getDate() - 7); self.renderSemanaTab(); });
        $document.on('click', '#cpp-programador-app .cpp-semana-next-btn', () => { self.semanaDate.setDate(self.semanaDate.getDate() + 7); self.renderSemanaTab(); });
        $document.on('change', '#cpp-programador-app #cpp-programacion-evaluacion-selector', function() { self.currentEvaluacionId = this.value; self.currentSesion = null; self.render(); });
        $document.on('change', '#cpp-programador-app #cpp-start-date-selector', function() { self.saveStartDate(this.value); });

        // Edición Inline
        $document.on('focusin', '#cpp-programador-app [contenteditable]', function() { self.originalContent = this.innerHTML; });
        $document.on('focusout', '#cpp-programador-app [data-field]', function() { self.handleInlineEdit(this); });
        $document.on('keydown', '#cpp-programador-app [contenteditable]', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.blur(); }
            else if (e.key === 'Escape') { this.innerHTML = self.originalContent; this.blur(); }
        });

        // Modales
        this.sesionModal.element.querySelector('.cpp-modal-close').addEventListener('click', () => this.closeSesionModal());
        this.sesionModal.form.addEventListener('submit', e => this.saveSesion(e, true));
        $document.on('click', '#cpp-add-holiday-btn', () => this.addHoliday());
        $document.on('click', '.cpp-remove-holiday-btn', function() { self.removeHoliday(this.closest('.cpp-list-item').dataset.index); });
        $document.on('click', '#cpp-add-vacation-btn', () => this.addVacation());
        $document.on('click', '.cpp-remove-vacation-btn', function() { self.removeVacation(this.closest('.cpp-list-item').dataset.index); });
        $document.on('submit', '#cpp-config-form', e => this.saveConfig(e));
    },


    // --- Lógica de la App ---
    handleInlineEdit(element) {
        const newContent = element.innerHTML;
        if (newContent === this.originalContent) return;
        const sesion = this.currentSesion;
        const field = element.dataset.field;
        if (!sesion || !field) return;

        // Guardamos una copia sin las actividades para no enviar datos innecesarios
        const { actividades_programadas, ...sesionToSave } = sesion;

        this.saveSesion(null, false, { ...sesionToSave, [field]: newContent });
    },

    addInlineSesion(afterSesionId) {
        const newSession = {
            clase_id: this.currentClase.id,
            evaluacion_id: this.currentEvaluacionId,
            titulo: 'Nueva Sesión',
        };

        const data = new URLSearchParams({
            action: 'cpp_add_inline_sesion',
            nonce: cppFrontendData.nonce,
            sesion: JSON.stringify(newSession),
            after_sesion_id: afterSesionId
        });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    this.fetchData(this.currentClase.id);
                } else {
                    alert('Error al añadir la sesión en línea.');
                }
            });
    },
    loadClass(claseId) {
        this.currentClase = this.clases.find(c => c.id == claseId);
        if (!this.currentClase) {
            this.tabContents.programacion.innerHTML = `<p style="color:red;">Error: No se encontró la clase con ID ${claseId}.</p>`;
            return;
        }
        this.currentEvaluacionId = this.currentClase.evaluaciones.length > 0 ? this.currentClase.evaluaciones[0].id : null;
        this.currentSesion = null;
        this.render();
    },
    // La lógica de switchTab ahora es manejada por cpp-cuaderno.js
    addTimeSlot() {
        const newSlot = prompt('Nuevo tramo horario (ej: 13:00):', '13:00');
        if (newSlot && /^\d{2}:\d{2}$/.test(newSlot) && !this.config.time_slots.includes(newSlot)) {
            this.config.time_slots.push(newSlot);
            this.config.time_slots.sort();
            this.saveHorario(true);
        } else if (newSlot) { alert('Formato no válido o el tramo ya existe. Usa HH:MM.'); }
    },
    deleteTimeSlot(slotValue) {
        if (!confirm(`¿Seguro que quieres eliminar el tramo horario de las ${slotValue}?`)) return;
        this.config.time_slots = this.config.time_slots.filter(slot => slot !== slotValue);
        Object.keys(this.config.horario).forEach(day => { if (this.config.horario[day][slotValue]) delete this.config.horario[day][slotValue]; });
        this.saveHorario(true);
    },
    handleTimeSlotEdit(element) {
        const originalValue = element.dataset.originalValue;
        const newValue = element.textContent.trim();
        const index = this.config.time_slots.indexOf(originalValue);
        if (newValue === originalValue) return;
        if (!/^\d{2}:\d{2}$/.test(newValue) || this.config.time_slots.includes(newValue)) { alert('Formato no válido o el tramo ya existe.'); element.textContent = originalValue; return; }
        if (index > -1) {
            this.config.time_slots[index] = newValue;
            Object.keys(this.config.horario).forEach(day => {
                if (this.config.horario[day][originalValue]) { this.config.horario[day][newValue] = this.config.horario[day][originalValue]; delete this.config.horario[day][originalValue]; }
            });
            this.config.time_slots.sort();
            this.saveHorario(true);
        }
    },
    openSesionModal() {
        this.sesionModal.form.reset();
        this.sesionModal.claseIdInput.value = this.currentClase.id;
        this.sesionModal.evaluacionIdInput.value = this.currentEvaluacionId;
        this.sesionModal.title.textContent = 'Nueva Sesión';
        this.sesionModal.idInput.value = '';
        this.sesionModal.element.style.display = 'block';
    },
    closeSesionModal() { this.sesionModal.element.style.display = 'none'; },

    openConfigModal() {
        this.populateConfigModal();
        this.configModal.element.style.display = 'block';
    },
    closeConfigModal() {
        this.configModal.element.style.display = 'none';
    },

    addHoliday() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        const dateInput = document.getElementById('cpp-new-holiday-date');
        const date = dateInput.value;
        if (date && !this.config.calendar_config.holidays.includes(date)) {
            this.config.calendar_config.holidays.push(date);
            this.config.calendar_config.holidays.sort();
            this.renderHolidaysList();
            dateInput.value = '';
        } else {
            alert('Por favor, selecciona una fecha válida que no esté ya en la lista.');
        }
        this.isProcessing = false;
    },

    removeHoliday(index) {
        this.config.calendar_config.holidays.splice(index, 1);
        this.renderHolidaysList();
    },

    addVacation() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        const startInput = document.getElementById('cpp-new-vacation-start');
        const endInput = document.getElementById('cpp-new-vacation-end');
        const addButton = document.getElementById('cpp-add-vacation-btn');
        const start = startInput.value;
        const end = endInput.value;

        if (start && end && new Date(start) <= new Date(end)) {
            this.config.calendar_config.vacations.push({ start, end });
            this.renderVacationsList();
            startInput.value = '';
            endInput.value = '';
            if (addButton) {
                addButton.blur();
            }
        } else {
            alert('Por favor, selecciona un periodo de vacaciones válido.');
        }
        this.isProcessing = false;
    },

    removeVacation(index) {
        this.config.calendar_config.vacations.splice(index, 1);
        this.renderVacationsList();
    },

    // --- Lógica de Datos (AJAX) ---
    populateConfigModal: function() {
        const config = this.config.calendar_config;
        if (!config) return;
        const form = document.querySelector('#cpp-config-form');
        if (!form) return;

        form.querySelectorAll('input[name="working_days"]').forEach(checkbox => {
            if (config.working_days) {
                checkbox.checked = config.working_days.includes(checkbox.value);
            }
        });

        this.renderHolidaysList();
        this.renderVacationsList();
    },

    renderHolidaysList() {
        const list = document.getElementById('cpp-holidays-list');
        const holidays = this.config.calendar_config.holidays || [];
        list.innerHTML = holidays.map((holiday, index) => `
            <div class="cpp-list-item" data-index="${index}">
                <span>${holiday}</span>
                <button type="button" class="cpp-remove-btn cpp-remove-holiday-btn">&times;</button>
            </div>
        `).join('');
    },

    renderVacationsList() {
        const list = document.getElementById('cpp-vacations-list');
        const vacations = this.config.calendar_config.vacations || [];
        list.innerHTML = vacations.map((vac, index) => `
            <div class="cpp-list-item" data-index="${index}">
                <span>${vac.start} al ${vac.end}</span>
                <button type="button" class="cpp-remove-btn cpp-remove-vacation-btn">&times;</button>
            </div>
        `).join('');
    },

    saveConfig(e) {
        e.preventDefault();
        if (this.isProcessing) return;
        this.isProcessing = true;

        const form = e.target;
        const workingDays = Array.from(form.querySelectorAll('input[name="working_days"]:checked')).map(cb => cb.value);
        const newConfig = {
            working_days: workingDays,
            holidays: this.config.calendar_config.holidays,
            vacations: this.config.calendar_config.vacations
        };

        this.config.calendar_config = newConfig;

        const data = new URLSearchParams({
            action: 'cpp_save_programador_config',
            nonce: cppFrontendData.nonce,
            calendar_config: JSON.stringify(newConfig)
        });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    alert('Configuración guardada.');
                    this.closeConfigModal();
                    this.render();
                } else {
                    alert('Error al guardar la configuración.');
                }
            })
            .finally(() => {
                this.isProcessing = false;
            });
    },

    fetchDataFromServer() {
        const data = new URLSearchParams({ action: 'cpp_get_programador_all_data', nonce: cppFrontendData.nonce });
        return fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json());
    },

    processInitialData(result, initialClaseId) {
        if (result.success) {
            this.clases = result.data.clases || [];
            this.config = result.data.config || { time_slots: [], horario: {} };
            this.sesiones = result.data.sesiones || [];

            if (this.clases.length > 0) {
                if (initialClaseId) {
                    this.loadClass(initialClaseId);
                } else {
                    this.tabContents.programacion.innerHTML = '<p>No se ha seleccionado ninguna clase.</p>';
                }
            } else {
                this.tabContents.programacion.innerHTML = '<p>No tienes clases creadas. Por favor, ve al Cuaderno y crea al menos una clase.</p>';
            }
        } else {
            this.tabContents.programacion.innerHTML = '<p style="color:red;">Error al cargar los datos del programador.</p>';
        }
    },

    fetchData(initialClaseId) {
        this.fetchDataFromServer().then(result => {
            this.processInitialData(result, initialClaseId);
        });
    },

    saveActividadesOrder(sesionId, newOrder) {
        const data = new URLSearchParams({
            action: 'cpp_save_programador_actividades_order',
            nonce: cppFrontendData.nonce,
            sesion_id: sesionId,
            orden: JSON.stringify(newOrder)
        });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    this.showNotification('Orden de actividades guardado.');
                    // No es necesario un fetch completo, solo reordenar localmente si se quisiera optimizar
                    this.fetchData(this.currentClase.id);
                } else {
                    this.showNotification('Error al guardar el orden de las actividades.', 'error');
                    this.fetchData(this.currentClase.id);
                }
            });
    },
    saveHorario(showNotification = false) {
        const newHorario = {};
        this.appElement.querySelectorAll('#cpp-horario-table tbody tr').forEach(tr => {
            tr.querySelectorAll('td[data-day]').forEach(td => {
                const day = td.dataset.day;
                const slot = td.dataset.slot;
                const claseId = td.querySelector('.cpp-horario-clase-selector').value;
                const notas = td.querySelector('.cpp-horario-notas-input').value;

                if (claseId || notas.trim() !== '') {
                    if (!newHorario[day]) {
                        newHorario[day] = {};
                    }
                    newHorario[day][slot] = {
                        claseId: claseId,
                        notas: notas.trim()
                    };
                }
            });
        });
        this.config.horario = newHorario;
        const data = new URLSearchParams({ action: 'cpp_save_programador_horario', nonce: cppFrontendData.nonce, horario: JSON.stringify(this.config.horario), time_slots: JSON.stringify(this.config.time_slots) });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                if (showNotification) this.showNotification('Horario guardado.');
                this.render();
            } else { this.showNotification('Error al guardar el horario.', 'error'); }
        });
    },
    saveSesion(e, fromModal = false, inlineData = null) {
        if (e) e.preventDefault();
        if (this.isProcessing) return;
        this.isProcessing = true;

        let sesionData;
        const $btn = this.sesionModal.form.querySelector('button[type="submit"]');
        const originalBtnHtml = $btn ? $btn.innerHTML : '';
        if ($btn) {
            $btn.disabled = true;
            $btn.innerHTML = '<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...';
        }

        if (fromModal) {
            sesionData = { id: this.sesionModal.idInput.value, clase_id: this.sesionModal.claseIdInput.value, evaluacion_id: this.sesionModal.evaluacionIdInput.value, titulo: this.sesionModal.tituloInput.value, descripcion: this.sesionModal.descripcionInput.value };
        } else {
            sesionData = inlineData;
        }

        const data = new URLSearchParams({ action: 'cpp_save_programador_sesion', nonce: cppFrontendData.nonce, sesion: JSON.stringify(sesionData) });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    if (fromModal) this.closeSesionModal();
                    this.fetchData(this.currentClase.id);
                } else {
                    alert('Error al guardar.');
                    this.fetchData(this.currentClase.id);
                }
            })
            .finally(() => {
                this.isProcessing = false;
                if ($btn) {
                    $btn.disabled = false;
                    $btn.innerHTML = originalBtnHtml;
                }
            });
    },
    saveStartDate(startDate) {
        if (!this.currentEvaluacionId) return;
        const date = new Date(`${startDate}T12:00:00`);
        const dayOfWeek = date.getUTCDay();
        const dayMapping = {0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'};
        const dayKey = dayMapping[dayOfWeek];

        const isWorkingDay = this.config.calendar_config.working_days.includes(dayKey);
        const classIdInHorario = Object.values(this.config.horario[dayKey] || {}).some(slot => slot.claseId === String(this.currentClase.id));

        if (startDate && (!isWorkingDay || !classIdInHorario)) {
            alert('La fecha de inicio debe ser un día lectivo en el que esta clase tenga horas asignadas en el horario.');
            const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
            this.appElement.querySelector('#cpp-start-date-selector').value = currentEval ? currentEval.start_date || '' : '';
            return;
        }
        const data = new URLSearchParams({ action: 'cpp_save_start_date', nonce: cppFrontendData.nonce, evaluacion_id: this.currentEvaluacionId, start_date: startDate });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
                if (currentEval) currentEval.start_date = startDate;
                this.render();
            } else { alert('Error al guardar la fecha.'); }
        });
    },
    deleteSesion(sesionId) {
        if (!confirm('¿Seguro que quieres eliminar esta sesión?')) return;
        if (this.isProcessing) return;
        this.isProcessing = true;

        const data = new URLSearchParams({ action: 'cpp_delete_programador_sesion', nonce: cppFrontendData.nonce, sesion_id: sesionId });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    if (this.currentSesion && this.currentSesion.id == sesionId) this.currentSesion = null;
                    this.fetchData(this.currentClase.id);
                }
                else { alert('Error al eliminar la sesión.'); }
            })
            .finally(() => {
                this.isProcessing = false;
            });
    },
    saveSesionOrder(newOrder) {
        const data = new URLSearchParams({ action: 'cpp_save_sesiones_order', nonce: cppFrontendData.nonce, clase_id: this.currentClase.id, evaluacion_id: this.currentEvaluacionId, orden: JSON.stringify(newOrder) });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                this.fetchData(this.currentClase.id);
            } else {
                alert('Error al guardar el orden.');
                this.fetchData(this.currentClase.id);
            }
        });
    },

    // --- Renderizado y UI ---
    makeSesionesSortable() {
        const list = this.appElement.querySelector('.cpp-sesiones-list-detailed');
        if (list) {
            $(list).sortable({
                handle: '.cpp-sesion-handle',
                placeholder: 'cpp-sesion-placeholder',
                update: (event, ui) => {
                    const newOrder = $(event.target).sortable('toArray', { attribute: 'data-sesion-id' });
                    this.saveSesionOrder(newOrder);
                }
            }).disableSelection();
        }
    },
    makeActividadesSortable() {
        const list = this.appElement.querySelector('.cpp-actividades-list');
        if (list) {
            $(list).sortable({
                placeholder: 'cpp-actividad-placeholder',
                update: (event, ui) => {
                    const newOrder = $(event.target).sortable('toArray', { attribute: 'data-actividad-id' });
                    this.saveActividadesOrder(this.currentSesion.id, newOrder);
                }
            }).disableSelection();
        }
    },
    render() {
        if (!this.currentClase) { this.tabContents.programacion.innerHTML = '<p class="cpp-empty-panel">Cargando...</p>'; return; }
        this.renderProgramacionTab();
        this.renderSemanaTab();
        this.renderHorarioTab();
    },
    renderProgramacionTab() {
        if (!this.tabContents.programacion) return;
        const content = this.tabContents.programacion;
        if (!this.currentClase) {
            content.innerHTML = '<p>Selecciona una clase para ver la programación.</p>';
            return;
        }
        let evaluacionOptions = '', startDate = '';
        const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
        if (this.currentClase.evaluaciones.length > 0) {
            evaluacionOptions = this.currentClase.evaluaciones.map(e => `<option value="${e.id}" ${e.id == this.currentEvaluacionId ? 'selected' : ''}>${e.nombre_evaluacion}</option>`).join('');
            if (currentEval) startDate = currentEval.start_date || '';
        }

        const sesionesFiltradas = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);

        let controlsHTML = `<div class="cpp-programacion-controls"><label>Evaluación: <select id="cpp-programacion-evaluacion-selector" ${!evaluacionOptions ? 'disabled' : ''}>${evaluacionOptions || '<option>Sin evaluaciones</option>'}</select></label><label>Fecha de Inicio: <input type="date" id="cpp-start-date-selector" value="${startDate}" ${!this.currentEvaluacionId ? 'disabled' : ''}></label></div>`;
        let layoutHTML;

        if (sesionesFiltradas.length === 0) {
            layoutHTML = `
                <div class="cpp-no-alumnos-container cpp-no-sesiones-container">
                    <div class="cpp-no-alumnos-emoji">📅</div>
                    <h3 class="cpp-no-alumnos-titulo">Planifica tu curso</h3>
                    <p class="cpp-no-alumnos-texto">Aún no has añadido ninguna sesión a esta evaluación. Crea tu primera sesión para empezar a organizar tus clases.</p>
                    <div class="cpp-no-alumnos-actions">
                        <button class="cpp-btn cpp-btn-primary cpp-add-sesion-btn" ${!this.currentEvaluacionId ? 'disabled' : ''}>
                            <span class="dashicons dashicons-plus"></span> Añadir primera sesión
                        </button>
                    </div>
                </div>
            `;
        } else {
            layoutHTML = `<div class="cpp-programacion-layout"><div class="cpp-programacion-left-col"><ul class="cpp-sesiones-list-detailed">${this.renderSesionList()}</ul></div><div class="cpp-programacion-right-col" id="cpp-programacion-right-col">${this.renderProgramacionTabRightColumn()}</div></div>`;
        }

        content.innerHTML = controlsHTML + layoutHTML;
        if (sesionesFiltradas.length > 0) {
            this.makeSesionesSortable();
        }
        if (this.currentSesion) {
            this.makeActividadesSortable();
        }
    },
    renderSesionList() {
        const sesionesFiltradas = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
        if (sesionesFiltradas.length === 0) return ''; // Ya no se maneja aquí

        const addIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 11h-3v3h-2v-3H8v-2h3V8h2v3h3v2z"/></svg>';
        const deleteIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>';

        return sesionesFiltradas.map((s, index) => `
            <li class="cpp-sesion-list-item ${this.currentSesion && s.id == this.currentSesion.id ? 'active' : ''}" data-sesion-id="${s.id}">
                <span class="cpp-sesion-handle">⠿</span>
                <span class="cpp-sesion-number">${index + 1}.</span>
                <span class="cpp-sesion-title">${s.titulo}</span>
                <div class="cpp-sesion-actions">
                    <button class="cpp-sesion-action-btn cpp-add-inline-sesion-btn" data-after-sesion-id="${s.id}" title="Añadir sesión debajo">${addIconSVG}</button>
                    <button class="cpp-sesion-action-btn cpp-delete-sesion-btn" data-sesion-id="${s.id}" title="Eliminar sesión">${deleteIconSVG}</button>
                </div>
            </li>`).join('');
    },
    renderProgramacionTabRightColumn() {
        if (!this.currentSesion) return '<p class="cpp-empty-panel">Selecciona una sesión para ver su contenido.</p>';
        return `<div class="cpp-sesion-detail-container" data-sesion-id="${this.currentSesion.id}">
                    <h3 class="cpp-sesion-detail-title" data-field="titulo" contenteditable="true">${this.currentSesion.titulo}</h3>
                    <div class="cpp-sesion-detail-section"><h4>Descripción</h4><div class="cpp-sesion-detail-content" data-field="descripcion" contenteditable="true">${this.currentSesion.descripcion || ''}</div></div>
                    <div class="cpp-sesion-detail-section"><h4>Objetivos</h4><div class="cpp-sesion-detail-content" data-field="objetivos" contenteditable="true">${this.currentSesion.objetivos || ''}</div></div>
                    <div class="cpp-sesion-detail-section"><h4>Recursos</h4><div class="cpp-sesion-detail-content" data-field="recursos" contenteditable="true">${this.currentSesion.recursos || ''}</div></div>
                    ${this.renderActividadesSection(this.currentSesion)}
                    <div class="cpp-sesion-detail-section"><h4>Seguimiento</h4><div class="cpp-sesion-detail-content" data-field="seguimiento" contenteditable="true">${this.currentSesion.seguimiento || ''}</div></div>
                </div>`;
    },

    renderActividadesSection(sesion) {
        const actividades = sesion.actividades_programadas || [];
        let listItems = actividades.map(act => this.renderActividadItem(act)).join('');
        return `
            <div class="cpp-sesion-detail-section">
                <h4>Actividades</h4>
                <ul class="cpp-actividades-list">${listItems}</ul>
                <div class="cpp-add-activity-buttons-container">
                    <button id="cpp-add-actividad-no-evaluable-btn" class="cpp-btn" data-sesion-id="${sesion.id}">+ Añadir Tarea/Actividad no evaluable</button>
                    <button id="cpp-add-actividad-evaluable-btn" class="cpp-btn cpp-btn-primary" data-sesion-id="${sesion.id}">+ Añadir Actividad Evaluable</button>
                </div>
            </div>
        `;
    },

    renderActividadItem(actividad) {
        const isEvaluable = actividad.tipo === 'evaluable';
        const deleteIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>';
        const editIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>';

        let actionsHTML = '';
        if (isEvaluable) {
            actionsHTML = `<button class="cpp-edit-evaluable-btn" data-actividad-id="${actividad.id}" title="Editar en Cuaderno">${editIconSVG}</button>`;
        }

        actionsHTML += `<button class="cpp-delete-actividad-btn" data-actividad-id="${actividad.id}" data-tipo="${actividad.tipo}" title="Eliminar">
                            ${deleteIconSVG}
                        </button>`;

        return `
            <li class="cpp-actividad-item ${isEvaluable ? 'evaluable' : 'no-evaluable'}" data-actividad-id="${actividad.id}" data-tipo="${actividad.tipo}">
                <span class="cpp-actividad-handle">⠿</span>
                <span class="cpp-actividad-titulo" contenteditable="true" data-actividad-id="${actividad.id}">${actividad.titulo}</span>
                <div class="cpp-actividad-actions">
                    ${actionsHTML}
                </div>
            </li>
        `;
    },

    addNonEvaluableActividad(sesionId) {
        const newActividad = {
            sesion_id: sesionId,
            titulo: 'Nueva tarea...',
        };
        const data = new URLSearchParams({
            action: 'cpp_save_programador_actividad',
            nonce: cppFrontendData.nonce,
            actividad: JSON.stringify(newActividad)
        });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    this.refreshCurrentView();
                } else {
                    this.showNotification('Error al añadir la tarea.', 'error');
                }
            });
    },

    addEvaluableActividad(sesionId) {
        const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
        if (!currentEval) {
            this.showNotification('No se puede añadir una actividad evaluable sin una evaluación seleccionada.', 'error');
            return;
        }

        if (cpp.modals && cpp.modals.actividades && typeof cpp.modals.actividades.mostrarAnadir === 'function') {
            cpp.modals.actividades.mostrarAnadir(sesionId);
        } else {
            this.showNotification('Error: El módulo de modales no está disponible.', 'error');
        }
    },

    editEvaluableActividad(actividadId) {
        const data = new URLSearchParams({
            action: 'cpp_get_evaluable_activity_data',
            nonce: cppFrontendData.nonce,
            actividad_id: actividadId
        });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    if (cpp.modals && cpp.modals.actividades && typeof cpp.modals.actividades.cargarConDatos === 'function') {
                        cpp.modals.actividades.cargarConDatos(result.data);
                    } else {
                        this.showNotification('Error: El módulo de modales no está disponible.', 'error');
                    }
                } else {
                    this.showNotification(result.data.message || 'Error al cargar los datos de la actividad.', 'error');
                }
            });
    },

    deleteActividad(actividadId, tipo) {
        let confirmMessage = '¿Seguro que quieres eliminar esta actividad?';
        let action = '';

        if (tipo === 'evaluable') {
            confirmMessage = 'Esta acción eliminará la actividad del Cuaderno y de la Programación, junto con todas las notas asociadas. ¿Estás seguro?';
            action = 'cpp_eliminar_actividad';
        } else {
            action = 'cpp_delete_programador_actividad';
        }

        if (!confirm(confirmMessage)) return;

        const data = new URLSearchParams({
            action: action,
            nonce: cppFrontendData.nonce,
            actividad_id: actividadId
        });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    this.showNotification('Actividad eliminada.');
                    this.refreshCurrentView();
                    if (tipo === 'evaluable') {
                        document.dispatchEvent(new CustomEvent('cpp:forceGradebookReload'));
                    }
                } else {
                    this.showNotification(result.data.message || 'Error al eliminar la actividad.', 'error');
                }
            });
    },

    updateActividadTitle(element, actividadId) {
        const newTitle = element.textContent.trim();
        const actividad = this.currentSesion.actividades_programadas.find(a => a.id == actividadId);
        if (!actividad || newTitle === actividad.titulo) return;

        const updatedActividad = { ...actividad, titulo: newTitle };
        const data = new URLSearchParams({
            action: 'cpp_save_programador_actividad',
            nonce: cppFrontendData.nonce,
            actividad: JSON.stringify(updatedActividad)
        });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    actividad.titulo = newTitle;
                    this.showNotification('Título guardado.');
                    if (result.data.needs_gradebook_reload) {
                        document.dispatchEvent(new CustomEvent('cpp:forceGradebookReload'));
                    }
                } else {
                    this.showNotification('Error al guardar.', 'error');
                    element.textContent = actividad.titulo;
                }
            });
    },

    refreshCurrentView() {
        const currentSesionId = this.currentSesion ? this.currentSesion.id : null;
        this.fetchDataFromServer().then(result => {
            if (result.success) {
                console.log("DEBUG: Datos recibidos en refresh", result.data);
                this.clases = result.data.clases || [];
                this.config = result.data.config || { time_slots: [], horario: {} };
                this.sesiones = result.data.sesiones || [];

                if (currentSesionId) {
                    this.currentSesion = this.sesiones.find(s => s.id == currentSesionId) || null;
                }
                this.render();
            } else {
                this.showNotification('Error al refrescar los datos.', 'error');
            }
        });
    },

    updateActividadCategoria(selector, actividadId) {
        const newCategoriaId = selector.value;
        const actividad = this.currentSesion.actividades_programadas.find(a => a.id == actividadId);
        if (!actividad || newCategoriaId == actividad.categoria_id) return;

        const data = new URLSearchParams({
            action: 'cpp_toggle_actividad_evaluable',
            nonce: cppFrontendData.nonce,
            actividad_id: actividadId,
            es_evaluable: 1,
            categoria_id: newCategoriaId
        });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    actividad.categoria_id = newCategoriaId;
                    this.showNotification('Categoría actualizada.');
                } else {
                    this.showNotification('Error al actualizar categoría.', 'error');
                    selector.value = actividad.categoria_id;
                }
            });
    },

    renderHorarioTab() {
        if (!this.tabContents.horario) return;
        const content = this.tabContents.horario;
        const allDays = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo' };
        const workingDays = (this.config.calendar_config && this.config.calendar_config.working_days) ? this.config.calendar_config.working_days : ['mon', 'tue', 'wed', 'thu', 'fri'];
        const daysToRender = workingDays.reduce((acc, dayKey) => {
            if (allDays[dayKey]) {
                acc[dayKey] = allDays[dayKey];
            }
            return acc;
        }, {});

        let classOptions = '<option value="">-- Vacío --</option>' + this.clases.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        const addButtonHTML = '<button id="cpp-horario-add-slot-btn" class="cpp-btn cpp-btn-primary" title="Añadir nuevo tramo horario">+ Añadir Tramo</button>';
        const configButtonHTML = '<button id="cpp-horario-config-btn" class="cpp-btn cpp-btn-secondary" title="Configurar calendario">Configurar</button>';

        let tableHTML = `<table id="cpp-horario-table" class="cpp-horario-table"><thead><tr class="cpp-horario-header-row"><th class="cpp-horario-a1-cell">${addButtonHTML}</th>${Object.values(daysToRender).map(day => `<th>${day}</th>`).join('')}<th>${configButtonHTML}</th></tr></thead><tbody>`;

        (this.config.time_slots || []).forEach(slot => {
            tableHTML += `<tr><td class="cpp-horario-time-slot" contenteditable="true" data-original-value="${slot}">${slot}</td>`;
            Object.keys(daysToRender).forEach(dayKey => {
                const cellData = this.config.horario?.[dayKey]?.[slot] || {};
                const claseId = cellData.claseId || '';
                const notas = cellData.notas || '';

                tableHTML += `<td data-day="${dayKey}" data-slot="${slot}">
                                <select class="cpp-horario-clase-selector" data-clase-id="${claseId}">${classOptions}</select>
                                <textarea class="cpp-horario-notas-input" placeholder="Notas...">${notas}</textarea>
                              </td>`;
            });
            tableHTML += `<td><button class="cpp-delete-slot-btn" data-slot="${slot}">❌</button></td></tr>`;
        });
        tableHTML += `</tbody></table>`;
        content.innerHTML = tableHTML;
        this.appElement.querySelectorAll('#cpp-horario-table select').forEach(s => {
            s.value = s.dataset.claseId;
            this.updateHorarioCellColor(s);
        });
    },

    updateHorarioCellColor(selectElement) {
        const claseId = selectElement.value;
        const cell = selectElement.closest('td');
        if (!cell) return;

        if (claseId) {
            const clase = this.clases.find(c => c.id == claseId);
            if (clase && clase.color) {
                cell.style.backgroundColor = clase.color;
            } else {
                cell.style.backgroundColor = ''; // Color por defecto si no se encuentra
            }
        } else {
            cell.style.backgroundColor = ''; // Sin color si no hay clase seleccionada
        }
    },

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `cpp-notification ${type}`;
        notification.textContent = message;
        this.appElement.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 3000);
    },

    renderSemanaTab() {
        const content = this.tabContents.semana;
        if (!this.currentClase || !this.currentEvaluacionId) { content.innerHTML = '<p class="cpp-empty-panel">Selecciona una clase y evaluación.</p>'; return; }
        const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
        if (!currentEval || !currentEval.start_date) { content.innerHTML = '<p class="cpp-empty-panel">Establece una fecha de inicio en "Programación".</p>'; return; }

        const sesiones = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
        if (sesiones.length === 0) { content.innerHTML = '<p class="cpp-empty-panel">No hay sesiones para programar.</p>'; return; }

        const horario = this.config.horario;

        // ** FIX: Pre-check to prevent infinite loop **
        let classHasSlots = false;
        for (const day in horario) {
            if (Object.values(horario[day]).some(slot => slot.claseId === String(this.currentClase.id))) {
                classHasSlots = true;
                break;
            }
        }
        if (!classHasSlots) {
            content.innerHTML = '<p class="cpp-empty-panel">Esta clase no tiene horas asignadas en el horario. Ve a la pestaña "Horario" para añadirlas.</p>';
            return;
        }

        let schedule = [];
        let currentDate = new Date(`${currentEval.start_date}T12:00:00Z`);

        // FIX: Prevent infinite loop if start_date is invalid
        if (isNaN(currentDate.getTime())) {
            content.innerHTML = '<p class="cpp-empty-panel" style="color: red;">Error: La fecha de inicio de la evaluación no es válida. Por favor, corrígela en la pestaña "Programación".</p>';
            return;
        }

        let sessionIndex = 0;
        const calendarConfig = this.config.calendar_config || { working_days: ['mon', 'tue', 'wed', 'thu', 'fri'], holidays: [], vacations: [] };
        const dayMapping = {0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'};

        let safetyCounter = 0;
        const MAX_ITERATIONS = 50000;

        while(sessionIndex < sesiones.length) {
            if (++safetyCounter > MAX_ITERATIONS) {
                console.error("Scheduler safety break triggered. Check for logic errors.");
                content.innerHTML = '<p class="cpp-empty-panel" style="color: red;">Error: Se ha producido un error inesperado al generar el calendario. Revisa la configuración del horario y las fechas.</p>';
                break;
            }

            const dayOfWeek = currentDate.getUTCDay();
            const dayKey = dayMapping[dayOfWeek];
            const ymd = currentDate.toISOString().slice(0, 10);

            const isWorkingDay = calendarConfig.working_days.includes(dayKey);
            const isHoliday = calendarConfig.holidays.includes(ymd);
            const isVacation = calendarConfig.vacations.some(v => ymd >= v.start && ymd <= v.end);

            if (isWorkingDay && !isHoliday && !isVacation && dayKey && horario[dayKey]) {
                const sortedSlots = Object.keys(horario[dayKey]).sort();
                for (const slot of sortedSlots) {
                    if (sessionIndex < sesiones.length && String(horario[dayKey][slot].claseId) === String(this.currentClase.id)) {
                        schedule.push({ sesion: sesiones[sessionIndex], fecha: new Date(currentDate.getTime()), hora: slot });
                        sessionIndex++;
                    }
                }
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }

        const weekDates = this.getWeekDates(this.semanaDate);
        const allDays = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo' };
        const daysToRender = calendarConfig.working_days.reduce((acc, dayKey) => {
            if (allDays[dayKey]) {
                acc[dayKey] = allDays[dayKey];
            }
            return acc;
        }, {});

        let headerHTML = `<div class="cpp-semana-nav"><button class="cpp-semana-prev-btn cpp-btn">◄ Semana Anterior</button><h3>Semana del ${weekDates[0].toLocaleDateString('es-ES', {day:'numeric', month:'long'})}</h3><button class="cpp-semana-next-btn cpp-btn">Siguiente ►</button></div>`;
        let tableHTML = `${headerHTML}<table class="cpp-semana-table"><thead><tr class="cpp-semana-header-row"><th class="cpp-semana-th-hora">Hora</th>`;

        const renderedHeaders = [];
        Object.keys(daysToRender).forEach((dayKey) => {
            const date = weekDates.find(d => this.getDayKey(d) === dayKey);
            if(date) {
                tableHTML += `<th class="cpp-semana-th-dia">${daysToRender[dayKey]}<br><small>${date.toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit'})}</small></th>`;
                renderedHeaders.push(dayKey);
            }
        });
        tableHTML += `</tr></thead><tbody>`;

        (this.config.time_slots || []).forEach(slot => {
            tableHTML += `<tr><td class="cpp-semana-td-hora">${slot}</td>`;
            renderedHeaders.forEach(dayKey => {
                const date = weekDates.find(d => this.getDayKey(d) === dayKey);
                const ymd = date.toISOString().slice(0, 10);
                const evento = schedule.find(e => e.fecha.toISOString().slice(0,10) === ymd && e.hora === slot);
                let cellContent = '';
                if (evento) {
                    const clase = this.clases.find(c => c.id == evento.sesion.clase_id);
                    if (clase) cellContent = `<div class="cpp-semana-slot" style="border-left-color: ${clase.color};"><strong>${clase.nombre}</strong><p>${evento.sesion.titulo}</p></div>`;
                }
                tableHTML += `<td>${cellContent}</td>`;
            });
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table>`;
        content.innerHTML = tableHTML;
    },
    getWeekDates(d) {
        const date = new Date(d.getTime());
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Asume que la semana empieza en Lunes
        const monday = new Date(date.setDate(diff));
        return Array.from({length: 7}, (v, i) => { const weekDay = new Date(monday.getTime()); weekDay.setDate(monday.getDate() + i); return weekDay; });
    },
    getDayKey(date) {
        const dayMapping = {0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'};
        return dayMapping[date.getDay()];
    }
    };
})(jQuery);
