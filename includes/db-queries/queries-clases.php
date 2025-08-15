<?php
// /includes/db-queries/queries-clases.php

defined('ABSPATH') or die('Acceso no permitido');

// --- FUNCIONES PARA CLASES ---

function cpp_obtener_clase_completa_por_id($clase_id, $user_id) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    return $wpdb->get_row(
        $wpdb->prepare(
            "SELECT id, user_id, nombre, color, base_nota_final, orden, fecha_creacion FROM $tabla_clases WHERE id = %d AND user_id = %d",
            $clase_id,
            $user_id
        ),
        ARRAY_A 
    );
}

function cpp_actualizar_clase_completa($clase_id, $user_id, $datos) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $clase_existente = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $tabla_clases WHERE id = %d", $clase_id));
    if (null === $clase_existente || $clase_existente != $user_id) {
        return false; 
    }
    $update_data = [];
    $update_formats = [];
    if (isset($datos['nombre'])) {
        $update_data['nombre'] = sanitize_text_field(substr(trim($datos['nombre']), 0, 100));
        $update_formats[] = '%s';
    }
    if (isset($datos['color'])) {
        $update_data['color'] = preg_match('/^#[a-f0-9]{6}$/i', $datos['color']) ? $datos['color'] : '#FFFFFF';
        $update_formats[] = '%s';
    }
    if (isset($datos['base_nota_final'])) { 
        $base_nota = floatval(str_replace(',', '.', $datos['base_nota_final']));
        if ($base_nota > 0) {
            $update_data['base_nota_final'] = $base_nota;
            $update_formats[] = '%f';
        }
    }
    if (empty($update_data)) {
        return 0; 
    }
    return $wpdb->update(
        $tabla_clases,
        $update_data,
        ['id' => $clase_id, 'user_id' => $user_id], 
        $update_formats,
        ['%d', '%d'] 
    );
}

function cpp_guardar_base_nota_final_clase($clase_id, $user_id, $base_nota) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    if (!is_numeric($base_nota) || floatval($base_nota) <= 0) {
        return false;
    }
    $base_nota_sanitizada = floatval($base_nota);
    $clase_existente = $wpdb->get_row($wpdb->prepare("SELECT user_id FROM $tabla_clases WHERE id = %d", $clase_id));
    if (!$clase_existente || $clase_existente->user_id != $user_id) {
        return false; 
    }
    $resultado = $wpdb->update(
        $tabla_clases,
        ['base_nota_final' => $base_nota_sanitizada],
        ['id' => $clase_id, 'user_id' => $user_id],
        ['%f'], 
        ['%d', '%d'] 
    );
    return $resultado;
}

function cpp_obtener_clases_usuario($user_id) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $query = $wpdb->prepare(
        "SELECT c.id, c.user_id, c.nombre, c.color, c.base_nota_final, c.orden, c.fecha_creacion, COUNT(a.id) as num_alumnos
         FROM $tabla_clases c
         LEFT JOIN $tabla_alumnos a ON c.id = a.clase_id
         WHERE c.user_id = %d
         GROUP BY c.id
         ORDER BY c.orden ASC, c.fecha_creacion DESC", 
        $user_id
    );
    return $wpdb->get_results($query, ARRAY_A);
}

function cpp_guardar_clase($user_id, $datos) {
    global $wpdb;
    $base_nota_final = isset($datos['base_nota_final']) ? floatval(str_replace(',', '.', $datos['base_nota_final'])) : 100.00;
    if ($base_nota_final <= 0) $base_nota_final = 100.00;
    $nombre_clase = isset($datos['nombre']) ? sanitize_text_field(substr(trim($datos['nombre']), 0, 100)) : '';
    $resultado = $wpdb->insert(
        $wpdb->prefix . 'cpp_clases',
        [
            'user_id' => $user_id,
            'nombre' => $nombre_clase,
            'color' => preg_match('/^#[a-f0-9]{6}$/i', $datos['color']) ? $datos['color'] : '#2962FF',
            'base_nota_final' => $base_nota_final
        ],
        ['%d', '%s', '%s', '%f'] 
    );
    if($resultado) {
        $nueva_clase_id = $wpdb->insert_id;
        cpp_crear_evaluacion($nueva_clase_id, $user_id, 'Evaluación General');
        return $nueva_clase_id;
    }
    return false;
}

function cpp_actualizar_orden_clases($user_id, $clases_ids_ordenadas) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    if (!is_array($clases_ids_ordenadas)) {
        return false;
    }
    $success = true;
    foreach ($clases_ids_ordenadas as $index => $clase_id) {
        $clase_id_sanitizada = intval($clase_id);
        $orden_nuevo = intval($index);
        $resultado_update = $wpdb->update(
            $tabla_clases,
            ['orden' => $orden_nuevo],
            ['id' => $clase_id_sanitizada, 'user_id' => $user_id],
            ['%d'],  
            ['%d', '%d']
        );
        if ($resultado_update === false) {
            $success = false;
        }
    }
    return $success;
}

function cpp_eliminar_clase_y_alumnos($clase_id, $user_id) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $tabla_alumnos = $wpdb->prefix . 'cpp_alumnos';
    $tabla_categorias_evaluacion = $wpdb->prefix . 'cpp_categorias_evaluacion';
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $tabla_actividades = $wpdb->prefix . 'cpp_actividades_evaluables';
    $tabla_calificaciones = $wpdb->prefix . 'cpp_calificaciones_alumnos';
    $tabla_asistencia = $wpdb->prefix . 'cpp_asistencia';
    $clase_a_eliminar = $wpdb->get_row( $wpdb->prepare("SELECT user_id FROM $tabla_clases WHERE id = %d", $clase_id) );
    if (!$clase_a_eliminar || $clase_a_eliminar->user_id != $user_id) { return false; }
    
    // Eliminar dependencias en cascada
    $actividades_ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM $tabla_actividades WHERE clase_id = %d", $clase_id));
    if (!empty($actividades_ids)) {
        $placeholders = implode(', ', array_fill(0, count($actividades_ids), '%d'));
        $wpdb->query($wpdb->prepare("DELETE FROM $tabla_calificaciones WHERE actividad_id IN ($placeholders)", $actividades_ids));
    }
    $wpdb->delete($tabla_actividades, ['clase_id' => $clase_id], ['%d']);

    // Obtener todas las evaluaciones asociadas a la clase
    $evaluaciones_ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM $tabla_evaluaciones WHERE clase_id = %d", $clase_id));

    if (!empty($evaluaciones_ids)) {
        // Crear placeholders para la consulta IN ()
        $placeholders_evaluaciones = implode(', ', array_fill(0, count($evaluaciones_ids), '%d'));

        // Eliminar categorías asociadas a esas evaluaciones
        $wpdb->query($wpdb->prepare("DELETE FROM $tabla_categorias_evaluacion WHERE evaluacion_id IN ($placeholders_evaluaciones)", $evaluaciones_ids));
    }

    // Eliminar las evaluaciones de la clase
    $wpdb->delete($tabla_evaluaciones, ['clase_id' => $clase_id], ['%d']);

    // Eliminar registros de asistencia
    $wpdb->delete($tabla_asistencia, ['clase_id' => $clase_id], ['%d']);
    cpp_eliminar_todos_alumnos_clase($clase_id, $user_id); 
    $clase_eliminada = $wpdb->delete($tabla_clases, ['id' => $clase_id, 'user_id' => $user_id], ['%d', '%d']);
    return $clase_eliminada;
}

function cpp_crear_clase_de_ejemplo_completa($user_id) {
    global $wpdb;

    // 1. Crear la clase de ejemplo
    $clase_id = cpp_guardar_clase($user_id, [
        'nombre' => 'Clase Ejemplo',
        'color' => '#cd18be',
        'base_nota_final' => 10.00
    ]);

    if (!$clase_id) {
        return false; // No se pudo crear la clase
    }

    // Eliminar la evaluación "General" que se crea por defecto
    $tabla_evaluaciones = $wpdb->prefix . 'cpp_evaluaciones';
    $wpdb->delete($tabla_evaluaciones, ['clase_id' => $clase_id, 'nombre_evaluacion' => 'Evaluación General']);


    // 2. Crear alumnos de ejemplo
    $alumnos = [
        ['nombre' => 'Juan', 'apellidos' => 'García Pérez'], ['nombre' => 'María', 'apellidos' => 'Fernández López'],
        ['nombre' => 'Carlos', 'apellidos' => 'Martínez Sánchez'], ['nombre' => 'Ana', 'apellidos' => 'Ruiz Gómez'],
        ['nombre' => 'David', 'apellidos' => 'Jiménez Hernández'], ['nombre' => 'Laura', 'apellidos' => 'Vázquez Romero'],
        ['nombre' => 'Javier', 'apellidos' => 'Moreno Navarro'], ['nombre' => 'Sofía', 'apellidos' => 'Iglesias Castillo'],
        ['nombre' => 'Pablo', 'apellidos' => 'Ortega Rubio'], ['nombre' => 'Elena', 'apellidos' => 'Molina Serrano'],
        ['nombre' => 'Miguel', 'apellidos' => 'Reyes Gil'], ['nombre' => 'Lucía', 'apellidos' => 'Santos Cabrera'],
        ['nombre' => 'Adrián', 'apellidos' => 'Domínguez Torres'], ['nombre' => 'Paula', 'apellidos' => 'Vega Ríos'],
        ['nombre' => 'Diego', 'apellidos' => 'Blanco Soler']
    ];
    $alumnos_ids = [];
    foreach ($alumnos as $alumno) {
        $alumno_id = cpp_guardar_alumno($clase_id, $alumno);
        if ($alumno_id) {
            $alumnos_ids[] = $wpdb->insert_id;
        }
    }

    // 3. Crear 3 evaluaciones con categorías y actividades
    $evaluaciones = [
        '1ª Evaluación' => [
            'categorias' => [
                ['nombre' => 'Exámenes', 'porcentaje' => 70],
                ['nombre' => 'Tareas', 'porcentaje' => 30]
            ],
            'actividades' => [
                'Exámenes' => [['nombre' => 'Examen Tema 1', 'nota_maxima' => 10], ['nombre' => 'Examen Tema 2', 'nota_maxima' => 10]],
                'Tareas' => [['nombre' => 'Tarea Volcanes', 'nota_maxima' => 10], ['nombre' => 'Tarea Ríos de España', 'nota_maxima' => 10], ['nombre' => 'Redacción: El Quijote', 'nota_maxima' => 10]]
            ]
        ],
        '2ª Evaluación' => [
            'categorias' => [
                ['nombre' => 'Exámenes', 'porcentaje' => 70],
                ['nombre' => 'Tareas', 'porcentaje' => 30]
            ],
            'actividades' => [
                'Exámenes' => [['nombre' => 'Examen Tema 3', 'nota_maxima' => 10], ['nombre' => 'Examen Tema 4', 'nota_maxima' => 10]],
                'Tareas' => [['nombre' => 'Tarea Sistema Solar', 'nota_maxima' => 10], ['nombre' => 'Tarea II Guerra Mundial', 'nota_maxima' => 10]]
            ]
        ],
        '3ª Evaluación' => [
            'categorias' => [
                ['nombre' => 'Exámenes', 'porcentaje' => 60],
                ['nombre' => 'Proyecto Final', 'porcentaje' => 40]
            ],
            'actividades' => [
                'Exámenes' => [['nombre' => 'Examen Final', 'nota_maxima' => 10]],
                'Proyecto Final' => [['nombre' => 'Proyecto de Investigación', 'nota_maxima' => 10]]
            ]
        ]
    ];

    foreach ($evaluaciones as $nombre_eval => $data) {
        $evaluacion_id = cpp_crear_evaluacion($clase_id, $user_id, $nombre_eval);
        if (!$evaluacion_id) continue;

        // Actualizar el modo de cálculo a 'ponderada'
        $wpdb->update(
            $wpdb->prefix . 'cpp_evaluaciones',
            ['calculo_nota' => 'ponderada'],
            ['id' => $evaluacion_id]
        );

        $categorias_ids = [];
        foreach ($data['categorias'] as $cat) {
            $categoria_id = cpp_guardar_categoria_evaluacion($evaluacion_id, $user_id, $cat['nombre'], $cat['porcentaje']);
            if ($categoria_id) {
                $categorias_ids[$cat['nombre']] = $categoria_id;
            }
        }

        foreach ($data['actividades'] as $nombre_cat => $actividades) {
            if (!isset($categorias_ids[$nombre_cat])) continue;
            $categoria_id_actual = $categorias_ids[$nombre_cat];

            foreach ($actividades as $act) {
                $actividad_id = cpp_guardar_actividad_evaluable([
                    'clase_id' => $clase_id,
                    'evaluacion_id' => $evaluacion_id,
                    'categoria_id' => $categoria_id_actual,
                    'nombre_actividad' => $act['nombre'],
                    'nota_maxima' => $act['nota_maxima'],
                    'user_id' => $user_id
                ]);

                if ($actividad_id) {
                    foreach ($alumnos_ids as $alumno_id) {
                        $nota = round(max(0, min($act['nota_maxima'], $act['nota_maxima'] * (rand(40, 98) / 100))), 2);
                        cpp_guardar_o_actualizar_calificacion($alumno_id, $actividad_id, $nota, $user_id);
                    }
                }
            }
        }
    }

    return $clase_id;
}