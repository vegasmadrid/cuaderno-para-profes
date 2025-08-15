<?php
// /includes/ajax-handlers/ajax-cuaderno.php

defined('ABSPATH') or die('Acceso no permitido');

add_action('wp_ajax_cpp_cargar_cuaderno_clase', 'cpp_ajax_cargar_cuaderno_clase');
function cpp_ajax_cargar_cuaderno_clase() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    
    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    $evaluacion_id_solicitada = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : null;

    if (empty($clase_id)) { wp_send_json_error(['message' => 'ID de clase no proporcionado.']); return; }

    global $wpdb;
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $clase_db = $wpdb->get_row($wpdb->prepare("SELECT id, nombre, user_id, color, base_nota_final FROM {$wpdb->prefix}cpp_clases WHERE id = %d AND user_id = %d", $clase_id, $user_id));
    if (!$clase_db) { wp_send_json_error(['message' => 'Clase no encontrada o no tienes permiso.']); return; }

    $evaluaciones = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
    $evaluacion_activa_id = null;
    $metodo_calculo = 'total';

    if (count($evaluaciones) > 1) {
        $evaluaciones[] = [
            'id' => 'final',
            'nombre_evaluacion' => 'Evaluación Final (Media)',
            'calculo_nota' => 'total'
        ];
    }

    if (!empty($evaluaciones)) {
        if ($evaluacion_id_solicitada) {
            foreach ($evaluaciones as $eval) {
                if ($eval['id'] == $evaluacion_id_solicitada) {
                    $evaluacion_activa_id = $evaluacion_id_solicitada;
                    $metodo_calculo = $eval['calculo_nota'];
                    break;
                }
            }
        }
        if ($evaluacion_activa_id === null && isset($evaluaciones[0])) {
            $evaluacion_activa_id = $evaluaciones[0]['id'];
            $metodo_calculo = $evaluaciones[0]['calculo_nota'];
        }
    }

    $alumnos = cpp_obtener_alumnos_clase($clase_id);
    $actividades_raw = cpp_obtener_actividades_por_clase($clase_id, $user_id, $evaluacion_activa_id);
    $calificaciones_raw = cpp_obtener_calificaciones_cuaderno($clase_id, $user_id, $evaluacion_activa_id);
    $categorias_evaluacion = cpp_obtener_categorias_por_evaluacion($evaluacion_activa_id, $user_id);

    $map_categorias_porcentajes = [];
    if (is_array($categorias_evaluacion)) {
        foreach ($categorias_evaluacion as $cat) { $map_categorias_porcentajes[$cat['id']] = floatval($cat['porcentaje']); }
    }

    $base_nota_final_clase = isset($clase_db->base_nota_final) ? floatval($clase_db->base_nota_final) : 100.00;
    if ($base_nota_final_clase <= 0) $base_nota_final_clase = 100.00;

    $clase_color_actual = isset($clase_db->color) && !empty($clase_db->color) ? $clase_db->color : '#2962FF';
    $texto_color_barra_fija = cpp_get_contrasting_text_color($clase_color_actual);
    $soft_class_color = cpp_lighten_hex_color($clase_color_actual, 0.92);

    $notas_finales_alumnos = [];
    if (!empty($alumnos) && $evaluacion_activa_id) {
        foreach ($alumnos as $alumno) {
            $nota_0_100 = cpp_calcular_nota_final_alumno($alumno['id'], $clase_id, $user_id, $evaluacion_activa_id);
            $nota_reescalada = ($nota_0_100 / 100) * $base_nota_final_clase;
            $notas_finales_alumnos[$alumno['id']] = $nota_reescalada;
        }
    }

    ob_start();
    ?>
    <div class="cpp-fixed-top-bar" style="background-color: <?php echo esc_attr($clase_color_actual); ?>; color: <?php echo esc_attr($texto_color_barra_fija); ?>;">
        <button class="cpp-btn-icon cpp-top-bar-menu-btn" id="cpp-a1-menu-btn-toggle" title="Menú de clases"><span class="dashicons dashicons-menu-alt"></span></button>
        <span id="cpp-cuaderno-nombre-clase-activa-a1" class="cpp-top-bar-class-name"><?php echo esc_html($clase_db->nombre); ?></span>
        <div id="cpp-evaluacion-selector-container" class="cpp-top-bar-selector-container"></div>
    </div>
    <div class="cpp-cuaderno-tabla-wrapper">
        <table class="cpp-cuaderno-tabla">
            <thead>
                <tr>
                    <th class="cpp-cuaderno-th-alumno">
                        <div class="cpp-a1-controls-container">
                            <div class="cpp-a1-icons-row">
                                <button class="cpp-btn-icon" id="cpp-a1-take-attendance-btn" title="Pasar Lista"><span class="dashicons dashicons-list-view"></span></button>
                                <button class="cpp-btn-icon" id="cpp-a1-enter-direction-btn" title="Desplazar hacia abajo al pulsar Intro (clic para cambiar)"><span class="dashicons dashicons-arrow-down-alt2"></span></button>
                                <button class="cpp-btn-icon" id="cpp-a1-import-students-btn" title="Importar Alumnos desde Excel"><span class="dashicons dashicons-upload"></span></button>
                                <button class="cpp-btn-icon" id="cpp-a1-download-excel-btn" title="Descargar Excel"><span class="dashicons dashicons-download"></span></button>
                                <button class="cpp-btn-icon" id="cpp-a1-add-activity-btn" title="Añadir Actividad"><span class="dashicons dashicons-plus-alt"></span></button>
                            </div>
                        </div>
                    </th>
                    <?php if (empty($actividades_raw)): ?>
                        <th class="cpp-cuaderno-th-no-actividades">No hay actividades en esta evaluación.</th>
                    <?php else: ?>
                        <?php foreach ($actividades_raw as $actividad):
                            $header_bg_color = $soft_class_color;
                            if ($metodo_calculo === 'ponderada') {
                                if (!empty($actividad['categoria_color']) && !in_array($actividad['nombre_categoria'], ['General', 'Sin categoría'])) {
                                    $header_bg_color = $actividad['categoria_color'];
                                }
                            }
                            $contrasting_text_color = cpp_get_contrasting_text_color($header_bg_color);
                        ?>
                            <th class="cpp-cuaderno-th-actividad" style="background-color: <?php echo esc_attr($header_bg_color); ?>; color: <?php echo esc_attr($contrasting_text_color); ?>;">
                                <div class="cpp-editable-activity-name"
                                        data-actividad-id="<?php echo esc_attr($actividad['id']); ?>"
                                        data-nombre-actividad="<?php echo esc_attr($actividad['nombre_actividad']); ?>"
                                        data-categoria-id="<?php echo esc_attr($actividad['categoria_id']); ?>"
                                        data-nota-maxima="<?php echo esc_attr($actividad['nota_maxima']); ?>"
                                        data-fecha-actividad="<?php echo esc_attr($actividad['fecha_actividad']); ?>"
                                        data-descripcion-actividad="<?php echo esc_attr($actividad['descripcion_actividad']); ?>"
                                        title="Editar Actividad: <?php echo esc_attr($actividad['nombre_actividad']); ?>">
                                    <?php echo esc_html($actividad['nombre_actividad']); ?>
                                </div>
                                <div class="cpp-actividad-notamax" style="color: <?php echo esc_attr($contrasting_text_color); ?>;">(Sobre <?php echo cpp_formatear_nota_display($actividad['nota_maxima']); ?>)</div>
                                <?php if ($metodo_calculo === 'ponderada'): ?>
                                    <div class="cpp-actividad-categoria" style="color: <?php echo esc_attr($contrasting_text_color); ?>;"><?php echo esc_html($actividad['nombre_categoria'] ?: 'Sin categoría'); ?> (<?php echo esc_html(isset($map_categorias_porcentajes[$actividad['categoria_id']]) ? $map_categorias_porcentajes[$actividad['categoria_id']] . '%' : 'N/A'); ?>)</div>
                                <?php endif; ?>
                                <div class="cpp-actividad-fecha" style="color: <?php echo esc_attr($contrasting_text_color); ?>;"><?php if($actividad['fecha_actividad']) echo esc_html(date('d/m/Y', strtotime($actividad['fecha_actividad']))); ?></div>
                            </th>
                        <?php endforeach; ?>
                    <?php endif; ?>

                    <th class="cpp-cuaderno-th-final" data-base-nota-final="<?php echo esc_attr($base_nota_final_clase); ?>"><div class="cpp-th-final-content-wrapper">Nota Final<span class="cpp-nota-final-base-info">(sobre <?php echo cpp_formatear_nota_display($base_nota_final_clase, ($base_nota_final_clase == floor($base_nota_final_clase) ? 0 : 2) ); ?>)</span></div></th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($alumnos)): ?> <tr><td colspan="<?php echo count($actividades_raw) > 0 ? count($actividades_raw) + 2 : 3; ?>">No hay alumnos. Añade alumnos a esta clase para empezar.</td></tr>
                <?php else: foreach ($alumnos as $index => $alumno):
                        $row_style_attr = ($index % 2 != 0) ? 'style="background-color: ' . esc_attr(cpp_lighten_hex_color($clase_color_actual, 0.95)) . ';"' : '';
                        $decimales_nota_final = 2;
                        if ($base_nota_final_clase == floor($base_nota_final_clase)) { if (isset($notas_finales_alumnos[$alumno['id']]) && $notas_finales_alumnos[$alumno['id']] == floor($notas_finales_alumnos[$alumno['id']])) { $decimales_nota_final = 0; } }
                        $nota_final_display = isset($notas_finales_alumnos[$alumno['id']]) ? cpp_formatear_nota_display($notas_finales_alumnos[$alumno['id']], $decimales_nota_final) : '-';
                    ?>
                        <tr data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" <?php echo $row_style_attr; ?>><td class="cpp-cuaderno-td-alumno"><div class="cpp-alumno-avatar-cuaderno"><?php if(!empty($alumno['foto'])):?><img src="<?php echo esc_url($alumno['foto']);?>" alt="Foto <?php echo esc_attr($alumno['nombre']); ?>"><?php else:?><span><?php echo strtoupper(substr(esc_html($alumno['nombre']),0,1));?></span><?php endif;?></div><span class="cpp-alumno-nombre-cuaderno"><?php echo esc_html($alumno['apellidos'] . ', ' . $alumno['nombre']); ?></span></td><?php if (empty($actividades_raw)): ?><td class="cpp-cuaderno-td-no-actividades"></td>
                            <?php else: foreach ($actividades_raw as $actividad):
                                    $nota_alumno_actividad_raw = isset($calificaciones_raw[$alumno['id']][$actividad['id']]) ? $calificaciones_raw[$alumno['id']][$actividad['id']] : '';
                                    $nota_alumno_actividad_display = cpp_formatear_nota_display($nota_alumno_actividad_raw);
                                    ?><td class="cpp-cuaderno-td-nota" data-actividad-id="<?php echo esc_attr($actividad['id']); ?>"><input type="text" class="cpp-input-nota" value="<?php echo esc_attr($nota_alumno_actividad_display); ?>" data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" data-actividad-id="<?php echo esc_attr($actividad['id']); ?>" data-nota-maxima="<?php echo esc_attr($actividad['nota_maxima']); ?>" placeholder="-"><span class="cpp-nota-validation-message cpp-error-message" style="display:none;"></span></td><?php endforeach; ?>
                            <?php endif; ?><td class="cpp-cuaderno-td-final" id="cpp-nota-final-alumno-<?php echo esc_attr($alumno['id']); ?>"><?php echo esc_html($nota_final_display); ?></td></tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
    <?php
    $html_cuaderno = ob_get_clean();
    wp_send_json_success([
        'html_cuaderno' => $html_cuaderno, 'nombre_clase' => $clase_db->nombre, 'evaluaciones' => $evaluaciones,
        'evaluacion_activa_id' => $evaluacion_activa_id, 'calculo_nota' => $metodo_calculo,
        'base_nota_final' => $base_nota_final_clase
    ]);
}

add_action('wp_ajax_cpp_guardar_actividad_evaluable', 'cpp_ajax_guardar_actividad_evaluable');
function cpp_ajax_guardar_actividad_evaluable() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    
    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id_actividad']) ? intval($_POST['clase_id_actividad']) : 0;
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : 0;
    $nombre_actividad = isset($_POST['nombre_actividad']) ? sanitize_text_field(trim($_POST['nombre_actividad'])) : '';
    $nota_maxima = isset($_POST['nota_maxima_actividad']) ? floatval($_POST['nota_maxima_actividad']) : 10.00;
    $fecha_actividad = isset($_POST['fecha_actividad']) && !empty($_POST['fecha_actividad']) ? sanitize_text_field($_POST['fecha_actividad']) : null;
    $descripcion_actividad = isset($_POST['descripcion_actividad']) ? sanitize_textarea_field($_POST['descripcion_actividad']) : '';
    $actividad_id_editar = isset($_POST['actividad_id_editar']) ? intval($_POST['actividad_id_editar']) : 0;
    
    $categoria_id = isset($_POST['categoria_id_actividad']) && $_POST['categoria_id_actividad'] !== '' ? intval($_POST['categoria_id_actividad']) : 0;

    if (empty($clase_id) || empty($evaluacion_id) || empty($nombre_actividad) || $nota_maxima <= 0) {
        wp_send_json_error(['message' => 'Faltan datos esenciales (clase, evaluación, nombre o nota).']);
        return;
    }
    
    global $wpdb;

    if ($categoria_id === 0) {
        $tabla_categorias = $wpdb->prefix . 'cpp_categorias_evaluacion';
        $nombre_categoria_defecto = 'Sin categoría';
        
        $id_categoria_existente = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $tabla_categorias WHERE evaluacion_id = %d AND nombre_categoria = %s",
            $evaluacion_id, $nombre_categoria_defecto
        ));

        if ($id_categoria_existente) {
            $categoria_id = $id_categoria_existente;
        } else {
            $nuevo_id = cpp_guardar_categoria_evaluacion($evaluacion_id, $user_id, $nombre_categoria_defecto, 0, '#808080');
            if ($nuevo_id) {
                $categoria_id = $nuevo_id;
            } else {
                wp_send_json_error(['message' => 'Error al crear la categoría por defecto.']); return;
            }
        }
    }

    if(empty($categoria_id) && $categoria_id !== 0) {
        wp_send_json_error(['message' => 'El ID de la categoría no es válido.']);
        return;
    }
    
    $clase_valida = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}cpp_clases WHERE id = %d AND user_id = %d", $clase_id, $user_id));
    $categoria_valida = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}cpp_categorias_evaluacion WHERE id = %d AND evaluacion_id = %d", $categoria_id, $evaluacion_id));
    $evaluacion_valida = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d AND user_id = %d AND clase_id = %d", $evaluacion_id, $user_id, $clase_id));
    
    if ($clase_valida == 0 || $categoria_valida == 0 || $evaluacion_valida == 0) {
        wp_send_json_error(['message' => 'Clase, categoría o evaluación no válida, o no tienes permiso.']);
        return;
    }
    
    $datos_actividad = [ 'clase_id' => $clase_id, 'evaluacion_id' => $evaluacion_id, 'user_id' => $user_id, 'categoria_id' => $categoria_id, 'nombre_actividad' => $nombre_actividad, 'nota_maxima' => $nota_maxima, 'fecha_actividad' => $fecha_actividad, 'descripcion_actividad' => $descripcion_actividad ];
    if ($actividad_id_editar > 0) { $resultado_guardado = cpp_actualizar_actividad_evaluable($actividad_id_editar, $datos_actividad); $mensaje_exito = 'Actividad actualizada.'; } 
    else { $resultado_guardado = cpp_guardar_actividad_evaluable($datos_actividad); $mensaje_exito = 'Actividad guardada.'; }
    if ($resultado_guardado !== false) { wp_send_json_success(['message' => $mensaje_exito]); }
    else { wp_send_json_error(['message' => 'Error al procesar la actividad.']); }
}

add_action('wp_ajax_cpp_guardar_calificacion_alumno', 'cpp_ajax_guardar_calificacion_alumno');
function cpp_ajax_guardar_calificacion_alumno() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $alumno_id = isset($_POST['alumno_id']) ? intval($_POST['alumno_id']) : 0;
    $actividad_id = isset($_POST['actividad_id']) ? intval($_POST['actividad_id']) : 0;
    $nota_str = isset($_POST['nota']) ? trim($_POST['nota']) : null;
    $evaluacion_id = isset($_POST['evaluacion_id']) ? intval($_POST['evaluacion_id']) : null;
    if (empty($alumno_id) || empty($actividad_id) || empty($evaluacion_id)) { wp_send_json_error(['data' => ['message' => 'Faltan IDs de alumno, actividad o evaluación.']]); return; }
    $nota_a_guardar = null;
    if ($nota_str !== '' && $nota_str !== null) {
        $nota_str_limpia = str_replace(',', '.', $nota_str);
        if (!is_numeric($nota_str_limpia)) { wp_send_json_error(['data' => ['message' => 'La nota debe ser un valor numérico.']]); return; }
        $nota_a_guardar = floatval($nota_str_limpia);
    }
    $resultado_guardado = cpp_guardar_o_actualizar_calificacion($alumno_id, $actividad_id, $nota_a_guardar, $user_id);
    if ($resultado_guardado === false) { wp_send_json_error(['data' => ['message' => 'Error al guardar la calificación. Verifique que la nota no excede la máxima.']]); return; }
    global $wpdb;
    $clase_info = $wpdb->get_row($wpdb->prepare("SELECT act.clase_id, c.base_nota_final FROM {$wpdb->prefix}cpp_actividades_evaluables act JOIN {$wpdb->prefix}cpp_clases c ON act.clase_id = c.id WHERE act.id = %d AND act.user_id = %d", $actividad_id, $user_id ));
    if (!$clase_info) { wp_send_json_error(['data' => ['message' => 'Error al obtener datos de la clase para recalcular.']]); return; }
    $clase_id = $clase_info->clase_id;
    $base_nota_final_clase = floatval($clase_info->base_nota_final);
    if ($base_nota_final_clase <= 0) { $base_nota_final_clase = 100.00; }
    $nota_final_alumno_0_100 = cpp_calcular_nota_final_alumno($alumno_id, $clase_id, $user_id, $evaluacion_id);
    $nota_final_reescalada = ($nota_final_alumno_0_100 / 100) * $base_nota_final_clase;
    $decimales_nota_final = 2;
    if ($base_nota_final_clase == floor($base_nota_final_clase) && $nota_final_reescalada == floor($nota_final_reescalada)) { $decimales_nota_final = 0; }
    wp_send_json_success([ 'message' => 'Calificación guardada.', 'alumno_id' => $alumno_id, 'nota_final_alumno' => cpp_formatear_nota_display($nota_final_reescalada, $decimales_nota_final) ]);
}

add_action('wp_ajax_cpp_eliminar_actividad', 'cpp_ajax_eliminar_actividad');
function cpp_ajax_eliminar_actividad() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    $user_id = get_current_user_id();
    $actividad_id = isset($_POST['actividad_id']) ? intval($_POST['actividad_id']) : 0;
    if (empty($actividad_id)) { wp_send_json_error(['message' => 'ID de actividad no proporcionado.']); return; }
    $resultado = cpp_eliminar_actividad_y_calificaciones($actividad_id, $user_id);
    if ($resultado) { wp_send_json_success(['message' => 'Actividad eliminada correctamente.']); } 
    else { wp_send_json_error(['message' => 'Error al eliminar la actividad o no tienes permiso.']); }
}

add_action('wp_ajax_cpp_cargar_vista_final', 'cpp_ajax_cargar_vista_final');
function cpp_ajax_cargar_vista_final() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    global $wpdb;
    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    if (empty($clase_id)) { wp_send_json_error(['message' => 'ID de clase no proporcionado.']); return; }

    $clase_db = $wpdb->get_row($wpdb->prepare("SELECT id, nombre, user_id, color, base_nota_final FROM {$wpdb->prefix}cpp_clases WHERE id = %d AND user_id = %d", $clase_id, $user_id));
    if (!$clase_db) { wp_send_json_error(['message' => 'Clase no encontrada o no tienes permiso.']); return; }

    $alumnos = cpp_obtener_alumnos_clase($clase_id);
    $evaluaciones_reales = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
    $base_nota_final_clase = isset($clase_db->base_nota_final) ? floatval($clase_db->base_nota_final) : 100.00;
    $clase_color_actual = isset($clase_db->color) && !empty($clase_db->color) ? $clase_db->color : '#2962FF';
    $texto_color_barra_fija = cpp_get_contrasting_text_color($clase_color_actual);

    $notas_por_evaluacion = [];
    $notas_finales_promediadas = [];

    foreach ($alumnos as $alumno) {
        $notas_finales_promediadas[$alumno['id']] = cpp_calcular_nota_media_final_alumno($alumno['id'], $clase_id, $user_id);
        foreach ($evaluaciones_reales as $evaluacion) {
            $notas_por_evaluacion[$alumno['id']][$evaluacion['id']] = cpp_calcular_nota_final_alumno($alumno['id'], $clase_id, $user_id, $evaluacion['id']);
        }
    }

    ob_start();
    ?>
    <div class="cpp-fixed-top-bar" style="background-color: <?php echo esc_attr($clase_color_actual); ?>; color: <?php echo esc_attr($texto_color_barra_fija); ?>;">
        <button class="cpp-btn-icon cpp-top-bar-menu-btn" id="cpp-a1-menu-btn-toggle" title="Menú de clases"><span class="dashicons dashicons-menu-alt"></span></button>
        <span id="cpp-cuaderno-nombre-clase-activa-a1" class="cpp-top-bar-class-name"><?php echo esc_html($clase_db->nombre); ?></span>
        <div id="cpp-evaluacion-selector-container" class="cpp-top-bar-selector-container"></div>
    </div>
    <div class="cpp-cuaderno-tabla-wrapper">
        <table class="cpp-cuaderno-tabla">
            <thead>
                <tr>
                    <th class="cpp-cuaderno-th-alumno">Alumno</th>
                    <?php foreach ($evaluaciones_reales as $evaluacion): ?>
                        <th class="cpp-cuaderno-th-actividad"><?php echo esc_html($evaluacion['nombre_evaluacion']); ?></th>
                    <?php endforeach; ?>
                    <th class="cpp-cuaderno-th-final">Nota Final (Media)</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($alumnos)): ?>
                    <tr><td colspan="<?php echo count($evaluaciones_reales) + 2; ?>">No hay alumnos en esta clase.</td></tr>
                <?php else: foreach ($alumnos as $index => $alumno):
                        $row_style_attr = ($index % 2 != 0) ? 'style="background-color: ' . esc_attr(cpp_lighten_hex_color($clase_color_actual, 0.95)) . ';"' : '';
                    ?>
                    <tr data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" <?php echo $row_style_attr; ?>>
                        <td class="cpp-cuaderno-td-alumno">
                            <div class="cpp-alumno-avatar-cuaderno">
                                <?php if(!empty($alumno['foto'])):?><img src="<?php echo esc_url($alumno['foto']);?>" alt="Foto <?php echo esc_attr($alumno['nombre']); ?>"><?php else:?><span><?php echo strtoupper(substr(esc_html($alumno['nombre']),0,1));?></span><?php endif;?>
                            </div>
                            <span class="cpp-alumno-nombre-cuaderno"><?php echo esc_html($alumno['apellidos'] . ', ' . $alumno['nombre']); ?></span>
                        </td>
                        <?php foreach ($evaluaciones_reales as $evaluacion):
                            $nota_0_100 = $notas_por_evaluacion[$alumno['id']][$evaluacion['id']];
                            $nota_reescalada = ($nota_0_100 / 100) * $base_nota_final_clase;
                        ?>
                            <td class="cpp-cuaderno-td-nota"><?php echo cpp_formatear_nota_display($nota_reescalada, 2); ?></td>
                        <?php endforeach; ?>
                        <td class="cpp-cuaderno-td-final">
                            <?php
                                $nota_promediada_0_100 = $notas_finales_promediadas[$alumno['id']];
                                $nota_promediada_reescalada = ($nota_promediada_0_100 / 100) * $base_nota_final_clase;
                                echo cpp_formatear_nota_display($nota_promediada_reescalada, 2);
                            ?>
                        </td>
                    </tr>
                <?php endforeach; endif; ?>
            </tbody>
        </table>
    </div>
    <?php
    $html_cuaderno = ob_get_clean();

    $evaluaciones_con_final = $evaluaciones_reales;
    if (count($evaluaciones_reales) > 1) {
        $evaluaciones_con_final[] = ['id' => 'final', 'nombre_evaluacion' => 'Evaluación Final (Media)'];
    }

    wp_send_json_success([
        'html_cuaderno' => $html_cuaderno,
        'evaluaciones' => $evaluaciones_con_final,
        'evaluacion_activa_id' => 'final',
        'nombre_clase' => $clase_db->nombre,
    ]);
}