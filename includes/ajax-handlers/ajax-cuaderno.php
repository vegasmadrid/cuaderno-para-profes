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
    $sort_order = isset($_POST['sort_order']) && in_array($_POST['sort_order'], ['nombre', 'apellidos', 'nota_asc', 'nota_desc']) ? $_POST['sort_order'] : 'apellidos';

    if (empty($clase_id)) { wp_send_json_error(['message' => 'ID de clase no proporcionado.']); return; }

    global $wpdb;
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $clase_db = cpp_obtener_clase_completa_por_id($clase_id, $user_id);
    if (!$clase_db) { wp_send_json_error(['message' => 'Clase no encontrada o no tienes permiso.']); return; }

    $evaluaciones = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
    $evaluacion_activa_id = null;
    $metodo_calculo = 'total';

    if (count($evaluaciones) > 1) {
        // Añadir la opción de Evaluación Final si hay más de una evaluación real
        $evaluaciones[] = [ 'id' => 'final', 'nombre_evaluacion' => 'Evaluación Final (Media)', 'calculo_nota' => 'total' ];
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

    $alumnos = cpp_obtener_alumnos_clase($clase_id, in_array($sort_order, ['nombre', 'apellidos']) ? $sort_order : 'apellidos');
    $actividades_raw = cpp_obtener_actividades_por_clase($clase_id, $user_id, $evaluacion_activa_id);
    $calificaciones_raw = cpp_obtener_calificaciones_cuaderno($clase_id, $user_id, $evaluacion_activa_id);

    // FIX: Crear el mapa de categorías y porcentajes que faltaba
    $map_categorias_porcentajes = [];
    if ($metodo_calculo === 'ponderada') {
        $categorias_evaluacion = cpp_obtener_categorias_por_evaluacion($evaluacion_activa_id, $user_id);
        foreach ($categorias_evaluacion as $categoria) {
            $map_categorias_porcentajes[$categoria['id']] = $categoria['porcentaje'];
        }
    }

    $base_nota_final_clase = isset($clase_db['base_nota_final']) ? floatval($clase_db['base_nota_final']) : 100.00;

    $notas_finales_alumnos = [];
    if (!empty($alumnos)) {
        foreach ($alumnos as $index => $alumno) {
            $nota_0_100 = cpp_calcular_nota_final_alumno($alumno['id'], $clase_id, $user_id, $evaluacion_activa_id);
            $nota_reescalada = ($nota_0_100 / 100) * $base_nota_final_clase;
            $notas_finales_alumnos[$alumno['id']] = $nota_reescalada;
            $alumnos[$index]['nota_final_calculada'] = $nota_reescalada;
        }
    }

    if ($sort_order === 'nota_asc' || $sort_order === 'nota_desc') {
        usort($alumnos, function($a, $b) use ($sort_order) {
            $notaA = $a['nota_final_calculada'];
            $notaB = $b['nota_final_calculada'];
            if ($notaA == $notaB) return 0;
            if ($sort_order === 'nota_asc') {
                return ($notaA < $notaB) ? -1 : 1;
            } else {
                return ($notaA > $notaB) ? -1 : 1;
            }
        });
    }

    $clase_color_actual = isset($clase_db['color']) && !empty($clase_db['color']) ? $clase_db['color'] : '#2962FF';
    $texto_color_barra_fija = cpp_get_contrasting_text_color($clase_color_actual);
    $soft_class_color = cpp_lighten_hex_color($clase_color_actual, 0.92);

    ob_start();

    if (empty($alumnos)) {
        ?>
        <div class="cpp-no-alumnos-container">
            <div class="cpp-no-alumnos-emoji">🚀</div>
            <h3 class="cpp-no-alumnos-titulo">¡Añade tu primer tripulante!</h3>
            <p class="cpp-no-alumnos-texto">Esta clase todavía no tiene alumnos. ¡Es hora de llenar las sillas y empezar la aventura del conocimiento!</p>
            <div class="cpp-no-alumnos-actions">
                <button class="cpp-btn cpp-btn-primary" id="cpp-btn-agregar-alumnos-mano" data-clase-id="<?php echo esc_attr($clase_id); ?>" data-clase-nombre="<?php echo esc_attr($clase_db['nombre']); ?>">
                    <span class="dashicons dashicons-admin-users"></span> Ingresar alumnos a mano
                </button>
                <button class="cpp-btn cpp-btn-secondary" id="cpp-btn-importar-alumnos-excel">
                    <span class="dashicons dashicons-database-import"></span> Importar alumnos desde un archivo
                </button>
            </div>
        </div>
        <?php
    } else {
    ?>
    <div class="cpp-cuaderno-tabla-wrapper">
        <table class="cpp-cuaderno-tabla">
            <thead>
                <tr>
                    <th class="cpp-cuaderno-th-alumno">
                        <div class="cpp-a1-controls-container">
                            <div id="cpp-evaluacion-selector-container" class="cpp-a1-evaluacion-selector"></div>
                            <div class="cpp-a1-icons-row">
                                <button class="cpp-btn-icon" id="cpp-a1-sort-students-btn" title="Ordenar por Apellidos" data-sort="apellidos">
                                    <svg class="icon-sort-alpha" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 18l-4-4h3V4h2v10h3l-4 4zM4.75 5.5H10c.83 0 1.5-.67 1.5-1.5S10.83 2.5 10 2.5H4.75c-.83 0-1.5.67-1.5 1.5S3.92 5.5 4.75 5.5zM10.25 8.5H4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.75c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5zM10.25 14.5H4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.75c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-take-attendance-btn" title="Pasar Lista">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-enter-direction-btn" title="Desplazar hacia abajo al pulsar Intro">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-import-students-btn" title="Importar Alumnos desde Excel">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 13v-3h-2v3H8l4 4 4-4h-3zm-1-5V3.5L18.5 9H13z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-download-excel-btn" title="Descargar Excel">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13v4h-2v-4H8v-2h7V7h2v4h2v2h-4z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-add-activity-btn" title="Añadir Actividad">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 11h-3v3h-2v-3H8v-2h3V8h2v3h3v2z"/></svg>
                                </button>
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
                                <?php if ($metodo_calculo === 'ponderada' && !empty($actividad['nombre_categoria']) && !in_array($actividad['nombre_categoria'], ['General', 'Sin categoría'])): ?>
                                    <div class="cpp-actividad-categoria" style="color: <?php echo esc_attr($contrasting_text_color); ?>;"><?php echo esc_html($actividad['nombre_categoria']); ?> (<?php echo esc_html(isset($map_categorias_porcentajes[$actividad['categoria_id']]) ? $map_categorias_porcentajes[$actividad['categoria_id']] . '%' : 'N/A'); ?>)</div>
                                <?php endif; ?>
                                <div class="cpp-actividad-fecha" style="color: <?php echo esc_attr($contrasting_text_color); ?>;"><?php if($actividad['fecha_actividad']) echo esc_html(date('d/m/Y', strtotime($actividad['fecha_actividad']))); ?></div>
                            </th>
                        <?php endforeach; ?>
                    <?php endif; ?>

                    <th class="cpp-cuaderno-th-final" data-base-nota-final="<?php echo esc_attr($base_nota_final_clase); ?>">
                        <div class="cpp-th-final-content-wrapper">
                            <span>Nota Final</span>
                            <span class="cpp-nota-final-base-info">(sobre <?php echo cpp_formatear_nota_display($base_nota_final_clase, ($base_nota_final_clase == floor($base_nota_final_clase) ? 0 : 2) ); ?>)</span>
                        </div>
                        <div class="cpp-th-final-actions">
                            <button class="cpp-btn-icon" id="cpp-final-grade-sort-btn" title="Ordenar por Nota Final">
                                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>
                            </button>
                             <button class="cpp-btn-icon" id="cpp-final-grade-highlight-btn" title="Destacar Alumnos Suspensos">
                                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
                            </button>
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($alumnos as $index => $alumno):
                        $row_style_attr = ($index % 2 != 0) ? 'style="background-color: ' . esc_attr(cpp_lighten_hex_color($clase_color_actual, 0.95)) . ';"' : '';
                        $decimales_nota_final = 2;
                        if ($base_nota_final_clase == floor($base_nota_final_clase)) { if (isset($notas_finales_alumnos[$alumno['id']]) && $notas_finales_alumnos[$alumno['id']] == floor($notas_finales_alumnos[$alumno['id']])) { $decimales_nota_final = 0; } }
                        $nota_final_display = isset($notas_finales_alumnos[$alumno['id']]) ? cpp_formatear_nota_display($notas_finales_alumnos[$alumno['id']], $decimales_nota_final) : '-';
                    ?>
                        <?php
                            $nombre_completo_display = (in_array($sort_order, ['nombre'])) ? ($alumno['nombre'] . ' ' . $alumno['apellidos']) : ($alumno['apellidos'] . ', ' . $alumno['nombre']);
                        ?>
                        <tr data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" data-nota-final="<?php echo esc_attr($notas_finales_alumnos[$alumno['id']]); ?>" <?php echo $row_style_attr; ?>><td class="cpp-cuaderno-td-alumno"><div class="cpp-alumno-avatar-cuaderno"><img src="<?php echo cpp_get_avatar_url($alumno); ?>" alt="Avatar de <?php echo esc_attr($alumno['nombre']); ?>"></div><span class="cpp-alumno-nombre-cuaderno"><?php echo esc_html($nombre_completo_display); ?></span></td><?php if (empty($actividades_raw)): ?><td class="cpp-cuaderno-td-no-actividades"></td>
                            <?php else: foreach ($actividades_raw as $actividad):
                                    $nota_alumno_actividad_raw = isset($calificaciones_raw[$alumno['id']][$actividad['id']]) ? $calificaciones_raw[$alumno['id']][$actividad['id']] : '';
                                    $nota_alumno_actividad_display = cpp_formatear_nota_display($nota_alumno_actividad_raw);
                                    ?><td class="cpp-cuaderno-td-nota" data-actividad-id="<?php echo esc_attr($actividad['id']); ?>"><input type="text" class="cpp-input-nota" value="<?php echo esc_attr($nota_alumno_actividad_display); ?>" data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" data-actividad-id="<?php echo esc_attr($actividad['id']); ?>" data-nota-maxima="<?php echo esc_attr($actividad['nota_maxima']); ?>" placeholder="-"><span class="cpp-nota-validation-message cpp-error-message" style="display:none;"></span></td><?php endforeach; ?>
                            <?php endif; ?><td class="cpp-cuaderno-td-final" id="cpp-nota-final-alumno-<?php echo esc_attr($alumno['id']); ?>"><?php echo esc_html($nota_final_display); ?></td></tr>
                    <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php
    }
    $html_cuaderno = ob_get_clean();
    wp_send_json_success([
        'html_cuaderno' => $html_cuaderno, 'nombre_clase' => $clase_db['nombre'], 'color_clase' => $clase_color_actual, 'evaluaciones' => $evaluaciones,
        'evaluacion_activa_id' => $evaluacion_activa_id, 'calculo_nota' => $metodo_calculo,
        'base_nota_final' => $base_nota_final_clase, 'nota_aprobado' => floatval($clase_db['nota_aprobado']),
        'sort_order' => $sort_order
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
    $sort_order = isset($_POST['sort_order']) && in_array($_POST['sort_order'], ['nombre', 'apellidos', 'nota_asc', 'nota_desc']) ? $_POST['sort_order'] : 'apellidos';
    if (empty($clase_id)) { wp_send_json_error(['message' => 'ID de clase no proporcionado.']); return; }

    $clase_db = $wpdb->get_row($wpdb->prepare("SELECT id, nombre, user_id, color, base_nota_final, nota_aprobado FROM {$wpdb->prefix}cpp_clases WHERE id = %d AND user_id = %d", $clase_id, $user_id));
    if (!$clase_db) { wp_send_json_error(['message' => 'Clase no encontrada o no tienes permiso.']); return; }

    $alumnos = cpp_obtener_alumnos_clase($clase_id, in_array($sort_order, ['nombre', 'apellidos']) ? $sort_order : 'apellidos');
    $evaluaciones_reales = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
    $base_nota_final_clase = isset($clase_db->base_nota_final) ? floatval($clase_db->base_nota_final) : 100.00;
    $clase_color_actual = isset($clase_db->color) && !empty($clase_db->color) ? $clase_db->color : '#2962FF';
    $texto_color_barra_fija = cpp_get_contrasting_text_color($clase_color_actual);

    $notas_por_evaluacion = [];
    $notas_finales_promediadas = [];

    foreach ($alumnos as $index => $alumno) {
        $nota_final_promediada = cpp_calcular_nota_media_final_alumno($alumno['id'], $clase_id, $user_id);
        $notas_finales_promediadas[$alumno['id']] = $nota_final_promediada;
        $alumnos[$index]['nota_final_calculada'] = $nota_final_promediada; // Used for sorting
        foreach ($evaluaciones_reales as $evaluacion) {
            $notas_por_evaluacion[$alumno['id']][$evaluacion['id']] = cpp_calcular_nota_final_alumno($alumno['id'], $clase_id, $user_id, $evaluacion['id']);
        }
    }

    if ($sort_order === 'nota_asc' || $sort_order === 'nota_desc') {
        usort($alumnos, function($a, $b) use ($sort_order) {
            $notaA = $a['nota_final_calculada'];
            $notaB = $b['nota_final_calculada'];
            if ($notaA == $notaB) return 0;
            if ($sort_order === 'nota_asc') {
                return ($notaA < $notaB) ? -1 : 1;
            } else {
                return ($notaA > $notaB) ? -1 : 1;
            }
        });
    }

    ob_start();
    ?>
    <div class="cpp-cuaderno-tabla-wrapper">
        <table class="cpp-cuaderno-tabla">
            <thead>
                <tr>
                    <th class="cpp-cuaderno-th-alumno">
                        <div class="cpp-a1-controls-container">
                            <div id="cpp-evaluacion-selector-container" class="cpp-a1-evaluacion-selector"></div>
                            <div class="cpp-a1-icons-row">
                                <button class="cpp-btn-icon" id="cpp-a1-sort-students-btn" title="Ordenar por Apellidos" data-sort="apellidos">
                                    <svg class="icon-sort-alpha" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 18l-4-4h3V4h2v10h3l-4 4zM4.75 5.5H10c.83 0 1.5-.67 1.5-1.5S10.83 2.5 10 2.5H4.75c-.83 0-1.5.67-1.5 1.5S3.92 5.5 4.75 5.5zM10.25 8.5H4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.75c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5zM10.25 14.5H4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.75c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-take-attendance-btn" title="Pasar Lista">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-enter-direction-btn" title="Desplazar hacia abajo al pulsar Intro">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-import-students-btn" title="Importar Alumnos desde Excel">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 13v-3h-2v3H8l4 4 4-4h-3zm-1-5V3.5L18.5 9H13z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-download-excel-btn" title="Descargar Excel">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13v4h-2v-4H8v-2h7V7h2v4h2v2h-4z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-add-activity-btn" title="Añadir Actividad">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 11h-3v3h-2v-3H8v-2h3V8h2v3h3v2z"/></svg>
                                </button>
                            </div>
                        </div>
                    </th>
                    <?php foreach ($evaluaciones_reales as $evaluacion): ?>
                        <th class="cpp-cuaderno-th-actividad" data-evaluacion-id="<?php echo esc_attr($evaluacion['id']); ?>" title="Ver la <?php echo esc_attr($evaluacion['nombre_evaluacion']); ?>">
                            <?php echo esc_html($evaluacion['nombre_evaluacion']); ?>
                        </th>
                    <?php endforeach; ?>
                    <th class="cpp-cuaderno-th-final">
                        <div class="cpp-th-final-content-wrapper">Nota Final<span class="cpp-nota-final-base-info">(Media)</span></div>
                        <div class="cpp-th-final-actions">
                            <button class="cpp-btn-icon" id="cpp-final-grade-sort-btn" title="Ordenar por Nota Final">
                                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>
                            </button>
                             <button class="cpp-btn-icon" id="cpp-final-grade-highlight-btn" title="Destacar Alumnos Suspensos">
                                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
                            </button>
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($alumnos)): ?>
                    <tr><td colspan="<?php echo count($evaluaciones_reales) + 2; ?>">No hay alumnos en esta clase.</td></tr>
                <?php else: foreach ($alumnos as $index => $alumno):
                        $row_style_attr = ($index % 2 != 0) ? 'style="background-color: ' . esc_attr(cpp_lighten_hex_color($clase_color_actual, 0.95)) . ';"' : '';
                    ?>
                    <?php
                        $nombre_completo_display = ($sort_order === 'nombre') ? ($alumno['nombre'] . ' ' . $alumno['apellidos']) : ($alumno['apellidos'] . ', ' . $alumno['nombre']);
                        $nota_promediada_0_100 = $notas_finales_promediadas[$alumno['id']];
                        $nota_promediada_reescalada = ($nota_promediada_0_100 / 100) * $base_nota_final_clase;
                    ?>
                    <tr data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" data-nota-final="<?php echo esc_attr($nota_promediada_reescalada); ?>" <?php echo $row_style_attr; ?>>
                        <td class="cpp-cuaderno-td-alumno">
                            <div class="cpp-alumno-avatar-cuaderno">
                                <img src="<?php echo cpp_get_avatar_url($alumno); ?>" alt="Avatar de <?php echo esc_attr($alumno['nombre']); ?>">
                            </div>
                            <span class="cpp-alumno-nombre-cuaderno"><?php echo esc_html($nombre_completo_display); ?></span>
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
        'color_clase' => $clase_color_actual,
        'sort_order' => $sort_order,
        'base_nota_final' => $base_nota_final_clase,
        'nota_aprobado' => floatval($clase_db->nota_aprobado)
    ]);
}