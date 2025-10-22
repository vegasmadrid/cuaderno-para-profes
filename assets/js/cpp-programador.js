// /assets/js/cpp-programador.js

(function($) {
    'use strict';
    let listenersAttached = false;

    // La inicialización ahora es controlada por cpp-cuaderno.js
    window.CppProgramadorApp = {
    // --- Propiedades ---
    appElement: null, tabs: {}, tabContents: {}, sesionModal: {}, configModal: {}, copySesionModal: {},
    clases: [], config: { time_slots: [], horario: {}, calendar_config: {} }, sesiones: [], simbolos: {},
    currentClase: null, currentEvaluacionId: null, currentSesion: null, currentSimboloEditingSesionId: null,
    selectedSesiones: [],
    lastClickedSesionId: null,
    originalContent: '', semanaDate: new Date(),
    isProcessing: false,
    isShiftSelecting: false,

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
        this.copySesionModal = {
            element: document.querySelector('#cpp-copy-sesion-modal'),
            form: document.querySelector('#cpp-copy-sesion-form'),
            title: document.querySelector('#cpp-copy-sesion-modal-title'),
            claseSelect: document.querySelector('#cpp-copy-dest-clase'),
            evaluacionSelect: document.querySelector('#cpp-copy-dest-evaluacion')
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

        // --- Delegated events for robustness ---

        // Sesiones
        $document.on('click', '#cpp-add-sesion-toolbar-btn', () => { if (self.currentSesion) { self.addInlineSesion(self.currentSesion.id); } });
        $document.on('click', '#cpp-delete-sesion-toolbar-btn', () => { if (self.currentSesion) { self.deleteSesion(self.currentSesion.id); } });
        $document.on('click', '#cpp-programador-app .cpp-add-sesion-btn', () => self.openSesionModal()); // Botón en vista vacía

        $document.on('click', '#cpp-programador-app .cpp-sesion-list-item', function(e) {
            const sesionId = this.dataset.sesionId;
            const isCheckboxClick = e.target.closest('.cpp-sesion-checkbox');

            // Shift-click on the row (but not on the checkbox)
            if (e.shiftKey && self.lastClickedSesionId && !isCheckboxClick) {
                e.preventDefault();
                self.handleShiftSelection(sesionId);
                return;
            }

            // If it's a click on the checkbox, do nothing.
            // It's handled by its own 'click' and 'change' handlers.
            if (isCheckboxClick) {
                return;
            }

            // Normal click on the row
            self.lastClickedSesionId = sesionId;

            if (self.currentSesion && self.currentSesion.id == sesionId) {
                return;
            }

            if (self.selectedSesiones.length > 0) {
                self.selectedSesiones = [];
                self.updateBulkActionsUI();
                self.appElement.querySelectorAll('.cpp-sesion-checkbox:checked').forEach(cb => cb.checked = false);
            }

            self.currentSesion = self.sesiones.find(s => s.id == sesionId);

            const listContainer = this.closest('ul');
            if (listContainer) {
                const oldActive = listContainer.querySelector('.cpp-sesion-list-item.active');
                if (oldActive) oldActive.classList.remove('active');
            }
            this.classList.add('active');

            const rightCol = self.appElement.querySelector('#cpp-programacion-right-col');
            if (rightCol) {
                rightCol.innerHTML = self.renderProgramacionTabRightColumn();
                self.makeActividadesSortable();
            }

            const isSesionSelected = self.currentSesion !== null;
            const toolbar = self.appElement.querySelector('.cpp-programacion-action-controls');
            if (toolbar) {
                toolbar.querySelector('#cpp-add-sesion-toolbar-btn').disabled = !isSesionSelected;
                toolbar.querySelector('#cpp-delete-sesion-toolbar-btn').disabled = !isSesionSelected;
                toolbar.querySelector('#cpp-simbolo-sesion-toolbar-btn').disabled = !isSesionSelected;
                const fijarBtn = toolbar.querySelector('#cpp-fijar-sesion-toolbar-btn');
                fijarBtn.disabled = !isSesionSelected;
                if (isSesionSelected) {
                    if (self.currentSesion.fecha_fijada) {
                        fijarBtn.innerHTML = '<span class="dashicons dashicons-unlock"></span>';
                        fijarBtn.title = 'Desfijar fecha';
                    } else {
                        fijarBtn.innerHTML = '<span class="dashicons dashicons-admin-post"></span>';
                        fijarBtn.title = 'Fijar fecha';
                    }
                }
            }
        });

        // Actividades
        $document.on('click', '#cpp-add-actividad-no-evaluable-btn', function() { self.addNonEvaluableActividad(this.dataset.sesionId); });
        $document.on('click', '#cpp-add-actividad-evaluable-btn', function() { self.addEvaluableActividad(this.dataset.sesionId); });
        $document.on('click', '.cpp-edit-evaluable-btn', function() { self.editEvaluableActividad(this.dataset.actividadId); });
        $document.on('click', '.cpp-edit-no-evaluable-btn', function() { self.editNonEvaluableActividad(this.dataset.actividadId); });
        $document.on('click', '#cpp-programador-app .cpp-delete-actividad-btn', function() { self.deleteActividad(this.dataset.actividadId, this.dataset.tipo); });
        $document.on('focusout', '#cpp-programador-app .cpp-actividad-titulo', function() { self.updateActividadTitle(this, this.dataset.actividadId); });


        // Horario
        $document.on('click', '#cpp-programador-app .cpp-delete-slot-btn', function() { self.deleteTimeSlot(this.dataset.slot); });
        $document.on('click', '#cpp-programador-app #cpp-horario-add-slot-btn', () => self.addTimeSlot());
        $document.on('change', '#cpp-programador-app #cpp-horario-table select', function() { self.updateHorarioCellColor(this); self.saveHorario(true); });
        $document.on('focusout', '#cpp-programador-app .cpp-horario-notas-input', function() { self.saveHorario(true); });
        $document.on('focusout', '#cpp-programador-app .cpp-horario-time-slot', function() { self.handleTimeSlotEdit(this); });

        // Navegación y Controles Generales
        $document.on('click', '.cpp-main-tab-link[data-tab="programacion"]', () => {
            setTimeout(() => {
                self.updateBulkActionsUI();
            }, 0);
        });
        $document.on('click', '#cpp-programador-app #cpp-horario-config-btn', function() {
            $('.cpp-main-tab-link[data-tab="configuracion"]').click();
            if (cpp.config && typeof cpp.config.handleConfigTabClick === 'function') {
                cpp.config.handleConfigTabClick(null, 'calendario');
            }
        });
        $document.on('click', '#cpp-programador-app .cpp-semana-prev-btn', () => { self.semanaDate.setDate(self.semanaDate.getDate() - 7); self.renderSemanaTab(); });
        $document.on('click', '#cpp-programador-app .cpp-semana-next-btn', () => { self.semanaDate.setDate(self.semanaDate.getDate() + 7); self.renderSemanaTab(); });
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

        // --- Eventos de Configuración General (delegados desde body) ---
        const $body = $('body');
        $body.on('click', '#cpp-add-holiday-btn', () => this.addHoliday());
        $body.on('click', '.cpp-remove-holiday-btn', function() { self.removeHoliday(this.closest('.cpp-list-item').dataset.index); });
        $body.on('click', '#cpp-add-vacation-btn', () => this.addVacation());
        $body.on('click', '.cpp-remove-vacation-btn', function() { self.removeVacation(this.closest('.cpp-list-item').dataset.index); });
        $body.on('submit', '#cpp-config-form', e => this.saveConfig(e));

        // --- Copy Sessions ---
        $document.on('click', '#cpp-programador-app .cpp-sesion-checkbox', function(e) {
            if (e.shiftKey && self.lastClickedSesionId) {
                e.preventDefault();
                self.isShiftSelecting = true;
                self.handleShiftSelection(this.dataset.sesionId);
                // Use a timeout to reset the flag after the current event loop,
                // allowing the 'change' event to be correctly ignored.
                setTimeout(() => {
                    self.isShiftSelecting = false;
                }, 0);
            }
        });

        $document.on('change', '#cpp-programador-app .cpp-sesion-checkbox', function() {
            if (self.isShiftSelecting) return;
            self.handleSesionSelection(this.dataset.sesionId, this.checked);
        });
        $document.on('click', '#cpp-copy-selected-btn', () => self.openCopySesionModal());
        $document.on('click', '#cpp-delete-selected-btn', () => self.handleDeleteSelectedSesions());
        $document.on('click', '#cpp-fijar-sesion-toolbar-btn', () => self.handleFijarSesionClick());
        $document.on('click', '#cpp-deselect-all-btn', () => self.cancelSelection());
        this.copySesionModal.element.querySelector('.cpp-modal-close').addEventListener('click', () => this.closeCopySesionModal());
        this.copySesionModal.claseSelect.addEventListener('change', () => this.updateCopyModalEvaluations());
        this.copySesionModal.form.addEventListener('submit', e => this.handleCopySesions(e));

        // --- Simbolos (Palette) ---
        $document.on('click', '#cpp-simbolo-sesion-toolbar-btn', function() {
            if (self.currentSesion) {
                self.openSimboloPalette(this, self.currentSesion.id);
            }
        });
        // Note: The class is specific to the programmer palette to avoid conflicts
        $document.on('click', '.cpp-programador-symbol-palette .cpp-simbolo-item', function() {
            self.selectSimbolo(this.dataset.simboloId);
        });
        $document.on('click', '#cpp-programador-save-leyendas-btn', () => self.saveSimboloLeyendas());
        // Close on click outside
        $document.on('click', function(e) {
            const palette = document.querySelector('.cpp-programador-symbol-palette');
            // Close if clicked outside the palette AND not on the button that opens it
            if (palette && !palette.contains(e.target) && !e.target.closest('#cpp-simbolo-sesion-toolbar-btn')) {
                 self.closeSimboloPalette();
            }
        });
        $document.on('click', '.cpp-programador-symbol-palette .cpp-modal-close', () => self.closeSimboloPalette());


        // --- Semana View Navigation ---
        $document.on('click', '#cpp-programador-app .cpp-semana-slot', function() {
            const sesionId = this.dataset.sesionId;
            const claseId = this.dataset.claseId;
            const evaluacionId = this.dataset.evaluacionId;
            self.navigateToSesion(claseId, evaluacionId, sesionId);
        });
    },

    navigateToSesion(claseId, evaluacionId, sesionId) {
        if (!claseId || !evaluacionId || !sesionId) return;

        // Check if we are already in the correct class
        if (this.currentClase && this.currentClase.id == claseId) {
            // We are in the correct class, just switch tab and load session.
            // Pass the sesionId directly to loadClass.
            this.loadClass(claseId, evaluacionId, sesionId, false); // don't render yet

            // The main app (cpp-cuaderno.js) handles the tab switching. We just need to trigger the click.
            $('.cpp-main-tab-link[data-tab="programacion"]').click();

            // After the tab is switched, we render our content.
            // A small delay might be needed for the tab switch to complete.
            setTimeout(() => {
                this.render();
            }, 50);

        } else {
            // We need to switch to a different class.
            // Set a flag that processInitialData will use upon data loading.
            if (typeof cpp !== 'undefined') {
                cpp.pendingNavigation = {
                    target: 'programador',
                    claseId: claseId,
                    evaluacionId: evaluacionId,
                    sesionId: sesionId,
                };

                // Trigger the tab switch and class load in the main app
                $('.cpp-main-tab-link[data-tab="programacion"]').click();
                // --- FIX ---
                // Instead of calling a non-existent function, we find the corresponding
                // sidebar link for the class and trigger a click on it. This reuses
                // the existing, correct logic for switching classes.
                const sidebarLink = $(`.cpp-sidebar-clase-item[data-clase-id="${claseId}"] a`);
                if (sidebarLink.length) {
                    sidebarLink.click();
                } else {
                    console.error(`Error de navegación: No se encontró el enlace de la clase ${claseId} en la barra lateral.`);
                    // Opcional: mostrar un error al usuario
                    alert('Error: No se pudo cambiar a la clase seleccionada porque no se encontró en la lista.');
                }
            }
        }
    },

    handleDeleteSelectedSesions() {
        if (this.selectedSesiones.length === 0) {
            alert('Por favor, selecciona al menos una sesión para eliminar.');
            return;
        }

        const confirmMessage = `¿Estás seguro de que quieres eliminar ${this.selectedSesiones.length} ${this.selectedSesiones.length > 1 ? 'sesiones' : 'sesión'}? Esta acción no se puede deshacer.`;
        if (!confirm(confirmMessage)) {
            return;
        }

        let deleteActivities = false;
        const sessionsWithEvaluableActivities = this.selectedSesiones.some(sesionId => {
            const sesion = this.sesiones.find(s => s.id == sesionId);
            return sesion && sesion.actividades_programadas && sesion.actividades_programadas.some(act => act.tipo === 'evaluable');
        });

        if (sessionsWithEvaluableActivities) {
            deleteActivities = confirm("Algunas de las sesiones seleccionadas contienen actividades evaluables. ¿Deseas eliminar también estas actividades del cuaderno de notas?\n\n(Aceptar = SÍ, eliminar / Cancelar = NO, mantener y desvincular)");
        }

        if (this.isProcessing) return;
        this.isProcessing = true;

        const data = new URLSearchParams({
            action: 'cpp_delete_multiple_sesiones',
            nonce: cppFrontendData.nonce,
            session_ids: JSON.stringify(this.selectedSesiones),
            delete_activities: deleteActivities
        });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    this.showNotification(result.data.message || 'Sesiones eliminadas con éxito.');
                    if (this.currentSesion && this.selectedSesiones.includes(this.currentSesion.id.toString())) {
                        this.currentSesion = null;
                    }
                    this.selectedSesiones = [];
                    this.fetchData(this.currentClase.id, this.currentEvaluacionId);
                    if (result.data.needs_gradebook_reload) {
                        if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function' && this.currentClase && this.currentEvaluacionId) {
                            cpp.gradebook.cargarContenidoCuaderno(this.currentClase.id, this.currentClase.nombre, this.currentEvaluacionId);
                        }
                    }
                } else {
                    alert(result.data.message || 'Error al eliminar las sesiones.');
                }
            })
            .finally(() => {
                this.isProcessing = false;
                this.updateBulkActionsUI();
            });
    },

    cancelSelection() {
        this.selectedSesiones = [];
        this.appElement.querySelectorAll('.cpp-sesion-checkbox:checked').forEach(cb => cb.checked = false);
        this.updateBulkActionsUI();
    },
    handleShiftSelection(endSesionId) {
        const sesionElements = Array.from(this.appElement.querySelectorAll('.cpp-sesion-list-item'));
        const allSesionIds = sesionElements.map(el => el.dataset.sesionId);

        const startIndex = allSesionIds.indexOf(this.lastClickedSesionId);
        const endIndex = allSesionIds.indexOf(endSesionId);

        if (startIndex === -1 || endIndex === -1) {
            return;
        }

        const [start, end] = [startIndex, endIndex].sort((a, b) => a - b);
        const idsToSelect = allSesionIds.slice(start, end + 1);

        // Reemplazar la selección actual con el nuevo rango
        this.selectedSesiones = idsToSelect;

        // Actualizar checkboxes
        sesionElements.forEach(el => {
            const checkbox = el.querySelector('.cpp-sesion-checkbox');
            if (checkbox) {
                checkbox.checked = this.selectedSesiones.includes(el.dataset.sesionId);
            }
        });

        this.updateBulkActionsUI();
    },

    // --- Lógica de la App ---
    handleInlineEdit(element) {
        const newContent = element.innerHTML;
        if (newContent === this.originalContent) return;
        const sesion = this.currentSesion;
        const field = element.dataset.field;
        if (!sesion || !field) return;

        // Guardamos una copia sin las actividades para no enviar datos innecesarios
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
                if (result.success && result.data.sesion) {
                    const newSesion = result.data.sesion;
                    const afterId = result.data.after_sesion_id;
                    const afterIndex = this.sesiones.findIndex(s => s.id == afterId);

                    if (afterIndex > -1) {
                        this.sesiones.splice(afterIndex + 1, 0, newSesion);
                    } else {
                        this.sesiones.push(newSesion);
                    }
                    this.currentSesion = newSesion;

                    // --- FIX: Reordenar y redibujar para asegurar orden cronológico ---
                    this.fetchAndApplyFechas(this.currentEvaluacionId).then(() => {
                        // Reordenar el array de sesiones principal por fecha
                        this.sesiones.sort((a, b) => {
                            // Poner sesiones sin fecha al final
                            if (!a.fecha_calculada) return 1;
                            if (!b.fecha_calculada) return -1;
                            return new Date(a.fecha_calculada) - new Date(b.fecha_calculada);
                        });

                        // --- FIX v2: Reordenar el DOM en lugar de redibujar para evitar el salto de scroll ---

                        const list = this.appElement.querySelector('.cpp-sesiones-list-detailed');
                        if (list) {
                            // 1. Añadir el nuevo elemento al DOM (puede estar en la posición incorrecta temporalmente)
                            const sesionesFiltradasAntes = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
                            const lastSesionElement = list.querySelector('.cpp-sesion-list-item:last-child');
                            const newItemHTML = this.renderSingleSesionItemHTML(newSesion, sesionesFiltradasAntes.length); // Renderizar como si fuera el último
                            list.insertAdjacentHTML('beforeend', newItemHTML);

                            // 2. Reordenar el array de datos
                             this.sesiones.sort((a, b) => {
                                if (!a.fecha_calculada) return 1;
                                if (!b.fecha_calculada) return -1;
                                return new Date(a.fecha_calculada) - new Date(b.fecha_calculada);
                            });

                            // 3. Reordenar el DOM basándose en el array de datos
                            const sesionesFiltradasDespues = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
                            sesionesFiltradasDespues.forEach((sesion, index) => {
                                const item = list.querySelector(`.cpp-sesion-list-item[data-sesion-id="${sesion.id}"]`);
                                if (item) {
                                    item.style.order = index;
                                    item.querySelector('.cpp-sesion-number').textContent = `${index + 1}.`;
                                }
                            });
                            list.style.display = 'flex';
                            list.style.flexDirection = 'column';

                             // 4. Actualizar estado y hacer scroll
                            const oldActive = list.querySelector('.cpp-sesion-list-item.active');
                            if (oldActive) oldActive.classList.remove('active');

                            const newActiveElement = list.querySelector(`.cpp-sesion-list-item[data-sesion-id="${newSesion.id}"]`);
                             if (newActiveElement) {
                                newActiveElement.classList.add('active');
                                newActiveElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }

                            this.appElement.querySelector('#cpp-programacion-right-col').innerHTML = this.renderProgramacionTabRightColumn();
                            this.makeActividadesSortable();
                        }
                    });

                    // --- AÑADIDO: Recargar cuaderno si es necesario ---
                    if (result.data.needs_gradebook_reload) {
                        if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function' && this.currentClase && this.currentEvaluacionId) {
                            cpp.gradebook.cargarContenidoCuaderno(this.currentClase.id, this.currentClase.nombre, this.currentEvaluacionId);
                        }
                    }

                } else if (result.success) { // Fallback
                    const newSesionId = result.data.new_sesion_id || null;
                    this.fetchData(this.currentClase.id, this.currentEvaluacionId, newSesionId);
                } else {
                    alert('Error al añadir la sesión en línea.');
                }
            });
    },
    loadClass(claseId, evaluacionIdToSelect = null, sesionIdToSelect = null, renderAfter = true) {
        // --- FIX: Check for pending navigation when a class is loaded ---
        // La navegación pendiente tiene prioridad sobre el sesionIdToSelect pasado como argumento
        if (typeof cpp !== 'undefined' && cpp.pendingNavigation && cpp.pendingNavigation.target === 'programador' && cpp.pendingNavigation.claseId == claseId) {
            const nav = cpp.pendingNavigation;
            evaluacionIdToSelect = nav.evaluacionId;
            sesionIdToSelect = nav.sesionId;
            // Limpiar la bandera para que no se reutilice
            delete cpp.pendingNavigation;
        }

        this.currentClase = this.clases.find(c => c.id == claseId);
        if (!this.currentClase) {
            this.tabContents.programacion.innerHTML = `<p style="color:red;">Error: No se encontró la clase con ID ${claseId}.</p>`;
            return;
        }

        // Priorizar el ID de evaluación pasado explícitamente (o desde pendingNavigation)
        if (evaluacionIdToSelect && (evaluacionIdToSelect === 'final' || this.currentClase.evaluaciones.some(e => e.id == evaluacionIdToSelect))) {
            this.currentEvaluacionId = evaluacionIdToSelect;
        } else {
            // Si no hay uno explícito, usar el de localStorage
            let savedEvalId = null;
            const localStorageKey = 'cpp_last_opened_eval_clase_' + this.currentClase.id;
            try {
                savedEvalId = localStorage.getItem(localStorageKey);
            } catch (e) {
                console.warn("No se pudo acceder a localStorage:", e);
            }

            if (savedEvalId && this.currentClase.evaluaciones.some(e => e.id == savedEvalId)) {
                this.currentEvaluacionId = savedEvalId;
            } else {
                // Como último recurso, usar la primera evaluación
                this.currentEvaluacionId = this.currentClase.evaluaciones.length > 0 ? this.currentClase.evaluaciones[0].id : null;
            }
        }

        // Guardar la evaluación seleccionada (ya sea la explícita, la de storage o la primera) para consistencia
        if (this.currentEvaluacionId) {
            try {
                const localStorageKey = 'cpp_last_opened_eval_clase_' + this.currentClase.id;
                localStorage.setItem(localStorageKey, this.currentEvaluacionId);
            } catch (e) {
                console.warn("No se pudo guardar en localStorage:", e);
            }
        }

        // Sincronizar con el estado global
        if (typeof cpp !== 'undefined') {
            cpp.currentEvaluacionId = this.currentEvaluacionId;
        }

        this.selectedSesiones = [];
        if (sesionIdToSelect) {
            this.currentSesion = this.sesiones.find(s => s.id == sesionIdToSelect) || null;
        } else {
            this.currentSesion = null;
        }

        if (renderAfter) {
            this.render();
            // --- FIX: Cargar fechas en segundo plano ---
            this.fetchAndApplyFechas(this.currentEvaluacionId);
        } else {
            this.updateBulkActionsUI();
        }
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

    openConfigModal() {
        this.populateConfigModal();
        this.configModal.element.style.display = 'block';
    },
    closeConfigModal() {
        this.configModal.element.style.display = 'none';
    },

    addHoliday() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        const dateInput = document.getElementById('cpp-new-holiday-date');
        const date = dateInput.value;
        if (date && !this.config.calendar_config.holidays.includes(date)) {
            this.config.calendar_config.holidays.push(date);
            this.config.calendar_config.holidays.sort();
            this.renderHolidaysList();
            dateInput.value = '';
        } else {
            alert('Por favor, selecciona una fecha válida que no esté ya en la lista.');
        }
        this.isProcessing = false;
    },

    removeHoliday(index) {
        this.config.calendar_config.holidays.splice(index, 1);
        this.renderHolidaysList();
    },

    addVacation() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        const startInput = document.getElementById('cpp-new-vacation-start');
        const endInput = document.getElementById('cpp-new-vacation-end');
        const addButton = document.getElementById('cpp-add-vacation-btn');
        const start = startInput.value;
        const end = endInput.value;

        if (start && end && new Date(start) <= new Date(end)) {
            this.config.calendar_config.vacations.push({ start, end });
            this.renderVacationsList();
            startInput.value = '';
            endInput.value = '';
            if (addButton) {
                addButton.blur();
            }
        } else {
            alert('Por favor, selecciona un periodo de vacaciones válido.');
        }
        this.isProcessing = false;
    },

    removeVacation(index) {
        this.config.calendar_config.vacations.splice(index, 1);
        this.renderVacationsList();
    },

    // --- Lógica de Datos (AJAX) ---
    populateConfigModal: function() {
        const config = this.config.calendar_config;
        if (!config) return;
        const form = document.querySelector('#cpp-config-form');
        if (!form) return;

        form.querySelectorAll('input[name="working_days"]').forEach(checkbox => {
            if (config.working_days) {
                checkbox.checked = config.working_days.includes(checkbox.value);
            }
        });

        this.renderHolidaysList();
        this.renderVacationsList();
    },

    renderHolidaysList() {
        const list = document.getElementById('cpp-holidays-list');
        const holidays = this.config.calendar_config.holidays || [];
        list.innerHTML = holidays.map((holiday, index) => `
            <div class="cpp-list-item" data-index="${index}">
                <span>${holiday}</span>
                <button type="button" class="cpp-remove-btn cpp-remove-holiday-btn">&times;</button>
            </div>
        `).join('');
    },

    renderVacationsList() {
        const list = document.getElementById('cpp-vacations-list');
        const vacations = this.config.calendar_config.vacations || [];
        list.innerHTML = vacations.map((vac, index) => `
            <div class="cpp-list-item" data-index="${index}">
                <span>${vac.start} al ${vac.end}</span>
                <button type="button" class="cpp-remove-btn cpp-remove-vacation-btn">&times;</button>
            </div>
        `).join('');
    },

    saveConfig(e) {
        e.preventDefault();
        if (this.isProcessing) return;
        this.isProcessing = true;

        const form = e.target;
        const workingDays = Array.from(form.querySelectorAll('input[name="working_days"]:checked')).map(cb => cb.value);
        const newConfig = {
            working_days: workingDays,
            holidays: this.config.calendar_config.holidays,
            vacations: this.config.calendar_config.vacations
        };

        this.config.calendar_config = newConfig;

        const data = new URLSearchParams({
            action: 'cpp_save_programador_config',
            nonce: cppFrontendData.nonce,
            calendar_config: JSON.stringify(newConfig)
        });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    alert('Configuración guardada.');
                    this.closeConfigModal();
                    this.render();
                } else {
                    alert('Error al guardar la configuración.');
                }
            })
            .finally(() => {
                this.isProcessing = false;
            });
    },

    fetchDataFromServer() {
        const data = new URLSearchParams({ action: 'cpp_get_programador_all_data', nonce: cppFrontendData.nonce });
        return fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json());
    },

    processInitialData(result, initialClaseId, evaluacionIdToSelect = null, sesionIdToSelect = null) {
        if (result.success) {
            this.clases = result.data.clases || [];
            this.config = result.data.config || { time_slots: [], horario: {} };
            this.sesiones = result.data.sesiones || [];
            this.fetchSimbolos(); // Cargar símbolos

            if (this.clases.length > 0) {
                if (initialClaseId) {
                    // La lógica de pendingNavigation ahora está en loadClass.
                    // Simplemente llamamos a loadClass y ella se encargará de todo.
                    this.loadClass(initialClaseId, evaluacionIdToSelect, sesionIdToSelect, true);
                } else {
                    this.tabContents.programacion.innerHTML = '<p>No se ha seleccionado ninguna clase.</p>';
                }
            } else {
                this.tabContents.programacion.innerHTML = '<p>No tienes clases creadas. Por favor, ve al Cuaderno y crea al menos una clase.</p>';
            }
        } else {
            this.tabContents.programacion.innerHTML = '<p style="color:red;">Error al cargar los datos del programador.</p>';
        }
    },

    fetchData(initialClaseId, evaluacionIdToSelect = null, sesionIdToSelect = null) {
        this.fetchDataFromServer().then(result => {
            this.processInitialData(result, initialClaseId, evaluacionIdToSelect, sesionIdToSelect);
        });
    },

    fetchSimbolos() {
        const data = new URLSearchParams({
            action: 'cpp_get_programador_simbolos',
            nonce: cppFrontendData.nonce,
        });

        return fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    this.simbolos = result.data.simbolos;
                } else {
                    console.error('Error al cargar los símbolos del programador.');
                }
            });
    },

    saveActividadesOrder(sesionId, newOrder) {
        const data = new URLSearchParams({
            action: 'cpp_save_programador_actividades_order',
            nonce: cppFrontendData.nonce,
            sesion_id: sesionId,
            orden: JSON.stringify(newOrder)
        });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    this.showNotification('Orden de actividades guardado.');
                    // No es necesario un fetch completo, solo reordenar localmente si se quisiera optimizar
                    this.fetchData(this.currentClase.id);
                } else {
                    this.showNotification('Error al guardar el orden de las actividades.', 'error');
                    this.fetchData(this.currentClase.id);
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
                    if (!newHorario[day]) {
                        newHorario[day] = {};
                    }
                    newHorario[day][slot] = {
                        claseId: claseId,
                        notas: notas.trim()
                    };
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
        if ($btn) {
            $btn.disabled = true;
            $btn.innerHTML = '<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...';
        }

        if (fromModal) {
            sesionData = { id: this.sesionModal.idInput.value, clase_id: this.sesionModal.claseIdInput.value, evaluacion_id: this.sesionModal.evaluacionIdInput.value, titulo: this.sesionModal.tituloInput.value, descripcion: this.sesionModal.descripcionInput.value };
        } else {
            sesionData = inlineData;
        }

        const data = new URLSearchParams({ action: 'cpp_save_programador_sesion', nonce: cppFrontendData.nonce, sesion: JSON.stringify(sesionData) });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    if (fromModal) this.closeSesionModal();

                    // Determinar la sesión actualizada, ya sea desde la respuesta o desde los datos enviados
                    let updatedSesion = result.data.sesion || sesionData;
                    if (result.data.sesion_id && !updatedSesion.id) {
                        updatedSesion.id = result.data.sesion_id;
                    }

                    const index = this.sesiones.findIndex(s => s.id == updatedSesion.id);
                    const isNew = index === -1;

                    if (isNew) {
                        this.sesiones.push(updatedSesion);
                    } else {
                        // Mantener las actividades que ya estaban cargadas para no perderlas en la actualización
                        updatedSesion.actividades_programadas = this.sesiones[index].actividades_programadas;
                        this.sesiones[index] = updatedSesion;
                    }
                    this.currentSesion = this.sesiones.find(s => s.id == updatedSesion.id);

                    // Lógica de renderizado selectivo para evitar recargas completas
                    if (isNew) {
                        const noSesionesContainer = this.appElement.querySelector('.cpp-no-sesiones-container');
                        if (noSesionesContainer) {
                            // Si no había sesiones, es necesario un render completo para construir la nueva estructura
                            this.render();
                        } else {
                            const list = this.appElement.querySelector('.cpp-sesiones-list-detailed');
                            const sesionesFiltradas = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
                            const newDisplayIndex = sesionesFiltradas.length - 1;
                            const newItemHTML = this.renderSingleSesionItemHTML(this.currentSesion, newDisplayIndex);
                            list.insertAdjacentHTML('beforeend', newItemHTML);

                            const newActiveElement = list.querySelector(`.cpp-sesion-list-item[data-sesion-id="${this.currentSesion.id}"]`);
                            if (newActiveElement) {
                                const oldActive = list.querySelector('.active');
                                if (oldActive) oldActive.classList.remove('active');
                                newActiveElement.classList.add('active');
                            }
                        }
                    } else {
                        const listItem = this.appElement.querySelector(`.cpp-sesion-list-item[data-sesion-id="${this.currentSesion.id}"]`);
                        if (listItem) {
                            // --- FIX: Update DOM without replacing the element to preserve scroll ---
                            const s = this.currentSesion; // The updated session

                            // Update Title and Date
                            const titleElement = listItem.querySelector('.cpp-sesion-title');
                            if (titleElement) {
                                const fechaMostrada = s.fecha_calculada
                                    ? new Date(s.fecha_calculada + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                                    : '';
                                const titleHTML = s.fecha_calculada
                                    ? `${s.titulo}<br><small class="cpp-sesion-date">${fechaMostrada}</small>`
                                    : s.titulo;
                                titleElement.innerHTML = titleHTML;
                            }

                            // Update Symbol
                            const simboloContainer = listItem.querySelector('.cpp-sesion-simbolo-container');
                            if (simboloContainer) {
                                const simboloData = (s.simbolo_id && this.simbolos && this.simbolos[s.simbolo_id]) ? this.simbolos[s.simbolo_id] : null;
                                const simboloHTML = simboloData ? `<span class="cpp-sesion-simbolo">${simboloData.simbolo}</span>` : '';
                                const simboloTitle = simboloData ? (simboloData.leyenda || '') : '';
                                simboloContainer.innerHTML = simboloHTML;
                                simboloContainer.title = simboloTitle;
                            }

                            // Update 'today' class
                            const today = new Date();
                            const todayYMD = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                            const isToday = s.fecha_calculada === todayYMD;
                            if (isToday) {
                                listItem.classList.add('cpp-sesion-hoy');
                            } else {
                                listItem.classList.remove('cpp-sesion-hoy');
                            }

                            // Ensure it remains active
                            listItem.classList.add('active');
                        }
                    }

                    // Siempre actualizar la columna derecha y buscar fechas
                    const rightCol = this.appElement.querySelector('#cpp-programacion-right-col');
                    if (rightCol) {
                        rightCol.innerHTML = this.renderProgramacionTabRightColumn();
                        this.makeActividadesSortable();
                    }
                    this.fetchAndApplyFechas(this.currentEvaluacionId);

                } else {
                    alert(result.data.message || 'Error al guardar.');
                }
            })
            .finally(() => {
                this.isProcessing = false;
                if ($btn) {
                    $btn.disabled = false;
                    $btn.innerHTML = originalBtnHtml;
                }
            });
    },
    async saveStartDate(startDate) {
        if (!this.currentEvaluacionId) return;

        // --- Client-side conflict check ---
        if (startDate) {
            const checkData = new URLSearchParams({
                action: 'cpp_check_schedule_conflict',
                nonce: cppFrontendData.nonce,
                evaluacion_id: this.currentEvaluacionId,
                start_date: startDate
            });

            try {
                const response = await fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: checkData });
                const result = await response.json();

                if (result.success && result.data.conflict) {
                    alert('La fecha de inicio seleccionada crea un conflicto de horario con otra evaluación. Por favor, elige una fecha diferente.');
                    const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
                    this.appElement.querySelector('#cpp-start-date-selector').value = currentEval ? currentEval.start_date || '' : '';
                    return;
                }
                if (!result.success) {
                    // Non-blocking error, backend will validate again
                    console.warn("No se pudo verificar el conflicto de horario: " + (result.data.message || 'Error desconocido'));
                }
            } catch (error) {
                console.error("Error en la verificación de conflicto de horario:", error);
                // Non-blocking error, backend will validate again
            }
        }
        // --- End client-side conflict check ---

        const date = new Date(`${startDate}T12:00:00Z`); // Use Z for UTC context
        const dayOfWeek = date.getUTCDay();
        const dayMapping = {0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'};
        const dayKey = dayMapping[dayOfWeek];

        const isWorkingDay = this.config.calendar_config.working_days.includes(dayKey);
        const classIdInHorario = Object.values(this.config.horario[dayKey] || {}).some(slot => slot.claseId === String(this.currentClase.id));

        if (startDate && (!isWorkingDay || !classIdInHorario)) {
            alert('La fecha de inicio debe ser un día lectivo en el que esta clase tenga horas asignadas en el horario.');
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
                // --- FIX: Recalcular y aplicar fechas ---
                this.fetchAndApplyFechas(this.currentEvaluacionId);

                if (result.data.needs_gradebook_reload) {
                    if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function' && this.currentClase && this.currentEvaluacionId) {
                        cpp.gradebook.cargarContenidoCuaderno(this.currentClase.id, this.currentClase.nombre, this.currentEvaluacionId);
                    }
                }
            } else {
                alert(result.data.message || 'Error al guardar la fecha.');
                const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
                this.appElement.querySelector('#cpp-start-date-selector').value = currentEval ? currentEval.start_date || '' : '';
            }
        });
    },
    deleteSesion(sesionId) {
        const sesionToDelete = this.sesiones.find(s => s.id == sesionId);
        if (!sesionToDelete) {
            alert('Error: No se pudo encontrar la sesión a eliminar.');
            return;
        }

        const hasEvaluableActivities = sesionToDelete.actividades_programadas && sesionToDelete.actividades_programadas.some(act => act.tipo === 'evaluable');
        let deleteActivities = false;

        if (hasEvaluableActivities) {
            if (!confirm("¿Seguro que quieres eliminar esta sesión? Contiene actividades evaluables.")) {
                return; // El usuario canceló la eliminación de la sesión por completo
            }
            // Si confirma, ahora preguntamos qué hacer con las actividades
            deleteActivities = confirm("¿Deseas eliminar también las actividades evaluables asociadas del cuaderno de notas?\n\n(Aceptar = SÍ, eliminar actividades / Cancelar = NO, mantener actividades)");
        } else {
            if (!confirm('¿Seguro que quieres eliminar esta sesión?')) {
                return;
            }
        }

        if (this.isProcessing) return;
        this.isProcessing = true;

        // --- LÓGICA PARA SELECCIONAR LA SESIÓN ANTERIOR ---
        const sesionesFiltradas = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
        const currentIndex = sesionesFiltradas.findIndex(s => s.id == sesionId);
        let nextSesionToSelect = null;
        if (currentIndex > 0) {
            nextSesionToSelect = sesionesFiltradas[currentIndex - 1];
        } else if (sesionesFiltradas.length > 1) {
            // Si se borra la primera y hay más, seleccionar la siguiente
            nextSesionToSelect = sesionesFiltradas[1];
        }
        // Si no, nextSesionToSelect será null, que es el comportamiento deseado (ninguna seleccionada)

        const data = new URLSearchParams({
            action: 'cpp_delete_programador_sesion',
            nonce: cppFrontendData.nonce,
            sesion_id: sesionId,
            delete_activities: deleteActivities
        });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    // Actualizar el array local de sesiones
                    this.sesiones = this.sesiones.filter(s => s.id != sesionId);

                    // Asignar la nueva sesión actual
                    this.currentSesion = nextSesionToSelect;

                    // Re-renderizar la UI
                    this.render();

                    // Forzar recarga del cuaderno si es necesario
                    if (result.data.needs_gradebook_reload) {
                        if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function' && this.currentClase && this.currentEvaluacionId) {
                            cpp.gradebook.cargarContenidoCuaderno(this.currentClase.id, this.currentClase.nombre, this.currentEvaluacionId);
                        }
                    }
                }
                else { alert('Error al eliminar la sesión.'); }
            })
            .finally(() => {
                this.isProcessing = false;
            });
    },
    saveSesionOrder(newOrder) {
        const data = new URLSearchParams({ action: 'cpp_save_sesiones_order', nonce: cppFrontendData.nonce, clase_id: this.currentClase.id, evaluacion_id: this.currentEvaluacionId, orden: JSON.stringify(newOrder) });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data }).then(res => res.json()).then(result => {
            if (result.success) {
                this.fetchData(this.currentClase.id, this.currentEvaluacionId);
                if (result.data.needs_gradebook_reload) {
                    if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function' && this.currentClase && this.currentEvaluacionId) {
                        cpp.gradebook.cargarContenidoCuaderno(this.currentClase.id, this.currentClase.nombre, this.currentEvaluacionId);
                    }
                }
            } else {
                alert('Error al guardar el orden.');
                this.fetchData(this.currentClase.id, this.currentEvaluacionId);
            }
        });
    },

    // --- Renderizado y UI ---
    fetchAndApplyFechas(evaluacionId) {
        if (!evaluacionId || !this.currentClase) return Promise.resolve();

        const data = new URLSearchParams({
            action: 'cpp_get_fechas_evaluacion',
            nonce: cppFrontendData.nonce,
            evaluacion_id: evaluacionId,
            clase_id: this.currentClase.id
        });

        return fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success && result.data.fechas) {
                    const changedSesiones = [];
                    this.sesiones.forEach(sesion => {
                        if (sesion.evaluacion_id == evaluacionId && result.data.fechas.hasOwnProperty(sesion.id)) {
                            const fechaData = result.data.fechas[sesion.id];
                            const newFecha = fechaData.fecha;
                            const newNotas = fechaData.notas;

                            if (sesion.fecha_calculada !== newFecha || sesion.notas_horario !== newNotas) {
                                sesion.fecha_calculada = newFecha;
                                sesion.notas_horario = newNotas;
                                changedSesiones.push(sesion);
                            }
                        }
                    });

                    if (changedSesiones.length > 0) {
                        const list = this.appElement.querySelector('.cpp-sesiones-list-detailed');
                        if (!list) return;

                        const sesionesEnLista = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);

                        changedSesiones.forEach(sesion => {
                            const listItem = list.querySelector(`.cpp-sesion-list-item[data-sesion-id="${sesion.id}"]`);
                            if (listItem) {
                                const displayIndex = sesionesEnLista.findIndex(s => s.id == sesion.id);
                                listItem.outerHTML = this.renderSingleSesionItemHTML(sesion, displayIndex);
                            }
                        });

                        // If the currently selected session was updated, re-render the right column
                        if (this.currentSesion && changedSesiones.some(s => s.id == this.currentSesion.id)) {
                            const rightCol = this.appElement.querySelector('#cpp-programacion-right-col');
                            if (rightCol) {
                                rightCol.innerHTML = this.renderProgramacionTabRightColumn();
                                this.makeActividadesSortable();
                            }
                        }
                    }
                }
                // No hacemos nada en caso de error para no molestar al usuario
            }).catch(error => console.error('Error fetching session dates:', error));
    },

    makeSesionesSortable() {
        const list = this.appElement.querySelector('.cpp-sesiones-list-detailed');
        if (list) {
            $(list).sortable({
                handle: '.cpp-sesion-handle',
                placeholder: 'cpp-sesion-placeholder',
                update: (event, ui) => {
                    const newOrder = $(event.target).sortable('toArray', { attribute: 'data-sesion-id' });
                    this.saveSesionOrder(newOrder);
                }
            }).disableSelection();
        }
    },
    makeActividadesSortable() {
        const list = this.appElement.querySelector('.cpp-actividades-list');
        if (list) {
            $(list).sortable({
                placeholder: 'cpp-actividad-placeholder',
                update: (event, ui) => {
                    const newOrder = $(event.target).sortable('toArray', { attribute: 'data-actividad-id' });
                    this.saveActividadesOrder(this.currentSesion.id, newOrder);
                }
            }).disableSelection();
        }
    },
    render() {
        if (!this.currentClase) { this.tabContents.programacion.innerHTML = '<p class="cpp-empty-panel">Cargando...</p>'; return; }
        this.renderProgramacionTab();
        this.renderHorarioTab();
    },
    renderProgramacionTab() {
        if (!this.tabContents.programacion) return;
        const content = this.tabContents.programacion;
        if (!this.currentClase) {
            content.innerHTML = '<p>Selecciona una clase para ver la programación.</p>';
            return;
        }

        // --- AÑADIDO: Manejar el caso especial de "Evaluación Final" ---
        if (this.currentEvaluacionId === 'final') {
            content.innerHTML = `
                <div class="cpp-no-alumnos-container cpp-no-sesiones-container">
                    <div class="cpp-no-alumnos-emoji">🤖</div>
                    <h3 class="cpp-no-alumnos-titulo">¡Vista solo para robots!</h3>
                    <p class="cpp-no-alumnos-texto">La Evaluación Final se calcula automáticamente y no necesita que planifiques sesiones. ¡Relájate y deja que la magia de las mates haga su trabajo! ✨</p>
                </div>
            `;
            return;
        }

        let evaluacionOptions = '', startDate = '';
        const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
        if (this.currentClase.evaluaciones.length > 0) {
            if (currentEval) startDate = currentEval.start_date || '';
        }

        const sesionesFiltradas = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);

        const isSesionSelected = this.currentSesion !== null;
        let controlsHTML = `
            <div class="cpp-programacion-controls">
                <div class="cpp-programacion-main-controls">
                    <label>Fecha de Inicio: <input type="date" id="cpp-start-date-selector" value="${startDate}" ${!this.currentEvaluacionId ? 'disabled' : ''}></label>
                </div>
                <div class="cpp-programacion-action-controls">
                    <button id="cpp-add-sesion-toolbar-btn" class="cpp-btn cpp-btn-secondary" ${!isSesionSelected ? 'disabled' : ''} title="Añadir sesión debajo de la seleccionada">
                        <span class="dashicons dashicons-plus-alt2"></span>
                    </button>
                    <button id="cpp-delete-sesion-toolbar-btn" class="cpp-btn cpp-btn-secondary" ${!isSesionSelected ? 'disabled' : ''} title="Eliminar la sesión seleccionada">
                        <span class="dashicons dashicons-trash"></span>
                    </button>
                    <button id="cpp-fijar-sesion-toolbar-btn" class="cpp-btn cpp-btn-secondary" ${!isSesionSelected ? 'disabled' : ''} title="Fijar fecha">
                        <span class="dashicons dashicons-admin-post"></span>
                    </button>
                    <button id="cpp-simbolo-sesion-toolbar-btn" class="cpp-btn cpp-btn-secondary" ${!isSesionSelected ? 'disabled' : ''} title="Asignar o cambiar símbolo">
                        <span class="dashicons dashicons-star-filled"></span>
                    </button>
                </div>
                <div id="cpp-sesion-bulk-actions" class="hidden"></div>
            </div>`;
        let layoutHTML;

        if (sesionesFiltradas.length === 0) {
            layoutHTML = `
                <div class="cpp-no-alumnos-container cpp-no-sesiones-container">
                    <div class="cpp-no-alumnos-emoji">📅</div>
                    <h3 class="cpp-no-alumnos-titulo">Planifica tu curso</h3>
                    <p class="cpp-no-alumnos-texto">Aún no has añadido ninguna sesión a esta evaluación. Crea tu primera sesión para empezar a organizar tus clases.</p>
                    <div class="cpp-no-alumnos-actions">
                        <button class="cpp-btn cpp-btn-primary cpp-add-sesion-btn" ${!this.currentEvaluacionId ? 'disabled' : ''}>
                            <span class="dashicons dashicons-plus"></span> Añadir primera sesión
                        </button>
                    </div>
                </div>
            `;
        } else {
            layoutHTML = `<div class="cpp-programacion-layout"><div class="cpp-programacion-left-col"><ul class="cpp-sesiones-list-detailed">${this.renderSesionList()}</ul></div><div class="cpp-programacion-right-col" id="cpp-programacion-right-col">${this.renderProgramacionTabRightColumn()}</div></div>`;
        }

        content.innerHTML = controlsHTML + layoutHTML;
        if (sesionesFiltradas.length > 0) {
            this.makeSesionesSortable();
        }
        if (this.currentSesion) {
            this.makeActividadesSortable();
        }
        this.updateBulkActionsUI();

        // Scroll to selected session only if it's a new one, handled in addInlineSesion
    },
    renderSingleSesionItemHTML(s, index) {
        const fijadaIconHTML = s.fecha_fijada ? `<span class="cpp-sesion-fijada-icon" title="Fecha fijada: ${new Date(s.fecha_fijada + 'T12:00:00Z').toLocaleDateString('es-ES')}">📌</span>` : '';
        const fechaMostrada = s.fecha_calculada
            ? new Date(s.fecha_calculada + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
            : '';

        const titleHTML = s.fecha_calculada
            ? `${s.titulo}<br><small class="cpp-sesion-date">${fechaMostrada} ${fijadaIconHTML}</small>`
            : s.titulo;

        const isChecked = this.selectedSesiones.includes(s.id.toString());
        const today = new Date();
        const todayYMD = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        const isToday = s.fecha_calculada === todayYMD;
        const todayClass = isToday ? 'cpp-sesion-hoy' : '';

        const simboloData = (s.simbolo_id && this.simbolos && this.simbolos[s.simbolo_id]) ? this.simbolos[s.simbolo_id] : null;
        const simboloHTML = simboloData ? `<span class="cpp-sesion-simbolo">${simboloData.simbolo}</span>` : '';
        const simboloTitle = simboloData ? simboloData.leyenda : '';

        return `
        <li class="cpp-sesion-list-item ${this.currentSesion && s.id == this.currentSesion.id ? 'active' : ''} ${todayClass}" data-sesion-id="${s.id}">
            <input type="checkbox" class="cpp-sesion-checkbox" data-sesion-id="${s.id}" ${isChecked ? 'checked' : ''}>
            <span class="cpp-sesion-handle">⠿</span>
            <span class="cpp-sesion-number">${index + 1}.</span>
            <span class="cpp-sesion-title">${titleHTML}</span>
            <div class="cpp-sesion-simbolo-container" title="${simboloTitle}">
                ${simboloHTML}
            </div>
        </li>`;
    },

    renderSesionList() {
        const sesionesFiltradas = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
        if (sesionesFiltradas.length === 0) return ''; // Ya no se maneja aquí

        return sesionesFiltradas.map((s, index) => this.renderSingleSesionItemHTML(s, index)).join('');
    },
    renderProgramacionTabRightColumn() {
        if (!this.currentSesion) return '<p class="cpp-empty-panel">Selecciona una sesión para ver su contenido.</p>';

        const fechaMostrada = this.currentSesion.fecha_calculada
            ? new Date(this.currentSesion.fecha_calculada + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
            : '';

        const notasHorarioHTML = this.currentSesion.notas_horario
            ? `<div class="cpp-sesion-detail-notas">${this.currentSesion.notas_horario.replace(/\n/g, '<br>')}</div>`
            : '';

        const headerHTML = `
            <div class="cpp-sesion-detail-header">
                <h3 class="cpp-sesion-detail-title" data-field="titulo" contenteditable="true">${this.currentSesion.titulo}</h3>
                <div class="cpp-sesion-detail-meta">
                    ${fechaMostrada ? `<span class="cpp-sesion-detail-date-badge"><span class="dashicons dashicons-calendar-alt"></span> ${fechaMostrada}</span>` : ''}
                    ${notasHorarioHTML}
                </div>
            </div>`;

        return `<div class="cpp-sesion-detail-container" data-sesion-id="${this.currentSesion.id}">
                    ${headerHTML}
                    <div class="cpp-sesion-detail-section"><h4>Descripción</h4><div class="cpp-sesion-detail-content" data-field="descripcion" contenteditable="true">${this.currentSesion.descripcion || ''}</div></div>
                    <div class="cpp-sesion-detail-section"><h4>Objetivos</h4><div class="cpp-sesion-detail-content" data-field="objetivos" contenteditable="true">${this.currentSesion.objetivos || ''}</div></div>
                    <div class="cpp-sesion-detail-section"><h4>Recursos</h4><div class="cpp-sesion-detail-content" data-field="recursos" contenteditable="true">${this.currentSesion.recursos || ''}</div></div>
                    ${this.renderActividadesSection(this.currentSesion)}
                    <div class="cpp-sesion-detail-section"><h4>Seguimiento</h4><div class="cpp-sesion-detail-content" data-field="seguimiento" contenteditable="true">${this.currentSesion.seguimiento || ''}</div></div>
                </div>`;
    },

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
        } else {
            // --- AÑADIDO: Botón de editar para actividades no evaluables ---
            actionsHTML = `<button class="cpp-edit-no-evaluable-btn" data-actividad-id="${actividad.id}" title="Editar">${editIconSVG}</button>`;
        }

        actionsHTML += `<button class="cpp-delete-actividad-btn" data-actividad-id="${actividad.id}" data-tipo="${actividad.tipo}" title="Eliminar">
                            ${deleteIconSVG}
                        </button>`;

        return `
            <li class="cpp-actividad-item ${isEvaluable ? 'evaluable' : 'no-evaluable'}" data-actividad-id="${actividad.id}" data-tipo="${actividad.tipo}">
                <span class="cpp-actividad-handle">⠿</span>
                <span class="cpp-actividad-titulo" contenteditable="${!isEvaluable}" data-actividad-id="${actividad.id}">${actividad.titulo}</span>
                <div class="cpp-actividad-actions">
                    ${actionsHTML}
                </div>
            </li>
        `;
    },

    addNonEvaluableActividad(sesionId) {
        const newActividadData = {
            sesion_id: sesionId,
            titulo: 'Nueva tarea...',
        };
        const data = new URLSearchParams({
            action: 'cpp_save_programador_actividad',
            nonce: cppFrontendData.nonce,
            actividad: JSON.stringify(newActividadData)
        });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success && result.data && result.data.actividad) {
                    const newActividad = result.data.actividad;
                    if (!this.currentSesion.actividades_programadas) {
                        this.currentSesion.actividades_programadas = [];
                    }
                    this.currentSesion.actividades_programadas.push(newActividad);
                    const list = this.appElement.querySelector('.cpp-actividades-list');
                    if (list) {
                        list.insertAdjacentHTML('beforeend', this.renderActividadItem(newActividad));
                    }
                    const newElement = this.appElement.querySelector(`.cpp-actividad-titulo[data-actividad-id="${newActividad.id}"]`);
                    if (newElement) {
                        newElement.focus();
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(newElement);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                } else {
                    this.showNotification('Error al añadir la tarea.', 'error');
                }
            });
    },

    addEvaluableActividad(sesionId) {
        const currentEval = this.currentClase.evaluaciones.find(e => e.id == this.currentEvaluacionId);
        if (!currentEval) {
            this.showNotification('No se puede añadir una actividad evaluable sin una evaluación seleccionada.', 'error');
            return;
        }

        if (cpp.modals && cpp.modals.actividades && typeof cpp.modals.actividades.mostrarAnadir === 'function') {
            const calculatedDate = this.calculateDateForSesion(sesionId);
            cpp.modals.actividades.mostrarAnadir(sesionId, calculatedDate);
        } else {
            this.showNotification('Error: El módulo de modales no está disponible.', 'error');
        }
    },

    editEvaluableActividad(actividadId) {
        const data = new URLSearchParams({
            action: 'cpp_get_evaluable_activity_data',
            nonce: cppFrontendData.nonce,
            actividad_id: actividadId
        });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    if (cpp.modals && cpp.modals.actividades && typeof cpp.modals.actividades.cargarConDatos === 'function') {
                        cpp.modals.actividades.cargarConDatos(result.data);
                    } else {
                        this.showNotification('Error: El módulo de modales no está disponible.', 'error');
                    }
                } else {
                    this.showNotification(result.data.message || 'Error al cargar los datos de la actividad.', 'error');
                }
            });
    },

    editNonEvaluableActividad(actividadId) {
        const titleElement = this.appElement.querySelector(`.cpp-actividad-titulo[data-actividad-id="${actividadId}"]`);
        if (titleElement) {
            titleElement.focus();
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(titleElement);
            sel.removeAllRanges();
            sel.addRange(range);
        }
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

        const data = new URLSearchParams({
            action: action,
            nonce: cppFrontendData.nonce,
            actividad_id: actividadId
        });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    this.showNotification('Actividad eliminada.');
                    if (this.currentSesion && this.currentSesion.actividades_programadas) {
                        const index = this.currentSesion.actividades_programadas.findIndex(a => a.id == actividadId);
                        if (index > -1) {
                            this.currentSesion.actividades_programadas.splice(index, 1);
                        }
                    }
                    const item = this.appElement.querySelector(`.cpp-actividad-item[data-actividad-id="${actividadId}"]`);
                    if (item) {
                        item.remove();
                    }
                    if (tipo === 'evaluable') {
                        document.dispatchEvent(new CustomEvent('cpp:forceGradebookReload'));
                    }
                } else {
                    this.showNotification(result.data.message || 'Error al eliminar la actividad.', 'error');
                }
            });
    },

    updateActividadTitle(element, actividadId) {
        const newTitle = element.textContent.trim();
        const actividad = this.currentSesion.actividades_programadas.find(a => a.id == actividadId);
        if (!actividad || newTitle === actividad.titulo) return;

        const oldTitle = actividad.titulo;
        actividad.titulo = newTitle;

        const updatedActividad = { ...actividad, titulo: newTitle };
        const data = new URLSearchParams({
            action: 'cpp_save_programador_actividad',
            nonce: cppFrontendData.nonce,
            actividad: JSON.stringify(updatedActividad)
        });
        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    this.showNotification('Título guardado.');
                    if (result.data.needs_gradebook_reload) {
                        document.dispatchEvent(new CustomEvent('cpp:forceGradebookReload'));
                    }
                } else {
                    this.showNotification('Error al guardar.', 'error');
                    element.textContent = oldTitle;
                    actividad.titulo = oldTitle;
                }
            });
    },

    refreshCurrentView(callback) {
        const currentSesionId = this.currentSesion ? this.currentSesion.id : null;
        this.fetchDataFromServer().then(result => {
            if (result.success) {
                console.log("DEBUG: Datos recibidos en refresh", result.data);
                this.clases = result.data.clases || [];
                this.config = result.data.config || { time_slots: [], horario: {} };
                this.sesiones = result.data.sesiones || [];

                if (currentSesionId) {
                    this.currentSesion = this.sesiones.find(s => s.id == currentSesionId) || null;
                }
                this.render();
                if (callback && typeof callback === 'function') {
                    // Usamos un pequeño timeout para asegurar que el DOM se haya actualizado tras el renderizado
                    setTimeout(callback, 50);
                }
            } else {
                this.showNotification('Error al refrescar los datos.', 'error');
            }
        });
    },

    updateActividadCategoria(selector, actividadId) {
        const newCategoriaId = selector.value;
        const actividad = this.currentSesion.actividades_programadas.find(a => a.id == actividadId);
        if (!actividad || newCategoriaId == actividad.categoria_id) return;

        const data = new URLSearchParams({
            action: 'cpp_toggle_actividad_evaluable',
            nonce: cppFrontendData.nonce,
            actividad_id: actividadId,
            es_evaluable: 1,
            categoria_id: newCategoriaId
        });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    actividad.categoria_id = newCategoriaId;
                    this.showNotification('Categoría actualizada.');
                } else {
                    this.showNotification('Error al actualizar categoría.', 'error');
                    selector.value = actividad.categoria_id;
                }
            });
    },

    renderHorarioTab() {
        if (!this.tabContents.horario) return;
        const content = this.tabContents.horario;
        const allDays = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo' };
        const workingDays = (this.config.calendar_config && this.config.calendar_config.working_days) ? this.config.calendar_config.working_days : ['mon', 'tue', 'wed', 'thu', 'fri'];
        const daysToRender = workingDays.reduce((acc, dayKey) => {
            if (allDays[dayKey]) {
                acc[dayKey] = allDays[dayKey];
            }
            return acc;
        }, {});

        let classOptions = '<option value="">-- Vacío --</option>' + this.clases.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        const addSlotButtonHTML = `<button id="cpp-horario-add-slot-btn" class="cpp-btn cpp-btn-secondary cpp-btn-add-slot-header" title="Añadir nuevo tramo horario"><span class="dashicons dashicons-plus-alt"></span></button>`;

        let tableHTML = `<table id="cpp-horario-table" class="cpp-horario-table">
                            <thead>
                                <tr class="cpp-horario-header-row">
                                    <th class="cpp-horario-th-actions"></th>
                                    <th class="cpp-horario-th-hora">${addSlotButtonHTML}</th>
                                    ${Object.values(daysToRender).map(day => `<th class="cpp-horario-th-dia">${day}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>`;

        (this.config.time_slots || []).forEach(slot => {
            tableHTML += `<tr data-slot-value="${slot}">
                            <td class="cpp-horario-td-actions"><button class="cpp-delete-slot-btn" data-slot="${slot}">❌</button></td>
                            <td class="cpp-horario-td-hora" contenteditable="true" data-original-value="${slot}">${slot}</td>`;
            Object.keys(daysToRender).forEach(dayKey => {
                const cellData = this.config.horario?.[dayKey]?.[slot] || {};
                const claseId = cellData.claseId || '';
                const notas = cellData.notas || '';

                tableHTML += `<td data-day="${dayKey}" data-slot="${slot}">
                                <div class="cpp-horario-slot-content">
                                    <select class="cpp-horario-clase-selector" data-clase-id="${claseId}">${classOptions}</select>
                                    <textarea class="cpp-horario-notas-input" placeholder="Notas...">${notas}</textarea>
                                </div>
                              </td>`;
            });
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table>`;
        content.innerHTML = tableHTML;
        this.appElement.querySelectorAll('#cpp-horario-table select').forEach(s => {
            s.value = s.dataset.claseId;
            this.updateHorarioCellColor(s);
        });
    },

    updateHorarioCellColor(selectElement) {
        const claseId = selectElement.value;
        const cell = selectElement.closest('td');
        if (!cell) return;

        cell.style.setProperty('--class-color', 'transparent');

        if (claseId) {
            const clase = this.clases.find(c => c.id == claseId);
            if (clase && clase.color) {
                cell.style.setProperty('--class-color', clase.color);
                cell.classList.add('has-class');
            } else {
                cell.classList.remove('has-class');
            }
        } else {
            cell.classList.remove('has-class');
        }
    },

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `cpp-notification ${type}`;
        notification.textContent = message;
        this.appElement.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 3000);
    },

    renderSemanaTab() {
        const content = this.tabContents.semana;
        if (!this.config || !this.config.calendar_config) {
            content.innerHTML = '<p>Cargando configuración...</p>';
            return;
        }
        const horario = this.config.horario;
        const calendarConfig = this.config.calendar_config;
        const dayMapping = {0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'};

        let schedule = [];
        this.clases.forEach(clase => {
            clase.evaluaciones.forEach(evaluacion => {
                if (evaluacion.start_date) {
                    const sesionesDeLaEvaluacion = this.sesiones.filter(s => s.clase_id == clase.id && s.evaluacion_id == evaluacion.id);
                    if (sesionesDeLaEvaluacion.length === 0) return;

                    let classHasSlots = false;
                    for (const day in horario) {
                        if (Object.values(horario[day]).some(slot => slot.claseId === String(clase.id))) {
                            classHasSlots = true;
                            break;
                        }
                    }
                    if (!classHasSlots) return;

                    let currentDate = new Date(`${evaluacion.start_date}T12:00:00Z`);
                    if (isNaN(currentDate.getTime())) return;

                    let sessionIndex = 0;
                    let safetyCounter = 0;
                    const MAX_ITERATIONS = 50000;

                    while(sessionIndex < sesionesDeLaEvaluacion.length) {
                        if (++safetyCounter > MAX_ITERATIONS) {
                            console.error(`Scheduler safety break for clase ${clase.id}, evaluacion ${evaluacion.id}.`);
                            break;
                        }

                        const dayOfWeek = currentDate.getUTCDay();
                        const dayKey = dayMapping[dayOfWeek];
                        const ymd = currentDate.toISOString().slice(0, 10);

                        const isWorkingDay = calendarConfig.working_days.includes(dayKey);
                        const isHoliday = calendarConfig.holidays.includes(ymd);
                        const isVacation = calendarConfig.vacations.some(v => ymd >= v.start && ymd <= v.end);

                        if (isWorkingDay && !isHoliday && !isVacation && dayKey && horario[dayKey]) {
                            const sortedSlots = Object.keys(horario[dayKey]).sort();
                            for (const slot of sortedSlots) {
                                if (sessionIndex < sesionesDeLaEvaluacion.length && String(horario[dayKey][slot].claseId) === String(clase.id)) {
                                    const slotData = horario[dayKey][slot];
                                    schedule.push({
                                        sesion: sesionesDeLaEvaluacion[sessionIndex],
                                        fecha: new Date(currentDate.getTime()),
                                        hora: slot,
                                        notas: slotData.notas || ''
                                    });
                                    sessionIndex++;
                                }
                            }
                        }
                        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                    }
                }
            });
        });

        schedule.sort((a, b) => {
            const dateA = a.fecha.getTime();
            const dateB = b.fecha.getTime();
            if (dateA !== dateB) {
                return dateA - dateB;
            }
            return a.hora.localeCompare(b.hora);
        });

        const weekDates = this.getWeekDates(this.semanaDate);
        const allDays = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo' };
        const daysToRender = calendarConfig.working_days.reduce((acc, dayKey) => {
            if (allDays[dayKey]) {
                acc[dayKey] = allDays[dayKey];
            }
            return acc;
        }, {});

        const today = new Date();
        const todayYMD = today.toISOString().slice(0, 10);

        let headerHTML = `<div class="cpp-semana-nav">
                            <button class="cpp-semana-prev-btn cpp-btn-icon" title="Semana Anterior">◄</button>
                            <h3>Semana del ${weekDates[0].toLocaleDateString('es-ES', {day:'numeric', month:'long'})}</h3>
                            <button class="cpp-semana-next-btn cpp-btn-icon" title="Siguiente Semana">►</button>
                          </div>`;
        let tableHTML = `${headerHTML}<table class="cpp-semana-table"><thead><tr class="cpp-semana-header-row"><th class="cpp-semana-th-hora"></th>`;

        const renderedHeaders = [];
        Object.keys(daysToRender).forEach((dayKey) => {
            const date = weekDates.find(d => this.getDayKey(d) === dayKey);
            if(date) {
                const isToday = date.toISOString().slice(0, 10) === todayYMD;
                const todayClass = isToday ? 'cpp-semana-today' : '';
                tableHTML += `<th class="cpp-semana-th-dia ${todayClass}">${daysToRender[dayKey]}<br><small>${date.toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit'})}</small></th>`;
                renderedHeaders.push({dayKey: dayKey, isToday: isToday});
            }
        });
        tableHTML += `</tr></thead><tbody>`;

        (this.config.time_slots || []).forEach(slot => {
            tableHTML += `<tr><td class="cpp-semana-td-hora">${slot}</td>`;
            renderedHeaders.forEach(header => {
                const dayKey = header.dayKey;
                const todayClass = header.isToday ? 'cpp-semana-today' : '';
                const date = weekDates.find(d => this.getDayKey(d) === dayKey);
                const ymd = date.toISOString().slice(0, 10);
                const eventos = schedule.filter(e => e.fecha.toISOString().slice(0,10) === ymd && e.hora === slot);
                let cellContent = '';
                if (eventos.length > 0) {
                    eventos.forEach(evento => {
                        const clase = this.clases.find(c => c.id == evento.sesion.clase_id);
                        if (clase) {
                            const simboloData = (evento.sesion.simbolo_id && this.simbolos[evento.sesion.simbolo_id])
                                ? this.simbolos[evento.sesion.simbolo_id]
                                : null;
                            const simboloHTML = simboloData
                                ? `<span class="cpp-semana-simbolo" title="${this.escapeHtml(simboloData.leyenda || '')}">${this.escapeHtml(simboloData.simbolo)}</span>`
                                : '';

                            const fijadaIconHTML = evento.sesion.fecha_fijada ? `<span class="cpp-semana-fijada-icon" title="Fecha fijada">📌</span>` : '';

                            let actividadesHTML = '';
                            if (evento.sesion.actividades_programadas && evento.sesion.actividades_programadas.length > 0) {
                                actividadesHTML = `<ul class="cpp-semana-actividades-list">
                                    ${evento.sesion.actividades_programadas.map(act => `<li>${act.titulo}</li>`).join('')}
                                </ul>`;
                            }
                            cellContent += `<div class="cpp-semana-slot"
                                                 data-sesion-id="${evento.sesion.id}"
                                                 data-clase-id="${evento.sesion.clase_id}"
                                                 data-evaluacion-id="${evento.sesion.evaluacion_id}"
                                                 style="border-left-color: ${clase.color};">
                                <strong>${clase.nombre}</strong>
                                <p>${simboloHTML} ${fijadaIconHTML} ${evento.sesion.titulo}</p>
                                ${evento.notas ? `<p class="cpp-semana-notas-horario">${evento.notas.replace(/\n/g, '<br>')}</p>` : ''}
                                ${actividadesHTML}
                            </div>`;
                        }
                    });
                }
                tableHTML += `<td class="${todayClass}">${cellContent}</td>`;
            });
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table>`;
        content.innerHTML = tableHTML;
    },
    getWeekDates(d) {
        const date = new Date(d.getTime());
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Asume que la semana empieza en Lunes
        const monday = new Date(date.setDate(diff));
        return Array.from({length: 7}, (v, i) => { const weekDay = new Date(monday.getTime()); weekDay.setDate(monday.getDate() + i); return weekDay; });
    },
    getDayKey(date) {
        const dayMapping = {0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'};
        return dayMapping[date.getDay()];
    },

    calculateDateForSesion(sesionId) {
        const horario = this.config.horario;
        const calendarConfig = this.config.calendar_config || { working_days: ['mon', 'tue', 'wed', 'thu', 'fri'], holidays: [], vacations: [] };
        const dayMapping = {0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'};

        const targetSesion = this.sesiones.find(s => s.id == sesionId);
        if (!targetSesion) return null;

        const targetClase = this.clases.find(c => c.id == targetSesion.clase_id);
        if (!targetClase) return null;

        const targetEvaluacion = targetClase.evaluaciones.find(e => e.id == targetSesion.evaluacion_id);
        if (!targetEvaluacion || !targetEvaluacion.start_date) return null;

        const sesionesDeLaEvaluacion = this.sesiones.filter(s => s.clase_id == targetClase.id && s.evaluacion_id == targetEvaluacion.id);
        if (sesionesDeLaEvaluacion.length === 0) return null;

        let currentDate = new Date(`${targetEvaluacion.start_date}T12:00:00Z`);
        if (isNaN(currentDate.getTime())) return null;

        let sessionIndex = 0;
        let safetyCounter = 0;
        const MAX_ITERATIONS = 50000;

        while(sessionIndex < sesionesDeLaEvaluacion.length) {
            if (++safetyCounter > MAX_ITERATIONS) {
                console.error(`Scheduler safety break for clase ${targetClase.id}, evaluacion ${targetEvaluacion.id}.`);
                return null;
            }

            const dayOfWeek = currentDate.getUTCDay();
            const dayKey = dayMapping[dayOfWeek];
            const ymd = currentDate.toISOString().slice(0, 10);

            const isWorkingDay = calendarConfig.working_days.includes(dayKey);
            const isHoliday = calendarConfig.holidays.includes(ymd);
            const isVacation = calendarConfig.vacations.some(v => ymd >= v.start && ymd <= v.end);

            if (isWorkingDay && !isHoliday && !isVacation && dayKey && horario[dayKey]) {
                const sortedSlots = Object.keys(horario[dayKey]).sort();
                for (const slot of sortedSlots) {
                    if (sessionIndex < sesionesDeLaEvaluacion.length && String(horario[dayKey][slot].claseId) === String(targetClase.id)) {
                        if (sesionesDeLaEvaluacion[sessionIndex].id == sesionId) {
                            return ymd; // Found it!
                        }
                        sessionIndex++;
                    }
                }
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        return null; // Not found
    },

    // --- Copy Sessions Logic ---
    handleSesionSelection(sesionId, isChecked) {
        this.lastClickedSesionId = sesionId;
        if (isChecked) {
            if (!this.selectedSesiones.includes(sesionId)) {
                this.selectedSesiones.push(sesionId);
            }
        } else {
            const index = this.selectedSesiones.indexOf(sesionId);
            if (index > -1) {
                this.selectedSesiones.splice(index, 1);
            }
        }
        this.updateBulkActionsUI();
    },

    updateBulkActionsUI() {
        const container = document.getElementById('cpp-sesion-bulk-actions');
        if (!container) return;

        if (this.selectedSesiones.length > 0) {
            const count = this.selectedSesiones.length;
            container.innerHTML = `
                <button id="cpp-copy-selected-btn" class="cpp-btn cpp-btn-primary">Copiar ${count} ${count > 1 ? 'sesiones' : 'sesión'}</button>
                <button id="cpp-delete-selected-btn" class="cpp-btn cpp-btn-danger">Eliminar ${count} ${count > 1 ? 'sesiones' : 'sesión'}</button>
                <button id="cpp-deselect-all-btn" class="cpp-btn cpp-btn-secondary">Deseleccionar todo</button>
            `;
            container.classList.remove('hidden');
        } else {
            container.innerHTML = '';
            container.classList.add('hidden');
        }
    },

    handleFijarSesionClick() {
        if (!this.currentSesion) return;
        const fijar = !this.currentSesion.fecha_fijada;
        this.toggleSesionFijada(fijar);
    },

    toggleSesionFijada(fijar) {
        if (!this.currentSesion) return;

        if (this.isProcessing) return;
        this.isProcessing = true;

        const data = new URLSearchParams({
            action: 'cpp_toggle_sesion_fijada',
            nonce: cppFrontendData.nonce,
            session_ids: JSON.stringify([this.currentSesion.id]),
            fijar: fijar
        });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    this.showNotification(result.data.message || 'Operación completada.');

                    // Actualizar los datos locales de la sesión afectada
                    const sesion = this.sesiones.find(s => s.id == this.currentSesion.id);
                    if (sesion) {
                        if (fijar && result.data.fechas && result.data.fechas[sesion.id]) {
                            sesion.fecha_fijada = result.data.fechas[sesion.id].fecha;
                        } else {
                            sesion.fecha_fijada = null;
                        }
                    }

                    // --- FIX: Actualización selectiva para evitar salto de scroll ---
                    // 1. Actualizar el botón de la barra de herramientas
                    const fijarBtn = this.appElement.querySelector('#cpp-fijar-sesion-toolbar-btn');
                    if (fijarBtn) {
                        if (sesion.fecha_fijada) {
                            fijarBtn.innerHTML = '<span class="dashicons dashicons-unlock"></span>';
                            fijarBtn.title = 'Desfijar fecha';
                        } else {
                            fijarBtn.innerHTML = '<span class="dashicons dashicons-admin-post"></span>';
                            fijarBtn.title = 'Fijar fecha';
                        }
                    }

                    // --- FIX: Forzar la actualización del item para que el icono de la chincheta aparezca/desaparezca ---
                    const list = this.appElement.querySelector('.cpp-sesiones-list-detailed');
                    if (list) {
                        const listItem = list.querySelector(`.cpp-sesion-list-item[data-sesion-id="${sesion.id}"]`);
                        if (listItem) {
                             const sesionesFiltradas = this.sesiones.filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId);
                             const displayIndex = sesionesFiltradas.findIndex(s => s.id == sesion.id);
                             listItem.outerHTML = this.renderSingleSesionItemHTML(sesion, displayIndex);
                        }
                    }

                    // 2. Refrescar solo las fechas, que a su vez actualiza el HTML del item
                    this.fetchAndApplyFechas(this.currentEvaluacionId);


                    if (result.data.needs_gradebook_reload) {
                        if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function' && this.currentClase && this.currentEvaluacionId) {
                            cpp.gradebook.cargarContenidoCuaderno(this.currentClase.id, this.currentClase.nombre, this.currentEvaluacionId);
                        }
                    }
                } else {
                    alert(result.data.message || 'Error al realizar la operación.');
                }
            })
            .finally(() => {
                this.isProcessing = false;
            });
    },

    openCopySesionModal() {
        if (this.selectedSesiones.length === 0) {
            alert('Por favor, selecciona al menos una sesión para copiar.');
            return;
        }

        const modal = this.copySesionModal;
        modal.title.textContent = `Copiar ${this.selectedSesiones.length} sesiones`;

        // Populate class select
        modal.claseSelect.innerHTML = this.clases
            .filter(c => c.id != this.currentClase.id)
            .map(c => `<option value="${c.id}">${c.nombre}</option>`)
            .join('');

        this.updateCopyModalEvaluations();
        modal.element.style.display = 'block';
    },

    closeCopySesionModal() {
        this.copySesionModal.element.style.display = 'none';
    },

    updateCopyModalEvaluations() {
        const modal = this.copySesionModal;
        const selectedClaseId = modal.claseSelect.value;
        const clase = this.clases.find(c => c.id == selectedClaseId);

        if (clase && clase.evaluaciones) {
            modal.evaluacionSelect.innerHTML = clase.evaluaciones
                .map(e => `<option value="${e.id}">${e.nombre_evaluacion}</option>`)
                .join('');
        } else {
            modal.evaluacionSelect.innerHTML = '<option value="">No hay evaluaciones</option>';
        }
    },

    handleCopySesions(e) {
        e.preventDefault();
        if (this.isProcessing) return;

        const destClaseId = this.copySesionModal.claseSelect.value;
        const destEvaluacionId = this.copySesionModal.evaluacionSelect.value;

        if (!destClaseId || !destEvaluacionId) {
            alert('Por favor, selecciona una clase y una evaluación de destino.');
            return;
        }

        this.isProcessing = true;
        const $btn = this.copySesionModal.form.querySelector('button[type="submit"]');
        const originalBtnHtml = $btn.innerHTML;
        $btn.disabled = true;
        $btn.innerHTML = '<span class="dashicons dashicons-update dashicons-spin"></span> Copiando...';
        const sesionesFiltradas = this.sesiones
            .filter(s => s.clase_id == this.currentClase.id && s.evaluacion_id == this.currentEvaluacionId)
            .map(s => s.id.toString());

        const orderedSelectedIds = sesionesFiltradas.filter(id => this.selectedSesiones.includes(id));


        const data = new URLSearchParams({
            action: 'cpp_copy_multiple_sesiones',
            nonce: cppFrontendData.nonce,
            session_ids: JSON.stringify(orderedSelectedIds),
            destination_clase_id: destClaseId,
            destination_evaluacion_id: destEvaluacionId
        });

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    this.showNotification(result.data.message || 'Sesiones copiadas con éxito.');
                    this.closeCopySesionModal();
                    this.selectedSesiones = [];
                    this.fetchData(this.currentClase.id, this.currentEvaluacionId);
                } else {
                    alert(result.data.message || 'Error al copiar las sesiones.');
                }
            })
            .finally(() => {
                this.isProcessing = false;
                $btn.disabled = false;
                $btn.innerHTML = originalBtnHtml;
            });
    },

    // --- Lógica de Símbolos ---
    openSimboloPalette(buttonElement, sesionId) {
        this.closeSimboloPalette(); // Close any existing one
        this.currentSimboloEditingSesionId = sesionId;

        const modal = document.createElement('div');
        // Use specific classes to avoid style collision with the gradebook palette
        modal.className = 'cpp-modal cpp-programador-symbol-palette';
        modal.style.display = 'flex';

        const sesion = this.sesiones.find(s => s.id == this.currentSimboloEditingSesionId);
        const currentSimboloId = sesion ? sesion.simbolo_id : null;

        let paletteRowsHTML = '';

        // Opción para quitar el símbolo
        const noSymbolIsActive = currentSimboloId == null;
        const noSymbolSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px; opacity: 0.6;"><path d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10s10-4.48,10-10S17.52,2,12,2z M4.93,4.93l14.14,14.14L17.66,20.5 L3.51,6.34L4.93,4.93z"></path></svg>';
        paletteRowsHTML += `
            <div class="cpp-symbol-row no-leyenda">
                <div class="cpp-simbolo-item ${noSymbolIsActive ? 'active' : ''}" data-simbolo-id="null" title="Quitar símbolo">
                    ${noSymbolSVG}
                </div>
                <span class="leyenda-label">Quitar símbolo</span>
            </div>
        `;

        if (this.simbolos && Object.keys(this.simbolos).length > 0) {
            for (const id in this.simbolos) {
                const simbolo = this.simbolos[id];
                const isActive = id == currentSimboloId;
                paletteRowsHTML += `
                    <div class="cpp-symbol-row">
                        <div class="cpp-simbolo-item ${isActive ? 'active' : ''}" data-simbolo-id="${id}" title="Asignar este símbolo">
                            ${this.escapeHtml(simbolo.simbolo)}
                        </div>
                        <input type="text" class="leyenda-input" data-simbolo-id="${id}" value="${this.escapeHtml(simbolo.leyenda || '')}" placeholder="Significado...">
                    </div>`;
            }
        }

        modal.innerHTML = `
            <div class="cpp-modal-content">
                <span class="cpp-modal-close">&times;</span>
                <h2>Asignar Símbolo</h2>
                <p>Haz clic en un símbolo a la izquierda para asignarlo/desasignarlo. Edita las leyendas y pulsa Guardar.</p>
                <div class="cpp-symbol-list-container">${paletteRowsHTML}</div>
                <div class="cpp-modal-actions">
                    <button type="button" class="cpp-btn cpp-btn-primary" id="cpp-programador-save-leyendas-btn">Guardar Leyendas</button>
                </div>
            </div>
        `;
        // Append to body to avoid being contained within a positioned element
        document.body.appendChild(modal);
    },

    closeSimboloPalette() {
        const existingPalette = document.querySelector('.cpp-programador-symbol-palette');
        if (existingPalette) {
            existingPalette.remove();
        }
        this.currentSimboloEditingSesionId = null;
    },

    selectSimbolo(simboloId) {
        const sesion = this.sesiones.find(s => s.id == this.currentSimboloEditingSesionId);
        if (!sesion) return;

        // Si el ID es "null" (desde el botón "Sin Símbolo"), se desasigna.
        // Si no, se aplica la lógica de toggle: si se pulsa el mismo símbolo, se quita; si es otro, se asigna.
        if (simboloId === 'null') {
            sesion.simbolo_id = null;
        } else {
            sesion.simbolo_id = (sesion.simbolo_id == simboloId) ? null : simboloId;
        }

        // Close the modal. The subsequent saveSesion call will handle the smart UI update.
        this.closeSimboloPalette();

        // Save to backend. This will trigger a selective re-render of the session item.
        const { actividades_programadas, ...sesionToSave } = sesion;
        this.saveSesion(null, false, sesionToSave);
    },

    saveSimboloLeyendas() {
        const leyendas = {};
        // Target the specific palette's inputs
        document.querySelectorAll('.cpp-programador-symbol-palette .leyenda-input').forEach(input => {
            leyendas[input.dataset.simboloId] = input.value;
        });

        const data = new URLSearchParams({
            action: 'cpp_save_programador_simbolos_leyendas',
            nonce: cppFrontendData.nonce,
            leyendas: JSON.stringify(leyendas)
        });

        const button = document.getElementById('cpp-programador-save-leyendas-btn');
        if (!button) return;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Guardando...';

        fetch(cppFrontendData.ajaxUrl, { method: 'POST', body: data })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    this.showNotification('Leyendas guardadas.');
                    // Update local symbols data and re-render everything
                    this.fetchSimbolos().then(() => {
                        this.render();
                    });
                    button.textContent = '¡Guardado!';
                    setTimeout(() => {
                        this.closeSimboloPalette(); // Close modal on successful save
                    }, 1500);
                } else {
                    alert(result.data.message || 'Error al guardar las leyendas.');
                    button.textContent = originalText;
                    button.disabled = false;
                }
            })
            .catch(() => {
                 alert('Error de conexión al guardar las leyendas.');
                 button.textContent = originalText;
                 button.disabled = false;
            });
    },

    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') {
            return '';
        }
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
    };
})(jQuery);