<?php
// /includes/utils.php

defined('ABSPATH') or die('Acceso no permitido');

if (!function_exists('cpp_get_contrasting_text_color')) {
    function cpp_get_contrasting_text_color($hex_color) {
        $hex_color = ltrim($hex_color, '#');
        if (strlen($hex_color) == 3) {
            $hex_color = $hex_color[0].$hex_color[0].$hex_color[1].$hex_color[1].$hex_color[2].$hex_color[2];
        }
        if (strlen($hex_color) != 6) {
            return '#000000';
        }
        $r = hexdec(substr($hex_color,0,2));
        $g = hexdec(substr($hex_color,2,2));
        $b = hexdec(substr($hex_color,4,2));
        return ((0.299 * $r + 0.587 * $g + 0.114 * $b) / 255) > 0.5 ? '#000000' : '#FFFFFF';
    }
}

if (!function_exists('cpp_hex_to_rgba')) {
    function cpp_hex_to_rgba($hex, $alpha = 1) {
        $hex = ltrim($hex, '#');
        if (strlen($hex) == 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }
        if (strlen($hex) != 6) {
            return 'rgba(255,255,255,0)';
        }
        $r = hexdec(substr($hex, 0, 2));
        $g = hexdec(substr($hex, 2, 2));
        $b = hexdec(substr($hex, 4, 2));
        $alpha = max(0, min(1, floatval($alpha)));
        return "rgba({$r},{$g},{$b},{$alpha})";
    }
}

if (!function_exists('cpp_lighten_hex_color')) {
    function cpp_lighten_hex_color($hex, $percent) {
        $hex = ltrim($hex, '#');
        if (strlen($hex) == 3) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        }
        $rgb = [hexdec(substr($hex,0,2)), hexdec(substr($hex,2,2)), hexdec(substr($hex,4,2))];
        for ($i=0; $i<3; $i++) {
            if ($percent > 0) {
                $rgb[$i] = round($rgb[$i] * (1 - $percent) + 255 * $percent);
            } else {
                $rgb[$i] = round($rgb[$i] * (1 + $percent));
            }
            $rgb[$i] = max(0,min(255,$rgb[$i]));
        }
        return '#'.str_pad(dechex($rgb[0]),2,'0',STR_PAD_LEFT).str_pad(dechex($rgb[1]),2,'0',STR_PAD_LEFT).str_pad(dechex($rgb[2]),2,'0',STR_PAD_LEFT);
    }
}

if (!function_exists('cpp_formatear_nota_display')) {
    function cpp_formatear_nota_display($nota, $decimales = null, $user_id = null, $scope_check = 'actividad') {
        if ($nota === null || $nota === '') {
            return '';
        }

        // Primero, verificar si la nota es un valor numérico (o convertible a numérico).
        $nota_limpia = str_replace(',', '.', $nota);
        if (!is_numeric($nota_limpia)) {
            // Si no es numérico, es un símbolo o texto, devolverlo tal cual.
            return $nota;
        }

        if (empty($user_id)) {
            $user_id = get_current_user_id();
        }

        $nota_float = floatval($nota_limpia);

        if ($decimales === null) {
            // Aplicar redondeo según la configuración del usuario y el scope de la nota
            $nota_redondeada = cpp_aplicar_redondeo_nota($nota_float, $user_id, $scope_check);

            $config = cpp_get_eval_config($user_id);
            $mode = isset($config['rounding_mode']) ? $config['rounding_mode'] : 'none';
            $scope = isset($config['rounding_scope']) ? $config['rounding_scope'] : 'both';

            // Comprobar si para este $scope_check el redondeo estuvo activo
            $redondeo_activo = true;
            if ($scope_check === 'actividad' || $scope_check === 'none') {
                $redondeo_activo = false;
            } else if ($scope === 'evaluacion' && $scope_check !== 'evaluacion') {
                $redondeo_activo = false;
            } else if ($scope === 'media' && $scope_check !== 'media') {
                $redondeo_activo = false;
            }

            if ($redondeo_activo) {
                if (in_array($mode, ['nearest', 'ceil', 'floor', 'threshold'])) {
                    $decimales = 0;
                } else if ($mode === 'one_decimal') {
                    $decimales = (floor($nota_redondeada) == $nota_redondeada) ? 0 : 1;
                } else {
                    $decimales = (floor($nota_redondeada) == $nota_redondeada) ? 0 : 2;
                }
            } else {
                $decimales = (floor($nota_redondeada) == $nota_redondeada) ? 0 : 2;
            }

            return number_format($nota_redondeada, intval($decimales), '.', '');
        }

        return number_format($nota_float, intval($decimales), '.', '');
    }
}

if (!function_exists('cpp_formatear_nota_display_html')) {
    function cpp_formatear_nota_display_html($nota, $user_id = null, $scope_check = 'evaluacion', $nota_exacta_raw = null) {
        $formatted_rounded = cpp_formatear_nota_display($nota, null, $user_id, $scope_check);

        if ($nota === null || $nota === '' || !is_numeric(str_replace(',', '.', $nota))) {
            return esc_html($formatted_rounded);
        }

        if (empty($user_id)) {
            $user_id = get_current_user_id();
        }

        $config = cpp_get_eval_config($user_id);
        $show_exact = isset($config['show_exact_grade']) && intval($config['show_exact_grade']) === 1;
        $mode = isset($config['rounding_mode']) ? $config['rounding_mode'] : 'none';
        $scope = isset($config['rounding_scope']) ? $config['rounding_scope'] : 'both';

        $redondeo_activo = true;
        if ($scope_check === 'actividad' || $scope_check === 'none') {
            $redondeo_activo = false;
        } else if ($scope === 'evaluacion' && $scope_check !== 'evaluacion') {
            $redondeo_activo = false;
        } else if ($scope === 'media' && $scope_check !== 'media') {
            $redondeo_activo = false;
        }

        if ($show_exact && $mode !== 'none' && $redondeo_activo && in_array($scope_check, ['evaluacion', 'media'])) {
            $exact_val = ($nota_exacta_raw !== null) ? floatval(str_replace(',', '.', $nota_exacta_raw)) : floatval(str_replace(',', '.', $nota));
            $exact_dec = (floor($exact_val) == $exact_val) ? 0 : 2;
            $exact_formatted = number_format($exact_val, $exact_dec, '.', '');

            if ($exact_formatted !== $formatted_rounded && $exact_formatted !== '') {
                return '<strong>' . esc_html($formatted_rounded) . '</strong> <small style="font-size: 11px; opacity: 0.8; font-weight: normal; margin-left: 2px;">(' . esc_html($exact_formatted) . ')</small>';
            }
        }

        return esc_html($formatted_rounded);
    }
}

if (!function_exists('cpp_get_eval_config')) {
    function cpp_get_eval_config($user_id = null) {
        if (empty($user_id)) {
            $user_id = get_current_user_id();
        }

        $defaults = [
            'rounding_mode' => 'none', // 'none', 'nearest', 'one_decimal', 'ceil', 'floor', 'threshold'
            'rounding_threshold' => 0.5,
            'rounding_scope' => 'both', // 'both', 'evaluacion', 'media'
            'empty_grades' => 'ignore', // 'ignore', 'zero'
            'default_calc_method' => 'ponderada', // 'ponderada', 'total'
            'highlight_grades' => 1, // 1 or 0
            'calculation_base' => 'exact', // 'exact', 'rounded'
            'grace_pass_enabled' => 0, // 0 or 1
            'grace_pass_threshold' => 4.50,
            'show_exact_grade' => 0 // 0 or 1
        ];

        if (empty($user_id)) {
            return $defaults;
        }

        $saved = get_user_meta($user_id, 'cpp_eval_config', true);
        if (!is_array($saved) || empty($saved)) {
            global $wpdb;
            $tabla_config = $wpdb->prefix . 'cpp_programador_config';
            $val = $wpdb->get_var($wpdb->prepare("SELECT valor FROM $tabla_config WHERE user_id = %d AND clave = 'eval_config'", $user_id));
            if ($val) {
                $saved = json_decode($val, true);
            }
        }

        if (is_array($saved)) {
            return array_merge($defaults, $saved);
        }

        return $defaults;
    }
}

if (!function_exists('cpp_aplicar_redondeo_nota')) {
    function cpp_aplicar_redondeo_nota($nota, $user_id = null, $scope_check = 'evaluacion') {
        if ($nota === null || $nota === '') {
            return $nota;
        }

        $nota_num = floatval(str_replace(',', '.', $nota));
        if (empty($user_id)) {
            $user_id = get_current_user_id();
        }

        // Las notas de actividades individuales NUNCA se redondean por configuración de evaluación
        if ($scope_check === 'actividad' || $scope_check === 'none') {
            return round($nota_num, 2);
        }

        $config = cpp_get_eval_config($user_id);

        $scope = isset($config['rounding_scope']) ? $config['rounding_scope'] : 'both';
        // Verificar si el alcance configurado aplica a este tipo de nota
        if ($scope === 'evaluacion' && $scope_check !== 'evaluacion') {
            return round($nota_num, 2);
        }
        if ($scope === 'media' && $scope_check !== 'media') {
            return round($nota_num, 2);
        }

        $mode = isset($config['rounding_mode']) ? $config['rounding_mode'] : 'none';
        $threshold = isset($config['rounding_threshold']) ? floatval($config['rounding_threshold']) : 0.5;

        switch ($mode) {
            case 'nearest':
                return floatval(round($nota_num));
            case 'one_decimal':
                return floatval(round($nota_num, 1));
            case 'ceil':
                return floatval(ceil($nota_num));
            case 'floor':
                return floatval(floor($nota_num));
            case 'threshold':
                $entero = floor($nota_num);
                $decimal = round($nota_num - $entero, 4);
                if ($decimal >= $threshold) {
                    return floatval(ceil($nota_num));
                } else {
                    return floatval(floor($nota_num));
                }
            case 'none':
            default:
                return floatval(round($nota_num, 2));
        }
    }
}

if (!function_exists('cpp_get_symbol_legends')) {
    function cpp_get_symbol_legends($user_id) {
        $default_legends = [
            '👍' => 'Buen trabajo / Positivo',
            '✅' => 'Tarea entregada',
            '🏃‍♂️' => 'Falta injustificada',
            '⌛' => 'Retraso',
            '❤️' => 'Positivo / Interés',
            '📝' => 'Falta justificada',
            '❓' => 'Duda / Necesita revisión',
            '⭐' => 'Trabajo destacado',
            '❌' => 'Ausencia'
        ];

        $saved_legends = get_user_meta($user_id, 'cpp_symbol_legends', true);
        if (!is_array($saved_legends)) {
            $saved_legends = [];
        }

        return array_merge($default_legends, $saved_legends);
    }
}

if (!function_exists('cpp_get_avatar_url')) {
    function cpp_get_avatar_url($alumno) {
        if (!empty($alumno['foto'])) {
            return esc_url($alumno['foto']);
        } else {
            // Usa el ID del alumno para que el avatar sea siempre el mismo para ese alumno
            $seed = !empty($alumno['id']) ? $alumno['id'] : sanitize_title($alumno['nombre'] . ' ' . $alumno['apellidos']);
            return 'https://api.dicebear.com/8.x/avataaars/svg?seed=' . $seed;
        }
    }
}