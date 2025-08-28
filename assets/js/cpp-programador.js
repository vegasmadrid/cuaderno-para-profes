// /assets/js/cpp-programador.js

document.addEventListener('DOMContentLoaded', function () {
    const appElement = document.getElementById('cpp-programador-app');
    if (appElement) {
        CppProgramadorApp.init(appElement);
    }
});

const DateHelper = {
    fromYMD: (d) => { const p = d.split('-'); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); },
    addDays: (d, days) => { const r = new Date(d); r.setUTCDate(r.getUTCDate() + days); return r; },
    toYMD: (d) => d.toISOString().slice(0, 10),
    toFriendlyFormat: (d) => d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }),
};

const CppProgramadorApp = {
    // --- PROPIEDADES ---
    appElement: null,
    config: {},
    sesiones: [],
    // Elementos del DOM
    scheduleView: null,
    sessionModal: null,
    sessionForm: null,
    settingsModal: null,
    settingsForm: null,

    // --- INICIALIZACIÓN ---
    init(appElement) {
        this.appElement = appElement;
        // Vistas y modales
        this.scheduleView = this.appElement.querySelector('#cpp-programador-schedule-view');
        this.sessionModal = this.appElement.querySelector('#cpp-programador-session-modal');
        this.sessionForm = this.appElement.querySelector('#cpp-programador-session-form');
        this.settingsModal = this.appElement.querySelector('#cpp-programador-settings-modal');
        this.settingsForm = this.appElement.querySelector('#cpp-programador-settings-form');

        this.fetchData();
        this.attachEventListeners();
    },

    attachEventListeners() {
        // Botones principales
        this.appElement.querySelector('#cpp-programador-add-session-btn').addEventListener('click', () => this.openSessionModal());
        this.appElement.querySelector('#cpp-programador-settings-btn').addEventListener('click', () => this.openSettingsModal());

        // Modales
        this.sessionModal.querySelector('#cpp-close-session-modal').addEventListener('click', () => this.closeSessionModal());
        this.settingsModal.querySelector('#cpp-close-settings-modal').addEventListener('click', () => this.closeSettingsModal());
        this.sessionForm.addEventListener('submit', (e) => this.saveSession(e));
        this.settingsForm.addEventListener('submit', (e) => this.saveSettings(e));

        // Delegación de eventos para la lista de sesiones
        this.scheduleView.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.cpp-edit-sesion-btn');
            const deleteBtn = e.target.closest('.cpp-delete-sesion-btn');
            if (editBtn) {
                const sesion = this.sesiones.find(s => s.id == editBtn.closest('.cpp-programador-sesion').dataset.sesionId);
                this.openSessionModal(sesion);
            } else if (deleteBtn) {
                this.deleteSession(deleteBtn.closest('.cpp-programador-sesion').dataset.sesionId);
            }
        });
    },

    // --- LÓGICA DE DATOS (AJAX) ---
    fetchData() {
        this.scheduleView.innerHTML = '<p class="cpp-programador-loading">Cargando programador...</p>';
        const data = new URLSearchParams({ action: 'cpp_get_programador_data', nonce: cppFrontendData.nonce });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                this.config = result.data.config;
                this.sesiones = result.data.sesiones;
                this.render();
            } else {
                this.scheduleView.innerHTML = `<p class="cpp-programador-error">Error: ${result.data.message}</p>`;
            }
        }).catch(err => this.scheduleView.innerHTML = `<p class="cpp-programador-error">Error de conexión.</p>`);
    },

    saveSettings(e) {
        e.preventDefault();
        const dias_laborables = Array.from(this.settingsForm.querySelectorAll('input[name="dias_laborables"]:checked')).map(cb => cb.value);
        const dias_no_laborables = this.settingsForm.querySelector('#cpp-dias-no-laborables').value.split(',').map(d => d.trim()).filter(d => d);

        const newConfig = { dias_laborables, dias_no_laborables };
        const data = new URLSearchParams({
            action: 'cpp_save_programador_config',
            nonce: cppFrontendData.nonce,
            config: JSON.stringify(newConfig),
        });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                this.closeSettingsModal();
                this.fetchData(); // Recargar para aplicar cambios
            } else {
                alert('Error al guardar ajustes: ' + result.data.message);
            }
        });
    },

    saveSession(e) {
        e.preventDefault();
        const sesionData = {
            id: this.sessionForm.querySelector('#cpp-sesion-id').value,
            titulo: this.sessionForm.querySelector('#cpp-sesion-titulo').value,
            descripcion: this.sessionForm.querySelector('#cpp-sesion-descripcion').value,
        };
        const data = new URLSearchParams({
            action: 'cpp_save_programador_sesion',
            nonce: cppFrontendData.nonce,
            sesion: JSON.stringify(sesionData),
        });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                this.closeSessionModal();
                this.fetchData();
            } else {
                alert('Error al guardar la sesión: ' + result.data.message);
            }
        });
    },

    deleteSession(sesionId) {
        if (!confirm('¿Estás seguro de que quieres eliminar esta sesión?')) return;
        const data = new URLSearchParams({ action: 'cpp_delete_programador_sesion', nonce: cppFrontendData.nonce, sesion_id: sesionId });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                this.fetchData();
            } else {
                alert('Error al eliminar: ' + result.data.message);
            }
        });
    },

    updateSessionOrder(newOrder) {
        this.sesiones.sort((a, b) => newOrder.indexOf(String(a.id)) - newOrder.indexOf(String(b.id)));
        const data = new URLSearchParams({
            action: 'cpp_reorder_programador_sesiones',
            nonce: cppFrontendData.nonce,
            orden: JSON.stringify(newOrder),
        });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data });
    },

    // --- MANEJO DE MODALES ---
    openSessionModal(sesion = null) {
        this.sessionForm.reset();
        const title = this.sessionModal.querySelector('#cpp-programador-session-modal-title');
        if (sesion) {
            title.textContent = 'Editar Sesión';
            this.sessionForm.querySelector('#cpp-sesion-id').value = sesion.id;
            this.sessionForm.querySelector('#cpp-sesion-titulo').value = sesion.titulo;
            this.sessionForm.querySelector('#cpp-sesion-descripcion').value = sesion.descripcion;
        } else {
            title.textContent = 'Añadir Nueva Sesión';
            this.sessionForm.querySelector('#cpp-sesion-id').value = '';
        }
        this.sessionModal.style.display = 'block';
    },
    closeSessionModal: function() { this.sessionModal.style.display = 'none'; },

    openSettingsModal() {
        this.settingsForm.reset();
        this.config.dias_laborables.forEach(dia => {
            const cb = this.settingsForm.querySelector(`input[name="dias_laborables"][value="${dia}"]`);
            if (cb) cb.checked = true;
        });
        this.settingsForm.querySelector('#cpp-dias-no-laborables').value = this.config.dias_no_laborables.join(', ');
        this.settingsModal.style.display = 'block';
    },
    closeSettingsModal: function() { this.settingsModal.style.display = 'none'; },

    // --- RENDERIZADO ---
    render() {
        if (!this.sesiones) this.sesiones = [];
        const workingDays = this.generateWorkingDays();
        let html = '';
        if (this.sesiones.length === 0) {
            html = '<div class="cpp-programador-empty"><p>No hay sesiones programadas. ¡Añade la primera!</p></div>';
        } else {
            html = '<ul id="cpp-programador-list" class="cpp-programador-list">';
            this.sesiones.forEach((sesion, index) => {
                const date = workingDays[index];
                const friendlyDate = DateHelper.toFriendlyFormat(date);
                html += `
                    <li class="cpp-programador-sesion" data-sesion-id="${sesion.id}">
                        <div class="cpp-sesion-handle"><span class="dashicons dashicons-menu"></span></div>
                        <div class="cpp-sesion-date">${friendlyDate}</div>
                        <div class="cpp-sesion-title">${sesion.titulo}</div>
                        <div class="cpp-sesion-actions">
                            <button class="cpp-btn-icon cpp-edit-sesion-btn" title="Editar"><span class="dashicons dashicons-edit"></span></button>
                            <button class="cpp-btn-icon cpp-delete-sesion-btn" title="Eliminar"><span class="dashicons dashicons-trash"></span></button>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
        }
        this.scheduleView.innerHTML = html;
        if (this.sesiones.length > 0) this.makeSortable();
    },

    generateWorkingDays() {
        const workingDays = [];
        if (this.sesiones.length === 0) return workingDays;
        let currentDate = new Date();
        currentDate.setUTCHours(0,0,0,0);
        const diasLaborables = this.config.dias_laborables.map(Number);
        const diasNoLaborables = this.config.dias_no_laborables;
        while (workingDays.length < this.sesiones.length) {
            const dayOfWeek = currentDate.getUTCDay() === 0 ? 7 : currentDate.getUTCDay(); // Dom=7
            const ymd = DateHelper.toYMD(currentDate);
            if (diasLaborables.includes(dayOfWeek) && !diasNoLaborables.includes(ymd)) {
                workingDays.push(new Date(currentDate));
            }
            currentDate = DateHelper.addDays(currentDate, 1);
        }
        return workingDays;
    },

    makeSortable() {
        const list = jQuery('#cpp-programador-list');
        if (list.length) {
            list.sortable({
                handle: '.cpp-sesion-handle',
                placeholder: 'cpp-sesion-placeholder',
                forcePlaceholderSize: true,
                update: (e, ui) => {
                    const order = list.sortable('toArray', { attribute: 'data-sesion-id' });
                    this.updateSessionOrder(order);
                }
            }).disableSelection();
        }
    }
};
