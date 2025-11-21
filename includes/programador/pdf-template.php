<?php
// /includes/programador/pdf-template.php

defined('ABSPATH') or die('Acceso no permitido');

function cpp_get_programacion_pdf_html($clase_nombre, $rango_fechas, $fecha_actual, $semanas, $simbolos) {
    ob_start();
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Programación de Clase</title>
        <style>
            @page { margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; font-size: 12px; color: #333; }
            .cover { text-align: center; page-break-after: always; }
            .cover h1 { font-size: 28px; margin-bottom: 20px; }
            .cover h2 { font-size: 20px; font-weight: normal; margin-bottom: 40px; }
            .cover p { font-size: 14px; color: #777; }
            .header { text-align: center; font-size: 10px; color: #888; margin-bottom: 20px; }
            .week-container { page-break-before: always; }
            .week-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; }
            .session { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
            .session-header { font-size: 14px; font-weight: bold; margin-bottom: 8px; }
            .session-header .date { font-weight: normal; color: #555; margin-right: 10px;}
            .session-header .symbol { margin-right: 5px; }
            .activities { padding-left: 20px; }
            .activity { font-size: 12px; margin-bottom: 4px; }
            .activity.evaluable { font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="cover">
            <h1>Programación de la clase: <?php echo esc_html($clase_nombre); ?></h1>
            <h2>Del <?php echo esc_html($rango_fechas); ?></h2>
            <p>Programación actualizada a día <?php echo esc_html($fecha_actual); ?></p>
        </div>

        <?php foreach ($semanas as $key => $sesiones_de_la_semana): ?>
            <div class="week-container">
                <div class="header">Programación creada con cuadernodeprofe.com</div>
                <h3 class="week-title">Semana del <?php echo date_i18n('d \d\e F', strtotime(explode('-', $key)[0] . '-W' . explode('-', $key)[1])); ?></h3>
                <?php foreach ($sesiones_de_la_semana as $sesion):
                    $sesion = (object)$sesion;
                    $fecha_str = date_i18n('D, d M', strtotime($sesion->fecha_calculada));
                    $simbolo_str = '';
                    if (!empty($sesion->simbolo_id) && isset($simbolos[$sesion->simbolo_id])) {
                        $simbolo_str = esc_html($simbolos[$sesion->simbolo_id]['simbolo']);
                    }
                ?>
                    <div class="session">
                        <div class="session-header">
                            <span class="date"><?php echo $fecha_str; ?></span>
                            <span class="symbol"><?php echo $simbolo_str; ?></span>
                            <span><?php echo esc_html($sesion->titulo); ?></span>
                        </div>
                        <?php if (!empty($sesion->actividades_programadas)): ?>
                            <div class="activities">
                            <?php foreach ($sesion->actividades_programadas as $actividad):
                                $actividad = (object)$actividad;
                                $tipo_class = ($actividad->tipo === 'evaluable') ? 'evaluable' : '';
                            ?>
                                <div class="activity <?php echo $tipo_class; ?>">
                                    - <?php echo esc_html($actividad->titulo); ?>
                                </div>
                            <?php endforeach; ?>
                            </div>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endforeach; ?>
    </body>
    </html>
    <?php
    return ob_get_clean();
}
