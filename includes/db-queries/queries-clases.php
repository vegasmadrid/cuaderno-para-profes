<?php
// /includes/db-queries/queries-clases.php

defined('ABSPATH') or die('Acceso no permitido');

// --- FUNCIONES PARA CLASES ---

function cpp_obtener_clase_completa_por_id($clase_id, $user_id) {
    global $wpdb;
    $tabla_clases = $wpdb->prefix . 'cpp_clases';
    $clase_data = $wpdb->get_row(
        $wpdb->prepare(
            "SELECT id, user_id, nombre, color, base_nota_final, nota_aprobado, orden, fecha_creacion FROM $tabla_clases WHERE id = %d AND user_id = %d",
            $clase_id,
            $user_id
        ),
        ARRAY_A 
    );

    if ($clase_data) {
        // Incluir las evaluaciones directamente en los datos de la clase
        $clase_data['evaluaciones'] = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
    }

    return $clase_data;
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
        if ($base_nota > .0) {
            $update_data['base_nota_final'] = $base_nota;
            $update_formats[] = '%f';
        }
    }
    if (isset($datos['nota_aprobado'])) {
        $nota_aprobado = floatval(str_replace(',', '.', $datos['nota_aprobado']));
        if ($nota_aprobado >= 0) {
            $update_data['nota_aprobado'] = $nota_aprobado;
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
    $nota_aprobado = isset($datos['nota_aprobado']) ? floatval(str_replace(',', '.', $datos['nota_aprobado'])) : $base_nota_final / 2;
    if ($nota_aprobado < 0) $nota_aprobado = $base_nota_final / 2;

    $nombre_clase = isset($datos['nombre']) ? sanitize_text_field(substr(trim($datos['nombre']), 0, 100)) : '';
    $resultado = $wpdb->insert(
        $wpdb->prefix . 'cpp_clases',
        [
            'user_id' => $user_id,
            'nombre' => $nombre_clase,
            'color' => preg_match('/^#[a-f0-9]{6}$/i', $datos['color']) ? $datos['color'] : '#2962FF',
            'base_nota_final' => $base_nota_final,
            'nota_aprobado' => $nota_aprobado
        ],
        ['%d', '%s', '%s', '%f', '%f']
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

function cpp_crear_clase_de_ejemplo_completa($user_id, $nombre_clase = 'Clase Ejemplo', $color = '#cd18be') {
    global $wpdb;

    // 1. Crear la clase de ejemplo
    $clase_id = cpp_guardar_clase($user_id, [
        'nombre' => $nombre_clase,
        'color' => $color,
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
    foreach ($alumnos as $alumno_data) {
        $unique_slug = sanitize_title($alumno_data['nombre'] . ' ' . $alumno_data['apellidos']);
        $alumno_data['foto'] = 'https://api.dicebear.com/8.x/adventurer/svg?seed=' . $unique_slug;
        $resultado = cpp_guardar_alumno($clase_id, $alumno_data);
        if ($resultado) {
            $alumnos_ids[] = $wpdb->insert_id;
        }
    }

    // 4. Crear historial de asistencia para el último año
    $fecha_actual = new DateTime();
    $fecha_inicio = (new DateTime())->modify('-3 months'); // Simular 3 meses de historial
    $intervalo = new DateInterval('P1D');
    $periodo = new DatePeriod($fecha_inicio, $intervalo, $fecha_actual);
    $estados_posibles = ['presente', 'ausente', 'retraso', 'justificado'];

    foreach ($periodo as $fecha) {
        // Omitir fines de semana
        if ($fecha->format('N') >= 6) {
            continue;
        }

        $asistencias_dia = [];
        foreach ($alumnos_ids as $alumno_id) {
            // 95% de probabilidad de estar presente
            $estado = (rand(1, 100) <= 95) ? 'presente' : $estados_posibles[rand(1, 3)];

            // No es necesario guardar los presentes si ese es el estado por defecto,
            // pero lo guardamos para que el ejemplo sea explícito.
            $asistencias_dia[] = [
                'alumno_id' => $alumno_id,
                'estado' => $estado,
                'observaciones' => ''
            ];
        }

        if (!empty($asistencias_dia)) {
            cpp_guardar_asistencia_multiple($user_id, $clase_id, $fecha->format('Y-m-d'), $asistencias_dia);
        }
    }

    // 3. Crear 3 evaluaciones con categorías y actividades
    $pastel_colors = ['#F08080', '#ADD8E6', '#98FB98', '#FFDAB9', '#E6E6FA', '#D8BFD8'];
    $evaluaciones = [
        '1ª Evaluación' => [
            'categorias' => [
                ['nombre' => 'Exámenes', 'porcentaje' => 60, 'color' => $pastel_colors[0]],
                ['nombre' => 'Tareas', 'porcentaje' => 20, 'color' => $pastel_colors[1]],
                ['nombre' => 'Deberes', 'porcentaje' => 10, 'color' => $pastel_colors[2]],
                ['nombre' => 'Cuaderno', 'porcentaje' => 10, 'color' => $pastel_colors[3]],
            ],
            'actividades' => [
                'Exámenes' => [
                    ['nombre' => 'Examen T.1: La Hidrosfera', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-2 month')), 'desc' => 'Evaluación de los conceptos sobre el ciclo del agua.'],
                    ['nombre' => 'Examen T.2: La Atmósfera', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-1 month')), 'desc' => 'Prueba sobre las capas de la atmósfera y los fenómenos meteorológicos.'],
                    ['nombre' => 'Prueba Corta Sorpresa', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-1 month -15 days')), 'desc' => 'Test rápido sobre los últimos conceptos vistos en clase.'],
                    ['nombre' => 'Examen Oral T.1-2', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-10 days')), 'desc' => 'Exposición oral de los temas 1 y 2.'],
                ],
                'Tareas' => [
                    ['nombre' => 'Maqueta: El Volcán', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-2 month +7 days')), 'desc' => 'Construcción de un modelo a escala de un volcán en erupción.'],
                    ['nombre' => 'Mapa: Ríos de España', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-1 month +12 days')), 'desc' => 'Elaboración de un mapa físico con los principales ríos de la península.'],
                    ['nombre' => 'Redacción: El Quijote', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-2 month -5 days')), 'desc' => 'Análisis y resumen del primer capítulo de Don Quijote.'],
                    ['nombre' => 'Infografía: Ciclo del Agua', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-2 month -15 days')), 'desc' => 'Creación de una infografía visual sobre el ciclo del agua.'],
                ],
                'Deberes' => [
                    ['nombre' => 'Ejercicios Pág. 25', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-2 month -20 days')), 'desc' => 'Resolución de los ejercicios 1, 2 y 3 del libro de texto.'],
                    ['nombre' => 'Ejercicios Pág. 32', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-2 month -10 days')), 'desc' => 'Resolución de los ejercicios 4 y 5 del libro de texto.'],
                    ['nombre' => 'Búsqueda de Información', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-1 month -20 days')), 'desc' => 'Investigación sobre los tipos de nubes.'],
                    ['nombre' => 'Ver Documental y Resumir', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-1 month -10 days')), 'desc' => 'Visualización del documental "Cosmos" y entrega de un resumen.'],
                ],
                'Cuaderno' => [
                    ['nombre' => 'Revisión de Septiembre', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-3 month')), 'desc' => 'Revisión de la presentación y organización del cuaderno.'],
                    ['nombre' => 'Revisión de Octubre', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-2 month')), 'desc' => 'Revisión de la limpieza, orden y contenido del cuaderno.'],
                    ['nombre' => 'Revisión de Noviembre', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-1 month')), 'desc' => 'Revisión final del cuaderno de la evaluación.'],
                    ['nombre' => 'Autoevaluación del Cuaderno', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('-5 days')), 'desc' => 'El alumno evalúa su propio cuaderno siguiendo una rúbrica.'],
                ],
            ]
        ],
        '2ª Evaluación' => [
            'categorias' => [
                ['nombre' => 'Exámenes', 'porcentaje' => 60, 'color' => $pastel_colors[0]],
                ['nombre' => 'Tareas', 'porcentaje' => 20, 'color' => $pastel_colors[1]],
                ['nombre' => 'Deberes', 'porcentaje' => 10, 'color' => $pastel_colors[2]],
                ['nombre' => 'Cuaderno', 'porcentaje' => 10, 'color' => $pastel_colors[3]],
            ],
            'actividades' => [
                'Exámenes' => [
                    ['nombre' => 'Examen T.3: La Geosfera', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+1 month')), 'desc' => 'Prueba sobre las capas de la Tierra y sus componentes.'],
                    ['nombre' => 'Examen T.4: El Universo', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+2 month')), 'desc' => 'Evaluación de los conocimientos sobre el sistema solar y las galaxias.'],
                    ['nombre' => 'Prueba Práctica: Rocas', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+1 month +15 days')), 'desc' => 'Identificación de diferentes tipos de rocas y minerales.'],
                    ['nombre' => 'Debate: Vida Extraterrestre', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+2 month +10 days')), 'desc' => 'Participación en un debate sobre la posibilidad de vida en otros planetas.'],
                ],
                'Tareas' => [
                    ['nombre' => 'Presentación: Planetas', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+1 month +5 days')), 'desc' => 'Creación de una presentación de diapositivas sobre un planeta asignado.'],
                    ['nombre' => 'Línea de Tiempo: Big Bang', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+2 month -10 days')), 'desc' => 'Elaboración de una línea de tiempo desde el Big Bang hasta la actualidad.'],
                    ['nombre' => 'Biografía: Marie Curie', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+1 month -5 days')), 'desc' => 'Investigación y redacción de una biografía sobre Marie Curie.'],
                    ['nombre' => 'Póster: Constelaciones', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+2 month +5 days')), 'desc' => 'Diseño de un póster informativo sobre una constelación.'],
                ],
                 'Deberes' => [
                    ['nombre' => 'Ejercicios Pág. 45', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+20 days')), 'desc' => 'Resolución de los ejercicios sobre la tectónica de placas.'],
                    ['nombre' => 'Ejercicios Pág. 52', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+1 month +10 days')), 'desc' => 'Ejercicios de cálculo de distancias astronómicas.'],
                    ['nombre' => 'Artículo de Opinión', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+1 month +20 days')), 'desc' => 'Redacción sobre la importancia de la exploración espacial.'],
                    ['nombre' => 'Cuestionario Online', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+2 month')), 'desc' => 'Completar el cuestionario de repaso del tema 4.'],
                ],
                'Cuaderno' => [
                    ['nombre' => 'Revisión de Enero', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+1 month')), 'desc' => 'Revisión de la presentación y organización del cuaderno.'],
                    ['nombre' => 'Revisión de Febrero', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+2 month')), 'desc' => 'Revisión de la limpieza, orden y contenido del cuaderno.'],
                    ['nombre' => 'Revisión de Marzo', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+3 month')), 'desc' => 'Revisión final del cuaderno de la evaluación.'],
                    ['nombre' => 'Autoevaluación del Cuaderno', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+3 month +5 days')), 'desc' => 'El alumno evalúa su propio cuaderno siguiendo una rúbrica.'],
                ],
            ]
        ],
        '3ª Evaluación' => [
            'categorias' => [
                ['nombre' => 'Proyecto Final', 'porcentaje' => 50, 'color' => $pastel_colors[4]],
                ['nombre' => 'Examen Final', 'porcentaje' => 40, 'color' => $pastel_colors[0]],
                ['nombre' => 'Participación', 'porcentaje' => 10, 'color' => $pastel_colors[5]],
            ],
             'actividades' => [
                'Proyecto Final' => [
                    ['nombre' => 'Entrega 1: Propuesta', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+3 month +15 days')), 'desc' => 'Presentación de la propuesta del proyecto final.'],
                    ['nombre' => 'Entrega 2: Desarrollo', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+4 month')), 'desc' => 'Entrega de la parte principal del proyecto.'],
                    ['nombre' => 'Entrega 3: Borrador Final', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+4 month +15 days')), 'desc' => 'Revisión del borrador antes de la entrega final.'],
                    ['nombre' => 'Defensa del Proyecto', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+5 month')), 'desc' => 'Exposición y defensa oral del proyecto final ante la clase.'],
                ],
                'Examen Final' => [
                    ['nombre' => 'Examen Final Teórico', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+5 month +10 days')), 'desc' => 'Prueba escrita que abarca todo el temario del curso.'],
                    ['nombre' => 'Examen Final Práctico', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+5 month +12 days')), 'desc' => 'Resolución de un caso práctico aplicando los conocimientos adquiridos.'],
                    ['nombre' => 'Repaso General 1', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+4 month +20 days')), 'desc' => 'Actividad de repaso de la primera mitad del temario.'],
                    ['nombre' => 'Repaso General 2', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+5 month')), 'desc' => 'Actividad de repaso de la segunda mitad del temario.'],
                ],
                'Participación' => [
                    ['nombre' => 'Debate 1', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+3 month +20 days')), 'desc' => 'Evaluación de la participación en el primer debate.'],
                    ['nombre' => 'Debate 2', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+4 month +10 days')), 'desc' => 'Evaluación de la participación en el segundo debate.'],
                    ['nombre' => 'Actitud y Esfuerzo', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+5 month +15 days')), 'desc' => 'Valoración global de la actitud y el esfuerzo durante la evaluación.'],
                    ['nombre' => 'Ayuda a Compañeros', 'nota_maxima' => 10, 'fecha' => date('Y-m-d', strtotime('+5 month +15 days')), 'desc' => 'Valoración del trabajo en equipo y la ayuda a los compañeros.'],
                ],
            ]
        ]
    ];

    foreach ($evaluaciones as $nombre_eval => $data) {
        $evaluacion_id = cpp_crear_evaluacion($clase_id, $user_id, $nombre_eval);
        if (!$evaluacion_id) continue;

        $wpdb->update($wpdb->prefix . 'cpp_evaluaciones', ['calculo_nota' => 'ponderada'], ['id' => $evaluacion_id]);

        $categorias_ids = [];
        foreach ($data['categorias'] as $cat) {
            $categoria_id = cpp_guardar_categoria_evaluacion($evaluacion_id, $user_id, $cat['nombre'], $cat['porcentaje'], $cat['color']);
            if ($categoria_id) {
                $categorias_ids[$cat['nombre']] = $categoria_id;
            }
        }

        foreach ($data['actividades'] as $nombre_cat => $actividades) {
            if (!isset($categorias_ids[$nombre_cat])) continue;
            $categoria_id_actual = $categorias_ids[$nombre_cat];

            foreach ($actividades as $act) {
                $actividad_id = cpp_guardar_actividad_evaluable([
                    'clase_id' => $clase_id, 'evaluacion_id' => $evaluacion_id, 'categoria_id' => $categoria_id_actual,
                    'nombre_actividad' => $act['nombre'], 'nota_maxima' => $act['nota_maxima'],
                    'fecha_actividad' => $act['fecha'], 'descripcion_actividad' => $act['desc'], 'user_id' => $user_id
                ]);

                if ($actividad_id) {
                    // Designar a 2 alumnos para que tengan notas más bajas
                    $alumnos_suspensos_ids = array_slice($alumnos_ids, 0, 2);

                    foreach ($alumnos_ids as $alumno_id) {
                        if (in_array($alumno_id, $alumnos_suspensos_ids)) {
                            // Generar notas más bajas para los alumnos suspensos (entre 1.0 y 4.5)
                            $nota = round(max(0, min($act['nota_maxima'], $act['nota_maxima'] * (rand(10, 45) / 100))), 2);
                        } else {
                            // Generar notas de aprobado para el resto (entre 5.0 y 9.8)
                            $nota = round(max(0, min($act['nota_maxima'], $act['nota_maxima'] * (rand(50, 98) / 100))), 2);
                        }
                        cpp_guardar_o_actualizar_calificacion($alumno_id, $actividad_id, $nota, $user_id);
                    }
                }
            }
        }
    }

    return $clase_id;
}