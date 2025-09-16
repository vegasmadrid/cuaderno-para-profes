// /assets/js/cpp-programador.js

(function($) {
    'use strict';
    let listenersAttached = false;

    window.CppProgramadorApp = {
        // --- Propiedades ---
        appElement: null,
        tabs: {},
        tabContents: {},
        sesionModal: {},
        configModal: {},
        clases: [],
        config: {
            time_slots: [],
            horario: {},
            calendar_config: {}
        },
        sesiones: [],
        currentClase: null,
        currentEvaluacionId: null,
        currentSesion: null,
        originalContent: '',
        semanaDate: new Date(),
        isProcessing: false,

        // --- Inicialización ---
        init(initialClaseId) {
            this.appElement = document.getElementById('cpp-programador-app');
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
            $document.on('focusout', '#cpp-programador-app .cpp-actividad-titulo', function() { self.updateActividadTitle(this); });

            // Horario
            $document.on('click', '#cpp-programador-app .cpp-delete-slot-btn', function() { self.deleteTimeSlot(this.dataset.slot); });
            $document.on('click', '#cpp-programador-app #cpp-horario-add-slot-btn', () => self.addTimeSlot());
            $document.on('change', '#cpp-programador-app #cpp-horario-table .cpp-horario-clase-selector', function() { self.updateHorarioCellColor(this); self.saveHorario(true); });
            $document.on('focusout', '#cpp-programador-app .cpp-horario-notas-input', function() { self.saveHorario(true); });
            $document.on('focusout', '#cpp-programador-app .cpp-horario-time-slot', function() { self.handleTimeSlotEdit(this); });

            // Navegación y Controles Generales
            $document.on('click', '#cpp-programador-app #cpp-horario-config-btn', function() {
                $('.cpp-main-tab-link[data-tab="configuracion"]').click();
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
        },

        // --- Lógica de la App ---
        handleInlineEdit(element) {
            const newContent = element.innerHTML;
            if (newContent === this.originalContent) return;
            const sesion = this.currentSesion;
            const field = element.dataset.field;
            if (!sesion || !field) return;
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
                    if (result.success) { this.fetchData(this.currentClase.id); }
                    else { alert('Error al añadir la sesión en línea.'); }
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
        fetchDataFromServer() {
            return fetch(cppFrontendData.ajaxUrl, {
                method: 'POST',
                body: new URLSearchParams({ action: 'cpp_get_programador_all_data', nonce: cppFrontendData.nonce })
            }).then(res => res.json());
        },

        processInitialData(result) {
            if (result.success) {
                this.clases = result.data.clases || [];
                this.config = result.data.config || { time_slots: [], horario: {} };
                this.sesiones = result.data.sesiones || [];
                const initialClaseId = cpp.getInitialClaseId();
                if (this.clases.length > 0) {
                    if (initialClaseId) { this.loadClass(initialClaseId); }
                    else { this.tabContents.programacion.innerHTML = '<p>No se ha seleccionado ninguna clase.</p>'; }
                } else {
                    this.tabContents.programacion.innerHTML = '<p>No tienes clases creadas. Por favor, ve al Cuaderno y crea al menos una clase.</p>';
                }
            } else {
                this.tabContents.programacion.innerHTML = '<p style="color:red;">Error al cargar los datos del programador.</p>';
            }
        },

        fetchData() {
            this.fetchDataFromServer().then(result => this.processInitialData(result));
        },

        refreshCurrentView() {
            const currentSesionId = this.currentSesion ? this.currentSesion.id : null;
            this.fetchDataFromServer().then(result => {
                if (result.success) {
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

        saveHorario(showNotification = false) {
            const newHorario = {};
            this.appElement.querySelectorAll('#cpp-horario-table tbody tr').forEach(tr => {
                tr.querySelectorAll('td[data-day]').forEach(td => {
                    const day = td.dataset.day;
                    const slot = td.dataset.slot;
                    const claseId = td.querySelector('.cpp-horario-clase-selector').value;
                    const notas = td.querySelector('.cpp-horario-notas-input').value;
                    if (claseId || notas.trim() !== '') {
                        if (!newHorario[day]) { newHorario[day] = {}; }
                        newHorario[day][slot] = { claseId: claseId, notas: notas.trim() };
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
            if ($btn) { $btn.disabled = true; $btn.innerHTML = '<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...'; }
            if (fromModal) {
                sesionData = { id: this.sesionModal.idInput.value, clase_id: this.sesionModal.claseIdInput.value, evaluacion_id: this.sesionModal.evaluacionIdInput.value, titulo: this.sesionModal.tituloInput.value, descripcion: this.sesionModal.descripcionInput.value };
            } else { sesionData = inlineData; }
            const data = new URLSearchParams({ action: 'cpp_save_programador_sesion', nonce: cppFrontendData.nonce, sesion: JSON.stringify(sesionData) });
            fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
                .then(res => res.json())
                .then(result => {
                    if (result.success) {
                        if (fromModal) this.closeSesionModal();
                        this.fetchData(this.currentClase.id);
                    } else { alert('Error al guardar.'); this.fetchData(this.currentClase.id); }
                })
                .finally(() => {
                    this.isProcessing = false;
                    if ($btn) { $btn.disabled = false; $btn.innerHTML = originalBtnHtml; }
                });
        },

        saveStartDate(startDate) {
            if (!this.currentEvaluacionId) return;
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
            if (!confirm('¿Seguro que quieres eliminar esta sesión y todas sus actividades?')) return;
            if (this.isProcessing) return;
            this.isProcessing = true;
            const data = new URLSearchParams({ action: 'cpp_delete_programador_sesion', nonce: cppFrontendData.nonce, sesion_id: sesionId });
            fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
                .then(res => res.json())
                .then(result => {
                    if (result.success) {
                        if (this.currentSesion && this.currentSesion.id == sesionId) this.currentSesion = null;
                        this.fetchData(this.currentClase.id);
                    } else { alert('Error al eliminar la sesión.'); }
                })
                .finally(() => { this.isProcessing = false; });
        },

        saveSesionOrder(newOrder) {
            const data = new URLSearchParams({ action: 'cpp_save_sesiones_order', nonce: cppFrontendData.nonce, clase_id: this.currentClase.id, evaluacion_id: this.currentEvaluacionId, orden: JSON.stringify(newOrder) });
            fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
                if (result.success) { this.fetchData(this.currentClase.id); }
                else { alert('Error al guardar el orden.'); this.fetchData(this.currentClase.id); }
            });
        },

        // --- Renderizado y UI ---
        // ... (resto de funciones de renderizado, sesiones, etc.)

        // --- Lógica de Actividades ---
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
            actionsHTML += `<button class="cpp-delete-actividad-btn" data-actividad-id="${actividad.id}" data-tipo="${actividad.tipo}" title="Eliminar">${deleteIconSVG}</button>`;
            return `
                <li class="cpp-actividad-item ${isEvaluable ? 'evaluable' : 'no-evaluable'}" data-actividad-id="${actividad.id}" data-tipo="${actividad.tipo}">
                    <span class="cpp-actividad-handle">⠿</span>
                    <span class="cpp-actividad-titulo" contenteditable="true">${actividad.titulo}</span>
                    <div class="cpp-actividad-actions">${actionsHTML}</div>
                </li>
            `;
        },

        addNonEvaluableActividad(sesionId) {
            const newActividad = { sesion_id: sesionId, titulo: 'Nueva tarea...' };
            const data = new URLSearchParams({ action: 'cpp_save_programador_actividad', nonce: cppFrontendData.nonce, actividad: JSON.stringify(newActividad) });
            fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
                .then(res => res.json())
                .then(result => {
                    if (result.success) { this.refreshCurrentView(); }
                    else { this.showNotification('Error al añadir la tarea.', 'error'); }
                });
        },

        addEvaluableActividad(sesionId) {
            const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
            if (!currentEval) { this.showNotification('No se puede añadir una actividad evaluable sin una evaluación seleccionada.', 'error'); return; }
            if (cpp.modals && cpp.modals.actividades && typeof cpp.modals.actividades.mostrarAnadir === 'function') {
                cpp.modals.actividades.mostrarAnadir(sesionId);
            } else { this.showNotification('Error: El módulo de modales no está disponible.', 'error'); }
        },

        editEvaluableActividad(actividadId) {
            const data = new URLSearchParams({ action: 'cpp_get_evaluable_activity_data', nonce: cppFrontendData.nonce, actividad_id: actividadId });
            fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
                .then(res => res.json())
                .then(result => {
                    if (result.success) {
                        if (cpp.modals && cpp.modals.actividades && typeof cpp.modals.actividades.cargarConDatos === 'function') {
                            cpp.modals.actividades.cargarConDatos(result.data);
                        } else { this.showNotification('Error: El módulo de modales no está disponible.', 'error'); }
                    } else { this.showNotification(result.data.message || 'Error al cargar los datos de la actividad.', 'error'); }
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
            const data = new URLSearchParams({ action: action, nonce: cppFrontendData.nonce, actividad_id: actividadId });
            fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
                .then(res => res.json())
                .then(result => {
                    if (result.success) {
                        this.showNotification('Actividad eliminada.');
                        this.refreshCurrentView();
                        if (tipo === 'evaluable') {
                            document.dispatchEvent(new CustomEvent('cpp:forceGradebookReload'));
                        }
                    } else { this.showNotification(result.data.message || 'Error al eliminar la actividad.', 'error'); }
                });
        },

        updateActividadTitle(element) {
            const $element = $(element);
            const newTitle = $element.text().trim();
            const $li = $element.closest('li.cpp-actividad-item');
            const actividadId = $li.data('actividad-id');
            const tipo = $li.data('tipo');
            const actividad = this.currentSesion.actividades_programadas.find(a => a.id == actividadId);
            if (!actividad || newTitle === actividad.titulo) return;

            let action = '';
            let payload = {};

            if (tipo === 'evaluable') {
                action = 'cpp_update_evaluable_activity_title';
                payload = { id: actividadId, titulo: newTitle, user_id: cppFrontendData.userId };
            } else {
                action = 'cpp_save_programador_actividad';
                payload = { ...actividad, titulo: newTitle };
            }

            const data = new URLSearchParams({ action: action, nonce: cppFrontendData.nonce, actividad: JSON.stringify(payload) });
            fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
                .then(res => res.json())
                .then(result => {
                    if (result.success) {
                        actividad.titulo = newTitle;
                        this.showNotification('Título guardado.');
                        if (tipo === 'evaluable') {
                            document.dispatchEvent(new CustomEvent('cpp:forceGradebookReload'));
                        }
                    } else {
                        this.showNotification('Error al guardar.', 'error');
                        $element.text(actividad.titulo);
                    }
                });
        },

        // --- El resto de funciones de renderizado (horario, semana, etc.) ---
        // ...
    };
})(jQuery);
