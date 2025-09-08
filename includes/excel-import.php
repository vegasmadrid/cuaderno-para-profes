<?php
defined('ABSPATH') or die('Acceso no permitido');

// Incluir el autoloader de PhpSpreadsheet
if (file_exists(CPP_PLUGIN_DIR . 'lib/vendor/autoload.php')) {
    require_once CPP_PLUGIN_DIR . 'lib/vendor/autoload.php';
} else {
    if (current_user_can('manage_options')) {
        wp_die('Error Crítico: La librería PhpSpreadsheet no se encuentra en la ruta esperada (lib/vendor/autoload.php). Por favor, asegúrate de que se ha instalado y subido correctamente.');
    }
    error_log('Error crítico en el plugin Cuaderno para Profesores: Librería PhpSpreadsheet no encontrada en lib/vendor/autoload.php.');
    return; 
}

// Declaraciones 'use' para las clases de PhpSpreadsheet que vamos a utilizar
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Cell\DataType; // Ya estaba, pero por si acaso
use PhpOffice\PhpSpreadsheet\Style\Fill;    // NUEVO: Para el relleno de celda
use PhpOffice\PhpSpreadsheet\Style\Font;    // NUEVO: Para la fuente
use PhpOffice\PhpSpreadsheet\Style\Alignment; // NUEVO: Para la alineación
use PhpOffice\PhpSpreadsheet\Style\Border;  // NUEVO: Para los bordes
use PhpOffice\PhpSpreadsheet\Cell\Coordinate; // Para convertir índices de columna

/**
 * Manejador para la descarga de la plantilla Excel de alumnos.
 */
function cpp_handle_student_template_download() {
    if (!isset($_REQUEST['nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_REQUEST['nonce'])), 'cpp_frontend_nonce')) {
        wp_send_json_error(['message' => 'Error de seguridad (nonce).'], 403);
        // Para descargas directas, wp_die es mejor si no es una respuesta JSON esperada
        // wp_die('Error de seguridad (nonce).'); 
        return;
    }
    if (!is_user_logged_in()) {
        // wp_send_json_error(['message' => 'Usuario no autenticado.'], 401);
        wp_die('Usuario no autenticado.');
        return;
    }

    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Plantilla Alumnos');

    // Cabeceras
    $sheet->setCellValue('A1', 'Nombre');
    $sheet->setCellValue('B1', 'Apellidos');
    // $sheet->setCellValue('C1', 'Identificador (Opcional)');

    // Aplicar algo de estilo a las cabeceras
    $header_style_array = [
        'font' => ['bold' => true, 'color' => ['rgb' => '000000']], // Texto negro para fondo claro
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'D9EAD3']], // Un verde claro
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'BFBFBF']]]
    ];
    $sheet->getStyle('A1:B1')->applyFromArray($header_style_array);
    $sheet->getColumnDimension('A')->setWidth(25);
    $sheet->getColumnDimension('B')->setWidth(35);
    // $sheet->getColumnDimension('C')->setWidth(25);


    // Instrucciones o ejemplo (opcional)
    $sheet->setCellValue('A2', 'EjemploNombre');
    $sheet->setCellValue('B2', 'EjemploApellidos');
    // $sheet->setCellValue('C2', 'ID_001');
    
    $sheet->setCellValue('A4', 'Instrucciones:');
    $sheet->getStyle('A4')->getFont()->setBold(true);
    $sheet->setCellValue('A5', '- Rellene las columnas Nombre y Apellidos para cada alumno.');
    $sheet->setCellValue('A6', '- No modifique ni elimine la fila de cabeceras (fila 1).');
    $sheet->setCellValue('A7', '- Puede eliminar las filas de ejemplo e instrucciones (filas 2 a 7) antes de subir el archivo.');


    $filename = 'plantilla_importacion_alumnos.xlsx';

    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment;filename="' . $filename . '"');
    header('Cache-Control: max-age=0');
    header('Cache-Control: cache, must-revalidate');
    header('Pragma: public');

    $writer = new Xlsx($spreadsheet);
    ob_start();
    $writer->save('php://output');
    $excel_output = ob_get_clean();

    if (!empty($excel_output)) {
        echo $excel_output;
    } else {
        status_header(500);
        echo "Error al generar la plantilla Excel."; // Esto no se debería ver si las cabeceras ya se enviaron
    }
    wp_die();
}


/**
 * Manejador para la subida del archivo Excel de alumnos.
 */
function cpp_handle_student_excel_upload() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.'], 401);
        return;
    }

    if (empty($_FILES['student_excel_file'])) {
        wp_send_json_error(['message' => 'No se ha subido ningún archivo.'], 400);
        return;
    }

    $file = $_FILES['student_excel_file'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        wp_send_json_error(['message' => 'Error durante la subida del archivo: ' . $file['error']], 400);
        return;
    }

    $allowed_mime_types = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
        'application/vnd.ms-excel', 
        'application/wps-office.xlsx', 
        'application/wps-office.xls'
    ];
    $file_mime_type = mime_content_type($file['tmp_name']);

    if (!in_array($file_mime_type, $allowed_mime_types)) {
        $path_info = pathinfo($file['name']);
        $file_extension = isset($path_info['extension']) ? strtolower($path_info['extension']) : '';
        if (!in_array($file_extension, ['xlsx', 'xls'])) {
            wp_send_json_error(['message' => 'Tipo de archivo no permitido. Solo se aceptan archivos Excel (.xlsx, .xls). Tipo detectado: ' . esc_html($file_mime_type) . ', Extensión: ' . esc_html($file_extension) ], 415);
            return;
        }
    }

    if (!function_exists('wp_handle_upload')) {
        require_once(ABSPATH . 'wp-admin/includes/file.php');
    }
    $upload_overrides = ['test_form' => false]; 
    $movefile = wp_handle_upload($file, $upload_overrides);

    if ($movefile && !isset($movefile['error'])) {
        wp_send_json_success([
            'message' => 'Archivo subido correctamente.',
            'filePath' => $movefile['file'], 
            'fileName' => basename($movefile['file']) 
        ]);
    } else {
        wp_send_json_error(['message' => 'Error al procesar el archivo subido: ' . (isset($movefile['error']) ? $movefile['error'] : 'Error desconocido')], 500);
    }
}

/**
 * Manejador para procesar el archivo Excel subido e importar los alumnos.
 */
function cpp_handle_process_students_import() {
    check_ajax_referer('cpp_frontend_nonce', 'nonce');
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Usuario no autenticado.'], 401);
        return;
    }

    $user_id = get_current_user_id();
    $clase_id = isset($_POST['clase_id']) ? intval($_POST['clase_id']) : 0;
    $temp_file_path = isset($_POST['temp_file_path']) ? sanitize_text_field(wp_unslash($_POST['temp_file_path'])) : '';
    $import_mode = isset($_POST['import_mode']) ? sanitize_text_field($_POST['import_mode']) : 'add';

    if (empty($clase_id) || empty($temp_file_path)) {
        wp_send_json_error(['message' => 'Faltan datos para la importación (ID de clase o ruta de archivo).'], 400);
        return;
    }

    $uploads = wp_upload_dir();
    $upload_path = $uploads['basedir'];
    if (strpos(realpath($temp_file_path), realpath($upload_path)) !== 0) {
         wp_send_json_error(['message' => 'Ruta de archivo no válida o no permitida.'], 403);
         return;
    }
    if (!file_exists($temp_file_path)) {
        wp_send_json_error(['message' => 'El archivo temporal no existe en el servidor.'], 404);
        return;
    }

    $import_result = cpp_process_student_excel_import($temp_file_path, $clase_id, $user_id, $import_mode);

    wp_delete_file($temp_file_path);

    if (isset($import_result['status']) && $import_result['status'] === 'success') {
        wp_send_json_success($import_result);
    } else {
        wp_send_json_error($import_result); // $import_result ya debería tener 'message' y opcionalmente 'status'
    }
}


/**
 * Procesa el archivo Excel e importa los alumnos.
 */
function cpp_process_student_excel_import($file_path, $clase_id, $user_id, $import_mode) {
    try {
        $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($file_path);
        $reader->setReadDataOnly(true); 
        $spreadsheet = $reader->load($file_path);
        $worksheet = $spreadsheet->getActiveSheet();
        $highestRow = $worksheet->getHighestRow();
        $highestColumn = $worksheet->getHighestColumn(); // e.g. 'C'
        $highestColumnIndex = Coordinate::columnIndexFromString($highestColumn);


        $expected_headers = ['nombre', 'apellidos']; 
        $header_row_values = [];
        $col_map = [];

        // Leer la primera fila para obtener las cabeceras
        for ($col_idx = 1; $col_idx <= $highestColumnIndex; $col_idx++) {
            $header_val = trim(strtolower($worksheet->getCellByColumnAndRow($col_idx, 1)->getValue()));
            $header_row_values[$col_idx] = $header_val;
            if ($header_val === 'nombre') {
                $col_map['nombre'] = $col_idx;
            } elseif ($header_val === 'apellidos') {
                $col_map['apellidos'] = $col_idx;
            }
        }
        
        if (!isset($col_map['nombre']) || !isset($col_map['apellidos'])) {
            return ['status' => 'error', 'message' => 'El archivo Excel no tiene las cabeceras esperadas ("Nombre", "Apellidos") en la primera fila. Cabeceras encontradas: ' . implode(', ', $header_row_values)];
        }

        $imported_count = 0;
        $skipped_duplicates = 0;
        $errors_list = [];
        $students_to_add = [];

        for ($row = 2; $row <= $highestRow; $row++) { 
            $nombre = trim($worksheet->getCellByColumnAndRow($col_map['nombre'], $row)->getValue());
            $apellidos = trim($worksheet->getCellByColumnAndRow($col_map['apellidos'], $row)->getValue());

            if (empty($nombre) && empty($apellidos)) {
                continue; 
            }
            if (empty($nombre) || empty($apellidos)) {
                $errors_list[] = "Fila " . $row . ": Nombre y Apellidos son obligatorios. Alumno omitido.";
                continue;
            }
            $students_to_add[] = ['nombre' => sanitize_text_field($nombre), 'apellidos' => sanitize_text_field($apellidos), 'original_row' => $row];
        }

        if (empty($students_to_add)) {
             if(empty($errors_list)) {
                return ['status' => 'info', 'message' => 'No se encontraron alumnos válidos para importar en el archivo o las filas estaban vacías.'];
             } else {
                return ['status' => 'warning', 'message' => 'No se importaron alumnos. Se encontraron los siguientes problemas:', 'errors' => $errors_list];
             }
        }


        if ($import_mode === 'replace') {
            if (!function_exists('cpp_eliminar_todos_alumnos_clase')) { 
                return ['status' => 'error', 'message' => 'Error interno: Función para reemplazar alumnos no disponible.'];
            }
            cpp_eliminar_todos_alumnos_clase($clase_id, $user_id);
        }

        foreach ($students_to_add as $student_data) {
            if ($import_mode === 'add') {
                if (cpp_alumno_existe($clase_id, $student_data['nombre'], $student_data['apellidos'])) {
                    $skipped_duplicates++;
                    $errors_list[] = "Fila " . $student_data['original_row'] . ": Alumno '" . esc_html($student_data['nombre'] . " " . $student_data['apellidos']) . "' ya existe y fue omitido.";
                    continue;
                }
            }
            $result_save = cpp_guardar_alumno($clase_id, ['nombre' => $student_data['nombre'], 'apellidos' => $student_data['apellidos']]);
            if ($result_save) {
                $imported_count++;
            } else {
                $errors_list[] = "Fila " . $student_data['original_row'] . ": Error al guardar alumno '" . esc_html($student_data['nombre'] . " " . $student_data['apellidos']) . "'.";
            }
        }
        
        $final_message = "Importación completada. Alumnos procesados/importados: " . $imported_count . ".";
        if ($skipped_duplicates > 0) {
            $final_message .= " Duplicados omitidos (en modo añadir): " . $skipped_duplicates . ".";
        }
        
        $status_final = 'success';
        if (!empty($errors_list)) {
            $status_final = 'warning'; // Éxito parcial si hubo errores pero también importaciones
            $final_message .= " Se encontraron algunos problemas durante la importación.";
        }
        if ($imported_count === 0 && !empty($errors_list) && $skipped_duplicates === 0) {
            $status_final = 'error'; // Error total si no se importó nada y solo hubo errores.
            $final_message = "No se importaron alumnos debido a errores.";
        }


        return ['status' => $status_final, 'message' => $final_message, 'imported_count' => $imported_count, 'skipped_duplicates' => $skipped_duplicates, 'errors' => $errors_list];

    } catch (\PhpOffice\PhpSpreadsheet\Reader\Exception $e) {
        error_log("Error al leer archivo Excel: " . $e->getMessage());
        return ['status' => 'error', 'message' => 'Error al leer el archivo Excel: ' . $e->getMessage()];
    } catch (\Exception $e) {
        error_log("Error general durante la importación de Excel: " . $e->getMessage());
        return ['status' => 'error', 'message' => 'Ocurrió un error inesperado durante la importación: ' . $e->getMessage()];
    }
}

// Registrar los manejadores de AJAX
add_action('wp_ajax_cpp_download_student_template', 'cpp_handle_student_template_download');
add_action('wp_ajax_cpp_upload_student_excel', 'cpp_handle_student_excel_upload');
add_action('wp_ajax_cpp_import_students_from_file', 'cpp_handle_process_students_import');