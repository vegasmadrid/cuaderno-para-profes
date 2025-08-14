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
                content: '¡Hola, profe! Te doy la bienvenida al <strong>Cuaderno de Profe</strong>. ¡Estoy aquí para ayudarte! Empecemos por crear tu primera clase.',
                placement: 'bottom',
                style: 'page',
                trigger: { event: 'click', selector: '#cpp-btn-crear-primera-clase' }
            },
            { // 1: Name the class
                target: '#cpp-modal-clase #nombre_clase_modal',
                content: '¡Genial! Lo primero es ponerle un nombre con cariño a tu clase. Por ejemplo: "Mis Súper Estrellas de 4ºB". En cuanto empieces a escribir, seguimos.',
                placement: 'right',
                style: 'modal',
                trigger: { event: 'input', selector: '#cpp-modal-clase #nombre_clase_modal' }
            },
            { // 2: Choose a color
                target: '#cpp-modal-clase .cpp-color-swatches-container',
                content: '¡Qué buen nombre! Ahora, si quieres, puedes elegir un color para identificar la clase. ¡Dale un toque personal y alegre!',
                placement: 'right',
                style: 'modal',
                trigger: { event: 'click', selector: '#cpp-modal-clase .cpp-color-swatch' }
            },
            { // 3: Grading system (NEW)
                target: '#cpp-modal-clase #base_nota_final_clase_modal',
                content: 'Un último detalle. Aquí puedes decidir la nota máxima (normalmente 10 o 100). No te preocupes, ¡puedes cambiarlo cuando quieras!',
                placement: 'right',
                style: 'modal',
                trigger: { event: 'click', selector: '#cpp-modal-clase #cpp-submit-clase-btn-modal' } // Advances when saving
            },
            { // 5: After reload, prompt to open sidebar (CHANGED)
                target: '#cpp-a1-menu-btn-toggle',
                content: '¡Tu clase está creada! Qué emoción. Ahora, vamos a gestionar a tus alumnos. Pulsa en las tres rayitas para abrir el menú de clases.',
                placement: 'right',
                style: 'page',
                trigger: { event: 'click', selector: '#cpp-a1-menu-btn-toggle' }
            },
            { // 6: Click "Manage Students" (NEW)
                target: '.cpp-sidebar-clase-alumnos-btn',
                content: 'Desde aquí gestionarás todo lo de esta clase. Pulsa sobre el icono de los muñecos para empezar a añadir a tus estudiantes.',
                placement: 'right',
                style: 'page',
                onShow: function(renderStep) {
                    // Wait for sidebar animation to finish
                    setTimeout(renderStep, 300);
                },
                trigger: { event: 'click', selector: '.cpp-sidebar-clase-alumnos-btn' }
            },
            { // 7: Click "Add New Student" (WAS 5)
                target: '#cpp-nuevo-alumno-btn',
                content: '¡Perfecto! Este es tu centro de operaciones para los alumnos. Dale a este botón para añadir al primero.',
                placement: 'bottom',
                style: 'modal',
                trigger: { event: 'click', selector: '#cpp-nuevo-alumno-btn' }
            },
            { // 7: Type student name (WAS 6)
                target: '#cpp-form-nuevo-alumno [name="nombre_alumno"]',
                content: 'Empecemos por el nombre de tu alumno/a. ¡Cada genio tiene un nombre!',
                placement: 'top',
                style: 'modal',
                trigger: { event: 'input', selector: '#cpp-form-nuevo-alumno [name="nombre_alumno"]' }
            },
            { // 8: Type student last name (NEW)
                target: '#cpp-form-nuevo-alumno [name="apellidos_alumno"]',
                content: '¡Muy bien! Ahora sus apellidos. Este campo es importante, ¡no te lo saltes!',
                placement: 'bottom',
                style: 'modal',
                trigger: { event: 'input', selector: '#cpp-form-nuevo-alumno [name="apellidos_alumno"]' }
            },
            { // 9: Save student (WAS 7)
                target: '#cpp-form-nuevo-alumno #cpp-submit-alumno-btn',
                content: '¡Fantástico! Pulsa aquí para guardar y añadirlo a tu lista.',
                placement: 'top',
                style: 'modal',
                trigger: { event: 'click', selector: '#cpp-form-nuevo-alumno #cpp-submit-alumno-btn' }
            },
            { // 10: Close student modal (WAS 8)
                target: '#cpp-modal-alumnos .cpp-modal-close',
                content: '¡Ya tienes a tu primer/a valiente! Cierra esta ventanita para volver al cuaderno.',
                placement: 'bottom',
                style: 'modal',
                trigger: { event: 'click', selector: '#cpp-modal-alumnos .cpp-modal-close' }
            },
            { // 11: Prompt to close sidebar (NEW)
                target: '#cpp-a1-menu-btn-toggle',
                content: '¡Genial! Ahora, para ver tu cuaderno completo, pulsa de nuevo sobre las tres rayitas para cerrar este panel.',
                placement: 'right',
                style: 'page',
                trigger: { event: 'click', selector: '#cpp-a1-menu-btn-toggle' }
            },
            { // 12: Add activity (WAS 9)
                target: '#cpp-a1-add-activity-btn',
                content: '¡Ahora empieza lo bueno! Vamos a crear la primera actividad: un examen, un trabajo, lo que quieras. Pulsa en el botón \'+\' para crearla.',
                placement: 'bottom',
                style: 'page',
                trigger: { event: 'click', selector: '#cpp-a1-add-activity-btn' }
            },
            { // 13: Type activity name (WAS 10)
                target: '#cpp-modal-actividad-evaluable-cuaderno #nombre_actividad_cuaderno_input',
                content: "Ponle un nombre chulo, como \"Examen de los Planetas\" o \"Proyecto de Héroes y Heroínas\".",
                placement: 'bottom',
                style: 'modal',
                trigger: { event: 'input', selector: '#cpp-modal-actividad-evaluable-cuaderno #nombre_actividad_cuaderno_input' }
            },
            { // 14: Save activity (WAS 11)
                target: '#cpp-modal-actividad-evaluable-cuaderno #cpp-submit-actividad-btn-cuaderno-form',
                content: '¡Guárdala y prepárate para calificar!',
                placement: 'top',
                style: 'modal',
                trigger: { event: 'click', selector: '#cpp-modal-actividad-evaluable-cuaderno #cpp-submit-actividad-btn-cuaderno-form' }
            },
            { // 15: Enter a grade (WAS 12)
                target: 'td.cpp-celda-calificacion:first .cpp-calificacion-input',
                content: '¡La hora de la verdad! Pon tu primera nota en la casilla que se ilumina. Se guardará sola cuando hagas clic fuera. ¡Mágico!',
                placement: 'top',
                style: 'page',
                trigger: { event: 'focus', selector: 'td.cpp-celda-calificacion:first .cpp-calificacion-input' }
            },
            { // 16: Final summary (WAS 13)
                target: '#cpp-cuaderno-header',
                content: '¡Y con esto terminamos el repaso! 💪 Ahora ya sabes lo más básico para empezar a usar tu cuaderno. ¡Pero hay mucho más por descubrir! Así que, ánimo, explora sin miedo y, si me necesitas, ya sabes dónde encontrarme. ¡A disfrutarlo, profe! 😎',
                placement: 'bottom',
                style: 'page'
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
                $popover.html(popoverContent).attr('data-placement', step.placement || 'bottom');
                $popover.show();

                if (stepIndex !== 0) {
                    $('body').append('<div class="cpp-tutorial-highlight-overlay"></div>');
                    const $highlight = $('.cpp-tutorial-highlight-overlay');
                    const targetRect = $target[0].getBoundingClientRect();

                    // Base styles for the overlay
                    const baseHighlightStyle = {
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        zIndex: 10000, pointerEvents: 'none'
                    };

                    // Conditional styling based on step.style
                    if (step.style === 'page') {
                        // New style: circular highlight with pulse
                        const radius = Math.max(targetRect.width, targetRect.height) / 2 + 15; // Smaller padding for the hole
                        const centerX = targetRect.left + targetRect.width / 2;
                        const centerY = targetRect.top + targetRect.height / 2;

                        $highlight.css($.extend({}, baseHighlightStyle, {
                            background: `radial-gradient(circle at ${centerX}px ${centerY}px, transparent ${radius}px, rgba(0,0,0,0.5) ${radius}px)`
                        }));

                        // Add the pulsing element
                        $('body').append('<div class="cpp-tutorial-pulse-element"></div>');
                        $('.cpp-tutorial-pulse-element').css({
                            top: centerY - radius,
                            left: centerX - radius,
                            width: radius * 2,
                            height: radius * 2,
                        });
                    } else {
                        // Old/Modal style: rectangular highlight
                        $highlight.css($.extend({}, baseHighlightStyle, {
                            boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                            'clip-path': `polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%, ${targetRect.left}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.bottom}px, ${targetRect.left}px ${targetRect.bottom}px, ${targetRect.left}px ${targetRect.top}px)`
                        }));
                    }
                }

                $popover.css({pointerEvents: 'auto'});
                self.positionPopover($popover, $target, step.style);

                if (step.trigger && step.trigger.selector && step.trigger.event) {
                    // Use a more robust event delegation strategy.
                    // For modals, delegate from the modal content itself, as it's stable.
                    // For the page, delegate from the document.
                    const $context = (step.style === 'modal') ? $target.closest('.cpp-modal') : $(document);
                    $context.one(step.trigger.event + '.cppTutorial', step.trigger.selector, (e) => {
                        self.advance(stepIndex);
                    });
                }
            };

            if (typeof step.onShow === 'function') {
                step.onShow(renderStep);
            } else {
                renderStep();
            }
        },

        positionPopover: function($popover, $target, style) {
            if (style === 'page') {
                // New style: centered popover
                const popoverWidth = $popover.outerWidth();
                const left = (window.innerWidth / 2) - (popoverWidth / 2);
                $popover.css({
                    position: 'fixed',
                    top: 'auto',
                    bottom: '30px',
                    left: `${left}px`,
                    right: 'auto'
                }).addClass('fade-in');
            } else {
                // Old/Modal style: attached popover with boundary checks
                const targetRect = $target[0].getBoundingClientRect();
                const popoverHeight = $popover.outerHeight();
                const popoverWidth = $popover.outerWidth();
                const placement = $popover.attr('data-placement') || 'bottom';
                const margin = 15;
                let top, left;

                switch (placement) {
                    case 'top':
                        top = targetRect.top - popoverHeight - margin;
                        left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);
                        $popover.addClass('arrow-bottom');
                        break;
                    case 'left':
                        top = targetRect.top + (targetRect.height / 2) - (popoverHeight / 2);
                        left = targetRect.left - popoverWidth - margin;
                        $popover.addClass('arrow-right');
                        break;
                    case 'right':
                        top = targetRect.top + (targetRect.height / 2) - (popoverHeight / 2);
                        left = targetRect.left + targetRect.width + margin;
                        $popover.addClass('arrow-left');
                        break;
                    default: // bottom
                        top = targetRect.bottom + margin;
                        left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);
                        $popover.addClass('arrow-top');
                }

                const viewportMargin = 8;
                if (top < viewportMargin) top = viewportMargin;
                if (left < viewportMargin) left = viewportMargin;
                if (left + popoverWidth > window.innerWidth - viewportMargin) left = window.innerWidth - popoverWidth - viewportMargin;
                if (top + popoverHeight > window.innerHeight - viewportMargin) top = window.innerHeight - popoverHeight - viewportMargin;

                $popover.css({ position: 'fixed', top: top, left: left }).addClass('fade-in');
            }
        },

        bindEvents: function() {
            $('body').on('click', '.cpp-tutorial-end-btn', (e) => { e.preventDefault(); this.end(); });
        }
    };

})(jQuery);
