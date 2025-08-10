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
            { // 0: Start
                target: '#cpp-btn-crear-primera-clase',
                content: '¡Hola! Te damos la bienvenida al <strong>Cuaderno de profe</strong>. Pulsa aquí para crear tu primera clase.',
                placement: 'bottom',
                trigger: { event: 'click', selector: '#cpp-btn-crear-primera-clase' }
            },
            { // 1: Name the class
                target: '#cpp-modal-clase #nombre_clase_modal',
                content: 'Primero, ponle un nombre a tu clase. En cuanto empieces a escribir, seguimos.',
                placement: 'right',
                trigger: { event: 'input', selector: '#cpp-modal-clase #nombre_clase_modal' }
            },
            { // 2: Choose a color
                target: '#cpp-modal-clase .cpp-color-swatches-container',
                content: '¡Así me gusta! Ahora, si te apetece, elige un color para la clase. ¡Dale un toque personal!',
                placement: 'right',
                trigger: { event: 'click', selector: '#cpp-modal-clase .cpp-color-swatch' }
            },
            { // 3: Save the class
                target: '#cpp-modal-clase #cpp-submit-clase-btn-modal',
                content: '¡Perfecto! Dale a guardar para tener tu clase lista.',
                placement: 'top',
                trigger: { event: 'click', selector: '#cpp-modal-clase #cpp-submit-clase-btn-modal' }
            },
            { // 4: After reload, manage students
                target: '.cpp-sidebar-clase-alumnos-btn',
                content: '¡Ya tienes tu primera clase! Ahora, vamos a meter a tus alumnos en ella desde este botón.',
                placement: 'right',
                trigger: { event: 'click', selector: '.cpp-sidebar-clase-alumnos-btn' },
                onShow: function(callback) {
                    if (cpp.sidebar && !cpp.sidebar.isSidebarVisible) {
                        cpp.sidebar.toggle(callback); // Pasamos el callback a la función toggle
                    } else {
                        callback(); // Si ya está visible, ejecutamos el callback inmediatamente
                    }
                }
            },
            { // 5: Click "Add New Student"
                target: '#cpp-nuevo-alumno-btn',
                content: 'Venga, sin miedo. Dale aquí para añadir a tu primer estudiante.',
                placement: 'top',
                trigger: { event: 'click', selector: '#cpp-nuevo-alumno-btn' }
            },
            { // 6: Type student name
                target: '#cpp-form-nuevo-alumno [name="nombre_alumno"]',
                content: 'Escribe el nombre de tu alumno/a y verás qué pasa.',
                placement: 'top',
                trigger: { event: 'input', selector: '#cpp-form-nuevo-alumno [name="nombre_alumno"]' }
            },
            { // 7: Save student
                target: '#cpp-form-nuevo-alumno #cpp-submit-alumno-btn',
                content: '¡Guárdalo! Así de fácil.',
                placement: 'top',
                trigger: { event: 'click', selector: '#cpp-form-nuevo-alumno #cpp-submit-alumno-btn' }
            },
            { // 8: Close student modal
                target: '#cpp-modal-alumnos .cpp-modal-close',
                content: '¡Dentro! Ya tienes a tu primer alumno. Cierra esta ventana y volvamos al cuaderno.',
                placement: 'bottom',
                trigger: { event: 'click', selector: '#cpp-modal-alumnos .cpp-modal-close' }
            },
            { // 9: Add activity
                target: '#cpp-a1-add-activity-btn',
                content: 'Ahora lo importante: ¡las notas! Pulsa aquí para crear tu primera actividad (un examen, deberes, etc.).',
                placement: 'bottom',
                trigger: { event: 'click', selector: '#cpp-a1-add-activity-btn' }
            },
            { // 10: Type activity name
                target: '#cpp-modal-actividad-evaluable-cuaderno #nombre_actividad_cuaderno_input',
                content: "Ponle un nombre, como \"Examen Sorpresa\" o \"Trabajo de Historia\".",
                placement: 'top',
                trigger: { event: 'input', selector: '#cpp-modal-actividad-evaluable-cuaderno #nombre_actividad_cuaderno_input' }
            },
            { // 11: Save activity
                target: '#cpp-modal-actividad-evaluable-cuaderno #cpp-submit-actividad-btn-cuaderno-form',
                content: '¡Guárdala y a poner notas!',
                placement: 'top',
                trigger: { event: 'click', selector: '#cpp-modal-actividad-evaluable-cuaderno #cpp-submit-actividad-btn-cuaderno-form' }
            },
            { // 12: Enter a grade
                target: 'td.cpp-celda-calificacion:first .cpp-calificacion-input',
                content: '¡La hora de la verdad! Haz clic aquí y pon tu primera nota. Se guarda sola al quitar el ratón de la celda.',
                placement: 'top',
                trigger: { event: 'focus', selector: 'td.cpp-celda-calificacion:first .cpp-calificacion-input' }
            },
            { // 13: Final summary
                target: '#cpp-cuaderno-header',
                content: '¡Esto es todo! Ya sabes cómo funciona lo principal. Si te pierdes, recuerda que puedes saltar el tour con el botón. ¡A disfrutarlo!',
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
            console.log("Tutorial: Iniciando...");
            this.isActive = true;
            this.currentStep = 0;
            localStorage.setItem('cpp_tutorial_step', '0');
            this.showStep(this.currentStep);
        },

        resumeAt: function(step) {
            if (this.isActive || !this.steps[step]) return;
            console.log(`Tutorial: Reanudando en el paso ${step}`);
            this.isActive = true;
            this.currentStep = step;
            this.showStep(this.currentStep);
        },

        advance: function(expectedStep) {
            if (!this.isActive || this.currentStep !== expectedStep) {
                return;
            }
            console.log(`Tutorial: Avanzando desde el paso ${expectedStep}`);
            this.currentStep++;
            localStorage.setItem('cpp_tutorial_step', this.currentStep);

            if (this.currentStep >= this.steps.length) {
                this.end();
            } else {
                this.showStep(this.currentStep);
            }
        },

        end: function() {
            console.log("Tutorial: Finalizando.");
            this.isActive = false;
            this.currentStep = 0;
            localStorage.removeItem('cpp_tutorial_step');
            $('.cpp-tutorial-highlight-overlay').remove();
            $('.cpp-tutorial-popover').remove();
            $(document).off('.cppTutorial');
        },

        showStep: function(stepIndex) {
            $('.cpp-tutorial-highlight-overlay').remove();
            $('.cpp-tutorial-popover').remove();
            $(document).off('.cppTutorial');

            if (!this.isActive || !this.steps[stepIndex]) {
                this.end();
                return;
            }

            const step = this.steps[stepIndex];
            const self = this;

            // Función que renderiza el popover y el highlight
            const renderStep = function() {
                const $target = $(step.target);

                if (!$target.length || !$target.is(':visible')) {
                    console.warn(`Tutorial: Target '${step.target}' for step ${stepIndex} not found/visible. Retrying...`);
                    setTimeout(() => {
                        if (self.isActive && self.currentStep === stepIndex) {
                            self.showStep(stepIndex);
                        }
                    }, 300);
                    return;
                }

                $('body').append('<div class="cpp-tutorial-popover"></div>');
                const $popover = $('.cpp-tutorial-popover');
                let popoverContent = `<div class="cpp-tutorial-content">${step.content}</div>`;
                popoverContent += `<div class="cpp-tutorial-nav"><button type="button" class="cpp-tutorial-end-btn">Saltar Tour</button></div>`;
                $popover.html(popoverContent).attr('data-placement', step.placement);

                $('body').append('<div class="cpp-tutorial-highlight-overlay"></div>');
                const $highlight = $('.cpp-tutorial-highlight-overlay');
                const targetOffset = $target.offset();
                const targetWidth = $target.outerWidth();
                const targetHeight = $target.outerHeight();

                $highlight.css({
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    zIndex: 10000,
                    boxShadow: `0 0 0 9999px rgba(0,0,0,0.5)`,
                    'clip-path': `polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%, ${targetOffset.left - window.scrollX}px ${targetOffset.top - window.scrollY}px, ${targetOffset.left - window.scrollX + targetWidth}px ${targetOffset.top - window.scrollY}px, ${targetOffset.left - window.scrollX + targetWidth}px ${targetOffset.top - window.scrollY + targetHeight}px, ${targetOffset.left - window.scrollX}px ${targetOffset.top - window.scrollY + targetHeight}px, ${targetOffset.left - window.scrollX}px ${targetOffset.top - window.scrollY}px)`,
                    pointerEvents: 'none'
                });

                $popover.css({pointerEvents: 'auto'});
                self.positionPopover($popover, $target);

                if (step.trigger && step.trigger.selector && step.trigger.event) {
                    $(document).one(step.trigger.event + '.cppTutorial', step.trigger.selector, (e) => {
                        self.advance(stepIndex);
                    });
                }
            };

            // Ejecutar el callback onShow si existe, y pasarle renderStep como el callback
            if (typeof step.onShow === 'function') {
                step.onShow(renderStep);
            } else {
                renderStep(); // Si no hay onShow, renderizar directamente
            }
        },

        positionPopover: function($popover, $target) {
            // This function needs to be called after the popover is added to the DOM to measure its dimensions
            const targetOffset = $target.offset();
            const targetWidth = $target.outerWidth();
            const targetHeight = $target.outerHeight();
            const popoverHeight = $popover.outerHeight();
            const popoverWidth = $popover.outerWidth();
            let popoverTop, popoverLeft;
            const placement = $popover.attr('data-placement') || 'bottom';

            switch (placement) {
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
            $('body').on('click', '.cpp-tutorial-end-btn', (e) => { e.preventDefault(); this.end(); });
        }
    };

})(jQuery);
