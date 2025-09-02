// assets/js/cpp-utils.js
// No redeclarar 'cpp'. Asumimos que 'const cpp' ya existe desde cpp-core.js
// y que cpp-core.js se carga primero gracias a las dependencias en PHP.

cpp.utils = {
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
                $hiddenInput = $('#color_clase_hidden_modal');
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

        $classNameSpan.text(nombre);
    }
};

// La inicialización de este módulo (cpp.utils.init()) será llamada desde cpp.core.js