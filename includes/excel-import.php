<?php
// /includes/excel-import.php
// --- REFACTORIZADO PARA IMPORTACIÓN GLOBAL DE ALUMNOS A MÚLTIPLES CLASES ---

defined('ABSPATH') or die('Acceso no permitido');

if (file_exists(CPP_PLUGIN_DIR . 'lib/vendor/autoload.php')) {
    require_once CPP_PLUGIN_DIR . 'lib/vendor/autoload.php';
} else {
    // Manejo de error si la librería no está
    return;
}

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Font;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

/**
 * Manejador para la descarga de la plantilla Excel de alumnos (versión global).
 */
function cpp_handle_student_template_download() {
    if (!isset($_REQUEST['nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_REQUEST['nonce'])), 'cpp_frontend_nonce')) {
        wp_die('Error de seguridad (nonce).');
    }
    if (!is_user_logged_in()) {
        wp_die('Usuario no autenticado.');
    }

    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Plantilla Alumnos');

    // Cabeceras
    $sheet->setCellValue('A1', 'Nombre');
    $sheet->setCellValue('B1', 'Apellidos');
    $sheet->setCellValue('C1', 'Clases (separadas por comas)');

    // Estilo
    $header_style_array = [
        'font' => ['bold' => true],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'D9EAD3']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]]
    ];
    $sheet->getStyle('A1:C1')->applyFromArray($header_style_array);
    $sheet->getColumnDimension('A')->setWidth(25);
    $sheet->getColumnDimension('B')->setWidth(35);
    $sheet->getColumnDimension('C')->setWidth(50);

    // Ejemplo e Instrucciones
    $sheet->setCellValue('A2', 'EjemploNombre');
    $sheet->setCellValue('B2', 'EjemploApellidos');
    $sheet->setCellValue('C2', 'Matemáticas 1ºA, Física y Química 1ºA');
    
    $sheet->setCellValue('A4', 'Instrucciones:');
    $sheet->getStyle('A4')->getFont()->setBold(true);
    $sheet->setCellValue('A5', '- Rellene Nombre y Apellidos.');
    $sheet->setCellValue('A6', '- En la columna "Clases", escriba los nombres exactos de las clases a las que pertenece el alumno, separados por comas.');
    $sheet->setCellValue('A7', '- Si deja la columna "Clases" vacía, el alumno se creará pero no se asignará a ninguna clase.');
    $sheet->setCellValue('A8', '- Si un nombre de clase no existe, será ignorado.');

    $filename = 'plantilla_importacion_global_alumnos.xlsx';

    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment;filename="' . $filename . '"');
    header('Cache-Control: max-age=0');

    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    wp_die();
}

/**
 * Manejador para la subida del archivo Excel de alumnos (sin cambios).
 */
function cpp_handle_student_excel_upload() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.'], 401);
    }
    if (empty($_FILES['student_excel_file'])) {
        wp_send_json_error(['message' => 'No se ha subido ningún archivo.'], 400);
    }
    $file = $_FILES['student_excel_file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        wp_send_json_error(['message' => 'Error durante la subida: ' . $file['error']], 400);
    }
    if (!function_exists('wp_handle_upload')) {
        require_once(ABSPATH . 'wp-admin/includes/file.php');
    }
    $movefile = wp_handle_upload($file, ['test_form' => false]);
    if ($movefile && !isset($movefile['error'])) {
        wp_send_json_success(['filePath' => $movefile['file']]);
    } else {
        wp_send_json_error(['message' => 'Error al procesar el archivo: ' . $movefile['error']], 500);
    }
}

/**
 * Manejador para procesar el archivo Excel subido e importar los alumnos (versión global).
 */
function cpp_handle_process_students_import() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.'], 401);
    }

    $user_id = get_current_user_id();
    $temp_file_path = isset($_POST['temp_file_path']) ? sanitize_text_field(wp_unslash($_POST['temp_file_path'])) : '';

    if (empty($temp_file_path) || !file_exists($temp_file_path)) {
        wp_send_json_error(['message' => 'Faltan datos o el archivo no existe.'], 400);
    }

    $import_result = cpp_process_student_excel_import($temp_file_path, $user_id);

    wp_delete_file($temp_file_path);

    if (isset($import_result['status']) && $import_result['status'] === 'success') {
        wp_send_json_success($import_result);
    } else {
        wp_send_json_error($import_result);
    }
}

/**
 * Procesa el archivo Excel e importa los alumnos globalmente.
 */
function cpp_process_student_excel_import($file_path, $user_id) {
    try {
        $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($file_path);
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($file_path);
        $worksheet = $spreadsheet->getActiveSheet();
        $highestRow = $worksheet->getHighestRow();

        // Mapear cabeceras
        $header_row = $worksheet->rangeToArray('A1:' . $worksheet->getHighestColumn() . '1', NULL, TRUE, FALSE)[0];
        $col_map = array_flip(array_map('trim', array_map('strtolower', $header_row)));

        if (!isset($col_map['nombre']) || !isset($col_map['apellidos'])) {
            return ['status' => 'error', 'message' => 'El archivo no contiene las cabeceras "Nombre" y "Apellidos".'];
        }
        $col_idx_clases = isset($col_map['clases (separadas por comas)']) ? $col_map['clases (separadas por comas)'] : null;
        
        // Obtener todas las clases del usuario una sola vez para eficiencia
        $clases_usuario = cpp_obtener_clases_usuario($user_id);
        $map_nombre_clase_a_id = [];
        foreach ($clases_usuario as $clase) {
            $map_nombre_clase_a_id[trim(strtolower($clase['nombre']))] = $clase['id'];
        }

        $imported_count = 0;
        $skipped_duplicates = 0;
        $errors_list = [];

        for ($row = 2; $row <= $highestRow; $row++) {
            $nombre = trim($worksheet->getCellByColumnAndRow($col_map['nombre'] + 1, $row)->getValue());
            $apellidos = trim($worksheet->getCellByColumnAndRow($col_map['apellidos'] + 1, $row)->getValue());

            if (empty($nombre) && empty($apellidos)) continue;
            if (empty($nombre) || empty($apellidos)) {
                $errors_list[] = "Fila $row: Nombre y Apellidos son obligatorios.";
                continue;
            }

            if (cpp_alumno_existe($user_id, $nombre, $apellidos)) {
                $skipped_duplicates++;
                continue;
            }

            $clases_ids_a_asignar = [];
            if ($col_idx_clases !== null) {
                $clases_str = trim($worksheet->getCellByColumnAndRow($col_idx_clases + 1, $row)->getValue());
                if (!empty($clases_str)) {
                    $nombres_clases = array_map('trim', explode(',', $clases_str));
                    foreach ($nombres_clases as $nombre_clase) {
                        $nombre_clase_lower = trim(strtolower($nombre_clase));
                        if (isset($map_nombre_clase_a_id[$nombre_clase_lower])) {
                            $clases_ids_a_asignar[] = $map_nombre_clase_a_id[$nombre_clase_lower];
                        } else {
                            $errors_list[] = "Fila $row: La clase '$nombre_clase' no existe o no te pertenece y fue ignorada.";
                        }
                    }
                }
            }

            $datos_alumno = ['nombre' => $nombre, 'apellidos' => $apellidos];
            $new_alumno_id = cpp_crear_alumno($user_id, $datos_alumno, $clases_ids_a_asignar);

            if ($new_alumno_id) {
                $imported_count++;
            } else {
                $errors_list[] = "Fila $row: Error al guardar al alumno '$nombre $apellidos'.";
            }
        }
        
        $message = "Importación completada. Alumnos nuevos importados: $imported_count.";
        if ($skipped_duplicates > 0) $message .= " Alumnos omitidos por ya existir: $skipped_duplicates.";

        return [
            'status' => empty($errors_list) ? 'success' : 'warning',
            'message' => $message,
            'errors' => $errors_list
        ];

    } catch (\Exception $e) {
        return ['status' => 'error', 'message' => 'Error inesperado: ' . $e->getMessage()];
    }
}

// Registrar los manejadores de AJAX
add_action('wp_ajax_cpp_download_student_template', 'cpp_handle_student_template_download');
add_action('wp_ajax_cpp_upload_student_excel', 'cpp_handle_student_excel_upload');
add_action('wp_ajax_cpp_import_students_from_file', 'cpp_handle_process_students_import');
