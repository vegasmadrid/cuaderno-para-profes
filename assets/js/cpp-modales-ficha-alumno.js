// assets/js/cpp-modales-ficha-alumno.js - DEBUGGING VERSION 1.1
(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("DEBUG: 'cpp' object not found for fichaAlumno.");
        return;
    }
    cpp.modals = cpp.modals || {};

    console.log("DEBUG: Loading sanity-check version of cpp-modales-ficha-alumno.js");

    cpp.modals.fichaAlumno = {
        init: function() {
             console.log("DEBUG: fichaAlumno init() called.");
        },
        bindEvents: function() {
             console.log("DEBUG: fichaAlumno bindEvents() called.");
        },
        mostrar: function(alumnoId, claseId) {
            alert('DEBUGGING TEST: The `mostrar` function was called successfully! The module is loading. Please check the console to confirm there are no "module not found" errors.');
        }
    };

    console.log("DEBUG: Sanity-check version of cpp.modals.fichaAlumno has been defined.");

})(jQuery);
