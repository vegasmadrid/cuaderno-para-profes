// assets/js/cpp-core.js

const cpp = {
    currentClaseIdCuaderno: null,
    currentEvaluacionId: null, 
    currentBaseNotaFinal: 100,

    init: function() {
        const $ = jQuery;
        if (typeof cppFrontendData === 'undefined' || !cppFrontendData.ajaxUrl || !cppFrontendData.nonce) {
            $('#cpp-cuaderno-contenido').html('<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">Error crítico de configuración.</p></div>');
            return; 
        }

        const modulesToInitialize = [
            'utils', 'sidebar', 'gradebook',
            'modals.general', 'config', 'modals.alumnos',
            'modals.actividades', 'modals.excel', 'modals.asistencia',
            'modals.fichaAlumno', 'modals.evaluacion'
        ];
        
        modulesToInitialize.forEach(modulePath => {
            let moduleObject = cpp;
            const parts = modulePath.split('.');
            let found = true;
            for (const part of parts) {
                if (moduleObject && typeof moduleObject[part] !== 'undefined') {
                    moduleObject = moduleObject[part];
                } else {
                    found = false;
                    break;
                }
            }
            if (found && moduleObject && typeof moduleObject.init === 'function') {
                moduleObject.init();
            }
        });
        
        this.initializeCuadernoView();

        if (typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.init === 'function') {
            const initialClaseId = this.getInitialClaseId();
            CppProgramadorApp.init(initialClaseId);
        }

        // Restore the last opened tab at the end of all initialization
        try {
            const lastOpenedTab = localStorage.getItem('cpp_last_opened_tab');
            if (lastOpenedTab) {
                const $targetTab = $(`.cpp-main-tab-link[data-tab="${lastOpenedTab}"]`);
                if ($targetTab.length && !$targetTab.hasClass('active')) {
                    $targetTab.trigger('click');
                }
            }
        } catch (e) {
            console.warn("Could not restore last opened tab from localStorage:", e);
        }
    },

    getInitialClaseId: function() {
        const $clasesSidebarItems = jQuery('.cpp-sidebar-clases-list .cpp-sidebar-clase-item');
        let claseIdToLoad = null;
        if (typeof localStorage !== 'undefined' && cppFrontendData && cppFrontendData.userId) {
            const lastOpenedClaseId = localStorage.getItem('cpp_last_opened_clase_id_user_' + cppFrontendData.userId);
            if (lastOpenedClaseId && $clasesSidebarItems.filter(`[data-clase-id="${lastOpenedClaseId}"]`).length > 0) {
                claseIdToLoad = lastOpenedClaseId;
            }
        }
        if (!claseIdToLoad && $clasesSidebarItems.length > 0) {
            claseIdToLoad = $clasesSidebarItems.first().data('clase-id');
        }
        return claseIdToLoad;
    },

    initializeCuadernoView: function() {
        const $ = jQuery; 
        if ($('.cpp-cuaderno-viewport-classroom').length === 0) { return; }
        $('html, body').addClass('cpp-plugin-active cpp-cuaderno-page-active');
        let claseIdToLoad = this.getInitialClaseId();
        let $itemToActivate = null;
        if (claseIdToLoad) {
            $itemToActivate = $(`.cpp-sidebar-clase-item[data-clase-id="${claseIdToLoad}"]`);
        }

        if (claseIdToLoad && $itemToActivate && $itemToActivate.length > 0) {
            const claseNombreToLoad = $itemToActivate.data('clase-nombre');
            const baseNotaFinal = $itemToActivate.data('base-nota-final');
            if (typeof baseNotaFinal !== 'undefined') { cpp.currentBaseNotaFinal = parseFloat(baseNotaFinal) || 100; }
            $('.cpp-sidebar-clases-list .cpp-sidebar-clase-item').removeClass('cpp-sidebar-item-active');
            $itemToActivate.addClass('cpp-sidebar-item-active');
            if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function') {
                cpp.gradebook.cargarContenidoCuaderno(claseIdToLoad, claseNombreToLoad, null);
            }
        }
    }
};

jQuery(document).ready(function($) {
    cpp.init(); 
});