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
        this.attachEventListeners();
        this.fetchData(initialClaseId);
    },

    attachEventListeners() {
        // Listener para el contenedor principal de la app del programador
        this.appElement.addEventListener('click', e => {
            // Botones de borrado
            if (e.target.matches('.cpp-delete-sesion-btn')) {
                e.stopPropagation();
                this.deleteSesion(e.target.dataset.sesionId);
                return;
            }
            if (e.target.matches('.cpp-delete-slot-btn')) {
                this.deleteTimeSlot(e.target.dataset.slot);
                return;
            }

            // Otros botones
            if (e.target.id === 'cpp-horario-add-slot-btn') {
                this.addTimeSlot();
                return;
            }
            if (e.target.matches('.cpp-add-sesion-btn')) {
                this.openSesionModal();
                return;
            }

            // Navegación y selección
            const sesionItem = e.target.closest('.cpp-sesion-list-item');
            if (sesionItem) {
                this.currentSesion = this.sesiones.find(s => s.id == sesionItem.dataset.sesionId);
                this.renderProgramacionTab();
                return;
            }
            if (e.target.matches('.cpp-semana-prev-btn')) {
                this.semanaDate.setDate(this.semanaDate.getDate() - 7);
                this.renderSemanaTab();
                return;
            }
            if (e.target.matches('.cpp-semana-next-btn')) {
                this.semanaDate.setDate(this.semanaDate.getDate() + 7);
                this.renderSemanaTab();
                return;
            }
        });

        // Listeners para cambios y edición
        this.appElement.addEventListener('change', e => {
            if (e.target.tagName === 'SELECT' && e.target.closest('#cpp-horario-table')) {
                this.saveHorario(true);
            }
            if (e.target.id === 'cpp-programacion-evaluacion-selector') {
                this.currentEvaluacionId = e.target.value;
                this.currentSesion = null;
                this.render();
            }
            if (e.target.id === 'cpp-start-date-selector') {
                this.saveStartDate(e.target.value);
            }
        });

        this.appElement.addEventListener('focusin', e => {
            if (e.target.matches('[contenteditable]')) {
                this.originalContent = e.target.innerHTML;
            }
            if (e.target.matches('.cpp-horario-time-slot')) {
                e.target.dataset.originalValue = e.target.textContent;
            }
        });

        this.appElement.addEventListener('focusout', e => {
            if (e.target.matches('[contenteditable]')) {
                this.handleInlineEdit(e.target);
            }
            if (e.target.matches('.cpp-horario-time-slot')) {
                this.handleTimeSlotEdit(e.target);
            }
        });

        this.appElement.addEventListener('keydown', e => {
            if (e.target.matches('[contenteditable]')) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.target.blur();
                } else if (e.key === 'Escape') {
                    e.target.innerHTML = this.originalContent;
                    e.target.blur();
                }
            }
            if (e.target.matches('.cpp-horario-time-slot')) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                } else if (e.key === 'Escape') {
                    e.target.textContent = e.target.dataset.originalValue;
                    e.target.blur();
                }
            }
        });

        // Listeners para el modal de sesión, que está fuera del flujo principal
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

    // --- Lógica de Datos (AJAX) ---
    fetchData(initialClaseId) {
        const data = new URLSearchParams({ action: 'cpp_get_programador_all_data', nonce: cppFrontendData.nonce });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                this.clases = result.data.clases || [];
                this.config = result.data.config || { time_slots: [], horario: {} };
                this.sesiones = result.data.sesiones || [];

                if (this.clases.length > 0) {
                    if (initialClaseId) {
                        this.loadClass(initialClaseId);
                    } else {
                        // Si no se proporciona una clase inicial, no se muestra nada.
                        this.tabContents.programacion.innerHTML = '<p>No se ha seleccionado ninguna clase.</p>';
                    }
                } else {
                    this.tabContents.programacion.innerHTML = '<p>No tienes clases creadas. Por favor, ve al Cuaderno y crea al menos una clase.</p>';
                }
            } else {
                this.tabContents.programacion.innerHTML = '<p style="color:red;">Error al cargar los datos del programador.</p>';
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
                this.fetchData(this.currentClase.id);
            } else {
                alert('Error al guardar.');
                this.fetchData(this.currentClase.id);
            }
        });
    },
    saveStartDate(startDate) {
        if (!this.currentEvaluacionId) return;
        const date = new Date(`${startDate}T12:00:00`);
        const dayOfWeek = date.getUTCDay();
        const dayMapping = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
        const dayKey = dayMapping[dayOfWeek];
        const classIdInHorario = Object.values(this.config.horario[dayKey] || {}).includes(String(this.currentClase.id));
        if (startDate && (!dayKey || !this.config.horario[dayKey] || !classIdInHorario)) {
            alert('La fecha de inicio debe ser un día en el que esta clase tenga horas asignadas en el horario.');
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
        const data = new URLSearchParams({ action: 'cpp_delete_programador_sesion', nonce: cppFrontendData.nonce, sesion_id: sesionId });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                if (this.currentSesion && this.currentSesion.id == sesionId) this.currentSesion = null;
                this.fetchData(this.currentClase.id);
            }
            else { alert('Error al eliminar la sesión.'); }
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
            jQuery(list).sortable({
                handle: '.cpp-sesion-handle',
                placeholder: 'cpp-sesion-placeholder',
                update: (event, ui) => {
                    const newOrder = jQuery(event.target).sortable('toArray', { attribute: 'data-sesion-id' });
                    this.saveSesionOrder(newOrder);
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
        // Se elimina el selector de clase. El nombre de la clase se mostrará en la barra superior principal.
        let controlsHTML = `<div class="cpp-programacion-controls"><label>Evaluación: <select id="cpp-programacion-evaluacion-selector" ${!evaluacionOptions ? 'disabled' : ''}>${evaluacionOptions || '<option>Sin evaluaciones</option>'}</select></label><label>Fecha de Inicio: <input type="date" id="cpp-start-date-selector" value="${startDate}" ${!this.currentEvaluacionId ? 'disabled' : ''}></label></div>`;
        let layoutHTML = `<div class="cpp-programacion-layout"><div class="cpp-programacion-left-col"><ul class="cpp-sesiones-list-detailed">${this.renderSesionList()}</ul><button class="cpp-add-sesion-btn cpp-btn cpp-btn-primary" ${!this.currentEvaluacionId ? 'disabled' : ''}>+ Añadir Sesión</button></div><div class="cpp-programacion-right-col" id="cpp-programacion-right-col">${this.renderProgramacionTabRightColumn()}</div></div>`;
        content.innerHTML = controlsHTML + layoutHTML;
        this.makeSesionesSortable();
    },
    renderSesionList() {
        const sesionesFiltradas = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
        if (sesionesFiltradas.length === 0) return '<li>No hay sesiones para esta evaluación.</li>';
        return sesionesFiltradas.map((s, index) => `<li class="cpp-sesion-list-item ${this.currentSesion && s.id == this.currentSesion.id ? 'active' : ''}" data-sesion-id="${s.id}"><span class="cpp-sesion-handle">⠿</span><span class="cpp-sesion-number">${index + 1}.</span><span class="cpp-sesion-title">${s.titulo}</span><button class="cpp-delete-sesion-btn" data-sesion-id="${s.id}">❌</button></li>`).join('');
    },
    renderProgramacionTabRightColumn() {
        if (!this.currentSesion) return '<p class="cpp-empty-panel">Selecciona una sesión para ver su contenido.</p>';
        return `<div class="cpp-sesion-detail-container" data-sesion-id="${this.currentSesion.id}"><h3 class="cpp-sesion-detail-title" data-field="titulo" contenteditable="true">${this.currentSesion.titulo}</h3><div class="cpp-sesion-detail-section"><h4>Descripción</h4><div class="cpp-sesion-detail-content" data-field="descripcion" contenteditable="true">${this.currentSesion.descripcion || ''}</div></div><div class="cpp-sesion-detail-section"><h4>Objetivos</h4><div class="cpp-sesion-detail-content" data-field="objetivos" contenteditable="true">${this.currentSesion.objetivos || ''}</div></div><div class="cpp-sesion-detail-section"><h4>Recursos</h4><div class="cpp-sesion-detail-content" data-field="recursos" contenteditable="true">${this.currentSesion.recursos || ''}</div></div><div class="cpp-sesion-detail-section"><h4>Actividades</h4><div class="cpp-sesion-detail-content" data-field="actividades" contenteditable="true">${this.currentSesion.actividades || ''}</div></div><div class="cpp-sesion-detail-section"><h4>Seguimiento</h4><div class="cpp-sesion-detail-content" data-field="seguimiento" contenteditable="true">${this.currentSesion.seguimiento || ''}</div></div></div>`;
    },
    renderHorarioTab() {
        if (!this.tabContents.horario) return;
        const content = this.tabContents.horario;
        const days = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes' };
        let classOptions = '<option value="">-- Vacío --</option>' + this.clases.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        // El botón de añadir tramo ahora va en la cabecera
        const addButtonHTML = '<button id="cpp-horario-add-slot-btn" class="cpp-btn cpp-btn-primary" title="Añadir nuevo tramo horario">+ Añadir Tramo</button>';
        let tableHTML = `<table id="cpp-horario-table" class="cpp-horario-table"><thead><tr><th>Hora</th>${Object.values(days).map(day => `<th>${day}</th>`).join('')}<th>${addButtonHTML}</th></tr></thead><tbody>`;

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
        if (!this.currentClase || !this.currentEvaluacionId) { content.innerHTML = '<p class="cpp-empty-panel">Selecciona una clase y evaluación.</p>'; return; }
        const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
        if (!currentEval || !currentEval.start_date) { content.innerHTML = '<p class="cpp-empty-panel">Establece una fecha de inicio en "Programación".</p>'; return; }

        const sesiones = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
        if (sesiones.length === 0) { content.innerHTML = '<p class="cpp-empty-panel">No hay sesiones para programar.</p>'; return; }

        const horario = this.config.horario;

        // ** FIX: Pre-check to prevent infinite loop **
        let classHasSlots = false;
        for (const day in horario) {
            if (Object.values(horario[day]).includes(String(this.currentClase.id))) {
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
        const dayMapping = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };

        // Add a safety break to prevent browser crashes in unforeseen edge cases.
        let safetyCounter = 0;
        const MAX_ITERATIONS = 50000; // Approx 136 years of daily scheduling, a safe limit.

        while(sessionIndex < sesiones.length) {
            if (++safetyCounter > MAX_ITERATIONS) {
                console.error("Scheduler safety break triggered. Check for logic errors.");
                content.innerHTML = '<p class="cpp-empty-panel" style="color: red;">Error: Se ha producido un error inesperado al generar el calendario. Revisa la configuración del horario y las fechas.</p>';
                break;
            }

            const dayOfWeek = currentDate.getUTCDay();
            const dayKey = dayMapping[dayOfWeek];

            if (dayKey && horario[dayKey]) {
                const sortedSlots = Object.keys(horario[dayKey]).sort();
                for (const slot of sortedSlots) {
                    if (sessionIndex < sesiones.length && String(horario[dayKey][slot]) === String(this.currentClase.id)) {
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
        return Array.from({length: 5}, (v, i) => { const weekDay = new Date(monday.getTime()); weekDay.setDate(monday.getDate() + i); return weekDay; });
    }
};
