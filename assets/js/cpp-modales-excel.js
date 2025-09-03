// assets/js/cpp-modales-excel.js
(function($) { // Envolvemos en IIFE y pasamos jQuery como $
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-modales-excel.js no puede inicializarse.");
        return;
    }
    cpp.modals = cpp.modals || {}; // Asegura que cpp.modals exista

    cpp.modals.excel = {
        tempUploadedFilePath: null, 
        tempUploadedFileName: null,

        init: function() {
            console.log("CPP Modals Excel Module Initializing...");
            // No se necesita inicialización específica aquí más allá de bindEvents.
        },

        // --- Funciones para Descarga de Excel ---
        showDownloadOptions: function(event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            // Ocultar otros modales primero
            if (cpp.modals && cpp.modals.general && typeof cpp.modals.general.hideAll === 'function') {
                cpp.modals.general.hideAll(); 
            }
            $('#cpp-modal-excel-options').addClass('cpp-modal-visible');
        },

        triggerDownload: function(event, downloadType) {
            if (event) event.preventDefault();

            let url = cppFrontendData.ajaxUrl +
                        '?action=cpp_download_handler' +
                        '&nonce=' + cppFrontendData.nonce +
                        '&download_type=' + downloadType;
            // El nombre del archivo ('filename') se genera y maneja completamente en el backend (PHP)

            if (downloadType === 'single_class') {
                if (!cpp.currentClaseIdCuaderno) {
                    alert('Por favor, selecciona una clase primero para descargarla.');
                    return;
                }
                url += '&clase_id=' + cpp.currentClaseIdCuaderno;
            }
            
            window.location.href = url;
            
            // Ocultar el modal de opciones después de iniciar la descarga
            if (cpp.modals && cpp.modals.general && typeof cpp.modals.general.hideAll === 'function') {
                cpp.modals.general.hideAll();
            }
        },

        // --- Funciones para Importación de Alumnos desde Excel ---
        // Llamado por cpp.modals.general.hideAll() y al mostrar el modal de importación
        resetImportForm: function() { 
            // console.log("Reseteando formulario de modal de importación de alumnos.");
            const $modal = $('#cpp-modal-import-students');
            $modal.find('#student_excel_file_input').val(''); 
            $modal.find('#cpp-upload-status-message').text('').removeClass('cpp-error-message cpp-success-message');
            $modal.find('#cpp-btn-upload-excel-file').prop('disabled', true);
            $modal.find('#cpp-import-step-1-upload').show();
            $modal.find('#cpp-import-step-2-options').hide();
            $modal.find('input[name="import_mode"][value="add"]').prop('checked', true);
            $modal.find('#cpp-import-results').hide();
            $modal.find('#cpp-import-results-message').empty();
            $modal.find('#cpp-import-errors-list').empty();
            $modal.find('#cpp-btn-cancel-excel-import').text('Cancelar / Subir otro archivo');
            this.tempUploadedFilePath = null; 
            this.tempUploadedFileName = null;
        },

        showImportStudents: function(event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            if (!cpp.currentClaseIdCuaderno) { 
                alert("Por favor, selecciona primero una clase para importar alumnos.");
                return;
            }
            if (cpp.modals && cpp.modals.general && typeof cpp.modals.general.hideAll === 'function') {
                cpp.modals.general.hideAll(); 
            }
            this.resetImportForm(); 
            $('#cpp-modal-import-students').addClass('cpp-modal-visible');
        },

        downloadStudentTemplate: function(event) {
            if (event) event.preventDefault();
            const url = cppFrontendData.ajaxUrl + 
                            '?action=cpp_download_student_template' +
                            '&nonce=' + cppFrontendData.nonce;
            window.location.href = url;
        },

        handleFileSelected: function(event) { 
            const file = event.target.files[0]; 
            if (file) {
                $('#cpp-upload-status-message').text(`Archivo seleccionado: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`).removeClass('cpp-error-message cpp-success-message');
                $('#cpp-btn-upload-excel-file').prop('disabled', false);
            } else {
                $('#cpp-upload-status-message').text('');
                $('#cpp-btn-upload-excel-file').prop('disabled', true);
            }
        },
        
        uploadFile: function(event) { 
            if (event) event.preventDefault();
            const fileInput = document.getElementById('student_excel_file_input');
            if (!fileInput.files || fileInput.files.length === 0) {
                $('#cpp-upload-status-message').text('Por favor, selecciona un archivo primero.').addClass('cpp-error-message').removeClass('cpp-success-message');
                return;
            }
            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append('student_excel_file', file);
            formData.append('action', 'cpp_upload_student_excel');
            formData.append('nonce', cppFrontendData.nonce);

            const $uploadBtn = $('#cpp-btn-upload-excel-file');
            const originalBtnHtml = $uploadBtn.html();
            $uploadBtn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Subiendo...');
            $('#cpp-upload-status-message').text('Subiendo archivo...').removeClass('cpp-error-message cpp-success-message');

            const self = this; 

            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', data: formData,
                processData: false, contentType: false, dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        self.tempUploadedFilePath = response.data.filePath; 
                        self.tempUploadedFileName = response.data.fileName || file.name;
                        $('#cpp-upload-status-message').text(`Archivo "${self.tempUploadedFileName}" subido. Elige modo.`).addClass('cpp-success-message').removeClass('cpp-error-message');
                        
                        $('#cpp-import-step-1-upload').hide();
                        $('#cpp-uploaded-file-name-display').text(self.tempUploadedFileName);
                        
                        let currentClassName = "la clase actual";
                        const $classNameSpan = $('#cpp-cuaderno-nombre-clase-activa-a1.cpp-top-bar-class-name');
                        if($classNameSpan.length && $classNameSpan.text().trim()){
                            currentClassName = $classNameSpan.text().trim();
                        }
                        $('#cpp-import-target-class-name').text(currentClassName);
                        $('#cpp-import-step-2-options').show();
                        $('#cpp-import-results').hide().find('#cpp-import-results-message, #cpp-import-errors-list').empty(); 
                    } else {
                        $('#cpp-upload-status-message').text('Error: ' + (response.data.message || 'No se pudo subir.')).addClass('cpp-error-message').removeClass('cpp-success-message');
                    }
                },
                error: function() {
                    $('#cpp-upload-status-message').text('Error de conexión al subir.').addClass('cpp-error-message').removeClass('cpp-success-message');
                },
                complete: function() { $uploadBtn.html(originalBtnHtml).prop('disabled', false); } // Rehabilita el botón
            });
        },

        confirmImport: function(event) { 
            if (event) event.preventDefault();
            if (!cpp.currentClaseIdCuaderno) {
                alert("Error: No hay una clase activa seleccionada."); this.resetImportForm(); return;
            }
            if (!this.tempUploadedFilePath) {
                alert("Error: No hay un archivo subido para importar."); this.resetImportForm(); return;
            }

            const importMode = $('#cpp-modal-import-students input[name="import_mode"]:checked').val();
            const $confirmBtn = $('#cpp-btn-confirm-student-import');
            const originalBtnHtml = $confirmBtn.html();
            const self = this;

            $confirmBtn.prop('disabled', true).html('<span class="dashicons dashicons-update dashicons-spin"></span> Importando...');
            $('#cpp-btn-cancel-excel-import').prop('disabled', true);
            $('#cpp-import-results').hide().find('#cpp-import-results-message, #cpp-import-errors-list').empty();

            $.ajax({
                url: cppFrontendData.ajaxUrl, type: 'POST', dataType: 'json',
                data: {
                    action: 'cpp_import_students_from_file',
                    nonce: cppFrontendData.nonce,
                    clase_id: cpp.currentClaseIdCuaderno,
                    temp_file_path: self.tempUploadedFilePath,
                    import_mode: importMode
                },
                success: function(response) {
                    $('#cpp-import-results').show();
                    let resultHtml = '';
                    if (response.success || (response.data && response.data.status === 'warning')) { 
                        resultHtml = `<strong style="color:${response.success ? 'green' : '#e65100'};">${response.data.message || 'Proceso completado.'}</strong>`;
                        if (typeof response.data.imported_count !== 'undefined') {
                            resultHtml += `<br>Alumnos importados/actualizados: ${response.data.imported_count}.`;
                        }
                        if (typeof response.data.skipped_duplicates !== 'undefined' && response.data.skipped_duplicates > 0) {
                            resultHtml += `<br>Duplicados omitidos: ${response.data.skipped_duplicates}.`;
                        }
                        $('#cpp-import-results-message').html(resultHtml);

                        if (response.data.errors && response.data.errors.length > 0) {
                            $('#cpp-import-results-message').append('<br>Problemas encontrados:');
                            response.data.errors.forEach(function(errorMsg){
                                $('#cpp-import-errors-list').append($('<li>').text(errorMsg)); 
                            });
                        }
                        if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function' && cpp.currentClaseIdCuaderno) {
                            let currentClassName = "Clase";
                            const $classNameSpan = $('#cpp-cuaderno-nombre-clase-activa-a1.cpp-top-bar-class-name');
                            if($classNameSpan.length && $classNameSpan.text().trim()){
                                 currentClassName = $classNameSpan.text().trim();
                            }
                            cpp.gradebook.cargarContenidoCuaderno(cpp.currentClaseIdCuaderno, currentClassName);
                        }
                        if ($('#cpp-modal-alumnos').is(':visible') && cpp.modals && cpp.modals.alumnos && typeof cpp.modals.alumnos.refreshList === 'function') {
                            cpp.modals.alumnos.refreshList();
                        }
                    } else { 
                        $('#cpp-import-results-message').html(`<strong style="color:red;">Error: ${response.data.message || 'No se pudo importar.'}</strong>`);
                        if (response.data.errors && response.data.errors.length > 0) {
                            $('#cpp-import-results-message').append('<br>Detalles:');
                            response.data.errors.forEach(function(errorMsg){
                               $('#cpp-import-errors-list').append($('<li>').text(errorMsg));
                            });
                        }
                    }
                    $('#cpp-btn-cancel-excel-import').text('Cerrar'); 
                },
                error: function() {
                    $('#cpp-import-results').show();
                    $('#cpp-import-results-message').html('<strong style="color:red;">Error de conexión al importar.</strong>');
                },
                complete: function() {
                    $confirmBtn.prop('disabled', false).html('<span class="dashicons dashicons-database-import"></span> Confirmar Importación');
                    $('#cpp-btn-cancel-excel-import').prop('disabled', false);
                    self.tempUploadedFilePath = null; 
                    self.tempUploadedFileName = null;
                }
            });
        },

        bindEvents: function() {
            console.log("Binding Modals Excel events...");
            const $modalExcelOptions = $('#cpp-modal-excel-options');
            const $modalImportStudents = $('#cpp-modal-import-students');

            // Los botones que ABREN estos modales se bindean en cpp.gradebook.js

            // Eventos DENTRO del modal de opciones de descarga
            $modalExcelOptions.on('click', '#cpp-btn-download-excel-current-class', function(e){ cpp.modals.excel.triggerDownload(e, 'single_class'); });
            $modalExcelOptions.on('click', '#cpp-btn-download-excel-all-classes', function(e){ cpp.modals.excel.triggerDownload(e, 'all_classes'); });

            // Eventos DENTRO del modal de importación de alumnos
            $modalImportStudents.on('click', '#cpp-btn-download-student-template', function(e){ cpp.modals.excel.downloadStudentTemplate(e); });
            $modalImportStudents.on('change', '#student_excel_file_input', function(e){ cpp.modals.excel.handleFileSelected.call(this, e); });
            $modalImportStudents.on('click', '#cpp-btn-upload-excel-file', function(e){ cpp.modals.excel.uploadFile.call(cpp.modals.excel, e); });
            $modalImportStudents.on('click', '#cpp-btn-confirm-student-import', function(e){ cpp.modals.excel.confirmImport.call(cpp.modals.excel, e); });
            $modalImportStudents.on('click', '#cpp-btn-cancel-excel-import', function(e){ cpp.modals.excel.resetImportForm(); });
        }
    };

})(jQuery);