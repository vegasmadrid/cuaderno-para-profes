// assets/js/cpp-modales-asistencia.js
(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-modales-asistencia.js no puede inicializarse.");
        return;
    }
    cpp.modals = cpp.modals || {};

    cpp.modals.asistencia = {
        currentClaseId: null,
        currentFecha: null,
        // Define los estados de asistencia que usaremos. Asegúrate que coincidan con lo que esperas en el backend.
        estadosAsistencia: [
            { id: 'presente', texto: 'P', titulo: 'Presente' },
            { id: 'ausente', texto: 'A', titulo: 'Ausente' },
            { id: 'retraso', texto: 'R', titulo: 'Retraso' },
            { id: 'justificado', texto: 'J', titulo: 'Justificado' } // Puede ser ausencia o retraso justificado
        ],

        init: function() {
            console.log("CPP Modals Asistencia Module Initializing...");
            this.bindEvents();
        },

        resetForm: function() {
            const $modal = $('#cpp-modal-asistencia');
            if (!$modal.length) return;

            const today = new Date().toISOString().slice(0, 10);
            $modal.find('#cpp-asistencia-fecha').val(today);
            this.currentFecha = today;
            $modal.find('#cpp-asistencia-lista-alumnos-container').html('<p>Selecciona una fecha para cargar alumnos.</p>');
            $modal.find('#cpp-modal-asistencia-titulo').text('Pasar Lista');
        },

        mostrar: function(claseId) {
            if (!claseId) {
                alert('Error: No se ha especificado una clase para pasar lista.');
                return;
            }
            this.currentClaseId = claseId;
            
            // Asegurar que otros modales estén ocultos (si cpp.modals.general existe)
            if (cpp.modals && cpp.modals.general && typeof cpp.modals.general.hideAll === 'function') {
                cpp.modals.general.hideAll();
            }

            const $modal = $('#cpp-modal-asistencia');
            if (!$modal.length) {
                console.error("El modal #cpp-modal-asistencia no existe en el DOM.");
                return;
            }
            
            this.resetForm(); // Establece la fecha a hoy y limpia el contenedor

            // Actualizar título del modal con el nombre de la clase actual
            let claseNombre = "Clase Desconocida";
            const $claseActivaSidebar = $(`.cpp-sidebar-clase-item[data-clase-id="${claseId}"]`);
            if ($claseActivaSidebar.length) {
                claseNombre = $claseActivaSidebar.data('clase-nombre') || "Clase Desconocida";
            }
            $modal.find('#cpp-modal-asistencia-titulo').text(`Pasar Lista: ${claseNombre}`);

            $modal.fadeIn();
            this.cargarAlumnosyAsistencia(); // Carga para la fecha por defecto (hoy)
        },

        cargarAlumnosyAsistencia: function() {
            if (!this.currentClaseId || !this.currentFecha) {
                $('#cpp-asistencia-lista-alumnos-container').html('<p class="cpp-error-message">Error: Falta ID de clase o fecha.</p>');
                return;
            }

            const $container = $('#cpp-asistencia-lista-alumnos-container');
            $container.html('<p class="cpp-cuaderno-cargando">Cargando alumnos y asistencia...</p>');

            const self = this;

            // 1. Obtener lista de alumnos directamente
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_obtener_alumnos_para_asistencia',
                    nonce: cppFrontendData.nonce,
                    clase_id: self.currentClaseId
                },
                success: function(alumnosResponse) {
                    if (!alumnosResponse.success || !alumnosResponse.data.alumnos) {
                        $container.html('<p class="cpp-error-message">No se pudieron cargar los alumnos.</p>');
                        return;
                    }
                    const alumnos = alumnosResponse.data.alumnos;

                    if (alumnos.length === 0) {
                        $container.html('<p>No hay alumnos en esta clase.</p>');
                        return;
                    }

                    // 2. Obtener asistencia para la fecha actual
                    $.ajax({
                        url: cppFrontendData.ajaxUrl,
                        type: 'POST',
                        dataType: 'json',
                        data: {
                            action: 'cpp_obtener_asistencia_clase_fecha',
                            nonce: cppFrontendData.nonce,
                            clase_id: self.currentClaseId,
                            fecha_asistencia: self.currentFecha
                        },
                        success: function(responseAsistencia) {
                            let htmlAlumnos = '';
                            const asistenciaGuardada = responseAsistencia.success ? responseAsistencia.data.asistencia : {};

                            alumnos.forEach(function(alumno) {
                                const asistenciaAlumno = asistenciaGuardada[alumno.id] || { estado: 'presente', observaciones: '' }; // Por defecto 'presente'
                                htmlAlumnos += `
                                    <div class="cpp-asistencia-alumno-fila" data-alumno-id="${alumno.id}">
                                        <span class="cpp-asistencia-alumno-nombre">${$('<div>').text(alumno.apellidos + ', ' + alumno.nombre).html()}</span>
                                        <div class="cpp-asistencia-alumno-estados">`;
                                self.estadosAsistencia.forEach(function(estadoInfo) {
                                    const esActivo = asistenciaAlumno.estado === estadoInfo.id ? 'cpp-estado-activo' : '';
                                    htmlAlumnos += `<button type="button" class="cpp-btn-asistencia-estado ${esActivo}" data-estado="${estadoInfo.id}" title="${estadoInfo.titulo}">${estadoInfo.texto}</button>`;
                                });
                                htmlAlumnos += `</div>
                                        <input type="text" class="cpp-asistencia-observaciones" value="${$('<div>').text(asistenciaAlumno.observaciones || '').html()}" placeholder="Observaciones...">
                                    </div>`;
                            });
                            $container.html(htmlAlumnos);
                        },
                        error: function() {
                            $container.html('<p class="cpp-error-message">Error al cargar datos de asistencia.</p>');
                        }
                    }); // Fin AJAX obtener asistencia
                },
                error: function() {
                    $container.html('<p class="cpp-error-message">Error de conexión al cargar alumnos.</p>');
                }
            }); // Fin AJAX obtener alumnos
        },

        handleEstadoChange: function(event) {
            const $button = $(event.currentTarget);
            const $filaAlumno = $button.closest('.cpp-asistencia-alumno-fila');
            // const alumnoId = $filaAlumno.data('alumno-id'); // No lo usamos aquí directamente
            const nuevoEstado = $button.data('estado');

            $filaAlumno.find('.cpp-btn-asistencia-estado').removeClass('cpp-estado-activo');
            $button.addClass('cpp-estado-activo');
            // El estado se guarda con el data-selected-estado en la fila para fácil recolección
            $filaAlumno.data('selected-estado', nuevoEstado); 
        },

        handleMarcarTodos: function(estadoDeseado) {
            $('#cpp-asistencia-lista-alumnos-container .cpp-asistencia-alumno-fila').each(function() {
                const $fila = $(this);
                $fila.data('selected-estado', estadoDeseado);
                $fila.find('.cpp-btn-asistencia-estado').removeClass('cpp-estado-activo');
                $fila.find(`.cpp-btn-asistencia-estado[data-estado="${estadoDeseado}"]`).addClass('cpp-estado-activo');
            });
        },
        
        guardarAsistencia: function() {
            if (!this.currentClaseId || !this.currentFecha) {
                alert('Error: No hay clase o fecha seleccionada.');
                return;
            }

            const $btnGuardar = $('#cpp-guardar-asistencia-btn');
            const originalBtnHtml = $btnGuardar.html();
            $btnGuardar.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Guardando...');

            const asistenciasPayload = [];
            $('#cpp-asistencia-lista-alumnos-container .cpp-asistencia-alumno-fila').each(function() {
                const $fila = $(this);
                const alumnoId = $fila.data('alumno-id');
                // Leer el estado del botón activo, o del data si lo actualizamos ahí
                const estado = $fila.find('.cpp-btn-asistencia-estado.cpp-estado-activo').data('estado') || $fila.data('selected-estado') || 'presente';
                const observaciones = $fila.find('.cpp-asistencia-observaciones').val();
                asistenciasPayload.push({
                    alumno_id: alumnoId,
                    estado: estado,
                    observaciones: observaciones
                });
            });

            if (asistenciasPayload.length === 0) {
                alert("No hay alumnos para guardar asistencia.");
                $btnGuardar.prop('disabled', false).html(originalBtnHtml);
                return;
            }

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'cpp_guardar_asistencia_clase',
                    nonce: cppFrontendData.nonce,
                    clase_id: this.currentClaseId,
                    fecha_asistencia: this.currentFecha,
                    asistencias: asistenciasPayload // Esto será un array de objetos
                },
                success: function(response) {
                    if (response.success) {
                        alert(response.data.message || "Asistencia guardada con éxito.");
                        // Opcional: cerrar modal o indicar éxito de otra forma
                        // cpp.modals.general.hideAll(); // Por ejemplo
                    } else {
                        alert('Error: ' + (response.data.message || 'No se pudo guardar la asistencia.'));
                    }
                },
                error: function() {
                    alert('Error de conexión al guardar la asistencia.');
                },
                complete: function() {
                    $btnGuardar.prop('disabled', false).html(originalBtnHtml);
                }
            });
        },

        bindEvents: function() {
            console.log("Binding Modals Asistencia events...");
            const self = this; // para usar this dentro de los callbacks
            const $modal = $('#cpp-modal-asistencia');

            // Botón para ABRIR este modal (se bindea en cpp-cuaderno.js)
            // $(document).on('click', '#cpp-a1-take-attendance-btn', function(e) { /* ... cpp.modals.asistencia.mostrar() ... */ });
            
            $modal.on('change', '#cpp-asistencia-fecha', function() {
                self.currentFecha = $(this).val();
                self.cargarAlumnosyAsistencia();
            });

            $modal.on('click', '#cpp-marcar-todos-presentes-btn', function() {
                self.handleMarcarTodos('presente');
            });

            $modal.on('click', '.cpp-btn-asistencia-estado', function(e) {
                self.handleEstadoChange(e);
            });

            $modal.on('click', '#cpp-guardar-asistencia-btn', function() {
                self.guardarAsistencia();
            });
        }
    };

})(jQuery);