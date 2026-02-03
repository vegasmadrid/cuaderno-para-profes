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
        console.log("CPP Core: init() start");

        if (typeof cppFrontendData === 'undefined' || !cppFrontendData.ajaxUrl || !cppFrontendData.nonce) {
            console.error("FATAL: cppFrontendData no está definido o está incompleto.");
            $('#cpp-cuaderno-contenido').html('<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">Error crítico de configuración.</p></div>');
            return; 
        }

        const modulesToInitialize = [
            'utils', 'sidebar', 'cuaderno', 'alumnos',
            'modals.general', 'config', 'modals.clase',
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
                    moduleObject.init();
                }
                // bindEvents se llama ahora desde el init de cada módulo
            } else {
                console.warn(`CPP Core: Module '${modulePath}' not found.`);
            }
        });
        
        this.bindCoreEvents();
        this.initializeCuadernoView();
        this.handleConnectionStatus();

        // El módulo programador se inicializa de forma independiente si existe
        if (typeof CppProgramadorApp !== 'undefined' && typeof CppProgramadorApp.init === 'function') {
            const initialClaseId = this.getInitialClaseId();
            CppProgramadorApp.init(initialClaseId);
        }

        // Restaurar la última pestaña abierta al final de toda la inicialización
        try {
            let lastOpenedTab = localStorage.getItem('cpp_last_opened_tab');

            // Lógica para forzar el regreso a la pestaña 'cuaderno'
            if (lastOpenedTab && lastOpenedTab !== 'cuaderno') {
                lastOpenedTab = 'cuaderno';
                localStorage.setItem('cpp_last_opened_tab', 'cuaderno');
            }

            if (lastOpenedTab) {
                const $targetTab = $(`.cpp-main-tab-link[data-tab="${lastOpenedTab}"]`);
                if ($targetTab.length && !$targetTab.hasClass('active')) {
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

        // MANEJO CENTRALIZADO DE PESTAÑAS:
        // Solo un listener aquí que delega la lógica pesada al módulo correspondiente.
        $document.on('click', '.cpp-main-tab-link', function(e) {
            e.preventDefault();
            if (cpp.cuaderno && typeof cpp.cuaderno.handleMainTabSwitch === 'function') {
                cpp.cuaderno.handleMainTabSwitch($(this));
            }
        });

        // Botón de crear primera clase desde el welcome screen
        $document.on('click', '#cpp-btn-crear-primera-clase', function(e) {
            // Corregido para llamar al módulo correcto de modales
            if (cpp.modals && cpp.modals.clase && typeof cpp.modals.clase.showParaCrear === 'function') {
                cpp.modals.clase.showParaCrear(e);
            }
        });
    },

    handleConnectionStatus: function() {
        const offlineNotice = document.getElementById('cpp-offline-notice');
        const quoteTextElement = document.querySelector('#cpp-offline-quote .quote-text');
        const quoteAuthorElement = document.querySelector('#cpp-offline-quote .quote-author');
        const mainContainer = document.querySelector('.cpp-cuaderno-viewport-classroom');

        const quotes = [
            { text: "La educación es el arma más poderosa que puedes usar para cambiar el mundo.", author: "Nelson Mandela" },
            { text: "La única verdadera sabiduría está en saber que no sabes nada.", author: "Sócrates" },
            { text: "La mente que se abre a una nueva idea nunca volverá a su tamaño original.", author: "Albert Einstein" },
            { text: "Aprender es descubrir lo que ya sabes.", author: "Richard Bach" },
            { text: "Dime y lo olvido, enséñame y lo recuerdo, involúcrame y lo aprendo.", author: "Benjamin Franklin" },
            { text: "La educación es el pasaporte hacia el futuro, el mañana pertenece a aquellos que se preparan para él en el día de hoy.", author: "Malcolm X" }
        ];

        function updateOnlineStatus(event) {
            if (event.type === 'offline') {
                const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
                if (quoteTextElement && quoteAuthorElement) {
                    quoteTextElement.textContent = `«${randomQuote.text}»`;
                    quoteAuthorElement.textContent = `- ${randomQuote.author}`;
                }
                if (offlineNotice) {
                    offlineNotice.classList.add('visible');
                }
                if (mainContainer) {
                    mainContainer.classList.add('offline-active');
                }
            } else if (event.type === 'online') {
                if (offlineNotice && offlineNotice.classList.contains('visible')) {
                    window.location.reload();
                }
            }
        }

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        if (!navigator.onLine) {
            updateOnlineStatus({ type: 'offline' });
        }
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
            $clasesSidebarItems.removeClass('cpp-sidebar-item-active');
            $itemToActivate.addClass('cpp-sidebar-item-active');

            // Show loader before initial content load
            if (cpp.utils && typeof cpp.utils.showLoader === 'function') {
                cpp.utils.showLoader();
            }
            
            if (cpp.cuaderno && typeof cpp.cuaderno.cargarContenidoCuaderno === 'function') {
                // Pasamos null como tercer parámetro para que el backend cargue la primera evaluación por defecto.
                cpp.cuaderno.cargarContenidoCuaderno(claseIdToLoad, claseNombreToLoad, null);
            } else {
                 console.error("CPP Core: cpp.cuaderno.cargarContenidoCuaderno NOT DEFINED.");
                 $('#cpp-cuaderno-contenido').html('<div class="cpp-cuaderno-mensaje-vacio"><p class="cpp-error-message">Error: Notebook module not loaded.</p></div>');
            }
        } else if ($clasesSidebarItems.length === 0) {
            // This is the welcome screen. The PHP has already rendered the welcome message.
            // No JS action is needed here.
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