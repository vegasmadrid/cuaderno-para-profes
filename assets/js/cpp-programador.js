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
        this.header = { element: document.getElementById('cpp-programador-header'), claseNombre: document.getElementById('cpp-programador-clase-actual-nombre') };
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
            if (sesionItem) { this.currentSesion = this.sesiones.find(s => s.id == sesionItem.dataset.sesionId); this.renderProgramacionTab(); }
            if (e.target.matches('.cpp-add-sesion-btn')) this.openSesionModal(this.currentClase.id, this.currentEvaluacionId);
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

    fetchData() {
        const data = new URLSearchParams({ action: 'cpp_get_programador_all_data', nonce: cppFrontendData.nonce });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                this.clases = result.data.clases || [];
                this.config = result.data.config;
                this.sesiones = result.data.sesiones || [];
                this.eventos = result.data.eventos || [];
                if (!this.currentClase && this.clases.length > 0) { this.selectClase(this.clases[0].id); } else { this.render(); }
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

    openSesionModal(claseId, evaluacionId) {
        this.sesionModal.form.reset();
        this.sesionModal.claseIdInput.value = claseId;
        this.sesionModal.evaluacionIdInput.value = evaluacionId;
        this.sesionModal.title.textContent = 'Nueva Sesión';
        this.sesionModal.idInput.value = '';
        this.sesionModal.element.style.display = 'block';
    },

    closeSesionModal() { this.sesionModal.element.style.display = 'none'; },

    render() {
        if (!this.currentClase) { return; }
        this.renderProgramacionTab();
        this.renderSemanaTab();
        this.renderHorarioTab();
    },

    renderProgramacionTab() {
        const content = this.tabContents.programacion;
        if (!this.currentClase) { content.innerHTML = '<p>Selecciona una clase para ver su programación.</p>'; return; }
        if (!this.currentClase.evaluaciones || this.currentClase.evaluaciones.length === 0) { content.innerHTML = '<p>No hay evaluaciones creadas para esta clase en el Cuaderno.</p>'; return; }

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

    // El resto de funciones se quedan igual...
};
