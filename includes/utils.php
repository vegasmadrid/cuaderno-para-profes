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
    function cpp_formatear_nota_display($nota, $decimales = null) {
        if ($nota === null || $nota === '') {
            return '';
        }
        $nota_float = floatval(str_replace(',', '.', $nota));
        if ($decimales !== null) {
            return number_format($nota_float, intval($decimales), '.', '');
        }
        if (floor($nota_float) == $nota_float) {
            return number_format($nota_float, 0, '.', '');
        } else {
            return number_format($nota_float, 2, '.', '');
        }
    }
}

if (!function_exists('cpp_get_avatar_url')) {
    function cpp_get_avatar_url($alumno) {
        if (!empty($alumno['foto'])) {
            return esc_url($alumno['foto']);
        } else {
            // Usa el ID del alumno para que el avatar sea siempre el mismo para ese alumno
            $seed = !empty($alumno['id']) ? $alumno['id'] : sanitize_title($alumno['nombre'] . ' ' . $alumno['apellidos']);
            return 'https://api.dicebear.com/8.x/adventurer/svg?seed=' . $seed;
        }
    }
}