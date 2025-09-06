// assets/js/cpp-sidebar.js

(function($) { // Envolvemos todo en una IIFE para pasar jQuery como $
    'use strict';

    // Asumimos que 'cpp' ya ha sido declarado en cpp-core.js
    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-sidebar.js no puede inicializarse.");
        return;
    }

    cpp.sidebar = {
        isSidebarVisible: false,

        init: function() {
            console.log("CPP Sidebar Module Initializing...");
            this.initSortableClases();
            this.bindEvents();
        },

        initSortableClases: function() {
            const $clasesList = $('.cpp-sidebar-clases-list');
            if ($clasesList.length && typeof $clasesList.sortable === 'function') {
                $clasesList.sortable({
                    axis: 'y',
                    items: '> li.cpp-sidebar-clase-item',
                    cursor: 'move',
                    placeholder: 'cpp-sortable-placeholder',
                    helper: 'clone',
                    opacity: 0.7,
                    update: function(event, ui) {
                        const orderedClassIds = $(this).find('li.cpp-sidebar-clase-item').map(function() {
                            return $(this).data('clase-id');
                        }).get();
                        
                        if (typeof cppFrontendData === 'undefined' || !cppFrontendData.ajaxUrl || !cppFrontendData.nonce) {
                            console.error("Error en initSortableClases: cppFrontendData no disponible.");
                            return;
                        }

                        $.ajax({
                            url: cppFrontendData.ajaxUrl,
                            type: 'POST',
                            dataType: 'json',
                            data: {
                                action: 'cpp_guardar_orden_clases',
                                nonce: cppFrontendData.nonce,
                                orden_clases: orderedClassIds
                            },
                            success: function(response) {
                                if (response.success) {
                                    console.log("Orden de clases guardado correctamente.");
                                } else {
                                    console.error("Error al guardar el orden de las clases:", response.data ? response.data.message : 'Error desconocido.');
                                }
                            },
                            error: function(jqXHR, textStatus, errorThrown) {
                                console.error("Error AJAX al guardar orden de clases:", textStatus, errorThrown, jqXHR.responseText);
                            }
                        });
                    }
                });
            } else {
                // Logs de advertencia si sortable no está disponible o no se encuentra el elemento
                // if (!$clasesList.length) { console.warn("Contenedor '.cpp-sidebar-clases-list' no encontrado para sortable."); }
                // if (typeof $clasesList.sortable !== 'function') { console.warn("jQuery UI Sortable no está cargado."); }
            }
        },

        toggle: function(callback) {
            const $sidebar = $('#cpp-cuaderno-sidebar');
            const $overlay = $('#cpp-sidebar-overlay');

            if (!$sidebar.length) {
                console.error("Elemento Sidebar '#cpp-cuaderno-sidebar' NO ENCONTRADO.");
                if (typeof callback === 'function') callback();
                return;
            }

            // Si hay un callback, nos preparamos para ejecutarlo cuando la transición termine
            if (typeof callback === 'function') {
                $sidebar.one('transitionend', function() {
                    callback();
                });
            }

            this.isSidebarVisible = !this.isSidebarVisible;
            $sidebar.toggleClass('cpp-sidebar-visible', this.isSidebarVisible);
            if ($overlay.length) {
                $overlay.toggleClass('cpp-sidebar-visible', this.isSidebarVisible);
            }
            $('body').toggleClass('cpp-cuaderno-sidebar-is-open', this.isSidebarVisible);
        },

        seleccionarClase: function(event) { // 'this' será el elemento <a> dentro de esta función debido a .call()
            event.preventDefault();
            const $link = $(event.currentTarget); 
            const $sidebarItem = $link.closest('li.cpp-sidebar-clase-item');

            if ($sidebarItem.hasClass('cpp-sidebar-item-active')) {
                if (cpp.sidebar.isSidebarVisible) { // Accede a la propiedad del módulo
                    cpp.sidebar.toggle(); // Llama al método del módulo
                }
                return;
            }

            const claseId = $sidebarItem.data('clase-id');
            const claseNombre = $sidebarItem.data('clase-nombre');
            const baseNotaFinal = $sidebarItem.data('base-nota-final');

            if (typeof baseNotaFinal !== 'undefined' && cpp) { 
                cpp.currentBaseNotaFinal = parseFloat(baseNotaFinal) || 100; 
            }

            $('.cpp-sidebar-clases-list .cpp-sidebar-clase-item').removeClass('cpp-sidebar-item-active');
            $sidebarItem.addClass('cpp-sidebar-item-active');

            if (cpp.gradebook && typeof cpp.gradebook.cargarContenidoCuaderno === 'function') {
                cpp.gradebook.cargarContenidoCuaderno(claseId, claseNombre);
            } else {
                console.error("cpp.gradebook.cargarContenidoCuaderno no está definido.");
            }

            if (cpp.sidebar.isSidebarVisible) { 
                cpp.sidebar.toggle(); 
            }
        },

        bindEvents: function() {
            console.log("Binding Sidebar events...");
            const $document = $(document);

            $document.on('click', '#cpp-a1-menu-btn-toggle', function(e) {
                console.log("Botón Menú Clases (#cpp-a1-menu-btn-toggle) CLICADO.");
                e.preventDefault();
                e.stopPropagation();
                cpp.sidebar.toggle(); 
            });

            $document.on('click', '#cpp-sidebar-close-btn', function(e) {
                console.log("Botón Cerrar Sidebar (#cpp-sidebar-close-btn) CLICADO.");
                e.stopPropagation();
                if (cpp.sidebar.isSidebarVisible) {
                    cpp.sidebar.toggle(); 
                }
            });

            $document.on('click', '.cpp-sidebar-clases-list .cpp-sidebar-clase-item > a', function(e){
                cpp.sidebar.seleccionarClase.call(this, e); // Mantenemos .call(this, e) para que 'this' sea <a> dentro de seleccionarClase si es necesario
            });

            $document.on('click', '#cpp-sidebar-overlay', function(event) {
                if (cpp.sidebar.isSidebarVisible) {
                    cpp.sidebar.toggle();
                }
            });

            $document.on('click', '.cpp-sidebar-clase-alumnos-btn', function(e){
                if (cpp.modals && cpp.modals.alumnos && typeof cpp.modals.alumnos.mostrar === 'function') {
                    cpp.modals.alumnos.mostrar(e);
                } else {
                    console.error("Función cpp.modals.alumnos.mostrar no encontrada.");
                }
            });

            // Usamos addEventListener nativo en la fase de captura para máxima prioridad.
            document.addEventListener('click', function(e) {
                // Delegación manual del evento.
                let targetElement = e.target.closest('.cpp-sidebar-clase-settings-btn');

                if (targetElement) {
                    // Prevenimos que el click en el botón dispare otros handlers (como el de seleccionar clase)
                    e.preventDefault();
                    e.stopPropagation();

                    if (cpp.config && typeof cpp.config.showParaEditar === 'function') {
                        cpp.config.showParaEditar(e);
                    } else {
                        console.error("Función cpp.config.showParaEditar no encontrada.");
                    }
                }
            }, true); // El 'true' activa la fase de captura.
            $document.on('click', '#cpp-btn-nueva-clase-sidebar', function(e){
                if (cpp.config && typeof cpp.config.showModalParaCrear === 'function') {
                    cpp.config.showModalParaCrear(e);
                } else {
                    console.error("Función cpp.config.showModalParaCrear no encontrada.");
                }
            });
        }
    };

})(jQuery); // Pasa jQuery a la IIFE