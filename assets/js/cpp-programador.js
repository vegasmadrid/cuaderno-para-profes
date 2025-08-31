// /assets/js/cpp-programador.js

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('cpp-programador-app')) { CppProgramadorApp.init(); }
});

const CppProgramadorApp = {
    // --- Propiedades ---
    appElement: null, tabs: {}, tabContents: {}, sesionModal: {},
    clases: [], config: { time_slots: [], horario: {} }, sesiones: [],
    currentClase: null, currentEvaluacionId: null, currentSesion: null, originalContent: '',

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
        horarioTab.addEventListener('change', e => { if (e.target.tagName === 'SELECT') this.saveHorario(); });
        horarioTab.addEventListener('click', e => {
            if (e.target.id === 'cpp-horario-add-slot-btn') this.addTimeSlot();
            if (e.target.matches('.cpp-delete-slot-btn')) this.deleteTimeSlot(e.target.dataset.slot);
        });
        horarioTab.addEventListener('focusout', e => { if (e.target.matches('.cpp-horario-time-slot')) this.handleTimeSlotEdit(e.target); });
        horarioTab.addEventListener('keydown', e => { if (e.target.matches('.cpp-horario-time-slot')) { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } else if (e.key === 'Escape') { e.target.textContent = e.target.dataset.originalValue; e.target.blur(); } } });

        const programacionTab = this.tabContents.programacion;
        programacionTab.addEventListener('change', e => {
            if (e.target.id === 'cpp-programacion-clase-selector') this.selectClase(e.target.value);
            if (e.target.id === 'cpp-programacion-evaluacion-selector') { this.currentEvaluacionId = e.target.value; this.currentSesion = null; this.renderProgramacionTab(); }
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

        this.sesionModal.element.querySelector('.cpp-modal-close').addEventListener('click', () => this.closeSesionModal());
        this.sesionModal.form.addEventListener('submit', e => this.saveSesion(e, true));
    },

    handleInlineEdit(element) {
        const newContent = element.innerHTML;
        if (newContent === this.originalContent) return;
        const sesion = this.currentSesion;
        const field = element.dataset.field;
        if (!sesion || !field) return;
        const sesionData = { ...sesion, [field]: newContent };
        this.saveSesion(null, sesionData);
    },

    selectClase(claseId) {
        this.currentClase = this.clases.find(c => c.id == claseId);
        if (!this.currentClase) return;
        this.currentEvaluacionId = this.currentClase.evaluaciones.length > 0 ? this.currentClase.evaluaciones[0].id : null;
        this.currentSesion = null;
        this.render();
    },

    switchTab(tabName) { Object.values(this.tabs).forEach(tab => tab.classList.remove('active')); Object.values(this.tabContents).forEach(content => content.classList.remove('active')); this.tabs[tabName].classList.add('active'); this.tabContents[tabName].classList.add('active'); },

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
            if (result.success) { this.fetchData(); } else { alert('Error al guardar la fecha.'); }
        });
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
        let html = `<div class="cpp-programacion-layout"><div class="cpp-programacion-left-col"><div class="cpp-programacion-controls"><label>Clase:</label><select id="cpp-programacion-clase-selector">${claseOptions}</select><label>Evaluación:</label><select id="cpp-programacion-evaluacion-selector" ${!evaluacionOptions ? 'disabled' : ''}>${evaluacionOptions || '<option>Sin evaluaciones</option>'}</select><label>Fecha de Inicio:</label><input type="date" id="cpp-start-date-selector" value="${startDate}" ${!this.currentEvaluacionId ? 'disabled' : ''}><button class="cpp-add-sesion-btn cpp-btn cpp-btn-primary" ${!this.currentEvaluacionId ? 'disabled' : ''}>+ Añadir Sesión</button></div><ul class="cpp-sesiones-list-detailed">${this.renderSesionList()}</ul></div><div class="cpp-programacion-right-col" id="cpp-programacion-right-col">${this.renderProgramacionTabRightColumn()}</div></div>`;
        content.innerHTML = html;
    },

    renderSesionList() {
        const sesionesFiltradas = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
        if (sesionesFiltradas.length === 0) return '<li>No hay sesiones para esta evaluación.</li>';
        return sesionesFiltradas.map((s, index) => `<li class="cpp-sesion-list-item ${this.currentSesion && s.id == this.currentSesion.id ? 'active' : ''}" data-sesion-id="${s.id}"><span class="cpp-sesion-number">${index + 1}.</span><span class="cpp-sesion-title">${s.titulo}</span></li>`).join('');
    },

    renderProgramacionTabRightColumn() {
        let html;
        if (this.currentSesion) {
            html = `<div class="cpp-sesion-detail-container" data-sesion-id="${this.currentSesion.id}"><h3 class="cpp-sesion-detail-title" data-field="titulo" contenteditable="true">${this.currentSesion.titulo}</h3><div class="cpp-sesion-detail-section"><h4>Descripción</h4><div class="cpp-sesion-detail-content" data-field="descripcion" contenteditable="true">${this.currentSesion.descripcion || ''}</div></div><div class="cpp-sesion-detail-section"><h4>Objetivos</h4><div class="cpp-sesion-detail-content" data-field="objetivos" contenteditable="true">${this.currentSesion.objetivos || ''}</div></div><div class="cpp-sesion-detail-section"><h4>Recursos</h4><div class="cpp-sesion-detail-content" data-field="recursos" contenteditable="true">${this.currentSesion.recursos || ''}</div></div><div class="cpp-sesion-detail-section"><h4>Actividades</h4><div class="cpp-sesion-detail-content" data-field="actividades" contenteditable="true">${this.currentSesion.actividades || ''}</div></div><div class="cpp-sesion-detail-section"><h4>Seguimiento</h4><div class="cpp-sesion-detail-content" data-field="seguimiento" contenteditable="true">${this.currentSesion.seguimiento || ''}</div></div></div>`;
        } else {
            html = '<p class="cpp-empty-panel">Selecciona una sesión de la lista para ver su contenido.</p>';
        }
        return html;
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
        const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
        if (!currentEval || !currentEval.start_date) { content.innerHTML = '<p class="cpp-empty-panel">Selecciona una evaluación y establece una fecha de inicio en la pestaña "Programación".</p>'; return; }
        const sesiones = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
        if (sesiones.length === 0) { content.innerHTML = '<p class="cpp-empty-panel">No hay sesiones en esta evaluación para programar.</p>'; return; }
        const horario = this.config.horario;
        const startDate = new Date(`${currentEval.start_date}T00:00:00`);
        let schedule = [];
        let currentDate = new Date(startDate);
        let sessionIndex = 0;
        const dayMapping = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
        while(sessionIndex < sesiones.length && schedule.length < 200) { // Safety break
            const dayOfWeek = currentDate.getDay();
            const dayKey = dayMapping[dayOfWeek];
            if (dayKey && horario[dayKey]) {
                const sortedSlots = Object.keys(horario[dayKey]).sort();
                for (const slot of sortedSlots) {
                    if (sessionIndex < sesiones.length) {
                        schedule.push({ sesion: sesiones[sessionIndex], fecha: new Date(currentDate), hora: slot });
                        sessionIndex++;
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        let html = '<ul class="cpp-semana-timeline">';
        schedule.forEach(item => {
            html += `<li><strong>${item.fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} - ${item.hora}</strong>: ${item.sesion.titulo}</li>`;
        });
        html += '</ul>';
        content.innerHTML = html;
    }
};
