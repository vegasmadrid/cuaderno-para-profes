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
                content: '¡Hola, profe! Te doy la bienvenida al <strong>Cuaderno de Profe</strong>. ¡Estoy aquí para ayudarte! Empecemos por crear tu primera clase haciendo clic aquí.',
                placement: 'bottom',
                trigger: { event: 'click', selector: '#cpp-btn-crear-primera-clase' }
            },
            { // 1: Name the class
                target: '#cpp-modal-clase #nombre_clase_modal',
                content: '¡Genial! Lo primero es ponerle un nombre con cariño a tu clase. Por ejemplo: "Mis Súper Estrellas de 4ºB". En cuanto empieces a escribir, seguimos.',
                placement: 'right',
                trigger: { event: 'input', selector: '#cpp-modal-clase #nombre_clase_modal' }
            },
            { // 2: Choose a color
                target: '#cpp-modal-clase .cpp-color-swatches-container',
                content: '¡Qué buen nombre! Ahora, si quieres, puedes elegir un color para identificar la clase. ¡Dale un toque personal y alegre!',
                placement: 'right',
                trigger: { event: 'click', selector: '#cpp-modal-clase .cpp-color-swatch' }
            },
            { // 3: Grading system (NEW)
                target: '#cpp-modal-clase #base_calificacion_modal',
                content: 'Un último detalle. Aquí puedes decidir la nota máxima (normalmente 10 o 100). No te preocupes, ¡puedes cambiarlo cuando quieras!',
                placement: 'right',
                trigger: { event: 'click', selector: '#cpp-modal-clase #cpp-submit-clase-btn-modal' } // Advances when saving
            },
            { // 4: Save the class
                target: '#cpp-modal-clase #cpp-submit-clase-btn-modal',
                content: '¡Todo listo! Pulsa aquí para guardar tu nueva clase y que la magia comience.',
                placement: 'top',
                trigger: { event: 'click', selector: '#cpp-modal-clase #cpp-submit-clase-btn-modal' }
            },
            { // 5: After reload, prompt to open sidebar (CHANGED)
                target: '#cpp-a1-menu-btn-toggle',
                content: '¡Tu clase está creada! Qué emoción. Ahora, vamos a gestionar a tus alumnos. Haz clic aquí para abrir el menú de clases.',
                placement: 'right',
                trigger: { event: 'click', selector: '#cpp-a1-menu-btn-toggle' }
            },
            { // 6: Click "Manage Students" (NEW)
                target: '.cpp-sidebar-clase-alumnos-btn',
                content: '¡Genial! Desde aquí gestionarás todo lo de esta clase. Pulsa en este botón para empezar a añadir a tus estudiantes.',
                placement: 'right',
                trigger: { event: 'click', selector: '.cpp-sidebar-clase-alumnos-btn' }
            },
            { // 7: Click "Add New Student" (WAS 5)
                target: '#cpp-nuevo-alumno-btn',
                content: '¡Perfecto! Este es tu centro de operaciones para los alumnos. Dale a este botón para añadir al primero.',
                placement: 'bottom',
                trigger: { event: 'click', selector: '#cpp-nuevo-alumno-btn' }
            },
            { // 7: Type student name (WAS 6)
                target: '#cpp-form-nuevo-alumno [name="nombre_alumno"]',
                content: 'Empecemos por el nombre de tu alumno/a. ¡Cada genio tiene un nombre!',
                placement: 'top',
                trigger: { event: 'input', selector: '#cpp-form-nuevo-alumno [name="nombre_alumno"]' }
            },
            { // 8: Type student last name (NEW)
                target: '#cpp-form-nuevo-alumno [name="apellidos_alumno"]',
                content: '¡Muy bien! Ahora sus apellidos. Este campo es importante, ¡no te lo saltes!',
                placement: 'top',
                trigger: { event: 'input', selector: '#cpp-form-nuevo-alumno [name="apellidos_alumno"]' }
            },
            { // 9: Save student (WAS 7)
                target: '#cpp-form-nuevo-alumno #cpp-submit-alumno-btn',
                content: '¡Fantástico! Pulsa aquí para guardar y añadirlo a tu lista.',
                placement: 'top',
                trigger: { event: 'click', selector: '#cpp-form-nuevo-alumno #cpp-submit-alumno-btn' }
            },
            { // 10: Close student modal (WAS 8)
                target: '#cpp-modal-alumnos .cpp-modal-close',
                content: '¡Ya tienes a tu primer/a valiente! Cierra esta ventanita para volver al cuaderno.',
                placement: 'bottom',
                trigger: { event: 'click', selector: '#cpp-modal-alumnos .cpp-modal-close' }
            },
            { // 11: Prompt to close sidebar (NEW)
                target: '#cpp-a1-menu-btn-toggle',
                content: '¡Genial! Ahora, para ver tu cuaderno completo, pulsa aquí de nuevo para cerrar este panel.',
                placement: 'right',
                trigger: { event: 'click', selector: '#cpp-a1-menu-btn-toggle' }
            },
            { // 12: Add activity (WAS 9)
                target: '#cpp-a1-add-activity-btn',
                content: '¡Ahora empieza lo bueno! Vamos a crear la primera actividad: un examen, un trabajo, lo que quieras. ¡Pulsa aquí!',
                placement: 'bottom',
                trigger: { event: 'click', selector: '#cpp-a1-add-activity-btn' }
            },
            { // 13: Type activity name (WAS 10)
                target: '#cpp-modal-actividad-evaluable-cuaderno #nombre_actividad_cuaderno_input',
                content: "Ponle un nombre chulo, como \"Examen de los Planetas\" o \"Proyecto de Héroes y Heroínas\".",
                placement: 'top',
                trigger: { event: 'input', selector: '#cpp-modal-actividad-evaluable-cuaderno #nombre_actividad_cuaderno_input' }
            },
            { // 14: Save activity (WAS 11)
                target: '#cpp-modal-actividad-evaluable-cuaderno #cpp-submit-actividad-btn-cuaderno-form',
                content: '¡Guárdala y prepárate para calificar!',
                placement: 'top',
                trigger: { event: 'click', selector: '#cpp-modal-actividad-evaluable-cuaderno #cpp-submit-actividad-btn-cuaderno-form' }
            },
            { // 15: Enter a grade (WAS 12)
                target: 'td.cpp-celda-calificacion:first .cpp-calificacion-input',
                content: '¡La hora de la verdad! Haz clic aquí y pon tu primera nota. Se guardará sola cuando hagas clic fuera. ¡Mágico!',
                placement: 'top',
                trigger: { event: 'focus', selector: 'td.cpp-celda-calificacion:first .cpp-calificacion-input' }
            },
            { // 16: Final summary (WAS 13)
                target: '#cpp-cuaderno-header',
                content: '¡Lo has conseguido! Ya dominas lo esencial del Cuaderno de Profe. Explora y verás cuántas cosas más puedes hacer. ¡Estoy aquí si me necesitas! ❤️',
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

                if (stepIndex === 0) {
                    console.log("--- DEBUG TUTORIAL STEP 0 ---");
                    console.log("Target selector:", step.target);
                    console.log("Target exists in DOM:", $target.length > 0);
                    if ($target.length > 0) {
                        console.log("Target is visible:", $target.is(':visible'));
                        console.log("Target display:", $target.css('display'));
                        console.log("Target visibility:", $target.css('visibility'));
                        console.log("Target opacity:", $target.css('opacity'));
                        console.log("Target width:", $target.width());
                        console.log("Target height:", $target.height());
                        console.log("Parent visibility:", $target.parent().is(':visible'));
                    }
                    console.log("--- END DEBUG ---");
                }

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
                default: // bottom
                    popoverTop = targetOffset.top + targetHeight + 15;
                    popoverLeft = targetOffset.left + (targetWidth / 2) - (popoverWidth / 2);
                    $popover.addClass('arrow-top');
            }

            const finalTop = popoverTop - $(window).scrollTop();
            const finalLeft = popoverLeft - $(window).scrollLeft();

            $popover.css({ position: 'fixed', top: finalTop, left: finalLeft, opacity: 1 });
        },

        bindEvents: function() {
            $('body').on('click', '.cpp-tutorial-end-btn', (e) => { e.preventDefault(); this.end(); });
        }
    };

})(jQuery);
