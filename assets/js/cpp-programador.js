// /assets/js/cpp-programador.js

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('cpp-programador-app')) {
        CppProgramadorApp.init();
    }
});

const CppProgramadorApp = {
    // --- Propiedades ---
    appElement: null, tabs: {}, tabContents: {}, sesionModal: {},
    clases: [], config: { time_slots: [], horario: {} }, sesiones: [],
    currentClase: null, currentEvaluacionId: null, currentSesion: null,
    originalContent: '', semanaDate: new Date(),

    // --- Inicialización ---
    init() {
        this.appElement = document.getElementById('cpp-programador-app');
        this.tabs = { programacion: this.appElement.querySelector('.cpp-tab-link[data-tab="programacion"]'), semana: this.appElement.querySelector('.cpp-tab-link[data-tab="semana"]'), horario: this.appElement.querySelector('.cpp-tab-link[data-tab="horario"]') };
        this.tabContents = { programacion: this.appElement.querySelector('#tab-programacion'), semana: this.appElement.querySelector('#tab-semana'), horario: this.appElement.querySelector('#tab-horario') };
        this.sesionModal = { element: document.querySelector('#cpp-sesion-modal'), form: document.querySelector('#cpp-sesion-form'), title: document.querySelector('#cpp-sesion-modal-title'), idInput: document.querySelector('#cpp-sesion-id'), claseIdInput: document.querySelector('#cpp-sesion-clase-id'), evaluacionIdInput: document.querySelector('#cpp-sesion-evaluacion-id'), tituloInput: document.querySelector('#cpp-sesion-titulo'), descripcionInput: document.querySelector('#cpp-sesion-descripcion') };
        this.attachEventListeners();
        this.fetchData();
    },

    attachEventListeners() {
        Object.values(this.tabs).forEach(tab => tab.addEventListener('click', e => this.switchTab(e.target.dataset.tab)));

        const horarioTab = this.tabContents.horario;
        horarioTab.addEventListener('change', e => { if (e.target.tagName === 'SELECT') this.saveHorario(true); });
        horarioTab.addEventListener('click', e => {
            if (e.target.id === 'cpp-horario-add-slot-btn') this.addTimeSlot();
            if (e.target.matches('.cpp-delete-slot-btn')) this.deleteTimeSlot(e.target.dataset.slot);
        });
        horarioTab.addEventListener('focusin', e => { if (e.target.matches('.cpp-horario-time-slot')) e.target.dataset.originalValue = e.target.textContent; });
        horarioTab.addEventListener('focusout', e => { if (e.target.matches('.cpp-horario-time-slot')) this.handleTimeSlotEdit(e.target); });
        horarioTab.addEventListener('keydown', e => { if (e.target.matches('.cpp-horario-time-slot')) { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } else if (e.key === 'Escape') { e.target.textContent = e.target.dataset.originalValue; e.target.blur(); } } });

        const programacionTab = this.tabContents.programacion;
        programacionTab.addEventListener('change', e => {
            if (e.target.id === 'cpp-programacion-clase-selector') this.selectClase(e.target.value);
            if (e.target.id === 'cpp-programacion-evaluacion-selector') { this.currentEvaluacionId = e.target.value; this.currentSesion = null; this.render(); }
            if (e.target.id === 'cpp-start-date-selector') this.saveStartDate(e.target.value);
        });
        programacionTab.addEventListener('click', e => {
            const sesionItem = e.target.closest('.cpp-sesion-list-item');
            if (sesionItem) { this.currentSesion = this.sesiones.find(s => s.id == sesionItem.dataset.sesionId); this.renderProgramacionTab(); }
            if (e.target.matches('.cpp-add-sesion-btn')) this.openSesionModal();
        });
        programacionTab.addEventListener('focusin', e => { if (e.target.matches('[contenteditable]')) this.originalContent = e.target.innerHTML; });
        programacionTab.addEventListener('focusout', e => { if (e.target.matches('[contenteditable]')) this.handleInlineEdit(e.target); });
        programacionTab.addEventListener('keydown', e => { if (e.target.matches('[contenteditable]')) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); } else if (e.key === 'Escape') { e.target.innerHTML = this.originalContent; e.target.blur(); } } });

        const semanaTab = this.tabContents.semana;
        semanaTab.addEventListener('click', e => {
            if (e.target.matches('.cpp-semana-prev-btn')) { this.semanaDate.setDate(this.semanaDate.getDate() - 7); this.renderSemanaTab(); }
            if (e.target.matches('.cpp-semana-next-btn')) { this.semanaDate.setDate(this.semanaDate.getDate() + 7); this.renderSemanaTab(); }
        });

        this.sesionModal.element.querySelector('.cpp-modal-close').addEventListener('click', () => this.closeSesionModal());
        this.sesionModal.form.addEventListener('submit', e => this.saveSesion(e, true));
    },

    // --- Lógica de la App ---
    handleInlineEdit(element) {
        const newContent = element.innerHTML;
        if (newContent === this.originalContent) return;
        const sesion = this.currentSesion;
        const field = element.dataset.field;
        if (!sesion || !field) return;
        this.saveSesion(null, { ...sesion, [field]: newContent });
    },
    selectClase(claseId) {
        this.currentClase = this.clases.find(c => c.id == claseId);
        if (!this.currentClase) return;
        this.currentEvaluacionId = this.currentClase.evaluaciones.length > 0 ? this.currentClase.evaluaciones[0].id : null;
        this.currentSesion = null;
        this.render();
    },
    switchTab(tabName) { Object.values(this.tabs).forEach(tab => tab.classList.remove('active')); Object.values(this.tabContents).forEach(content => content.classList.remove('active')); this.tabs[tabName].classList.add('active'); this.tabContents[tabName].classList.add('active'); },
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

    // --- Lógica de Datos (AJAX) ---
    fetchData() {
        const data = new URLSearchParams({ action: 'cpp_get_programador_all_data', nonce: cppFrontendData.nonce });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                this.clases = result.data.clases || [];
                this.config = result.data.config;
                this.sesiones = result.data.sesiones || [];
                if (!this.currentClase && this.clases.length > 0) this.selectClase(this.clases[0].id);
                else if (this.clases.length > 0) this.render();
                else this.tabContents.programacion.innerHTML = '<p>No tienes clases creadas.</p>';
            }
        });
    },
    saveHorario(showNotification = false) {
        const newHorario = {};
        this.appElement.querySelectorAll('#cpp-horario-table tbody tr').forEach(tr => {
            tr.querySelectorAll('td[data-day]').forEach(td => {
                const day = td.dataset.day, slot = td.dataset.slot, claseId = td.querySelector('select').value;
                if (claseId) { if (!newHorario[day]) newHorario[day] = {}; newHorario[day][slot] = claseId; }
            });
        });
        this.config.horario = newHorario;
        const data = new URLSearchParams({ action: 'cpp_save_programador_horario', nonce: cppFrontendData.nonce, horario: JSON.stringify(this.config.horario), time_slots: JSON.stringify(this.config.time_slots) });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                if (showNotification) alert('Horario guardado.');
                this.render();
            } else { alert('Error al guardar el horario.'); }
        });
    },
    saveSesion(e, fromModal = false) {
        if (e) e.preventDefault();
        let sesionData;
        if (fromModal) {
            sesionData = { id: this.sesionModal.idInput.value, clase_id: this.sesionModal.claseIdInput.value, evaluacion_id: this.sesionModal.evaluacionIdInput.value, titulo: this.sesionModal.tituloInput.value, descripcion: this.sesionModal.descripcionInput.value };
        } else {
            sesionData = arguments[1];
        }
        const data = new URLSearchParams({ action: 'cpp_save_programador_sesion', nonce: cppFrontendData.nonce, sesion: JSON.stringify(sesionData) });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                if (fromModal) this.closeSesionModal();
                this.fetchData();
            } else { alert('Error al guardar.'); this.fetchData(); }
        });
    },
    saveStartDate(startDate) {
        const data = new URLSearchParams({ action: 'cpp_save_start_date', nonce: cppFrontendData.nonce, evaluacion_id: this.currentEvaluacionId, start_date: startDate });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) this.fetchData();
            else alert('Error al guardar la fecha.');
        });
    },

    // --- Renderizado ---
    render() {
        if (!this.currentClase) return;
        this.renderProgramacionTab();
        this.renderSemanaTab();
        this.renderHorarioTab();
    },
    renderProgramacionTab() {
        const content = this.tabContents.programacion;
        let claseOptions = this.clases.map(c => `<option value="${c.id}" ${this.currentClase && c.id == this.currentClase.id ? 'selected' : ''}>${c.nombre}</option>`).join('');
        let evaluacionOptions = '', startDate = '';
        const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
        if (this.currentClase && this.currentClase.evaluaciones.length > 0) {
            evaluacionOptions = this.currentClase.evaluaciones.map(e => `<option value="${e.id}" ${e.id == this.currentEvaluacionId ? 'selected' : ''}>${e.nombre_evaluacion}</option>`).join('');
            if (currentEval) startDate = currentEval.start_date || '';
        }
        let controlsHTML = `<div class="cpp-programacion-controls"><label>Clase: <select id="cpp-programacion-clase-selector">${claseOptions}</select></label><label>Evaluación: <select id="cpp-programacion-evaluacion-selector" ${!evaluacionOptions ? 'disabled' : ''}>${evaluacionOptions || '<option>Sin evaluaciones</option>'}</select></label><label>Fecha de Inicio: <input type="date" id="cpp-start-date-selector" value="${startDate}" ${!this.currentEvaluacionId ? 'disabled' : ''}></label></div>`;
        let layoutHTML = `<div class="cpp-programacion-layout"><div class="cpp-programacion-left-col"><ul class="cpp-sesiones-list-detailed">${this.renderSesionList()}</ul><button class="cpp-add-sesion-btn cpp-btn cpp-btn-primary" ${!this.currentEvaluacionId ? 'disabled' : ''}>+ Añadir Sesión</button></div><div class="cpp-programacion-right-col" id="cpp-programacion-right-col">${this.renderProgramacionTabRightColumn()}</div></div>`;
        content.innerHTML = controlsHTML + layoutHTML;
    },
    renderSesionList() {
        const sesionesFiltradas = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
        if (sesionesFiltradas.length === 0) return '<li>No hay sesiones para esta evaluación.</li>';
        return sesionesFiltradas.map((s, index) => `<li class="cpp-sesion-list-item ${this.currentSesion && s.id == this.currentSesion.id ? 'active' : ''}" data-sesion-id="${s.id}"><span class="cpp-sesion-number">${index + 1}.</span><span class="cpp-sesion-title">${s.titulo}</span></li>`).join('');
    },
    renderProgramacionTabRightColumn() {
        if (!this.currentSesion) return '<p class="cpp-empty-panel">Selecciona una sesión para ver su contenido.</p>';
        return `<div class="cpp-sesion-detail-container" data-sesion-id="${this.currentSesion.id}"><h3 class="cpp-sesion-detail-title" data-field="titulo" contenteditable="true">${this.currentSesion.titulo}</h3><div class="cpp-sesion-detail-section"><h4>Descripción</h4><div class="cpp-sesion-detail-content" data-field="descripcion" contenteditable="true">${this.currentSesion.descripcion || ''}</div></div><div class="cpp-sesion-detail-section"><h4>Objetivos</h4><div class="cpp-sesion-detail-content" data-field="objetivos" contenteditable="true">${this.currentSesion.objetivos || ''}</div></div><div class="cpp-sesion-detail-section"><h4>Recursos</h4><div class="cpp-sesion-detail-content" data-field="recursos" contenteditable="true">${this.currentSesion.recursos || ''}</div></div><div class="cpp-sesion-detail-section"><h4>Actividades</h4><div class="cpp-sesion-detail-content" data-field="actividades" contenteditable="true">${this.currentSesion.actividades || ''}</div></div><div class="cpp-sesion-detail-section"><h4>Seguimiento</h4><div class="cpp-sesion-detail-content" data-field="seguimiento" contenteditable="true">${this.currentSesion.seguimiento || ''}</div></div></div>`;
    },
    renderHorarioTab() {
        const content = this.tabContents.horario;
        const days = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes' };
        let classOptions = '<option value="">-- Vacío --</option>' + this.clases.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        let tableHTML = `<div class="cpp-horario-actions"><button id="cpp-horario-add-slot-btn" class="cpp-btn cpp-btn-primary">+ Añadir Tramo</button></div><table id="cpp-horario-table" class="cpp-horario-table"><thead><tr><th>Hora</th>${Object.values(days).map(day => `<th>${day}</th>`).join('')}<th></th></tr></thead><tbody>`;
        (this.config.time_slots || []).forEach(slot => {
            tableHTML += `<tr><td class="cpp-horario-time-slot" contenteditable="true" data-original-value="${slot}">${slot}</td>`;
            Object.keys(days).forEach(dayKey => {
                const claseId = this.config.horario?.[dayKey]?.[slot] || '';
                tableHTML += `<td data-day="${dayKey}" data-slot="${slot}"><select data-clase-id="${claseId}">${classOptions}</select></td>`;
            });
            tableHTML += `<td><button class="cpp-delete-slot-btn" data-slot="${slot}">❌</button></td></tr>`;
        });
        tableHTML += `</tbody></table>`;
        content.innerHTML = tableHTML;
        this.appElement.querySelectorAll('#cpp-horario-table select').forEach(s => { s.value = s.dataset.claseId; });
    },
    renderSemanaTab() {
        const content = this.tabContents.semana;
        if (!this.currentClase || !this.currentEvaluacionId) { content.innerHTML = '<p class="cpp-empty-panel">Selecciona una clase y evaluación en la pestaña "Programación".</p>'; return; }
        const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
        if (!currentEval || !currentEval.start_date) { content.innerHTML = '<p class="cpp-empty-panel">Establece una fecha de inicio en "Programación".</p>'; return; }
        const sesiones = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
        if (sesiones.length === 0) { content.innerHTML = '<p class="cpp-empty-panel">No hay sesiones para programar.</p>'; return; }
        const horario = this.config.horario;
        let schedule = [];
        let currentDate = new Date(`${currentEval.start_date}T00:00:00Z`);
        let sessionIndex = 0;
        const dayMapping = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
        while(sessionIndex < sesiones.length && schedule.length < 500) {
            const dayOfWeek = currentDate.getUTCDay();
            const dayKey = dayMapping[dayOfWeek];
            if (dayKey && horario[dayKey]) {
                const sortedSlots = Object.keys(horario[dayKey]).sort();
                for (const slot of sortedSlots) {
                    if (sessionIndex < sesiones.length) {
                        schedule.push({ sesion: sesiones[sessionIndex], fecha: new Date(currentDate.getTime()), hora: slot });
                        sessionIndex++;
                    }
                }
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        const weekDates = this.getWeekDates(this.semanaDate);
        const days = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes' };
        let headerHTML = `<div class="cpp-semana-nav"><button class="cpp-semana-prev-btn cpp-btn">◄ Semana Anterior</button><h3>Semana del ${weekDates[0].toLocaleDateString('es-ES', {day:'numeric', month:'long'})}</h3><button class="cpp-semana-next-btn cpp-btn">Siguiente ►</button></div>`;
        let tableHTML = `${headerHTML}<table class="cpp-semana-table"><thead><tr><th>Hora</th>`;
        Object.keys(days).forEach((dayKey, i) => { tableHTML += `<th>${days[dayKey]}<br><small>${weekDates[i].toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit'})}</small></th>`; });
        tableHTML += `</tr></thead><tbody>`;
        (this.config.time_slots || []).forEach(slot => {
            tableHTML += `<tr><td>${slot}</td>`;
            Object.keys(days).forEach((dayKey, dayIndex) => {
                const ymd = weekDates[dayIndex].toISOString().slice(0, 10);
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
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        return Array.from({length: 5}, (v, i) => {
            const weekDay = new Date(monday.getTime());
            weekDay.setDate(monday.getDate() + i);
            return weekDay;
        });
    }
};
