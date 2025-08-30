// /assets/js/cpp-programador.js

document.addEventListener('DOMContentLoaded', function() {
    const appElement = document.getElementById('cpp-programador-app');
    if (appElement) { CppProgramadorApp.init(appElement); }
});

const CppProgramadorApp = {
    // --- Propiedades ---
    appElement: null, tabs: {}, tabContents: {}, sesionModal: {},
    clases: [], config: { time_slots: [], horario: {} }, sesiones: [],
    eventos: [], currentDate: new Date(), currentClase: null,
    currentEvaluacionId: null, currentSesion: null, originalContent: '',

    // --- Inicialización ---
    init(appElement) {
        this.appElement = appElement;
        this.tabs = { programacion: appElement.querySelector('.cpp-tab-link[data-tab="programacion"]'), semana: appElement.querySelector('.cpp-tab-link[data-tab="semana"]'), horario: appElement.querySelector('.cpp-tab-link[data-tab="horario"]') };
        this.tabContents = { programacion: appElement.querySelector('#tab-programacion'), semana: appElement.querySelector('#tab-semana'), horario: appElement.querySelector('#tab-horario') };
        this.sesionModal = { element: document.querySelector('#cpp-sesion-modal'), form: document.querySelector('#cpp-sesion-form'), title: document.querySelector('#cpp-sesion-modal-title'), idInput: document.querySelector('#cpp-sesion-id'), claseIdInput: document.querySelector('#cpp-sesion-clase-id'), evaluacionIdInput: document.querySelector('#cpp-sesion-evaluacion-id'), tituloInput: document.querySelector('#cpp-sesion-titulo'), descripcionInput: document.querySelector('#cpp-sesion-descripcion') };
        this.attachEventListeners();
        this.fetchData();
    },

    attachEventListeners() {
        Object.values(this.tabs).forEach(tab => tab.addEventListener('click', e => this.switchTab(e.target.dataset.tab)));

        const programacionTab = this.tabContents.programacion;
        programacionTab.addEventListener('change', e => {
            if (e.target.id === 'cpp-programacion-clase-selector') { this.selectClase(e.target.value); }
            if (e.target.id === 'cpp-programacion-evaluacion-selector') { this.currentEvaluacionId = e.target.value; this.currentSesion = null; this.renderProgramacionTab(); }
        });
        programacionTab.addEventListener('click', e => {
            const sesionItem = e.target.closest('.cpp-sesion-list-item');
            if (sesionItem) { this.currentSesion = this.sesiones.find(s => s.id == sesionItem.dataset.sesionId); this.renderProgramacionTab(); }
            if (e.target.matches('.cpp-add-sesion-btn')) this.openSesionModal();
        });
        programacionTab.addEventListener('focusin', e => { if (e.target.matches('[contenteditable]')) this.originalContent = e.target.innerHTML; });
        programacionTab.addEventListener('focusout', e => { if (e.target.matches('[contenteditable]')) this.handleInlineEdit(e.target); });
        programacionTab.addEventListener('keydown', e => { if (e.target.matches('[contenteditable]')) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); } else if (e.key === 'Escape') { e.target.innerHTML = this.originalContent; e.target.blur(); } } });

        this.tabContents.semana.addEventListener('click', e => {
            if (e.target.matches('.cpp-semana-prev-btn')) { this.currentDate.setDate(this.currentDate.getDate() - 7); this.renderSemanaTab(); }
            if (e.target.matches('.cpp-semana-next-btn')) { this.currentDate.setDate(this.currentDate.getDate() + 7); this.renderSemanaTab(); }
            if (e.target.matches('.cpp-add-evento-btn')) this.assignSesionToEvento(e.target.dataset.fecha, e.target.dataset.slot, e.target.dataset.claseId);
            if (e.target.matches('.cpp-delete-evento-btn')) this.deleteEvento(e.target.dataset.eventoId);
        });

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
                this.eventos = result.data.eventos || [];
                if (!this.currentClase && this.clases.length > 0) {
                    this.selectClase(this.clases[0].id);
                } else if (this.clases.length > 0) {
                    this.render();
                } else {
                    this.tabContents.programacion.innerHTML = '<p>No tienes clases creadas. Por favor, ve al Cuaderno y crea al menos una clase.</p>';
                }
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

        let evaluacionOptions = '';
        if (this.currentClase && this.currentClase.evaluaciones) {
            evaluacionOptions = this.currentClase.evaluaciones.map(e => `<option value="${e.id}" ${e.id == this.currentEvaluacionId ? 'selected' : ''}>${e.nombre_evaluacion}</option>`).join('');
        }

        let html = `<div class="cpp-programacion-layout"><div class="cpp-programacion-left-col"><div class="cpp-programacion-controls"><label>Clase:</label><select id="cpp-programacion-clase-selector">${claseOptions}</select><label>Evaluación:</label><select id="cpp-programacion-evaluacion-selector" ${!evaluacionOptions ? 'disabled' : ''}>${evaluacionOptions || '<option>Sin evaluaciones</option>'}</select><button class="cpp-add-sesion-btn cpp-btn cpp-btn-primary" ${!this.currentEvaluacionId ? 'disabled' : ''}>+ Añadir Sesión</button></div><ul class="cpp-sesiones-list-detailed">${this.renderSesionList()}</ul></div><div class="cpp-programacion-right-col" id="cpp-programacion-right-col">${this.renderProgramacionTabRightColumn()}</div></div>`;
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
            html = `<div data-sesion-id="${this.currentSesion.id}"><h3 class="cpp-sesion-detail-title" data-field="titulo" contenteditable="true">${this.currentSesion.titulo}</h3><div class="cpp-sesion-detail-desc" data-field="descripcion" contenteditable="true">${this.currentSesion.descripcion || '<p>Añade una descripción...</p>'}</div></div>`;
        } else {
            html = '<p class="cpp-empty-panel">Selecciona una sesión de la lista para ver su contenido.</p>';
        }
        return html;
    },

    renderHorarioTab() {
        const content = this.tabContents.horario;
        const days = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes' };
        let classOptions = '<option value="">-- Vacío --</option>' + this.clases.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        let tableHTML = `<table id="cpp-horario-table" class="cpp-horario-table"><thead><tr><th>Hora</th>${Object.values(days).map(day => `<th>${day}</th>`).join('')}</tr></thead><tbody>`;
        (this.config.time_slots || []).forEach(slot => {
            tableHTML += `<tr><td>${slot}</td>`;
            Object.keys(days).forEach(dayKey => {
                const claseId = this.config.horario?.[dayKey]?.[slot] || '';
                tableHTML += `<td data-day="${dayKey}" data-slot="${slot}"><select data-clase-id="${claseId}">${classOptions}</select></td>`;
            });
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table>`;
        content.innerHTML = tableHTML;
        this.appElement.querySelectorAll('#cpp-horario-table select').forEach(s => { s.value = s.dataset.claseId; });
    },

    renderSemanaTab() {
        const content = this.tabContents.semana;
        const weekDates = this.getWeekDates(this.currentDate);
        const days = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes' };
        let headerHTML = `<div class="cpp-semana-nav"><button class="cpp-semana-prev-btn cpp-btn">◄</button><h3>Semana del ${weekDates[0].toLocaleDateString('es-ES', {day:'numeric', month:'long'})}</h3><button class="cpp-semana-next-btn cpp-btn">►</button></div>`;
        let tableHTML = `${headerHTML}<table class="cpp-semana-table"><thead><tr><th>Hora</th>`;
        Object.keys(days).forEach((dayKey, i) => { tableHTML += `<th>${days[dayKey]}<br><small>${weekDates[i].toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit'})}</small></th>`; });
        tableHTML += `</tr></thead><tbody>`;
        (this.config.time_slots || []).forEach(slot => {
            tableHTML += `<tr><td>${slot}</td>`;
            Object.keys(days).forEach((dayKey, dayIndex) => {
                const claseId = this.config.horario?.[dayKey]?.[slot];
                let cellContent = '';
                if (claseId && this.clases.length > 0) {
                    const clase = this.clases.find(c => c.id == claseId);
                    if(clase) {
                        const fecha = weekDates[dayIndex].toISOString().slice(0, 10);
                        const evento = this.eventos.find(e => e.fecha === fecha && e.hora_inicio.startsWith(slot));
                        cellContent = `<div class="cpp-semana-slot" style="border-left-color: ${clase.color};"><strong>${clase.nombre}</strong>`;
                        if (evento) {
                            const sesion = this.sesiones.find(s => s.id == evento.sesion_id);
                            cellContent += `<p>${sesion ? sesion.titulo : 'Sesión...'}</p><button class="cpp-delete-evento-btn" data-evento-id="${evento.id}">🗑️</button>`;
                        } else {
                            cellContent += `<button class="cpp-add-evento-btn" data-fecha="${fecha}" data-slot="${slot}" data-clase-id="${claseId}">+</button>`;
                        }
                        cellContent += `</div>`;
                    }
                }
                tableHTML += `<td>${cellContent}</td>`;
            });
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table>`;
        content.innerHTML = tableHTML;
    },

    getWeekDates(d) {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        return Array.from({length: 5}, (v, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    }
};
