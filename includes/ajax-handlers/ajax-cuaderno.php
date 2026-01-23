<?php
// /includes/ajax-handlers/ajax-cuaderno.php

defined('ABSPATH') or die('Acceso no permitido');

add_action('wp_ajax_cpp_cargar_cuaderno_clase', 'cpp_ajax_cargar_cuaderno_clase');
function cpp_ajax_cargar_cuaderno_clase() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }
    
    $user_id = get_current_user_id();
    cpp_clear_programador_cache($user_id);
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

    $alumnos = cpp_obtener_alumnos_clase($clase_id, '', in_array($sort_order, ['nombre', 'apellidos']) ? $sort_order : 'apellidos');
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
            $calculo_result = cpp_calcular_nota_final_alumno($alumno['id'], $clase_id, $user_id, $evaluacion_activa_id);
            $nota_0_100 = $calculo_result['nota'];
            $nota_reescalada = ($nota_0_100 / 100) * $base_nota_final_clase;

            $notas_finales_alumnos[$alumno['id']] = [
                'nota' => $nota_reescalada,
                'is_incomplete' => $calculo_result['is_incomplete'],
                'used_categories' => $calculo_result['used_categories'],
                'missing_categories' => $calculo_result['missing_categories']
            ];
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

    // The main table is now always rendered, and JS will handle visibility.
    ?>
    <div class="cpp-cuaderno-tabla-wrapper">
        <table class="cpp-cuaderno-tabla">
            <thead>
                <tr>
                    <th class="cpp-cuaderno-th-alumno">
                        <div class="cpp-a1-controls-container">
                            <div class="cpp-a1-icons-row">
                                <button class="cpp-btn-icon" id="cpp-a1-sort-students-btn" title="Ordenar Alumnos" data-sort="apellidos">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-take-attendance-btn" title="Pasar Lista">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H4V5h16v14zM18 7H6v2h12V7zm-4.03 7.47l-1.41-1.41-4.03 4.03-1.48-1.48L6 17.02l2.88 2.88L13.97 14.5l-1.41-1.41-2.59 2.58z"/></svg>
                                </button>
                                <?php if ($evaluacion_activa_id !== 'final'): ?>
                                <button class="cpp-btn-icon" id="cpp-a1-symbol-palette-btn" title="Insertar Símbolo">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M18 4H6v2l6.5 6L6 18v2h12v-3h-7l5-5-5-5h7z"/></svg>
                                </button>
                                <?php endif; ?>
                                <button class="cpp-btn-icon" id="cpp-a1-download-excel-btn" title="Descargar Excel">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                                </button>
                                <?php if ($evaluacion_activa_id !== 'final'): ?>
                                <button class="cpp-btn-icon" id="cpp-a1-add-activity-btn" title="Añadir Actividad">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 11h-3v3h-2v-3H8v-2h3V8h2v3h3v2z"/></svg>
                                </button>
                                <?php endif; ?>
                                <?php if ($evaluacion_activa_id === 'final'): ?>
                                <button class="cpp-btn-icon" id="cpp-manage-final-grade-evals-btn" data-clase-id="<?php echo esc_attr($clase_id); ?>" title="Configurar Evaluaciones para la Media">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>
                                </button>
                                <?php endif; ?>
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
                                        data-sesion-id="<?php echo esc_attr($actividad['sesion_id']); ?>"
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

                        $nota_final_data = $notas_finales_alumnos[$alumno['id']];
                        $nota_final_valor = $nota_final_data['nota'];
                        $is_incomplete = $nota_final_data['is_incomplete'];

                        $decimales_nota_final = 2;
                        if ($base_nota_final_clase == floor($base_nota_final_clase) && $nota_final_valor == floor($nota_final_valor)) { $decimales_nota_final = 0; }
                        $nota_final_display = cpp_formatear_nota_display($nota_final_valor, $decimales_nota_final);

                        $data_attributes = '';
                        if ($is_incomplete) {
                            $data_attributes = 'data-is-incomplete="true" ';
                            $data_attributes .= 'data-used-categories="' . esc_attr(wp_json_encode($nota_final_data['used_categories'])) . '" ';
                            $data_attributes .= 'data-missing-categories="' . esc_attr(wp_json_encode($nota_final_data['missing_categories'])) . '"';
                        }
                    ?>
                        <?php
                            $nombre_completo_display = (in_array($sort_order, ['nombre'])) ? ($alumno['nombre'] . ' ' . $alumno['apellidos']) : ($alumno['apellidos'] . ', ' . $alumno['nombre']);
                        ?>
                        <tr data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" data-nota-final="<?php echo esc_attr($nota_final_valor); ?>" <?php echo $row_style_attr; ?>><td class="cpp-cuaderno-td-alumno"><div class="cpp-alumno-avatar-cuaderno"><img src="<?php echo cpp_get_avatar_url($alumno); ?>" alt="Avatar de <?php echo esc_attr($alumno['nombre']); ?>"></div><span class="cpp-alumno-nombre-cuaderno"><?php echo ($index + 1) . ". " . esc_html($nombre_completo_display); ?></span></td><?php if (empty($actividades_raw)): ?><td class="cpp-cuaderno-td-no-actividades"></td>
                            <?php else: foreach ($actividades_raw as $actividad):
                                    $nota_alumno_actividad_raw = isset($calificaciones_raw[$alumno['id']][$actividad['id']]) ? $calificaciones_raw[$alumno['id']][$actividad['id']] : '';
                                    $nota_alumno_actividad_display = cpp_formatear_nota_display($nota_alumno_actividad_raw);
                                    ?><td class="cpp-cuaderno-td-nota" data-actividad-id="<?php echo esc_attr($actividad['id']); ?>"><input type="text" class="cpp-input-nota" value="<?php echo esc_attr($nota_alumno_actividad_display); ?>" data-alumno-id="<?php echo esc_attr($alumno['id']); ?>" data-actividad-id="<?php echo esc_attr($actividad['id']); ?>" data-nota-maxima="<?php echo esc_attr($actividad['nota_maxima']); ?>" placeholder="-"><span class="cpp-nota-validation-message cpp-error-message" style="display:none;"></span></td><?php endforeach; ?>
                            <?php endif; ?><td class="cpp-cuaderno-td-final" id="cpp-nota-final-alumno-<?php echo esc_attr($alumno['id']); ?>" <?php echo $data_attributes; ?>>
                                <?php echo esc_html($nota_final_display); ?>
                                <?php if ($is_incomplete): ?>
                                    <span class="cpp-warning-icon" title="Nota incompleta">⚠️</span>
                                <?php endif; ?>
                            </td></tr>
                    <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php
    $html_cuaderno = ob_get_clean();

    wp_send_json_success([
        'html_cuaderno' => $html_cuaderno,
        'nombre_clase' => $clase_db['nombre'],
        'color_clase' => $clase_color_actual,
        'evaluaciones' => $evaluaciones,
        'evaluacion_activa_id' => $evaluacion_activa_id,
        'calculo_nota' => $metodo_calculo,
        'base_nota_final' => $base_nota_final_clase,
        'nota_aprobado' => floatval($clase_db['nota_aprobado']),
        'sort_order' => $sort_order,
        'has_students' => !empty($alumnos),
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
    $sesion_id = isset($_POST['sesion_id']) ? intval($_POST['sesion_id']) : null;

    // Si la actividad está vinculada a una sesión de programación, su fecha debe ser NULL
    // para que la herede de la sesión.
    if ($sesion_id && $sesion_id > 0) {
        $fecha_actividad = null;
    }
    
    $categoria_id = isset($_POST['categoria_id_actividad']) && $_POST['categoria_id_actividad'] !== '' ? intval($_POST['categoria_id_actividad']) : 0;

    if (empty($clase_id) || empty($evaluacion_id) || empty($nombre_actividad) || $nota_maxima <= 0) {
        wp_send_json_error(['message' => 'Faltan datos esenciales (clase, evaluación, nombre o nota).']);
        return;
    }
    
    global $wpdb;

    if ($actividad_id_editar == 0 && $sesion_id) {
        $tabla_act_evaluables = $wpdb->prefix . 'cpp_actividades_evaluables';
        $tabla_act_programadas = $wpdb->prefix . 'cpp_programador_actividades';

        $max_orden_evaluable = $wpdb->get_var($wpdb->prepare("SELECT MAX(orden) FROM $tabla_act_evaluables WHERE sesion_id = %d", $sesion_id));
        $max_orden_programada = $wpdb->get_var($wpdb->prepare("SELECT MAX(orden) FROM $tabla_act_programadas WHERE sesion_id = %d", $sesion_id));

        $max_orden = max( (is_null($max_orden_evaluable) ? -1 : $max_orden_evaluable), (is_null($max_orden_programada) ? -1 : $max_orden_programada) );
        $orden = $max_orden + 1;
    } else {
        $orden = isset($_POST['orden']) ? intval($_POST['orden']) : 0; // Podríamos necesitar pasar el orden al editar
    }


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
    
    $datos_actividad = [
        'clase_id' => $clase_id,
        'sesion_id' => $sesion_id,
        'evaluacion_id' => $evaluacion_id,
        'user_id' => $user_id,
        'categoria_id' => $categoria_id,
        'nombre_actividad' => $nombre_actividad,
        'nota_maxima' => $nota_maxima,
        'fecha_actividad' => $fecha_actividad,
        'descripcion_actividad' => $descripcion_actividad,
        'orden' => $orden
    ];

    $categoria_cambiada = false;
    if ($actividad_id_editar > 0) {
        $actividad_original = $wpdb->get_row($wpdb->prepare("SELECT categoria_id FROM {$wpdb->prefix}cpp_actividades_evaluables WHERE id = %d", $actividad_id_editar));
        if ($actividad_original && $actividad_original->categoria_id != $categoria_id) {
            $categoria_cambiada = true;
        }
        $resultado_guardado = cpp_actualizar_actividad_evaluable($actividad_id_editar, $datos_actividad);
        $mensaje_exito = 'Actividad actualizada.';
    } else {
        $resultado_guardado = cpp_guardar_actividad_evaluable($datos_actividad);
        $mensaje_exito = 'Actividad guardada.';
    }

    if ($resultado_guardado !== false) {
        $final_actividad_id = $actividad_id_editar > 0 ? $actividad_id_editar : $resultado_guardado;

        $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
        $actividad = $wpdb->get_row($wpdb->prepare("SELECT * FROM $tabla_actividades WHERE id = %d AND user_id = %d", $final_actividad_id, $user_id), ARRAY_A);

        $response_data = ['message' => $mensaje_exito];

        if ($actividad) {
            $actividades_a_hidratar = [$actividad];
            $actividades_hidratadas = cpp_hidratar_fechas_de_actividades($actividades_a_hidratar, $actividad['clase_id'], $actividad['evaluacion_id'], $user_id);
            $actividad_completa = $actividades_hidratadas[0];
            $actividad_completa['tipo'] = 'evaluable';
            $actividad_completa['titulo'] = $actividad_completa['nombre_actividad'];

            // Añadir el nombre y color de la categoría a la respuesta
            $categoria_info = $wpdb->get_row($wpdb->prepare("SELECT nombre_categoria, color FROM {$wpdb->prefix}cpp_categorias_evaluacion WHERE id = %d", $categoria_id));
            if ($categoria_info) {
                $actividad_completa['nombre_categoria'] = $categoria_info->nombre_categoria;
                $actividad_completa['categoria_color'] = $categoria_info->color;
            }

            $response_data['actividad'] = $actividad_completa;
        } else {
            $response_data['new_id'] = $final_actividad_id;
        }

        if ($categoria_cambiada) {
            $alumnos = cpp_obtener_alumnos_clase($clase_id);
            $clase_db = cpp_obtener_clase_completa_por_id($clase_id, $user_id);
            $base_nota_final_clase = isset($clase_db['base_nota_final']) ? floatval($clase_db['base_nota_final']) : 100.00;
            $notas_finales_actualizadas = [];

            foreach ($alumnos as $alumno) {
                $calculo_result = cpp_calcular_nota_final_alumno($alumno['id'], $clase_id, $user_id, $evaluacion_id);
                $nota_reescalada = ($calculo_result['nota'] / 100) * $base_nota_final_clase;

                $decimales_nota_final = 2;
                 if ($base_nota_final_clase == floor($base_nota_final_clase) && $nota_reescalada == floor($nota_reescalada)) {
                    $decimales_nota_final = 0;
                }

                $notas_finales_actualizadas[] = [
                    'alumno_id' => $alumno['id'],
                    'nota_final_display' => cpp_formatear_nota_display($nota_reescalada, $decimales_nota_final),
                    'is_incomplete' => $calculo_result['is_incomplete'],
                    'used_categories' => $calculo_result['used_categories'],
                    'missing_categories' => $calculo_result['missing_categories']
                ];
            }
            $response_data['notas_finales_actualizadas'] = $notas_finales_actualizadas;
        }

        wp_send_json_success($response_data);

    } else {
        wp_send_json_error(['message' => 'Error al procesar la actividad.', 'debug_sesion_id' => $sesion_id]);
    }
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

    // La validación ahora se hará en la función de guardado para permitir texto libre.
    $nota_a_guardar = ($nota_str !== '' && $nota_str !== null) ? $nota_str : null;

    $resultado_guardado = cpp_guardar_o_actualizar_calificacion($alumno_id, $actividad_id, $nota_a_guardar, $user_id);
    if ($resultado_guardado === false) { wp_send_json_error(['data' => ['message' => 'Error al guardar la calificación. Verifique que la nota no excede la máxima.']]); return; }
    global $wpdb;
    $clase_info = $wpdb->get_row($wpdb->prepare("SELECT act.clase_id, c.base_nota_final FROM {$wpdb->prefix}cpp_actividades_evaluables act JOIN {$wpdb->prefix}cpp_clases c ON act.clase_id = c.id WHERE act.id = %d AND act.user_id = %d", $actividad_id, $user_id ));
    if (!$clase_info) { wp_send_json_error(['data' => ['message' => 'Error al obtener datos de la clase para recalcular.']]); return; }
    $clase_id = $clase_info->clase_id;
    $base_nota_final_clase = floatval($clase_info->base_nota_final);
    if ($base_nota_final_clase <= 0) { $base_nota_final_clase = 100.00; }

    $calculo_result = cpp_calcular_nota_final_alumno($alumno_id, $clase_id, $user_id, $evaluacion_id);

    // Preparar el objeto de respuesta completo
    $nota_final_reescalada = ($calculo_result['nota'] / 100) * $base_nota_final_clase;
    $decimales_nota_final = 2;
    if ($base_nota_final_clase == floor($base_nota_final_clase) && $nota_final_reescalada == floor($nota_final_reescalada)) {
        $decimales_nota_final = 0;
    }

    $response_data = [
        'message' => 'Calificación guardada.',
        'alumno_id' => $alumno_id,
        'nota_final_alumno_display' => cpp_formatear_nota_display($nota_final_reescalada, $decimales_nota_final),
        'is_incomplete' => $calculo_result['is_incomplete'],
        'used_categories' => $calculo_result['used_categories'],
        'missing_categories' => $calculo_result['missing_categories']
    ];

    wp_send_json_success($response_data);
}

add_action('wp_ajax_cpp_eliminar_actividad', 'cpp_ajax_eliminar_actividad');
function cpp_ajax_eliminar_actividad() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $actividad_id = isset($_POST['actividad_id']) ? intval($_POST['actividad_id']) : 0;

    if (empty($actividad_id)) {
        wp_send_json_error(['message' => 'ID de actividad no proporcionado.']);
        return;
    }

    // Esta función ahora solo elimina actividades evaluables.
    // La eliminación es total y no hay desvinculación.
    $resultado = cpp_eliminar_actividad_y_calificaciones($actividad_id, $user_id);

    if ($resultado) {
        wp_send_json_success(['message' => 'Actividad eliminada correctamente.']);
    } else {
        wp_send_json_error(['message' => 'Error al eliminar la actividad o no tienes permiso.']);
    }
}

add_action('wp_ajax_cpp_get_evaluable_activity_data', 'cpp_ajax_get_evaluable_activity_data');
function cpp_ajax_get_evaluable_activity_data() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) { wp_send_json_error(['message' => 'Usuario no autenticado.']); return; }

    $user_id = get_current_user_id();
    $actividad_id = isset($_POST['actividad_id']) ? intval($_POST['actividad_id']) : 0;

    if (empty($actividad_id)) {
        wp_send_json_error(['message' => 'ID de actividad no proporcionado.']);
        return;
    }

    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $actividad = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $tabla_actividades WHERE id = %d AND user_id = %d",
        $actividad_id,
        $user_id
    ), ARRAY_A);

    if ($actividad) {
        // Envolver la actividad en un array para poder usar la función de hidratación
        $actividades_a_hidratar = [$actividad];

        // Llamar a la función de hidratación
        $actividades_hidratadas = cpp_hidratar_fechas_de_actividades(
            $actividades_a_hidratar,
            $actividad['clase_id'],
            $actividad['evaluacion_id'],
            $user_id
        );

        // Devolver la primera (y única) actividad del array hidratado
        wp_send_json_success($actividades_hidratadas[0]);
    } else {
        wp_send_json_error(['message' => 'Actividad no encontrada o no tienes permiso.']);
    }
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

    $alumnos = cpp_obtener_alumnos_clase($clase_id, '', in_array($sort_order, ['nombre', 'apellidos']) ? $sort_order : 'apellidos');

    // Obtener todas las evaluaciones y luego filtrar las que se deben mostrar
    $todas_las_evaluaciones = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
    $evaluaciones_seleccionadas_ids = cpp_get_evaluaciones_para_media($clase_id, $user_id);
    $evaluaciones_a_mostrar = array_filter($todas_las_evaluaciones, function($eval) use ($evaluaciones_seleccionadas_ids) {
        return in_array($eval['id'], $evaluaciones_seleccionadas_ids);
    });

    $base_nota_final_clase = isset($clase_db->base_nota_final) ? floatval($clase_db->base_nota_final) : 100.00;
    $clase_color_actual = isset($clase_db->color) && !empty($clase_db->color) ? $clase_db->color : '#2962FF';
    $texto_color_barra_fija = cpp_get_contrasting_text_color($clase_color_actual);

    $notas_por_evaluacion = [];
    $notas_finales_promediadas = [];

    foreach ($alumnos as $index => $alumno) {
        $resultado_nota_final = cpp_calcular_nota_media_final_alumno($alumno['id'], $clase_id, $user_id);
        $nota_final_promediada = $resultado_nota_final['nota'];
        $notas_finales_promediadas[$alumno['id']] = $nota_final_promediada;
        $alumnos[$index]['nota_final_calculada'] = $nota_final_promediada; // Used for sorting
        // Recalcular las notas solo para las evaluaciones que se van a mostrar.
        foreach ($evaluaciones_a_mostrar as $evaluacion) {
            $calculo_evaluacion = cpp_calcular_nota_final_alumno($alumno['id'], $clase_id, $user_id, $evaluacion['id']);
            $notas_por_evaluacion[$alumno['id']][$evaluacion['id']] = $calculo_evaluacion['nota'];
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
                            <div class="cpp-a1-icons-row">
                                <button class="cpp-btn-icon" id="cpp-a1-sort-students-btn" title="Ordenar Alumnos" data-sort="apellidos">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-take-attendance-btn" title="Pasar Lista">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H4V5h16v14zM18 7H6v2h12V7zm-4.03 7.47l-1.41-1.41-4.03 4.03-1.48-1.48L6 17.02l2.88 2.88L13.97 14.5l-1.41-1.41-2.59 2.58z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-a1-download-excel-btn" title="Descargar Excel">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                                </button>
                                <button class="cpp-btn-icon" id="cpp-manage-final-grade-evals-btn" data-clase-id="<?php echo esc_attr($clase_id); ?>" title="Configurar Evaluaciones para la Media">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>
                                </button>
                            </div>
                        </div>
                    </th>
                    <?php foreach ($evaluaciones_a_mostrar as $evaluacion): ?>
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
                    <tr><td colspan="<?php echo count($evaluaciones_a_mostrar) + 2; ?>">No hay alumnos en esta clase.</td></tr>
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
                            <span class="cpp-alumno-nombre-cuaderno"><?php echo ($index + 1) . ". " . esc_html($nombre_completo_display); ?></span>
                        </td>
                        <?php foreach ($evaluaciones_a_mostrar as $evaluacion):
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

    $evaluaciones_con_final = $todas_las_evaluaciones;
    if (count($todas_las_evaluaciones) > 1) {
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
        'nota_aprobado' => floatval($clase_db->nota_aprobado),
        'has_students' => !empty($alumnos)
    ]);
}
