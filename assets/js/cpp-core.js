// assets/js/cpp-core.js

const cpp = {
    // Propiedades globales básicas
    currentClaseIdCuaderno: null,
    currentEvaluacionId: null, 
    currentBaseNotaFinal: 100,
    // cppFrontendData se adjuntará a este objeto por wp_localize_script

    // Lista de colores pastel, si cpp.utils no se carga, como fallback o si se decide mantener aquí
    pastelColors: [
        '#FFB6C1', '#ADD8E6', '#98FB98', '#E6E6FA', 
        '#FFDAB9', '#FFFFE0', '#AFEEEE', '#F08080', 
        '#D8BFD8', '#EEE8AA', '#FFE4E1', '#B0E0E6'
    ],

    init: function() {
        const $ = jQuery; // Asegurar que $ es jQuery dentro de esta función init
        console.log("CPP Core: init() 시작");

        if (typeof cppFrontendData === 'undefined' || !cppFrontendData.ajaxUrl || !cppFrontendData.nonce) {
            console.error("FATAL: cppFrontendData no está definido o está incompleto.");
            $('#cpp-cuaderno-contenido').html('<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">Error crítico de configuración.</p></div>');
            return; 
        }
        console.log("CPP Core: cppFrontendData disponible:", cppFrontendData);

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

            if (found && moduleObject) {
                if (typeof moduleObject.init === 'function') {
                    console.log(`CPP Core: Initializing ${modulePath}...`);
                    moduleObject.init();
                }
                // bindEvents se llama ahora desde el init de cada módulo
            } else {
                console.warn(`CPP Core: Module '${modulePath}' not found.`);
            }
        });
        
        this.bindCoreEvents();
        this.initializeCuadernoView();

        // El módulo programador se inicializa de forma independiente si existe
        if (typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.init === 'function') {
            console.log(`CPP Core: Initializing CppProgramadorApp...`);
            const initialClaseId = this.getInitialClaseId();
            CppProgramadorApp.init(initialClaseId);
        }

        console.log("CPP Core: init() completado.");
    },

    bindCoreEvents: function() {
        const $ = jQuery;
        const $document = $(document);

        $document.on('click', '.cpp-main-tab-link', function(e) {
            e.preventDefault();
            const $tab = $(this);
            const tabId = $tab.data('tab');

            if ($tab.hasClass('active')) {
                return;
            }

            $('.cpp-main-tab-link').removeClass('active');
            $tab.addClass('active');

            $('.cpp-main-tab-content').removeClass('active');
            $('#cpp-main-tab-' + tabId).addClass('active');

            try {
                localStorage.setItem('cpp_last_opened_tab', tabId);
            } catch (e) {
                console.warn("No se pudo guardar la última pestaña abierta en localStorage:", e);
            }

            // Si se activa la pestaña de configuración y hay una clase seleccionada, cargar sus datos
            if (tabId === 'configuracion' && cpp.currentClaseIdCuaderno) {
                if (cpp.config && typeof cpp.config.showParaEditar === 'function') {
                    cpp.config.showParaEditar(null, false, cpp.currentClaseIdCuaderno);
                }
            }
        });

        // Botón de crear primera clase desde el welcome screen
        $document.on('click', '#cpp-btn-crear-primera-clase', function(e) {
            if (cpp.config && typeof cpp.config.showParaCrear === 'function') {
                cpp.config.showParaCrear(e);
            }
        });
    },

    getInitialClaseId: function() {
        const $clasesSidebarItems = jQuery('.cpp-sidebar-clases-list .cpp-sidebar-clase-item');
        let claseIdToLoad = null;

        if (typeof localStorage !== 'undefined' && cppFrontendData && cppFrontendData.userId && cppFrontendData.userId !== '0') {
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

        if ($('.cpp-cuaderno-viewport-classroom').length === 0) {
            $('html, body').removeClass('cpp-plugin-active');
            $('body').removeClass('cpp-cuaderno-page-active');
            return;
        }
        console.log("CPP Core: initializeCuadernoView ejecutándose...");
        $('html, body').addClass('cpp-plugin-active'); 
        $('body').addClass('cpp-cuaderno-page-active');

        let claseIdToLoad = null;
        let claseNombreToLoad = null;
        let $itemToActivate = null;
        const $clasesSidebarItems = $('.cpp-sidebar-clases-list .cpp-sidebar-clase-item');

        if (typeof localStorage !== 'undefined' && cppFrontendData && cppFrontendData.userId && cppFrontendData.userId !== '0') {
            const lastOpenedClaseId = localStorage.getItem('cpp_last_opened_clase_id_user_' + cppFrontendData.userId);
            if (lastOpenedClaseId) {
                $itemToActivate = $clasesSidebarItems.filter(`[data-clase-id="${lastOpenedClaseId}"]`);
                if ($itemToActivate.length > 0) {
                    claseIdToLoad = lastOpenedClaseId;
                    claseNombreToLoad = $itemToActivate.data('clase-nombre');
                    const baseNotaFinal = $itemToActivate.data('base-nota-final');
                    if (typeof baseNotaFinal !== 'undefined') {
                        cpp.currentBaseNotaFinal = parseFloat(baseNotaFinal) || 100;
                    }
                } else {
                    localStorage.removeItem('cpp_last_opened_clase_id_user_' + cppFrontendData.userId);
                }
            }
        }

        if (!claseIdToLoad && $clasesSidebarItems.length > 0) {
            $itemToActivate = $clasesSidebarItems.first();
            claseIdToLoad = $itemToActivate.data('clase-id');
            claseNombreToLoad = $itemToActivate.data('clase-nombre');
            const baseNotaFinal = $itemToActivate.data('base-nota-final');
            if (typeof baseNotaFinal !== 'undefined') {
                cpp.currentBaseNotaFinal = parseFloat(baseNotaFinal) || 100;
            }
        }

        if (claseIdToLoad && $itemToActivate && $itemToActivate.length > 0) {
            console.log("CPP Core: Clase inicial a cargar ID:", claseIdToLoad);
            $clasesSidebarItems.removeClass('cpp-sidebar-item-active');
            $itemToActivate.addClass('cpp-sidebar-item-active');
            
            if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function') {
                // Pasamos null como tercer parámetro para que el backend cargue la primera evaluación por defecto.
                cpp.gradebook.cargarContenidoCuaderno(claseIdToLoad, claseNombreToLoad, null);
            } else {
                 console.error("CPP Core: cpp.gradebook.cargarContenidoCuaderno NO ESTÁ DEFINIDO. El cuaderno no se cargará.");
                 $('#cpp-cuaderno-contenido').html('<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">Error: Módulo del cuaderno no cargado.</p></div>');
            }
        } else if ($clasesSidebarItems.length === 0) {
            // This is the welcome screen. The PHP has already rendered the welcome message.
            // No JS action is needed here.
            console.log("CPP Core: No hay clases, mostrando pantalla de bienvenida.");
        } else {
            console.warn("CPP Core: No se pudo determinar la clase inicial a cargar.");
            $('#cpp-cuaderno-contenido').html('<p class="cpp-cuaderno-cargando">Error al seleccionar una clase para cargar.</p>');
        }

        // Restaurar la última pestaña abierta
        try {
            const lastOpenedTab = localStorage.getItem('cpp_last_opened_tab');
            if (lastOpenedTab) {
                // Usamos .trigger('click') para que se ejecute toda la lógica asociada al cambio de pestaña
                $(`.cpp-main-tab-link[data-tab="${lastOpenedTab}"]`).trigger('click');
            }
        } catch (e) {
            console.warn("No se pudo restaurar la última pestaña abierta desde localStorage:", e);
        }
    }
};

jQuery(document).ready(function($) {
    cpp.init(); 
});