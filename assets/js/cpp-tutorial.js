// assets/js/cpp-tutorial.js

(function($) {
    'use strict';

    if (typeof cpp === 'undefined') {
        console.error("Error: El objeto 'cpp' (de cpp-core.js) no está definido. El módulo cpp-tutorial.js no puede inicializarse.");
        return;
    }

    cpp.tutorial = {
        isActive: false,
        currentStep: 0,
        steps: [
            { // 0
                target: '#cpp-btn-crear-primera-clase',
                content: '¡Bienvenido/a! Para empezar, pulsa aquí para crear tu primera clase.',
                placement: 'bottom',
                requiresInteraction: true
            },
            { // 1
                target: '#cpp-modal-clase #nombre_clase_modal',
                content: 'Introduce un nombre para tu clase. Por ejemplo, "Mates 1ºA" o "Historia".',
                placement: 'top'
            },
            { // 2
                target: '#cpp-modal-clase #cpp-submit-clase-btn-modal',
                content: 'Una vez que hayas puesto el nombre, haz clic aquí para guardar la clase. ¡Ya casi estamos!',
                placement: 'top',
                requiresInteraction: true
            },
            { // 3: Después de recargar la página
                target: '.cpp-sidebar-clase-alumnos-btn',
                content: '¡Genial! Tu clase está creada. Ahora, vamos a añadir a tu primer alumno usando este botón.',
                placement: 'right',
                requiresInteraction: true
            },
            { // 4: Dentro del modal de alumnos
                target: '#cpp-nuevo-alumno-btn',
                content: 'Estupendo. Ahora, haz clic aquí para abrir el formulario y añadir un nuevo alumno.',
                placement: 'top',
                requiresInteraction: true
            },
            { // 5: Formulario de alumno visible
                target: '#cpp-form-nuevo-alumno [name="nombre_alumno"]',
                content: 'Introduce el nombre y apellidos de tu alumno.',
                placement: 'top'
            },
            { // 6
                target: '#cpp-form-nuevo-alumno #cpp-submit-alumno-btn',
                content: 'Ahora, guarda el alumno. La lista se actualizará automáticamente.',
                placement: 'top',
                requiresInteraction: true
            },
            { // 7: Lista de alumnos actualizada
                target: '#cpp-modal-alumnos .cpp-modal-close',
                content: '¡Alumno añadido! Cierra esta ventana para volver al cuaderno.',
                placement: 'bottom',
                requiresInteraction: true
            },
            { // 8: De vuelta en el cuaderno
                target: '#cpp-a1-add-activity-btn',
                content: 'Es hora de crear la primera actividad o examen. Haz clic aquí.',
                placement: 'bottom',
                requiresInteraction: true
            },
            { // 9: En el modal de actividad
                target: '#cpp-modal-actividad-evaluable-cuaderno #nombre_actividad_cuaderno_input',
                content: "Dale un nombre a tu actividad, como 'Examen Tema 1' o 'Deberes'.",
                placement: 'top'
            },
            { // 10
                target: '#cpp-modal-actividad-evaluable-cuaderno #cpp-submit-actividad-btn-cuaderno-form',
                content: 'Guarda la actividad para añadirla al cuaderno.',
                placement: 'top',
                requiresInteraction: true
            },
            { // 11: De vuelta en el cuaderno, con la actividad creada
                target: 'td.cpp-celda-calificacion:first .cpp-calificacion-input',
                content: '¡Ya lo tienes! Ahora solo tienes que hacer clic aquí para introducir una nota. El cuaderno guardará los cambios automáticamente.',
                placement: 'top'
            },
            { // 12: Final
                target: '#cpp-cuaderno-header',
                content: '¡Enhorabuena! Ya dominas lo básico. Explora los botones de la cabecera para descubrir más funciones. ¡Disfruta del plugin!',
                placement: 'bottom'
            }
        ],

        init: function() {
            this.bindEvents();
            const stepFromStorage = localStorage.getItem('cpp_tutorial_step');
            if (stepFromStorage) {
                setTimeout(() => {
                    this.resumeAt(parseInt(stepFromStorage, 10));
                }, 500);
            }
        },

        start: function() {
            if (this.isActive) return;
            this.isActive = true;
            this.currentStep = 0;
            localStorage.setItem('cpp_tutorial_step', '0');
            this.showStep(this.currentStep);
        },

        resumeAt: function(step) {
            if (this.isActive || !this.steps[step]) return;
            this.isActive = true;
            this.currentStep = step;
            this.showStep(this.currentStep);
        },

        nextStep: function() {
            if (this.currentStep + 1 < this.steps.length) {
                this.currentStep++;
                localStorage.setItem('cpp_tutorial_step', this.currentStep);
                // Añadimos un pequeño delay para dar tiempo a la UI a reaccionar (ej. modales apareciendo)
                setTimeout(() => {
                    this.showStep(this.currentStep);
                }, 150);
            } else {
                this.end();
            }
        },

        end: function() {
            this.isActive = false;
            this.currentStep = 0;
            localStorage.removeItem('cpp_tutorial_step');
            $('.cpp-tutorial-highlight-overlay').remove();
            $('.cpp-tutorial-popover').remove();
        },

        showStep: function(stepIndex) {
            $('.cpp-tutorial-highlight-overlay').remove();
            $('.cpp-tutorial-popover').remove();

            if (!this.isActive || !this.steps[stepIndex]) {
                this.end();
                return;
            }

            const step = this.steps[stepIndex];
            const $target = $(step.target);

            if (!$target.length || !$target.is(':visible')) {
                console.warn(`Tutorial: El elemento target '${step.target}' para el paso ${stepIndex} no está visible o no existe. Finalizando tutorial.`);
                this.end();
                return;
            }

            $('body').append('<div class="cpp-tutorial-popover"></div>');

            const $popover = $('.cpp-tutorial-popover');
            let popoverContent = `<div class="cpp-tutorial-content">${step.content}</div>`;
            popoverContent += `<div class="cpp-tutorial-nav">`;
            if (step.requiresInteraction) {
                 popoverContent += `<button type="button" class="cpp-tutorial-end-btn">Saltar Tour</button>`;
            } else {
                 if (stepIndex === this.steps.length - 1) {
                    popoverContent += `<button type="button" class="cpp-tutorial-end-btn">Finalizar</button>`;
                 } else {
                    popoverContent += `<button type="button" class="cpp-tutorial-end-btn">Terminar</button>`;
                    popoverContent += `<button type="button" class="cpp-tutorial-next-btn">Siguiente &rarr;</button>`;
                 }
            }
            popoverContent += `</div>`;
            $popover.html(popoverContent).attr('data-placement', step.placement);

            $('body').append('<div class="cpp-tutorial-highlight-overlay"></div>');
            const $highlight = $('.cpp-tutorial-highlight-overlay');
            const targetOffset = $target.offset();
            const targetWidth = $target.outerWidth();
            const targetHeight = $target.outerHeight();

            $highlight.css({
                position: 'fixed',
                top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 10000,
                boxShadow: `0 0 0 9999px rgba(0,0,0,0.5)`,
                'clip-path': `polygon(
                    0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                    ${targetOffset.left - window.scrollX}px ${targetOffset.top - window.scrollY}px,
                    ${targetOffset.left - window.scrollX + targetWidth}px ${targetOffset.top - window.scrollY}px,
                    ${targetOffset.left - window.scrollX + targetWidth}px ${targetOffset.top - window.scrollY + targetHeight}px,
                    ${targetOffset.left - window.scrollX}px ${targetOffset.top - window.scrollY + targetHeight}px,
                    ${targetOffset.left - window.scrollX}px ${targetOffset.top - window.scrollY}px
                )`,
                pointerEvents: 'none'
            });

            $popover.css({pointerEvents: 'auto'});

            const popoverHeight = $popover.outerHeight();
            const popoverWidth = $popover.outerWidth();
            let popoverTop, popoverLeft;

            switch (step.placement) {
                case 'top':
                    popoverTop = targetOffset.top - popoverHeight - 15;
                    popoverLeft = targetOffset.left + (targetWidth / 2) - (popoverWidth / 2);
                    $popover.addClass('arrow-bottom');
                    break;
                case 'left':
                    popoverTop = targetOffset.top + (targetHeight / 2) - (popoverHeight / 2);
                    popoverLeft = targetOffset.left - popoverWidth - 15;
                    $popover.addClass('arrow-right');
                    break;
                case 'right':
                    popoverTop = targetOffset.top + (targetHeight / 2) - (popoverHeight / 2);
                    popoverLeft = targetOffset.left + targetWidth + 15;
                    $popover.addClass('arrow-left');
                    break;
                default:
                    popoverTop = targetOffset.top + targetHeight + 15;
                    popoverLeft = targetOffset.left + (targetWidth / 2) - (popoverWidth / 2);
                    $popover.addClass('arrow-top');
            }

            $popover.css({ position: 'absolute', top: popoverTop, left: popoverLeft }).fadeIn();
        },

        bindEvents: function() {
            $('body').on('click', '.cpp-tutorial-next-btn', (e) => { e.preventDefault(); this.nextStep(); });
            $('body').on('click', '.cpp-tutorial-end-btn', (e) => { e.preventDefault(); this.end(); });
        }
    };

})(jQuery);
