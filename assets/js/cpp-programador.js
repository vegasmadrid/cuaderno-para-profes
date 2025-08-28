// /assets/js/cpp-programador.js

document.addEventListener('DOMContentLoaded', function() {
    const appElement = document.getElementById('cpp-programador-app');
    if (appElement) { CppProgramadorApp.init(appElement); }
});

const CppProgramadorApp = {
    appElement: null,
    tabs: {},
    tabContents: {},
    leccionModal: {},
    clases: [],
    config: { time_slots: [], horario: {} },
    lecciones: [],
    eventos: [],
    currentDate: new Date(),

    init(appElement) {
        this.appElement = appElement;
        this.tabs = { semana: appElement.querySelector('.cpp-tab-link[data-tab="semana"]'), clases: appElement.querySelector('.cpp-tab-link[data-tab="clases"]'), horario: appElement.querySelector('.cpp-tab-link[data-tab="horario"]') };
        this.tabContents = { semana: appElement.querySelector('#tab-semana'), clases: appElement.querySelector('#tab-clases'), horario: appElement.querySelector('#tab-horario') };
        this.leccionModal = {
            element: appElement.querySelector('#cpp-leccion-modal'),
            form: appElement.querySelector('#cpp-leccion-form'),
            title: appElement.querySelector('#cpp-leccion-modal-title'),
            idInput: appElement.querySelector('#cpp-leccion-id'),
            claseIdInput: appElement.querySelector('#cpp-leccion-clase-id'),
            tituloInput: appElement.querySelector('#cpp-leccion-titulo'),
            descripcionInput: appElement.querySelector('#cpp-leccion-descripcion'),
        };
        this.emptyStateElement = appElement.querySelector('#cpp-programador-empty-state');
        this.attachEventListeners();
        this.fetchData();
    },

    attachEventListeners() {
        Object.values(this.tabs).forEach(tab => tab.addEventListener('click', e => this.switchTab(e.target.dataset.tab)));
        this.tabContents.horario.addEventListener('click', e => {
            if (e.target.id === 'cpp-horario-save-btn') this.saveHorario();
            if (e.target.id === 'cpp-horario-add-slot-btn') this.addTimeSlot();
        });
        this.tabContents.clases.addEventListener('click', e => {
            if (e.target.matches('.cpp-add-leccion-btn')) this.openLeccionModal(e.target.dataset.claseId);
            if (e.target.matches('.cpp-edit-leccion-btn')) this.openLeccionModal(this.lecciones.find(l => l.id == e.target.dataset.leccionId).clase_id, this.lecciones.find(l => l.id == e.target.dataset.leccionId));
            if (e.target.matches('.cpp-delete-leccion-btn')) this.deleteLeccion(e.target.dataset.leccionId);
        });
        this.tabContents.semana.addEventListener('click', e => {
            if (e.target.matches('.cpp-semana-prev-btn')) { this.currentDate.setDate(this.currentDate.getDate() - 7); this.renderSemanaTab(); }
            if (e.target.matches('.cpp-semana-next-btn')) { this.currentDate.setDate(this.currentDate.getDate() + 7); this.renderSemanaTab(); }
            if (e.target.matches('.cpp-add-evento-btn')) {
                const { fecha, slot, claseId } = e.target.dataset;
                this.assignLeccionToEvento(fecha, slot, claseId);
            }
            if (e.target.matches('.cpp-delete-evento-btn')) {
                this.deleteEvento(e.target.dataset.eventoId);
            }
        });
        this.leccionModal.element.querySelector('.cpp-modal-close').addEventListener('click', () => this.closeLeccionModal());
        this.leccionModal.form.addEventListener('submit', e => this.saveLeccion(e));
        this.emptyStateElement.querySelector('#cpp-programador-create-example-btn').addEventListener('click', () => this.createExampleData());
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
                this.lecciones = result.data.lecciones || [];
                this.eventos = result.data.eventos || [];
                this.render();
            }
        });
    },

    saveHorario() { /* ... (código existente) ... */ },
    saveLeccion(e) { /* ... (código existente) ... */ },
    deleteLeccion(leccionId) { /* ... (código existente) ... */ },

    assignLeccionToEvento(fecha, slot, claseId) {
        const leccionesDeClase = this.lecciones.filter(l => l.clase_id == claseId);
        if (leccionesDeClase.length === 0) {
            alert('No hay lecciones en el banco para esta clase. Añade lecciones en la pestaña "Clases".');
            return;
        }
        const promptMessage = 'Selecciona una lección para asignar:\n\n' + leccionesDeClase.map((l, i) => `${i + 1}: ${l.titulo}`).join('\n');
        const choice = parseInt(prompt(promptMessage, '1'), 10);

        if (choice > 0 && choice <= leccionesDeClase.length) {
            const leccionSeleccionada = leccionesDeClase[choice - 1];
            const eventoData = { leccion_id: leccionSeleccionada.id, fecha: fecha, hora_inicio: slot };
            const data = new URLSearchParams({ action: 'cpp_save_programador_evento', nonce: cppFrontendData.nonce, evento: JSON.stringify(eventoData) });
            fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
                if (result.success) { this.fetchData(); } else { alert('Error al asignar la lección.'); }
            });
        }
    },

    deleteEvento(eventoId) {
        if (!confirm('¿Quitar esta lección del calendario?')) return;
        const data = new URLSearchParams({ action: 'cpp_delete_programador_evento', nonce: cppFrontendData.nonce, evento_id: eventoId });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) { this.fetchData(); } else { alert('Error al quitar la lección.'); }
        });
    },

    createExampleData() {
        const data = new URLSearchParams({ action: 'cpp_create_programador_example_data', nonce: cppFrontendData.nonce });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) { this.fetchData(); } else { alert(result.data.message); }
        });
    },

    addTimeSlot() { /* ... (código existente) ... */ },
    openLeccionModal(claseId, leccion = null) { /* ... (código existente) ... */ },
    closeLeccionModal() { /* ... (código existente) ... */ },

    // --- Renderizado ---
    render() {
        if (this.lecciones.length === 0 && Object.keys(this.config.horario).length === 0) {
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

    renderHorarioTab() { /* ... (código existente) ... */ },
    renderClasesTab() { /* ... (código existente) ... */ },

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
                        const leccion = this.lecciones.find(l => l.id == evento.leccion_id);
                        cellContent += `<p>${leccion ? leccion.titulo : 'Lección...'}</p><button class="cpp-delete-evento-btn" data-evento-id="${evento.id}">🗑️</button>`;
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

// Re-pegar funciones que se omitieron por brevedad
CppProgramadorApp.saveHorario = function() {
    const newHorario = {};
    this.appElement.querySelectorAll('#cpp-horario-table tbody tr').forEach(tr => {
        tr.querySelectorAll('td[data-day]').forEach(td => {
            const day = td.dataset.day, slot = td.dataset.slot, claseId = td.querySelector('select').value;
            if (claseId) { if (!newHorario[day]) newHorario[day] = {}; newHorario[day][slot] = claseId; }
        });
    });
    const data = new URLSearchParams({ action: 'cpp_save_programador_horario', nonce: cppFrontendData.nonce, horario: JSON.stringify(newHorario), time_slots: JSON.stringify(this.config.time_slots) });
    fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
        if (result.success) { alert('Horario guardado.'); this.fetchData(); } else { alert('Error al guardar.'); }
    });
};
CppProgramadorApp.saveLeccion = function(e) {
    e.preventDefault();
    const leccionData = { id: this.leccionModal.idInput.value, clase_id: this.leccionModal.claseIdInput.value, titulo: this.leccionModal.tituloInput.value, descripcion: this.leccionModal.descripcionInput.value };
    const data = new URLSearchParams({ action: 'cpp_save_programador_leccion', nonce: cppFrontendData.nonce, leccion: JSON.stringify(leccionData) });
    fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
        if (result.success) { this.closeLeccionModal(); this.fetchData(); } else { alert('Error al guardar.'); }
    });
};
CppProgramadorApp.deleteLeccion = function(leccionId) {
    if (!confirm('¿Seguro?')) return;
    const data = new URLSearchParams({ action: 'cpp_delete_programador_leccion', nonce: cppFrontendData.nonce, leccion_id: leccionId });
    fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
        if (result.success) { this.fetchData(); } else { alert('Error al eliminar.'); }
    });
};
CppProgramadorApp.addTimeSlot = function() {
    const newSlot = prompt('Nuevo tramo horario (ej: 13:00):', '13:00');
    if (newSlot && !this.config.time_slots.includes(newSlot)) {
        this.config.time_slots.push(newSlot);
        this.config.time_slots.sort();
        this.renderHorarioTab();
    }
};
CppProgramadorApp.openLeccionModal = function(claseId, leccion = null) {
    this.leccionModal.form.reset();
    this.leccionModal.claseIdInput.value = claseId;
    if (leccion) {
        this.leccionModal.title.textContent = 'Editar Lección';
        this.leccionModal.idInput.value = leccion.id;
        this.leccionModal.tituloInput.value = leccion.titulo;
        this.leccionModal.descripcionInput.value = leccion.descripcion;
    } else {
        this.leccionModal.title.textContent = 'Nueva Lección';
        this.leccionModal.idInput.value = '';
    }
    this.leccionModal.element.style.display = 'block';
};
CppProgramadorApp.closeLeccionModal = function() { this.leccionModal.element.style.display = 'none'; };
CppProgramadorApp.renderHorarioTab = function() {
    const content = this.tabContents.horario;
    const days = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes' };
    let classOptions = '<option value="">-- Vacío --</option>' + this.clases.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    let tableHTML = `<div class="cpp-horario-actions"><button id="cpp-horario-add-slot-btn" class="cpp-btn">Añadir Tramo</button><button id="cpp-horario-save-btn" class="cpp-btn cpp-btn-primary">Guardar</button></div><table id="cpp-horario-table" class="cpp-horario-table"><thead><tr><th>Hora</th>${Object.values(days).map(day => `<th>${day}</th>`).join('')}</tr></thead><tbody>`;
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
};
CppProgramadorApp.renderClasesTab = function() {
    const content = this.tabContents.clases;
    let html = '<div class="cpp-clases-columns">';
    if (this.clases.length === 0) { html += '<p>No has creado ninguna clase.</p>'; }
    else {
        this.clases.forEach(clase => {
            const leccionesDeClase = this.lecciones.filter(l => l.clase_id == clase.id);
            html += `<div class="cpp-clase-column"><h3>${clase.nombre}</h3><ul class="cpp-lecciones-list">${leccionesDeClase.map(l => `<li class="cpp-leccion-item"><span>${l.titulo}</span><div class="cpp-leccion-actions"><button class="cpp-edit-leccion-btn" data-leccion-id="${l.id}">✏️</button><button class="cpp-delete-leccion-btn" data-leccion-id="${l.id}">🗑️</button></div></li>`).join('')}</ul><button class="cpp-add-leccion-btn" data-clase-id="${clase.id}">+ Añadir Lección</button></div>`;
        });
    }
    html += '</div>';
    content.innerHTML = html;
};
