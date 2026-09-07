// assets/js/cpp-utils.js
// No redeclarar 'cpp'. Asumimos que 'const cpp' ya existe desde cpp-core.js
// y que cpp-core.js se carga primero gracias a las dependencias en PHP.

cpp.utils = {
    motivationalPhrases: [
        "Preparando tu varita de enseñar... ✨",
        "¡Organizando la magia del aprendizaje! 🧙‍♂️",
        "Ajustando los pupitres virtuales... 🚀",
        "Tu paciencia es legendaria. ¡Casi estamos! 🧘‍♀️",
        "La mente es un fuego por encender, no un vaso por llenar. - Plutarco 🔥",
        "El arte supremo del maestro es despertar la curiosidad. - A. Einstein 🔭",
        "Dime y lo olvido, enséñame y lo recuerdo, involúcrame y lo aprendo. - B. Franklin 🧠",
        "La educación es el arma más poderosa para cambiar el mundo. - N. Mandela 🌍",
        "Un maestro es una brújula que activa los imanes de la curiosidad. - S. Kierkegaard 🧭"
    ],
    phraseInterval: null,

    init: function() {
        console.log("CPP Utils Module Initializing...");
        this.initializeColorSwatches();
    },

    initializeColorSwatches: function() {
        // console.log("Initializing color swatches from cpp.utils");
        jQuery(document).on('click', '.cpp-color-swatches-container .cpp-color-swatch', function() {
            const $ = jQuery; // Asegurar que $ es jQuery aquí
            const $swatch = $(this);
            const color = $swatch.data('color');
            const $container = $swatch.closest('.cpp-color-swatches-container');
            let $hiddenInput;

            if ($container.hasClass('cpp-category-color-swatches')) {
                $hiddenInput = $container.closest('.cpp-form-categoria-container').find('#color_nueva_categoria_hidden_modal');
                if (!$hiddenInput.length) {
                     $hiddenInput = $container.closest('.cpp-form-group').find('#color_nueva_categoria_hidden_modal');
                }
                if (!$hiddenInput.length) { 
                    $hiddenInput = $('#color_nueva_categoria_hidden_modal');
                }
            } else { 
                $hiddenInput = $container.siblings('input[type="hidden"]');
                if (!$hiddenInput || !$hiddenInput.length) {
                    $hiddenInput = $container.closest('.cpp-form-group').find('input[type="hidden"]');
                }
            }

            if ($hiddenInput && $hiddenInput.length) {
                $hiddenInput.val(color);
            }
            
            $container.find('.cpp-color-swatch').removeClass('selected');
            $swatch.addClass('selected');
        });
    },

    getContrastingTextColor: function(hexcolor) {
        if (!hexcolor) return '#000000';
        hexcolor = hexcolor.replace('#', '');
        if (hexcolor.length === 3) {
            hexcolor = hexcolor.split('').map(char => char + char).join('');
        }
        const r = parseInt(hexcolor.substr(0, 2), 16);
        const g = parseInt(hexcolor.substr(2, 2), 16);
        const b = parseInt(hexcolor.substr(4, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    },

    updateTopBar: function(claseData) {
        const $ = jQuery;
        const $topBar = $('.cpp-fixed-top-bar');
        const $classNameSpan = $('#cpp-cuaderno-nombre-clase-activa-a1');

        if (!$topBar.length) return;

        const nombre = claseData.nombre || 'Selecciona una clase';
        const color = claseData.color || '#6c757d'; // Un gris por defecto

        const textColor = this.getContrastingTextColor(color);

        $topBar.css({
            'background-color': color,
            'color': textColor
        });

        $classNameSpan.text(nombre).attr('title', 'Haz clic para cambiar el nombre');
    },

    // --- Spinner y Notificaciones Toast ---
    showSpinner: function() {
        jQuery('body').append('<div id="cpp-spinner-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 9999; display: flex; justify-content: center; align-items: center;"><div class="spinner is-active" style="width: 50px; height: 50px;"></div></div>');
    },

    hideSpinner: function() {
        jQuery('#cpp-spinner-overlay').remove();
    },

    // Loader for main content area
    showLoader: function() {
        const $loader = jQuery('#cpp-main-loader');
        const $phrase = jQuery('#cpp-loader-phrase');

        if ($loader.length === 0) {
            // No need to create it here as it's in the shortcode now
            return;
        }

        // Clear any existing interval
        if (this.phraseInterval) {
            clearInterval(this.phraseInterval);
        }

        // Set an initial phrase immediately
        const initialPhrase = this.motivationalPhrases[Math.floor(Math.random() * this.motivationalPhrases.length)];
        $phrase.text(initialPhrase);

        // Start rotating phrases
        this.phraseInterval = setInterval(() => {
            const randomPhrase = this.motivationalPhrases[Math.floor(Math.random() * this.motivationalPhrases.length)];
            $phrase.text(randomPhrase);
        }, 2000);

        $loader.show();
    },

    hideLoader: function() {
        if (this.phraseInterval) {
            clearInterval(this.phraseInterval);
            this.phraseInterval = null;
        }
        jQuery('#cpp-main-loader').hide();
    },

    showToast: function(message, type = 'success') {
        const $toast = jQuery('<div id="cpp-toast-notification"></div>');
        $toast.text(message);
        $toast.addClass(type === 'success' ? 'cpp-toast-success' : 'cpp-toast-error');
        jQuery('body').append($toast);
        setTimeout(() => {
            $toast.fadeOut(500, function() {
                $(this).remove();
            });
        }, 3000);
    }
};

// La inicialización de este módulo (cpp.utils.init()) será llamada desde cpp.core.js