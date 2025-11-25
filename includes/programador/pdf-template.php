<?php
// /includes/programador/pdf-template.php

defined('ABSPATH') or die('Acceso no permitido');

function cpp_get_programador_pdf_html($rango_fechas, $fecha_actual, $semanas, $simbolos) {
    ob_start();
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Programación Semanal</title>
        <style>
            @page { margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; font-size: 11px; color: #333; }
            .cover {
                text-align: center;
                page-break-after: always;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 90%;
            }
            .cover h1 { font-size: 32px; margin-bottom: 20px; font-weight: bold; }
            .cover h2 { font-size: 18px; font-weight: normal; margin-bottom: 10px; }
            .cover h3 { font-size: 16px; font-weight: normal; margin-bottom: 40px; }
            .cover-footer { position: absolute; bottom: 40px; left: 0; right: 0; font-size: 12px; color: #777; }
            .header { text-align: center; font-size: 10px; color: #888; margin-bottom: 20px; position: fixed; top: -10mm; left: 0; right: 0; }
            .week-container { page-break-before: always; }
            .week-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; text-align: center; }
            .session { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
            .session-header { font-size: 14px; font-weight: bold; margin-bottom: 8px; }
            .session-header .date { font-weight: normal; color: #555; margin-right: 10px;}
            .session-header .symbol { margin-right: 5px; }
            .session-header .clase-name { font-style: italic; color: #444; margin-left: 5px; }
            .activities { padding-left: 20px; }
            .activity { font-size: 12px; margin-bottom: 4px; }
            .activity.evaluable { font-weight: bold; }
            .no-sessions-message { text-align: center; margin-top: 50px; font-size: 16px; color: #555; }
        </style>
    </head>
    <body>
        <div class="cover">
            <div>
                <h1>Programación</h1>
                <h2><?php echo esc_html($rango_fechas); ?></h2>
                <h3>Programación actualizada el <?php echo esc_html($fecha_actual); ?></h3>
            </div>
            <div class="cover-footer">
                Programación creada con cuadernodeprofe.com
            </div>
        </div>

        <?php
        setlocale(LC_TIME, 'es_ES.UTF-8');
        if (empty($semanas)): ?>
            <div class="no-sessions-message">
                <p>No se encontraron sesiones de programación en el rango de fechas seleccionado.</p>
            </div>
        <?php else:
            foreach ($semanas as $key => $sesiones_de_la_semana):
                $parts = explode('-', $key);
                $year = $parts[0];
                $week_num = $parts[1];

                $start_date_of_week = new DateTime();
                $start_date_of_week->setISODate($year, $week_num);
                $end_date_of_week = clone $start_date_of_week;
                $end_date_of_week->modify('+6 days');

                $week_title_str = 'Semana del ' . strftime('%e de %B', $start_date_of_week->getTimestamp()) . ' al ' . strftime('%e de %B de %Y', $end_date_of_week->getTimestamp());
            ?>
                <div class="week-container">
                    <div class="header">Programación creada con cuadernodeprofe.com</div>
                    <h3 class="week-title"><?php echo $week_title_str; ?></h3>
                    <?php foreach ($sesiones_de_la_semana as $sesion):
                        $sesion = (object)$sesion;
                        $fecha_str = strftime('%A, %e de %B', strtotime($sesion->fecha_calculada));
                        $simbolo_str = '';
                        if (!empty($sesion->simbolo_id) && isset($simbolos[$sesion->simbolo_id])) {
                            $simbolo_str = esc_html($simbolos[$sesion->simbolo_id]['simbolo']);
                        }
                    ?>
                        <div class="session">
                            <div class="session-header">
                                <span class="date" style="color: <?php echo esc_attr($sesion->color_clase); ?>;"><?php echo $fecha_str; ?></span>
                                <span class="symbol"><?php echo $simbolo_str; ?></span>
                                <span><?php echo esc_html($sesion->titulo); ?></span>
                                <span class="clase-name">(<?php echo esc_html($sesion->nombre_clase); ?>)</span>
                            </div>
                            <?php if (!empty($sesion->actividades_programadas)): ?>
                                <div class="activities">
                                <?php foreach ($sesion->actividades_programadas as $actividad):
                                    $actividad = (object)$actividad;
                                    $tipo_class = (isset($actividad->tipo) && $actividad->tipo === 'evaluable') ? 'evaluable' : '';
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
            <?php endforeach;
        endif; ?>
    </body>
    </html>
    <?php
    return ob_get_clean();
}
