// /assets/js/cpp-programador.js

document.addEventListener('DOMContentLoaded', function() {
    const appElement = document.getElementById('cpp-programador-app');
    if (appElement) { CppProgramadorApp.init(appElement); }
});

const CppProgramadorApp = {
    // --- Propiedades ---
    appElement: null, sidebar: null, header: {}, tabs: {}, tabContents: {},
    sesionModal: {}, clases: [], config: { time_slots: [], horario: {} },
    sesiones: [], eventos: [], currentDate: new Date(), currentClase: null,
    currentEvaluacionId: null, currentSesion: null, originalContent: '',

    // --- Inicialización ---
    init(appElement) {
        this.appElement = appElement;
        this.sidebar = document.getElementById('cpp-programador-sidebar');
        this.header = { element: document.getElementById('cpp-programador-header'), claseNombre: document.getElementById('cpp-programador-clase-actual-nombre'), };
        this.tabs = { programacion: appElement.querySelector('.cpp-tab-link[data-tab="programacion"]'), semana: appElement.querySelector('.cpp-tab-link[data-tab="semana"]'), horario: appElement.querySelector('.cpp-tab-link[data-tab="horario"]') };
        this.tabContents = { programacion: appElement.querySelector('#tab-programacion'), semana: appElement.querySelector('#tab-semana'), horario: appElement.querySelector('#tab-horario') };
        this.sesionModal = { element: document.querySelector('#cpp-sesion-modal'), form: document.querySelector('#cpp-sesion-form'), title: document.querySelector('#cpp-sesion-modal-title'), idInput: document.querySelector('#cpp-sesion-id'), claseIdInput: document.querySelector('#cpp-sesion-clase-id'), evaluacionIdInput: document.querySelector('#cpp-sesion-evaluacion-id'), tituloInput: document.querySelector('#cpp-sesion-titulo'), descripcionInput: document.querySelector('#cpp-sesion-descripcion') };
        this.emptyStateElement = document.querySelector('#cpp-programador-empty-state');
        this.attachEventListeners();
        this.fetchData();
    },

    attachEventListeners() {
        document.getElementById('cpp-sidebar-open-btn').addEventListener('click', () => this.toggleSidebar(true));
        document.getElementById('cpp-sidebar-close-btn').addEventListener('click', () => this.toggleSidebar(false));
        document.getElementById('cpp-sidebar-overlay').addEventListener('click', () => this.toggleSidebar(false));
        this.sidebar.addEventListener('click', e => { const item = e.target.closest('.cpp-sidebar-clase-item'); if(item) { this.selectClase(item.dataset.claseId); this.toggleSidebar(false); } });
        Object.values(this.tabs).forEach(tab => tab.addEventListener('click', e => this.switchTab(e.target.dataset.tab)));
        this.tabContents.horario.addEventListener('change', e => { if (e.target.tagName === 'SELECT') this.saveHorario(); });
        this.tabContents.horario.addEventListener('click', e => { if (e.target.id === 'cpp-horario-add-slot-btn') this.addTimeSlot(); });

        const programacionTab = this.tabContents.programacion;
        programacionTab.addEventListener('change', e => { if (e.target.id === 'cpp-programacion-evaluacion-selector') { this.currentEvaluacionId = e.target.value; this.currentSesion = null; this.renderProgramacionTab(); } });
        programacionTab.addEventListener('click', e => {
            const sesionItem = e.target.closest('.cpp-sesion-list-item');
            if (sesionItem) {
                this.currentSesion = this.sesiones.find(s => s.id == sesionItem.dataset.sesionId);
                this.renderProgramacionTab(); // Re-render completo para actualizar la clase 'active'
            }
            if (e.target.matches('.cpp-add-sesion-btn')) this.openSesionModal(this.currentClase.id, this.currentEvaluacionId);
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
        const sesionId = this.currentSesion.id;
        const field = element.dataset.field;
        const sesion = this.sesiones.find(s => s.id == sesionId);
        if (!sesion || !field) return;
        const sesionData = { ...sesion, [field]: newContent };
        this.saveSesion(null, sesionData);
    },

    toggleSidebar(visible) { this.sidebar.classList.toggle('cpp-sidebar-visible', visible); document.getElementById('cpp-sidebar-overlay').classList.toggle('cpp-sidebar-visible', visible); },

    selectClase(claseId) {
        this.currentClase = this.clases.find(c => c.id == claseId);
        if (!this.currentClase) return;
        this.currentEvaluacionId = this.currentClase.evaluaciones.length > 0 ? this.currentClase.evaluaciones[0].id : null;
        this.currentSesion = null;
        this.header.element.style.backgroundColor = this.currentClase.color;
        const hex = this.currentClase.color.replace('#', ''), r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
        this.header.element.style.color = ((0.299 * r + 0.587 * g + 0.114 * b) / 255) < 0.5 ? '#FFFFFF' : '#000000';
        this.header.claseNombre.textContent = this.currentClase.nombre;
        this.sidebar.querySelectorAll('.cpp-sidebar-clase-item').forEach(item => item.classList.toggle('cpp-sidebar-item-active', item.dataset.claseId == claseId));
        this.render();
    },

    switchTab(tabName) { Object.values(this.tabs).forEach(tab => tab.classList.remove('active')); Object.values(this.tabContents).forEach(content => content.classList.remove('active')); this.tabs[tabName].classList.add('active'); this.tabContents[tabName].classList.add('active'); },

    fetchData() { /* ... (código existente) ... */ },
    saveHorario(showNotification = false) { /* ... (código existente) ... */ },
    saveSesion(e, fromModal = false) { /* ... (código existente) ... */ },
    deleteSesion(sesionId) { /* ... (código existente) ... */ },
    saveSesionOrder(claseId, newOrder) { /* ... (código existente) ... */ },
    assignSesionToEvento(fecha, slot, claseId) { /* ... (código existente) ... */ },
    deleteEvento(eventoId) { /* ... (código existente) ... */ },
    createExampleData() { /* ... (código existente) ... */ },
    addTimeSlot() { /* ... (código existente) ... */ },
    openSesionModal(claseId, evaluacionId, sesion = null) { /* ... (código existente) ... */ },
    closeSesionModal() { this.sesionModal.element.style.display = 'none'; },
    makeSesionesSortable() { /* ... (código existente) ... */ },
    getWeekDates(d) { /* ... (código existente) ... */ },

    render() {
        if (!this.currentClase) {
            this.tabContents.programacion.innerHTML = '<p class="cpp-empty-panel">Por favor, selecciona una clase para empezar.</p>';
            this.tabContents.semana.innerHTML = '';
            this.tabContents.horario.innerHTML = '';
            return;
        }
        this.renderProgramacionTab();
        this.renderSemanaTab();
        this.renderHorarioTab();
    },

    renderProgramacionTab() {
        const content = this.tabContents.programacion;
        if (!this.currentClase.evaluaciones || this.currentClase.evaluaciones.length === 0) { content.innerHTML = '<p class="cpp-empty-panel">No hay evaluaciones creadas para esta clase. Añádelas desde la configuración del Cuaderno.</p>'; return; }
        let evaluacionOptions = this.currentClase.evaluaciones.map(e => `<option value="${e.id}" ${e.id == this.currentEvaluacionId ? 'selected' : ''}>${e.nombre_evaluacion}</option>`).join('');
        let html = `<div class="cpp-programacion-layout"><div class="cpp-programacion-left-col"><div class="cpp-programacion-controls"><select id="cpp-programacion-evaluacion-selector">${evaluacionOptions}</select><button class="cpp-add-sesion-btn cpp-btn cpp-btn-primary">+ Añadir Sesión</button></div><ul class="cpp-sesiones-list-detailed">${this.renderSesionList()}</ul></div><div class="cpp-programacion-right-col" id="cpp-programacion-right-col">${this.renderProgramacionTabRightColumn()}</div></div>`;
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
        const rightCol = this.appElement.querySelector('#cpp-programacion-right-col');
        if (rightCol) { rightCol.innerHTML = html; } else { return html; }
    },

    renderHorarioTab() {
        const content = this.tabContents.horario;
        const days = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes' };
        let classOptions = '<option value="">-- Vacío --</option>' + this.clases.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        let tableHTML = `<div class="cpp-horario-actions"><button id="cpp-horario-add-slot-btn" class="cpp-btn">Añadir Tramo Horario</button></div><table id="cpp-horario-table" class="cpp-horario-table"><thead><tr><th>Hora</th>${Object.values(days).map(day => `<th>${day}</th>`).join('')}</tr></thead><tbody>`;
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

// --- Re-pegar funciones completas para evitar errores de referencia ---
CppProgramadorApp.saveSesion = function(e, fromModal = false) { if (e) e.preventDefault(); let sesionData; if (fromModal) { sesionData = { id: this.sesionModal.idInput.value, clase_id: this.sesionModal.claseIdInput.value, evaluacion_id: this.sesionModal.evaluacionIdInput.value, titulo: this.sesionModal.tituloInput.value, descripcion: this.sesionModal.descripcionInput.value }; } else { sesionData = arguments[1]; } const data = new URLSearchParams({ action: 'cpp_save_programador_sesion', nonce: cppFrontendData.nonce, sesion: JSON.stringify(sesionData) }); fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => { if (result.success) { if (fromModal) this.closeSesionModal(); this.fetchData(); } else { alert('Error al guardar.'); this.fetchData(); } }); };
CppProgramadorApp.fetchData = function() { const data = new URLSearchParams({ action: 'cpp_get_programador_all_data', nonce: cppFrontendData.nonce }); fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => { if (result.success) { this.clases = result.data.clases || []; this.config = result.data.config; this.sesiones = result.data.sesiones || []; this.eventos = result.data.eventos || []; if (!this.currentClase && this.clases.length > 0) { this.selectClase(this.clases[0].id); } else { this.render(); } } }); };
// ... (El resto de funciones auxiliares se asume que están definidas)
