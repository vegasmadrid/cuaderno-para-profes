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
            { name: 'utils', objRef: 'utils' },
            { name: 'sidebar', objRef: 'sidebar' },
            { name: 'gradebook', objRef: 'gradebook' }, // cpp-cuaderno.js
            { name: 'modalsGeneral', objRef: 'modals.general' },
            { name: 'modalsClase', objRef: 'modals.clase' },
            { name: 'modalsAlumnos', objRef: 'modals.alumnos' },
            { name: 'modalsActividades', objRef: 'modals.actividades' },
            { name: 'modalsExcel', objRef: 'modals.excel' },
            { name: 'modalsAsistencia', objRef: 'modals.asistencia' },
            { name: 'modalsFichaAlumno', objRef: 'modals.fichaAlumno' },
            { name: 'modalsEvaluacion', objRef: 'modals.evaluacion' },
            { name: 'tutorial', objRef: 'tutorial' }
        ];
        
        modulesToInitialize.forEach(moduleInfo => {
            let moduleObject = cpp; 
            const parts = moduleInfo.objRef.split('.'); 
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
                console.log(`CPP Core: Módulo '${moduleInfo.name}' encontrado.`);
                if (typeof moduleObject.init === 'function') {
                    console.log(`CPP Core: Llamando a init() de '${moduleInfo.name}'...`);
                    moduleObject.init();
                }
            } else {
                console.warn(`CPP Core: Módulo '${moduleInfo.name}' (cpp.${moduleInfo.objRef}) NO encontrado o no tiene estructura esperada.`);
            }
        });
        
        modulesToInitialize.forEach(moduleInfo => {
            let moduleObject = cpp;
            const parts = moduleInfo.objRef.split('.');
            let found = true;
            for (const part of parts) {
                if (moduleObject && typeof moduleObject[part] !== 'undefined') {
                    moduleObject = moduleObject[part];
                } else { found = false; break; }
            }
            if (found && moduleObject && typeof moduleObject.bindEvents === 'function') {
                console.log(`CPP Core: Llamando a bindEvents() de '${moduleInfo.name}'...`);
                moduleObject.bindEvents();
            }
        });
        
        this.initializeCuadernoView(); 

        console.log("CPP Core: init() completado.");
    }, 

    initializeCuadernoView: function() {
        const $ = jQuery; 

        if ($('.cpp-cuaderno-viewport-classroom').length === 0) {
            return; // No estamos en la página del cuaderno
        }

        // Si la pantalla de bienvenida se muestra (renderizada por PHP), no hacemos nada más.
        if ($('.cpp-welcome-screen').length > 0) {
            console.log("CPP Core: Pantalla de bienvenida detectada. La inicialización de la vista del cuaderno se detiene aquí.");
            return;
        }

        console.log("CPP Core: initializeCuadernoView ejecutándose...");
        $('html, body').addClass('cpp-plugin-active'); 
        $('body').addClass('cpp-cuaderno-page-active');

        let claseIdToLoad = null;
        let claseNombreToLoad = null;
        let $itemToActivate = null;
        const $clasesSidebarItems = $('.cpp-sidebar-clases-list .cpp-sidebar-clase-item');

        // Si no hay clases en la barra lateral, no hay nada que cargar.
        if ($clasesSidebarItems.length === 0) {
            console.warn("CPP Core: No hay clases en la barra lateral para cargar.");
            return;
        }

        // 1. Intentar cargar la última clase abierta desde localStorage
        if (typeof localStorage !== 'undefined' && cppFrontendData && cppFrontendData.userId && cppFrontendData.userId !== '0') {
            const lastOpenedClaseId = localStorage.getItem('cpp_last_opened_clase_id_user_' + cppFrontendData.userId);
            if (lastOpenedClaseId) {
                $itemToActivate = $clasesSidebarItems.filter(`[data-clase-id="${lastOpenedClaseId}"]`);
                if ($itemToActivate.length > 0) {
                    claseIdToLoad = lastOpenedClaseId;
                } else {
                    // La clase guardada ya no existe, limpiar localStorage
                    localStorage.removeItem('cpp_last_opened_clase_id_user_' + cppFrontendData.userId);
                }
            }
        }

        // 2. Si no hay última clase guardada, cargar la primera de la lista
        if (!claseIdToLoad) {
            $itemToActivate = $clasesSidebarItems.first();
            claseIdToLoad = $itemToActivate.data('clase-id');
        }

        // 3. Si se ha determinado una clase para cargar, proceder
        if (claseIdToLoad && $itemToActivate && $itemToActivate.length > 0) {
            claseNombreToLoad = $itemToActivate.data('clase-nombre');
            console.log("CPP Core: Clase inicial a cargar ID:", claseIdToLoad);

            $clasesSidebarItems.removeClass('cpp-sidebar-item-active');
            $itemToActivate.addClass('cpp-sidebar-item-active');
            
            if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function') {
                cpp.gradebook.cargarContenidoCuaderno(claseIdToLoad, claseNombreToLoad, null);
            } else {
                 console.error("CPP Core: cpp.gradebook.cargarContenidoCuaderno NO ESTÁ DEFINIDO. El cuaderno no se cargará.");
                 $('#cpp-cuaderno-contenido').html('<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">Error: Módulo del cuaderno no cargado.</p></div>');
            }
        } else {
            // Este caso ahora solo debería ocurrir si hay un error extraño, como clases en la lista pero sin data-clase-id.
            console.warn("CPP Core: No se pudo determinar una clase válida para cargar.");
        }
    }
};

jQuery(document).ready(function($) {
    cpp.init(); 
});