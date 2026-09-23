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
            this.bindEvents();
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

            // ESC Key listener to close top visible modal
            $(document).on('keydown', function(e) {
                if (e.key === 'Escape' || e.keyCode === 27) {
                    const $visibleModal = $('.cpp-modal:visible').last();
                    if ($visibleModal.length) {
                        e.preventDefault();
                        $visibleModal.find('.cpp-modal-close, .cpp-modal-cancel-btn').first().trigger('click');
                    }
                }
            });

            // Auto-focus on first visible input/select when modal becomes visible
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.attributeName === 'style') {
                        const target = mutation.target;
                        if ($(target).hasClass('cpp-modal') && $(target).is(':visible')) {
                            setTimeout(function() {
                                const $firstInput = $(target).find('input:visible, select:visible, textarea:visible').first();
                                if ($firstInput.length && !$firstInput.prop('readonly')) {
                                    $firstInput.focus();
                                }
                            }, 100);
                        }
                    }
                });
            });

            $('.cpp-modal').each(function() {
                observer.observe(this, { attributes: true });
            });
            
            $(document).on('click', '.cpp-modal-close, .cpp-modal-cancel-btn', function(e) {
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

            // Se comenta esta sección para evitar que el modal se cierre al hacer clic fuera.
            // El comportamiento deseado es que solo se cierre con el botón X.
            // $(document).on('click', '.cpp-modal', function(event) {
            //     if ($(event.target).is('.cpp-modal')) {
            //         cpp.modals.general.hideAll();
            //     }
            // });
        }
    };

})(jQuery);