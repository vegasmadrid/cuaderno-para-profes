// /assets/js/cpp-programador.js

document.addEventListener('DOMContentLoaded', function() {
    const appElement = document.getElementById('cpp-programador-app');
    if (appElement) { CppProgramadorApp.init(appElement); }
});

const CppProgramadorApp = {
    // --- Propiedades ---
    appElement: null,
    tabs: {},
    tabContents: {},
    sesionModal: {},
    clases: [],
    config: { time_slots: [], horario: {} },
    sesiones: [],
    eventos: [],
    currentDate: new Date(),
    originalSesionTitle: '',

    // --- Inicialización ---
    init(appElement) {
        this.appElement = appElement;
        this.tabs = { semana: appElement.querySelector('.cpp-tab-link[data-tab="semana"]'), clases: appElement.querySelector('.cpp-tab-link[data-tab="clases"]'), horario: appElement.querySelector('.cpp-tab-link[data-tab="horario"]') };
        this.tabContents = { semana: appElement.querySelector('#tab-semana'), clases: appElement.querySelector('#tab-clases'), horario: appElement.querySelector('#tab-horario') };
        this.sesionModal = {
            element: document.querySelector('#cpp-sesion-modal'),
            form: document.querySelector('#cpp-sesion-form'),
            title: document.querySelector('#cpp-sesion-modal-title'),
            idInput: document.querySelector('#cpp-sesion-id'),
            claseIdInput: document.querySelector('#cpp-sesion-clase-id'),
            tituloInput: document.querySelector('#cpp-sesion-titulo'),
            descripcionInput: document.querySelector('#cpp-sesion-descripcion'),
        };
        this.emptyStateElement = document.querySelector('#cpp-programador-empty-state');

        this.attachEventListeners();
        this.fetchData();
    },

    attachEventListeners() {
        Object.values(this.tabs).forEach(tab => tab.addEventListener('click', e => this.switchTab(e.target.dataset.tab)));
        this.tabContents.horario.addEventListener('change', e => { if (e.target.tagName === 'SELECT') this.saveHorario(); });
        this.tabContents.horario.addEventListener('click', e => { if (e.target.id === 'cpp-horario-add-slot-btn') this.addTimeSlot(); });

        const clasesTab = this.tabContents.clases;
        clasesTab.addEventListener('click', e => {
            if (e.target.matches('.cpp-add-sesion-btn')) this.openSesionModal(e.target.dataset.claseId);
            if (e.target.matches('.cpp-delete-sesion-btn')) this.deleteSesion(e.target.dataset.sesionId);
        });
        clasesTab.addEventListener('focusin', e => { if (e.target.matches('.cpp-sesion-title')) this.originalSesionTitle = e.target.textContent; });
        clasesTab.addEventListener('focusout', e => { if (e.target.matches('.cpp-sesion-title')) this.handleInlineEdit(e.target); });
        clasesTab.addEventListener('keydown', e => {
            if (e.target.matches('.cpp-sesion-title')) {
                if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
                else if (e.key === 'Escape') { e.target.textContent = this.originalSesionTitle; e.target.blur(); }
            }
        });

        this.tabContents.semana.addEventListener('click', e => {
            if (e.target.matches('.cpp-semana-prev-btn')) { this.currentDate.setDate(this.currentDate.getDate() - 7); this.renderSemanaTab(); }
            if (e.target.matches('.cpp-semana-next-btn')) { this.currentDate.setDate(this.currentDate.getDate() + 7); this.renderSemanaTab(); }
            if (e.target.matches('.cpp-add-evento-btn')) this.assignSesionToEvento(e.target.dataset.fecha, e.target.dataset.slot, e.target.dataset.claseId);
            if (e.target.matches('.cpp-delete-evento-btn')) this.deleteEvento(e.target.dataset.eventoId);
        });

        this.sesionModal.element.querySelector('.cpp-modal-close').addEventListener('click', () => this.closeSesionModal());
        this.sesionModal.form.addEventListener('submit', e => this.saveSesion(e, true));
        this.emptyStateElement.querySelector('#cpp-programador-create-example-btn').addEventListener('click', () => this.createExampleData());
    },

    handleInlineEdit(element) {
        const newTitle = element.textContent;
        if (newTitle === this.originalSesionTitle) return;
        const sesionId = element.closest('.cpp-sesion-item').dataset.sesionId;
        const sesion = this.sesiones.find(s => s.id == sesionId);
        if (!sesion) return;
        const sesionData = { ...sesion, titulo: newTitle };
        this.saveSesion(null, sesionData);
    },

    switchTab(tabName) {
        Object.values(this.tabs).forEach(tab => tab.classList.remove('active'));
        Object.values(this.tabContents).forEach(content => content.classList.remove('active'));
        this.tabs[tabName].classList.add('active');
        this.tabContents[tabName].classList.add('active');
    },

    // --- Lógica de Datos (AJAX) ---
    fetchData() {
        const data = new URLSearchParams({ action: 'cpp_get_programador_all_data', nonce: cppFrontendData.nonce });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                this.clases = result.data.clases || [];
                this.config = result.data.config;
                this.sesiones = result.data.sesiones || [];
                this.eventos = result.data.eventos || [];
                this.render();
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
        const data = new URLSearchParams({ action: 'cpp_save_programador_horario', nonce: cppFrontendData.nonce, horario: JSON.stringify(newHorario), time_slots: JSON.stringify(this.config.time_slots) });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                if (showNotification) alert('Horario guardado.');
                this.config.horario = newHorario;
                this.renderSemanaTab();
            } else {
                alert('Error al guardar el horario.');
            }
        });
    },

    saveSesion(e, fromModal = false) {
        if (e) e.preventDefault();
        let sesionData;
        if (fromModal) {
            sesionData = { id: this.sesionModal.idInput.value, clase_id: this.sesionModal.claseIdInput.value, titulo: this.sesionModal.tituloInput.value, descripcion: this.sesionModal.descripcionInput.value };
        } else {
            sesionData = arguments[1];
        }
        const data = new URLSearchParams({ action: 'cpp_save_programador_sesion', nonce: cppFrontendData.nonce, sesion: JSON.stringify(sesionData) });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                if (fromModal) this.closeSesionModal();
                this.fetchData();
            } else {
                alert('Error al guardar.');
                this.fetchData();
            }
        });
    },

    deleteSesion(sesionId) {
        if (!confirm('¿Seguro que quieres eliminar esta sesión?')) return;
        const data = new URLSearchParams({ action: 'cpp_delete_programador_sesion', nonce: cppFrontendData.nonce, sesion_id: sesionId });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) { this.fetchData(); } else { alert('Error al eliminar.'); }
        });
    },

    saveSesionOrder(claseId, newOrder) {
        const data = new URLSearchParams({ action: 'cpp_save_sesiones_order', nonce: cppFrontendData.nonce, clase_id: claseId, orden: JSON.stringify(newOrder) });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) { this.fetchData(); }
            else { alert('Error al guardar el nuevo orden.'); this.fetchData(); }
        });
    },

    assignSesionToEvento(fecha, slot, claseId) {
        const sesionesDeClase = this.sesiones.filter(s => s.clase_id == claseId);
        if (sesionesDeClase.length === 0) { alert('No hay sesiones en el banco para esta clase. Añade sesiones en la pestaña "Clases".'); return; }
        const promptMessage = 'Selecciona una sesión para asignar:\n\n' + sesionesDeClase.map((s, i) => `${i + 1}: ${s.titulo}`).join('\n');
        const choice = parseInt(prompt(promptMessage, '1'), 10);
        if (choice > 0 && choice <= sesionesDeClase.length) {
            const sesionSeleccionada = sesionesDeClase[choice - 1];
            const eventoData = { sesion_id: sesionSeleccionada.id, fecha: fecha, hora_inicio: slot };
            const data = new URLSearchParams({ action: 'cpp_save_programador_evento', nonce: cppFrontendData.nonce, evento: JSON.stringify(eventoData) });
            fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
                if (result.success) { this.fetchData(); } else { alert('Error al asignar la sesión.'); }
            });
        }
    },

    deleteEvento(eventoId) {
        if (!confirm('¿Quitar esta sesión del calendario?')) return;
        const data = new URLSearchParams({ action: 'cpp_delete_programador_evento', nonce: cppFrontendData.nonce, evento_id: eventoId });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) { this.fetchData(); } else { alert('Error al quitar la sesión.'); }
        });
    },

    createExampleData() {
        const data = new URLSearchParams({ action: 'cpp_create_programador_example_data', nonce: cppFrontendData.nonce });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) { this.fetchData(); } else { alert(result.data.message); }
        });
    },

    addTimeSlot() {
        const newSlot = prompt('Nuevo tramo horario (ej: 13:00):', '13:00');
        if (newSlot && !this.config.time_slots.includes(newSlot)) {
            this.config.time_slots.push(newSlot);
            this.config.time_slots.sort();
            this.renderHorarioTab();
            this.saveHorario(true);
        }
    },

    openSesionModal(claseId, sesion = null) {
        this.sesionModal.form.reset();
        this.sesionModal.claseIdInput.value = claseId;
        if (sesion) {
            this.sesionModal.title.textContent = 'Editar Sesión';
            this.sesionModal.idInput.value = sesion.id;
            this.sesionModal.tituloInput.value = sesion.titulo;
            this.sesionModal.descripcionInput.value = sesion.descripcion;
        } else {
            this.sesionModal.title.textContent = 'Nueva Sesión';
            this.sesionModal.idInput.value = '';
        }
        this.sesionModal.element.style.display = 'block';
    },

    closeSesionModal() { this.sesionModal.element.style.display = 'none'; },

    makeSesionesSortable() {
        this.appElement.querySelectorAll('.cpp-sesiones-list').forEach(list => {
            jQuery(list).sortable({
                placeholder: 'cpp-sesion-placeholder',
                handle: '.cpp-sesion-handle',
                update: (event, ui) => {
                    const claseId = ui.item.closest('.cpp-clase-column').dataset.claseId;
                    const newOrder = jQuery(event.target).sortable('toArray', { attribute: 'data-sesion-id' });
                    this.saveSesionOrder(claseId, newOrder);
                }
            }).disableSelection();
        });
    },

    render() {
        if (this.sesiones.length === 0 && Object.keys(this.config.horario).length === 0) {
            this.emptyStateElement.style.display = 'block';
            this.appElement.querySelector('.cpp-programador-tabs').style.display = 'none';
            this.appElement.querySelector('.cpp-programador-content').style.display = 'none';
        } else {
            this.emptyStateElement.style.display = 'none';
            this.appElement.querySelector('.cpp-programador-tabs').style.display = 'flex';
            this.appElement.querySelector('.cpp-programador-content').style.display = 'block';
        }
        this.renderHorarioTab();
        this.renderClasesTab();
        this.renderSemanaTab();
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

    renderClasesTab() {
        const content = this.tabContents.clases;
        let html = '<div class="cpp-clases-columns">';
        if (this.clases.length === 0) { html += '<p>No has creado ninguna clase.</p>'; }
        else {
            this.clases.forEach(clase => {
                const sesionesDeClase = this.sesiones.filter(s => s.clase_id == clase.id);
                html += `<div class="cpp-clase-column" data-clase-id="${clase.id}"><h3>${clase.nombre}</h3><ul class="cpp-sesiones-list">${sesionesDeClase.map((s, index) => `<li class="cpp-sesion-item" data-sesion-id="${s.id}"><div class="cpp-sesion-handle">⠿</div><span class="cpp-sesion-number">${index + 1}.</span><div class="cpp-sesion-title" contenteditable="true">${s.titulo}</div><div class="cpp-sesion-actions"><button class="cpp-delete-sesion-btn" data-sesion-id="${s.id}">🗑️</button></div></li>`).join('')}</ul><button class="cpp-add-sesion-btn" data-clase-id="${clase.id}">+ Añadir Sesión</button></div>`;
            });
        }
        html += '</div>';
        content.innerHTML = html;
        this.makeSesionesSortable();
    },

    renderSemanaTab() {
        const content = this.tabContents.semana;
        const weekDates = this.getWeekDates(this.currentDate);
        const days = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes' };
        let headerHTML = `<div class="cpp-semana-nav"><button class="cpp-semana-prev-btn cpp-btn">◄</button><h3>Semana del ${weekDates[0].toLocaleDateString('es-ES', {day:'numeric', month:'long'})}</h3><button class="cpp-semana-next-btn cpp-btn">►</button></div>`;
        let tableHTML = `${headerHTML}<table class="cpp-semana-table"><thead><tr><th>Hora</th>`;
        Object.keys(days).forEach((dayKey, i) => {
            tableHTML += `<th>${days[dayKey]}<br><small>${weekDates[i].toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit'})}</small></th>`;
        });
        tableHTML += `</tr></thead><tbody>`;
        (this.config.time_slots || []).forEach(slot => {
            tableHTML += `<tr><td>${slot}</td>`;
            Object.keys(days).forEach((dayKey, dayIndex) => {
                const claseId = this.config.horario?.[dayKey]?.[slot];
                let cellContent = '';
                if (claseId) {
                    const clase = this.clases.find(c => c.id == claseId);
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
