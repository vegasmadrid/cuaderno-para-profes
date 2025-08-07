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

    updateTopBarClassName: function(claseNombre) {
        const $ = jQuery; // Asegurar que $ es jQuery aquí
        const $span = $('#cpp-cuaderno-nombre-clase-activa-a1.cpp-top-bar-class-name');
        if ($span.length) {
            $span.text(claseNombre || 'Cuaderno'); 
        }
    }
};

// La inicialización de este módulo (cpp.utils.init()) será llamada desde cpp.core.js