// assets/js/cpp-modales-general.js
(function($) { // Envolvemos en IIFE y pasamos jQuery como $
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-modales-general.js no puede inicializarse.");
        return;
    }
    cpp.modals = cpp.modals || {}; // Asegura que cpp.modals exista

    cpp.modals.general = {
        init: function() {
            console.log("CPP Modals General Module Initializing...");
            // bindEvents se llamará desde cpp.core.js si es necesario
        },

        hideAll: function() {
            const $visibleModal = $('.cpp-modal:visible');
            if (!$visibleModal.length) {
                return;
            }
            // console.log("Cerrando modal visible:", $visibleModal.attr('id'));

            if ($visibleModal.is('#cpp-modal-clase') && cpp.modals.clase && typeof cpp.modals.clase.resetForm === 'function') {
                cpp.modals.clase.resetForm();
            } else if ($visibleModal.is('#cpp-modal-alumnos') && cpp.modals.alumnos && typeof cpp.modals.alumnos.resetForm === 'function') {
                cpp.modals.alumnos.resetForm();
            } else if ($visibleModal.is('#cpp-modal-actividad-evaluable-cuaderno') && cpp.modals.actividades && typeof cpp.modals.actividades.resetForm === 'function') {
                cpp.modals.actividades.resetForm();
            } else if ($visibleModal.is('#cpp-modal-excel-options')) {
                // No necesita reseteo especial
            } else if ($visibleModal.is('#cpp-modal-import-students') && cpp.modals.excel && typeof cpp.modals.excel.resetImportForm === 'function') {
                cpp.modals.excel.resetImportForm();
            }
            
            $visibleModal.fadeOut();
        },

        bindEvents: function() {
            console.log("Binding Modals General events...");
            
            $(document).on('click', '.cpp-modal-close', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const $modal = $(this).closest('.cpp-modal');
                if (cpp.tutorial && cpp.tutorial.isActive) {
                    if ($modal.is('#cpp-modal-alumnos') && cpp.tutorial.currentStep === 7) {
                        cpp.tutorial.nextStep();
                    } else if ($modal.is('#cpp-modal-actividad-evaluable-cuaderno') && (cpp.tutorial.currentStep === 9 || cpp.tutorial.currentStep === 10)) {
                        cpp.tutorial.end();
                    }
                }

                cpp.modals.general.hideAll();
            });

            $(document).on('click', '.cpp-modal', function(event) {
                if ($(event.target).is('.cpp-modal')) {
                    cpp.modals.general.hideAll();
                }
            });
        }
    };

})(jQuery);