<?php
// /includes/db-queries/queries-criterios.php

defined('ABSPATH') or die('Acceso no permitido');

// --- GESTIÓN DE CRITERIOS GLOBALES ---

function cpp_obtener_criterios_globales($user_id) {
    global $wpdb;
    $tabla = $wpdb->prefix . 'cpp_criterios_globales';
    return $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $tabla WHERE user_id = %d ORDER BY nombre ASC",
        $user_id
    ), ARRAY_A);
}

/**
 * Obtiene los conteos de actividades por criterio de forma eficiente.
 */
function cpp_get_global_criterion_counts($user_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';

    $counts_raw = $wpdb->get_results($wpdb->prepare("
        SELECT criterio_id, COUNT(*) as total
        FROM $tabla_actividades
        WHERE user_id = %d
        GROUP BY criterio_id
    ", $user_id), OBJECT_K);

    $criterios_globales = cpp_obtener_criterios_globales($user_id);

    // Filtrar criterios redundantes (Sin categoría, Sin criterio)
    $criterios_globales = array_filter($criterios_globales, function($crit) {
        $nombre = trim(mb_strtolower($crit['nombre']));
        return !in_array($nombre, ['sin categoría', 'sin categoria', 'sin criterio', 'no aplica']);
    });

    foreach ($criterios_globales as &$crit) {
        $crit_id = $crit['id'];
        $crit['num_actividades'] = isset($counts_raw[$crit_id]) ? intval($counts_raw[$crit_id]->total) : 0;
    }
    unset($crit);
    $criterios_globales = array_values($criterios_globales); // Reindexar

    // Contar solo actividades de evaluaciones PONDERADAS que no tienen criterio
    $num_sin_criterio = $wpdb->get_var($wpdb->prepare("
        SELECT COUNT(*)
        FROM $tabla_actividades a
        INNER JOIN $tabla_evaluaciones e ON a.evaluacion_id = e.id
        WHERE a.user_id = %d
          AND (a.criterio_id IS NULL OR a.criterio_id = 0)
          AND e.calculo_nota = 'ponderada'
    ", $user_id));

    // Contar actividades de evaluaciones de MEDIA TOTAL (donde no aplica criterio)
    $num_no_aplica = $wpdb->get_var($wpdb->prepare("
        SELECT COUNT(*)
        FROM $tabla_actividades a
        INNER JOIN $tabla_evaluaciones e ON a.evaluacion_id = e.id
        WHERE a.user_id = %d
          AND e.calculo_nota = 'total'
    ", $user_id));

    // Contar tareas NO evaluables (del programador)
    $tabla_prog_act = $wpdb->prefix . 'cpp_programador_actividades';
    $tabla_sesiones = $wpdb->prefix . 'cpp_programador_sesiones';
    $num_no_evaluables = $wpdb->get_var($wpdb->prepare("
        SELECT COUNT(*)
        FROM $tabla_prog_act pa
        INNER JOIN $tabla_sesiones s ON pa.sesion_id = s.id
        WHERE s.user_id = %d AND (pa.es_evaluable = 0 OR pa.es_evaluable IS NULL)
    ", $user_id));

    return [
        'criterios' => $criterios_globales,
        'num_sin_criterio' => $num_sin_criterio,
        'num_no_aplica' => intval($num_no_aplica),
        'num_no_evaluables' => intval($num_no_evaluables)
    ];
}

function cpp_guardar_criterio_global($user_id, $nombre, $color = '#FFFFFF') {
    global $wpdb;
    $tabla = $wpdb->prefix . 'cpp_criterios_globales';
    $color_validado = preg_match('/^#[a-f0-9]{6}$/i', $color) ? $color : '#FFFFFF';

    if (empty(trim($nombre))) return false;

    $resultado = $wpdb->insert(
        $tabla,
        [
            'user_id' => $user_id,
            'nombre'  => sanitize_text_field($nombre),
            'color'   => $color_validado
        ],
        ['%d', '%s', '%s']
    );
    return $resultado ? $wpdb->insert_id : false;
}

function cpp_obtener_criterio_global_por_id($criterio_id, $user_id) {
    global $wpdb;
    $tabla = $wpdb->prefix . 'cpp_criterios_globales';
    return $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $tabla WHERE id = %d AND user_id = %d",
        $criterio_id, $user_id
    ), ARRAY_A);
}

function cpp_actualizar_criterio_global($criterio_id, $user_id, $datos) {
    global $wpdb;
    $tabla = $wpdb->prefix . 'cpp_criterios_globales';

    $update_data = [];
    $update_formats = [];

    if (isset($datos['nombre'])) {
        $update_data['nombre'] = sanitize_text_field($datos['nombre']);
        $update_formats[] = '%s';
    }
    if (isset($datos['color'])) {
        $update_data['color'] = preg_match('/^#[a-f0-9]{6}$/i', $datos['color']) ? $datos['color'] : '#FFFFFF';
        $update_formats[] = '%s';
    }

    if (empty($update_data)) return false;

    return $wpdb->update($tabla, $update_data, ['id' => $criterio_id, 'user_id' => $user_id], $update_formats, ['%d', '%d']);
}

function cpp_eliminar_criterio_global($criterio_id, $user_id, $new_criterio_id = null) {
    global $wpdb;
    $tabla_criterios = $wpdb->prefix . 'cpp_criterios_globales';
    $tabla_eval_crit = $wpdb->prefix . 'cpp_evaluacion_criterios';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';

    // Iniciar transacción
    $wpdb->query('START TRANSACTION');

    // 1. Desasignar de todas las evaluaciones (los pesos mueren siempre porque el ID global desaparece)
    $wpdb->delete($tabla_eval_crit, ['criterio_id' => $criterio_id], ['%d']);

    // 2. Reasignar o dejar a NULL las actividades de TODAS las clases
    $update_data = ['criterio_id' => $new_criterio_id ? intval($new_criterio_id) : null];
    $wpdb->update($tabla_actividades, $update_data, ['criterio_id' => $criterio_id, 'user_id' => $user_id]);

    // 3. Eliminar el criterio global
    $resultado = $wpdb->delete($tabla_criterios, ['id' => $criterio_id, 'user_id' => $user_id], ['%d', '%d']);

    if ($resultado === false) {
        $wpdb->query('ROLLBACK');
        return false;
    }

    $wpdb->query('COMMIT');
    return true;
}

/**
 * Comprueba si la evaluación destino tiene actividades asociadas a criterios existentes
 * y devuelve información para sugerir el mapeo a los criterios de la evaluación origen.
 */
function cpp_check_target_eval_activities_criteria($target_eval_id, $source_eval_id, $user_id) {
    global $wpdb;
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_criterios = $wpdb->prefix . 'cpp_criterios_globales';

    $source_criteria = cpp_obtener_criterios_por_evaluacion($source_eval_id, $user_id);
    if (empty($source_criteria)) {
        return ['success' => false, 'message' => 'La evaluación de origen no tiene criterios o ponderaciones asignadas.'];
    }

    $source_crit_ids = array_map('intval', wp_list_pluck($source_criteria, 'criterio_id'));

    $affected_raw = $wpdb->get_results($wpdb->prepare("
        SELECT a.criterio_id, cg.nombre, cg.color, COUNT(a.id) as activity_count
        FROM $tabla_actividades a
        LEFT JOIN $tabla_criterios cg ON a.criterio_id = cg.id
        WHERE a.evaluacion_id = %d AND a.user_id = %d AND a.criterio_id IS NOT NULL AND a.criterio_id > 0
        GROUP BY a.criterio_id
    ", $target_eval_id, $user_id), ARRAY_A);

    $affected_criteria = [];
    $has_activities = !empty($affected_raw);

    if ($has_activities) {
        foreach ($affected_raw as $row) {
            $old_id = intval($row['criterio_id']);
            $default_mapped_id = null;

            if (in_array($old_id, $source_crit_ids)) {
                $default_mapped_id = $old_id;
            } else {
                foreach ($source_criteria as $sc) {
                    if (strcasecmp(trim($sc['nombre']), trim($row['nombre'])) === 0) {
                        $default_mapped_id = intval($sc['criterio_id']);
                        break;
                    }
                }
            }

            if (!$default_mapped_id && !empty($source_criteria)) {
                $default_mapped_id = intval($source_criteria[0]['criterio_id']);
            }

            $affected_criteria[] = [
                'criterio_id' => $old_id,
                'nombre' => $row['nombre'] ? $row['nombre'] : 'Criterio sin nombre',
                'color' => $row['color'] ? $row['color'] : '#808080',
                'activity_count' => intval($row['activity_count']),
                'default_mapped_id' => $default_mapped_id
            ];
        }
    }

    return [
        'success' => true,
        'has_activities' => $has_activities,
        'source_criteria' => $source_criteria,
        'affected_criteria' => $affected_criteria
    ];
}

/**
 * Clona los criterios y ponderaciones de una evaluación origen a una evaluación destino,
 * reasignando opcionalmente las actividades existentes de la evaluación destino a los nuevos criterios.
 */
function cpp_clonar_criterios_evaluacion($target_eval_id, $source_eval_id, $remapping, $user_id) {
    global $wpdb;
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $tabla_eval_crit = $wpdb->prefix . 'cpp_evaluacion_criterios';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';

    $target_owner = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_evaluaciones WHERE id = %d", $target_eval_id));
    $source_owner = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_evaluaciones WHERE id = %d", $source_eval_id));

    if ((int)$target_owner !== (int)$user_id || (int)$source_owner !== (int)$user_id) {
        return ['success' => false, 'message' => 'No tienes permiso para modificar estas evaluaciones.'];
    }

    $source_criteria = cpp_obtener_criterios_por_evaluacion($source_eval_id, $user_id);
    if (empty($source_criteria)) {
        return ['success' => false, 'message' => 'La evaluación de origen no tiene criterios o ponderaciones asignadas.'];
    }

    $source_crit_ids = array_map('intval', wp_list_pluck($source_criteria, 'criterio_id'));

    $wpdb->query('START TRANSACTION');

    if (is_array($remapping) && !empty($remapping)) {
        foreach ($remapping as $old_crit_id => $new_crit_id) {
            $old_id = intval($old_crit_id);
            $new_id = intval($new_crit_id);

            if ($new_id > 0 && in_array($new_id, $source_crit_ids)) {
                $wpdb->update(
                    $tabla_actividades,
                    ['criterio_id' => $new_id],
                    ['evaluacion_id' => $target_eval_id, 'criterio_id' => $old_id, 'user_id' => $user_id],
                    ['%d'],
                    ['%d', '%d', '%d']
                );
            } else {
                $wpdb->update(
                    $tabla_actividades,
                    ['criterio_id' => null],
                    ['evaluacion_id' => $target_eval_id, 'criterio_id' => $old_id, 'user_id' => $user_id],
                    ['%s'],
                    ['%d', '%d', '%d']
                );
            }
        }
    }

    if (!empty($source_crit_ids)) {
        $placeholders = implode(',', array_fill(0, count($source_crit_ids), '%d'));
        $query = $wpdb->prepare(
            "UPDATE $tabla_actividades SET criterio_id = NULL WHERE evaluacion_id = %d AND user_id = %d AND criterio_id IS NOT NULL AND criterio_id NOT IN ($placeholders)",
            array_merge([$target_eval_id, $user_id], $source_crit_ids)
        );
        $wpdb->query($query);
    }

    $wpdb->delete($tabla_eval_crit, ['evaluacion_id' => $target_eval_id], ['%d']);

    foreach ($source_criteria as $crit) {
        $wpdb->insert($tabla_eval_crit, [
            'evaluacion_id' => $target_eval_id,
            'criterio_id' => intval($crit['criterio_id']),
            'porcentaje' => intval($crit['porcentaje'])
        ], ['%d', '%d', '%d']);
    }

    $wpdb->update(
        $tabla_evaluaciones,
        ['calculo_nota' => 'ponderada'],
        ['id' => $target_eval_id, 'user_id' => $user_id],
        ['%s'],
        ['%d', '%d']
    );

    $wpdb->query('COMMIT');

    if (function_exists('cpp_clear_programador_cache')) {
        cpp_clear_programador_cache($user_id);
    }

    return ['success' => true, 'message' => 'Ponderaciones clonadas correctamente.'];
}

// --- PESOS POR EVALUACIÓN ---

function cpp_obtener_criterios_por_evaluacion($evaluacion_id, $user_id) {
    global $wpdb;
    $tabla_eval_crit = $wpdb->prefix . 'cpp_evaluacion_criterios';
    $tabla_criterios = $wpdb->prefix . 'cpp_criterios_globales';
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';

    // Safety check for table existence (prevents crash if migration partially failed)
    if($wpdb->get_var("SHOW TABLES LIKE '$tabla_eval_crit'") === null) {
        return [];
    }

    return $wpdb->get_results($wpdb->prepare(
        "SELECT ec.*, cg.nombre, cg.color
         FROM $tabla_eval_crit ec
         INNER JOIN $tabla_criterios cg ON ec.criterio_id = cg.id
         INNER JOIN $tabla_evaluaciones ev ON ec.evaluacion_id = ev.id
         WHERE ec.evaluacion_id = %d AND ev.user_id = %d
         ORDER BY cg.nombre ASC",
        $evaluacion_id, $user_id
    ), ARRAY_A);
}

function cpp_asignar_criterio_a_evaluacion($evaluacion_id, $criterio_id, $porcentaje, $user_id) {
    global $wpdb;
    $tabla_eval_crit = $wpdb->prefix . 'cpp_evaluacion_criterios';

    // Verificar propiedad de la evaluación y el criterio
    $ev_user = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d", $evaluacion_id));
    $crit_user = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_criterios_globales WHERE id = %d", $criterio_id));

    if ($ev_user != $user_id || $crit_user != $user_id) return false;

    return $wpdb->insert($tabla_eval_crit, [
        'evaluacion_id' => $evaluacion_id,
        'criterio_id'   => $criterio_id,
        'porcentaje'    => intval($porcentaje)
    ], ['%d', '%d', '%d']);
}

function cpp_actualizar_peso_criterio_evaluacion($evaluacion_id, $criterio_id, $porcentaje, $user_id, $new_criterio_id = null) {
    global $wpdb;
    $tabla_eval_crit = $wpdb->prefix . 'cpp_evaluacion_criterios';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';

    // Verificar propiedad de la evaluación
    $ev_user = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d", $evaluacion_id));
    if ($ev_user != $user_id) return false;

    if ($new_criterio_id && $new_criterio_id != $criterio_id) {
        // SWAP operation
        $wpdb->query('START TRANSACTION');

        // 1. Actualizar la relación de pesos (cambiar el ID del criterio)
        $res1 = $wpdb->update($tabla_eval_crit,
            ['criterio_id' => intval($new_criterio_id), 'porcentaje' => intval($porcentaje)],
            ['evaluacion_id' => $evaluacion_id, 'criterio_id' => $criterio_id],
            ['%d', '%d'], ['%d', '%d']
        );

        // 2. Actualizar las actividades de esta evaluación
        $res2 = $wpdb->update($tabla_actividades,
            ['criterio_id' => intval($new_criterio_id)],
            ['evaluacion_id' => $evaluacion_id, 'criterio_id' => $criterio_id, 'user_id' => $user_id],
            ['%d'], ['%d', '%d', '%d']
        );

        if ($res1 === false || $res2 === false) {
            $wpdb->query('ROLLBACK');
            return false;
        }
        $wpdb->query('COMMIT');
        return true;
    } else {
        // Solo actualización de porcentaje
        return $wpdb->update($tabla_eval_crit,
            ['porcentaje' => intval($porcentaje)],
            ['evaluacion_id' => $evaluacion_id, 'criterio_id' => $criterio_id],
            ['%d'], ['%d', '%d']
        );
    }
}

function cpp_desasignar_criterio_de_evaluacion($evaluacion_id, $criterio_id, $user_id, $new_criterio_id = null) {
    global $wpdb;
    $tabla_eval_crit = $wpdb->prefix . 'cpp_evaluacion_criterios';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';

    // Verificar propiedad
    $ev_user = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}cpp_evaluaciones WHERE id = %d", $evaluacion_id));
    if ($ev_user != $user_id) return false;

    $wpdb->query('START TRANSACTION');

    // 1. Eliminar relación de pesos
    $res1 = $wpdb->delete($tabla_eval_crit, ['evaluacion_id' => $evaluacion_id, 'criterio_id' => $criterio_id], ['%d', '%d']);

    // 2. Reasignar o dejar a NULL las actividades de esta evaluación
    $update_data = ['criterio_id' => $new_criterio_id ? intval($new_criterio_id) : null];
    $res2 = $wpdb->update($tabla_actividades,
        $update_data,
        ['evaluacion_id' => $evaluacion_id, 'criterio_id' => $criterio_id, 'user_id' => $user_id]
    );

    if ($res1 === false || $res2 === false) {
        $wpdb->query('ROLLBACK');
        return false;
    }

    $wpdb->query('COMMIT');
    return true;
}
