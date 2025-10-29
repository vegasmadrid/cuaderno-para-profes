<?php
// /includes/ajax-handlers/ajax-resumen.php

defined('ABSPATH') or die('Acceso no permitido');

// Incluir los ficheros de consultas necesarios
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-clases.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-alumnos.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-evaluaciones.php';
require_once CPP_PLUGIN_DIR . 'includes/db-queries/queries-calculos.php';


add_action('wp_ajax_cpp_get_resumen_data', 'cpp_ajax_get_resumen_data');

function cpp_ajax_get_resumen_data()
{
    // Verificar nonce y permisos de usuario
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Acceso no autorizado.'], 403);
    }
    $user_id = get_current_user_id();
    global $wpdb;

    // 1. Obtener todas las clases del usuario
    $clases = cpp_obtener_clases_usuario($user_id);
    if (empty($clases)) {
        wp_send_json_success([
            'alumnosSuspensos' => [],
            'rankingClases' => [],
            'estadisticasAdicionales' => ['totalAlumnos' => 0, 'promedioGeneral' => 0, 'tasaAprobados' => 0],
            'distribucionNotas' => [0, 0, 0, 0, 0],
        ]);
    }

    $alumnosSuspensos = [];
    $rankingClases = [];
    $totalAlumnos = 0;
    $sumaNotasGlobal = 0;
    $totalNotasComputadas = 0;
    $totalAprobados = 0;
    $distribucionNotas = [
        'sobresaliente' => 0,
        'notable' => 0,
        'bien' => 0,
        'suficiente' => 0,
        'insuficiente' => 0,
    ];

    foreach ($clases as $clase) {
        $clase_id = $clase['id'];
        $nota_aprobado = isset($clase['nota_aprobado']) ? floatval($clase['nota_aprobado']) : 50.0;

        // 2. Obtener los alumnos de la clase
        $alumnos = cpp_obtener_alumnos_por_clase($clase_id, $user_id);
        $totalAlumnos += count($alumnos);

        if (empty($alumnos)) {
            $rankingClases[] = ['nombre' => $clase['nombre'], 'notaMedia' => 0, 'tasaAprobados' => 0];
            continue;
        }

        $sumaNotasClase = 0;
        $alumnosConNota = 0;
        $aprobadosClase = 0;

        // 3. Obtener todas las evaluaciones de la clase
        $evaluaciones = cpp_obtener_evaluaciones_por_clase($clase_id, $user_id);
        if (empty($evaluaciones)) {
            $rankingClases[] = ['nombre' => $clase['nombre'], 'notaMedia' => 0, 'tasaAprobados' => 0];
            continue;
        }

        foreach ($alumnos as $alumno) {
            $sumaNotasAlumno = 0;
            $evaluacionesConNota = 0;

            foreach ($evaluaciones as $evaluacion) {
                // 4. Calcular la nota final del alumno en la evaluación
                $resultado_nota = cpp_calcular_nota_final_alumno($alumno['id'], $clase_id, $user_id, $evaluacion['id']);
                $nota_final_100 = $resultado_nota['nota'];

                if ($nota_final_100 !== null) {
                    $sumaNotasAlumno += $nota_final_100;
                    $evaluacionesConNota++;
                }
            }

            if ($evaluacionesConNota > 0) {
                $mediaAlumno = $sumaNotasAlumno / $evaluacionesConNota;
                $sumaNotasClase += $mediaAlumno;
                $sumaNotasGlobal += $mediaAlumno;
                $alumnosConNota++;
                $totalNotasComputadas++;

                if ($mediaAlumno < $nota_aprobado) {
                    $alumnosSuspensos[] = [
                        'nombre' => $alumno['nombre'],
                        'apellidos' => $alumno['apellidos'],
                        'clase' => $clase['nombre'],
                        'notaFinal' => $mediaAlumno,
                    ];
                } else {
                    $aprobadosClase++;
                    $totalAprobados++;
                }

                // Clasificar la nota para el gráfico de distribución
                if ($mediaAlumno >= 90) {
                    $distribucionNotas['sobresaliente']++;
                } elseif ($mediaAlumno >= 70) {
                    $distribucionNotas['notable']++;
                } elseif ($mediaAlumno >= 60) {
                    $distribucionNotas['bien']++;
                } elseif ($mediaAlumno >= 50) {
                    $distribucionNotas['suficiente']++;
                } else {
                    $distribucionNotas['insuficiente']++;
                }
            }
        }

        $notaMediaClase = ($alumnosConNota > 0) ? $sumaNotasClase / $alumnosConNota : 0;
        $tasaAprobadosClase = (count($alumnos) > 0) ? ($aprobadosClase / count($alumnos)) * 100 : 0;
        $rankingClases[] = ['nombre' => $clase['nombre'], 'notaMedia' => $notaMediaClase, 'tasaAprobados' => $tasaAprobadosClase];
    }

    // 5. Ordenar el ranking de clases
    usort($rankingClases, function ($a, $b) {
        return $b['notaMedia'] <=> $a['notaMedia'];
    });

    // 6. Calcular estadísticas adicionales
    $promedioGeneral = ($totalNotasComputadas > 0) ? $sumaNotasGlobal / $totalNotasComputadas : 0;
    $tasaAprobados = ($totalAlumnos > 0) ? ($totalAprobados / $totalAlumnos) * 100 : 0;

    $data = [
        'alumnosSuspensos' => $alumnosSuspensos,
        'rankingClases' => $rankingClases,
        'estadisticasAdicionales' => [
            'totalAlumnos' => $totalAlumnos,
            'promedioGeneral' => $promedioGeneral,
            'tasaAprobados' => $tasaAprobados,
        ],
        'distribucionNotas' => array_values($distribucionNotas),
    ];

    wp_send_json_success($data);
}
