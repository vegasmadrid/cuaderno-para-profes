<?php
defined('ABSPATH') or die('Acceso no permitido');

// Incluir el autoloader de PhpSpreadsheet
// Este archivo se encarga de la EXPORTACIÓN de datos del cuaderno, no de la plantilla de importación.
if (file_exists(CPP_PLUGIN_DIR . 'lib/vendor/autoload.php')) {
    require_once CPP_PLUGIN_DIR . 'lib/vendor/autoload.php';
} else {
    // Manejo de error si la librería no existe
    if (current_user_can('manage_options')) {
        wp_die('Error Crítico: La librería PhpSpreadsheet no se encuentra en la ruta esperada (lib/vendor/autoload.php) para la exportación. Por favor, asegúrate de que se ha instalado y subido correctamente.');
    }
    error_log('Error crítico en el plugin Cuaderno para Profesores (excel-export.php): Librería PhpSpreadsheet no encontrada en lib/vendor/autoload.php.');
    return;
}

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Font;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

/**
 * Función principal para generar y descargar el archivo Excel CON DATOS DEL CUADERNO.
 * Esta función es llamada por la acción cpp_trigger_excel_download_handler.
 */
function cpp_generate_excel_for_download($user_id, $clase_id_para_exportar = null, $download_type = 'single_class', $filename = 'cuaderno_exportado.xlsx', $evaluacion_id = null) {
    
    // Verificación de permisos básicos
    if (!is_user_logged_in() || get_current_user_id() != $user_id) {
        wp_die('No tienes permiso para realizar esta acción.');
    }

    $spreadsheet = new Spreadsheet();
    $spreadsheet->getProperties()
        ->setCreator("Cuaderno para Profesores Plugin")
        ->setLastModifiedBy(wp_get_current_user()->display_name)
        ->setTitle("Exportación de Cuaderno de Notas")
        ->setSubject("Datos de Clases y Alumnos");

    if ($download_type === 'single_class' && !empty($clase_id_para_exportar)) {
        // --- Lógica para exportar una sola clase ---
        $clase_info = cpp_obtener_clase_completa_por_id($clase_id_para_exportar, $user_id);
        if (!$clase_info) {
            wp_die('Clase no encontrada o no tienes permiso sobre ella.');
        }
        if (empty($evaluacion_id)) {
            wp_die('ID de evaluación no proporcionado para la exportación de una sola clase.');
        }

        $sheet = $spreadsheet->getActiveSheet();
        cpp_populate_sheet_with_class_data($sheet, $clase_info, $user_id, $evaluacion_id);

        $sheet_name = substr(preg_replace('/[\\\\\/\?\*\[\]:]/', '', $clase_info['nombre']), 0, 31);
        $sheet->setTitle($sheet_name ?: 'Clase');

    } elseif ($download_type === 'all_classes') {
        // --- Lógica para exportar todas las clases del usuario ---
        $clases = cpp_obtener_clases_usuario($user_id);
        if (empty($clases)) {
            wp_die('No tienes clases para exportar.');
        }

        $sheet_index = 0;
        foreach ($clases as $clase_info_loop) {
            // Para cada clase, obtener su primera evaluación como la predeterminada para exportar
            $primera_evaluacion = cpp_obtener_primera_evaluacion_clase($clase_info_loop['id'], $user_id);
            if (!$primera_evaluacion) continue; // Si no tiene evaluaciones, se salta

            if ($sheet_index > 0) {
                $spreadsheet->createSheet();
            }
            $sheet = $spreadsheet->getSheet($sheet_index);

            cpp_populate_sheet_with_class_data($sheet, $clase_info_loop, $user_id, $primera_evaluacion['id']);

            $sheet_name = substr(preg_replace('/[\\\\\/\?\*\[\]:]/', '', $clase_info_loop['nombre']), 0, 31);
            $sheet->setTitle($sheet_name ?: ('Clase ' . ($sheet_index + 1)));
            $sheet_index++;
        }

        if ($spreadsheet->getSheetCount() === 0) {
            wp_die('Ninguna de tus clases tiene evaluaciones para poder exportar.');
        }
        $spreadsheet->setActiveSheetIndex(0);

    } else {
        wp_die('Tipo de descarga no válido.');
    }

    // --- Envío del archivo al navegador ---

    // Limpiar cualquier salida de buffer anterior para evitar errores
    if (ob_get_level()) {
        ob_end_clean();
    }

    // Enviar las cabeceras HTTP para forzar la descarga
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment;filename="' . $filename . '"');
    header('Cache-Control: max-age=0');

    // Crear el "escritor" de Excel y enviarlo directamente a la salida del navegador
    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');

    // Terminar la ejecución del script inmediatamente para evitar contenido extra.
    exit;
}


/**
 * Función auxiliar para rellenar una hoja de Excel con los datos de una clase.
 * (Esta función es usada por cpp_generate_excel_for_download)
 * Se ha eliminado el parámetro no usado $id_curso.
 */
function cpp_populate_sheet_with_class_data(&$sheet, $clase_info_array, $user_id, $id_evaluacion) {

    $clase_id = $clase_info_array['id'];
    $nombre_clase = $clase_info_array['nombre'];
    $base_nota_final_clase = isset($clase_info_array['base_nota_final']) ? floatval($clase_info_array['base_nota_final']) : 100.00;
    if ($base_nota_final_clase <= 0) $base_nota_final_clase = 100.00;

    $alumnos = cpp_obtener_alumnos_clase($clase_id); 
    // Asegurarse de que $id_evaluacion no sea nulo antes de usarlo
    $actividades = $id_evaluacion ? cpp_obtener_actividades_por_clase($clase_id, $user_id, $id_evaluacion) : [];
    $calificaciones_raw = $id_evaluacion ? cpp_obtener_calificaciones_cuaderno($clase_id, $user_id, $id_evaluacion) : [];

    // Estilos (sin cambios)
    $header_font_style = ['bold' => true, 'color' => ['rgb' => 'FFFFFF']];
    $header_fill_style = ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '4A86E8']]; 
    $header_alignment_style = ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER];
    $cell_border_style = ['borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'BFBFBF']]]];
    
    $sheet->setCellValue('A1', 'Clase: ' . $nombre_clase);
    $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(16);
    $sheet->mergeCells('A1:D1'); 

    $col_index = 1;
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col_index) . '3', 'Alumno/a');
    $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($col_index))->setAutoSize(true);
    
    // Rellenar cabeceras de actividades
    if (!empty($actividades)) {
        foreach ($actividades as $act) {
            $col_index++;
            $header_text = $act['nombre_actividad'] . "\n" .
                           '(' . ($act['nombre_categoria'] ?: 'Sin Cat.') . ' / ' . cpp_formatear_nota_display($act['nota_maxima']) . ')';
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col_index) . '3', $header_text);
            $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($col_index))->setWidth(18);
            $sheet->getStyle(Coordinate::stringFromColumnIndex($col_index) . '3')->getAlignment()->setWrapText(true);
        }
    }

    $col_index++;
    $col_final_nota_char = Coordinate::stringFromColumnIndex($col_index);
    $sheet->setCellValue($col_final_nota_char . '3', 'Nota Final' . "\n" . '(sobre ' . cpp_formatear_nota_display($base_nota_final_clase, ($base_nota_final_clase == floor($base_nota_final_clase) ? 0 : 2)) . ')');
    $sheet->getColumnDimension($col_final_nota_char)->setAutoSize(true);
    $sheet->getStyle($col_final_nota_char . '3')->getAlignment()->setWrapText(true);

    $header_range = 'A3:' . $col_final_nota_char . '3';
    $sheet->getStyle($header_range)->getFont()->applyFromArray($header_font_style);
    $sheet->getStyle($header_range)->getFill()->applyFromArray($header_fill_style);
    $sheet->getStyle($header_range)->getAlignment()->applyFromArray($header_alignment_style);
    $sheet->getStyle($header_range)->applyFromArray($cell_border_style); 
    $sheet->getRowDimension('3')->setRowHeight(45); 

    // Rellenar datos de alumnos y calificaciones
    $current_row_excel = 4;
    if (!empty($alumnos)) {
        foreach ($alumnos as $alumno) {
            $col_index_data = 1;
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col_index_data) . $current_row_excel, $alumno['apellidos'] . ', ' . $alumno['nombre']);
            $sheet->getStyle(Coordinate::stringFromColumnIndex($col_index_data) . $current_row_excel)->getFont()->setBold(true);

            if (!empty($actividades)) {
                foreach ($actividades as $act) {
                    $col_index_data++;
                    $nota_actividad_raw = isset($calificaciones_raw[$alumno['id']][$act['id']]) ? $calificaciones_raw[$alumno['id']][$act['id']] : null;
                    if (is_numeric($nota_actividad_raw)) {
                        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col_index_data) . $current_row_excel, floatval($nota_actividad_raw));
                        $sheet->getStyle(Coordinate::stringFromColumnIndex($col_index_data) . $current_row_excel)->getNumberFormat()->setFormatCode('0.00');
                    } else {
                        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col_index_data) . $current_row_excel, '');
                    }
                    $sheet->getStyle(Coordinate::stringFromColumnIndex($col_index_data) . $current_row_excel)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                }
            }

            // Calcular nota final (requiere el ID de evaluación)
            $nota_final_0_100 = $id_evaluacion ? cpp_calcular_nota_final_alumno($alumno['id'], $clase_id, $user_id, $id_evaluacion) : 0;
            $nota_final_reescalada = ($nota_final_0_100 / 100) * $base_nota_final_clase;
            
            $sheet->setCellValue($col_final_nota_char . $current_row_excel, $nota_final_reescalada);
            $sheet->getStyle($col_final_nota_char . $current_row_excel)->getNumberFormat()->setFormatCode('0.00'); 
            $sheet->getStyle($col_final_nota_char . $current_row_excel)->getFont()->setBold(true);
            $sheet->getStyle($col_final_nota_char . $current_row_excel)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            
            $current_row_excel++;
        }
        if ($current_row_excel > 4) {
            $data_range = 'A4:' . $col_final_nota_char . ($current_row_excel - 1);
            $sheet->getStyle($data_range)->applyFromArray($cell_border_style);
        }
    } else {
        $sheet->setCellValue('A' . $current_row_excel, 'No hay alumnos en esta clase.');
        $sheet->mergeCells('A' . $current_row_excel . ':' . $col_final_nota_char . $current_row_excel);
        $sheet->getStyle('A' . $current_row_excel)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    }
}

// NO DEBE HABER NINGUNA OTRA FUNCIÓN DEFINIDA AQUÍ, especialmente cpp_handle_student_template_download