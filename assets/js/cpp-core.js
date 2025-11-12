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
            'utils', 'sidebar', 'cuaderno',
            'modals.general', 'config',
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

        // Restaurar la última pestaña abierta al final de toda la inicialización
        try {
            const lastOpenedTab = localStorage.getItem('cpp_last_opened_tab');
            if (lastOpenedTab) {
                const $targetTab = $(`.cpp-main-tab-link[data-tab="${lastOpenedTab}"]`);
                if ($targetTab.length && !$targetTab.hasClass('active')) {
                    console.log(`CPP Core: Restaurando la pestaña ${lastOpenedTab}.`);
                    // El click ahora se maneja de forma centralizada, por lo que un simple trigger es suficiente y más limpio.
                    $targetTab.trigger('click');
                }
            }
        } catch (e) {
            console.warn("No se pudo restaurar la última pestaña abierta desde localStorage:", e);
        }

        console.log("CPP Core: init() completado.");
    },

    bindCoreEvents: function() {
        const $ = jQuery;
        const $document = $(document);

        // Este listener ahora solo delega al manejador centralizado en el módulo del cuaderno
        $document.on('click', '.cpp-main-tab-link', function(e) {
            e.preventDefault();
            if (cpp.cuaderno && typeof cpp.cuaderno.handleMainTabSwitch === 'function') {
                cpp.cuaderno.handleMainTabSwitch(jQuery(this));
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
            
            if (cpp.cuaderno && typeof cpp.cuaderno.cargarContenidoCuaderno === 'function') {
                // Pasamos null como tercer parámetro para que el backend cargue la primera evaluación por defecto.
                cpp.cuaderno.cargarContenidoCuaderno(claseIdToLoad, claseNombreToLoad, null);
            } else {
                 console.error("CPP Core: cpp.cuaderno.cargarContenidoCuaderno NO ESTÁ DEFINIDO. El cuaderno no se cargará.");
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

        // La restauración de la pestaña se ha movido al final de la función init()
        // para asegurar que todos los módulos estén cargados.
    }
};

jQuery(document).ready(function($) {
    cpp.init(); 
});