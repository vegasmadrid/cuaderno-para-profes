<?php
// /includes/programador/pdf-template.php

defined('ABSPATH') or die('Acceso no permitido');

function cpp_get_programador_pdf_html($rango_fechas, $fecha_actual, $dias, $simbolos) {
    $logo_url = 'https://cuadernodeprofe.com/wp-content/uploads/2025/10/Logotipo-Papeleria-Kawaii-Lindo-Rosa-Amarillo-y-Azul-1.png';
    ob_start();
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Programación Semanal</title>
        <style>
            @page { margin: 20mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; font-size: 12px; color: #333; line-height: 1.6; }
            .cover {
                text-align: center;
                page-break-after: always;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 95%;
            }
            .cover h1 { font-size: 48px; margin-bottom: 25px; font-weight: bold; color: #2c3e50; }
            .cover h2 { font-size: 20px; font-weight: 300; margin-bottom: 15px; color: #34495e; }
            .cover h3 { font-size: 16px; font-weight: 300; margin-bottom: 60px; color: #7f8c8d; }
            .cover-footer { position: absolute; bottom: 20mm; left: 0; right: 0; font-size: 12px; color: #95a5a6; }
            .cover-footer img { width: 40px; height: 40px; margin-bottom: 10px; }
            .header { text-align: center; font-size: 9px; color: #aaa; position: fixed; top: -15mm; left: 0; right: 0; }
            .footer { text-align: center; font-size: 9px; color: #aaa; position: fixed; bottom: -15mm; left: 0; right: 0; }
            .content-page { page-break-before: always; }
            .day-separator { margin-top: 25px; }
            .day-header {
                font-size: 20px;
                font-weight: bold;
                color: #34495e;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 2px solid #ecf0f1;
            }
            .session {
                margin-bottom: 20px;
                padding-left: 15px;
                border-left: 3px solid #bdc3c7;
            }
            .session-header { font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #2c3e50; }
            .session-header .clase-name { font-style: normal; font-weight: 600; }
            .session-header .symbol { margin-right: 8px; font-size: 18px; }
            .session-content { padding-left: 20px; }
            .session-content p { margin: 4px 0; }
            .activities { padding-left: 20px; margin-top: 10px;}
            .activities-title { font-weight: bold; margin-bottom: 5px; }
            .activity { font-size: 12px; margin-bottom: 5px; list-style-type: disc; }
            .activity.evaluable { font-weight: bold; }
            .no-sessions-message { text-align: center; margin-top: 50px; font-size: 18px; color: #555; }
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
                <img src="<?php echo esc_url($logo_url); ?>" alt="Logo">
                <p>Programación creada con cuadernodeprofe.com</p>
            </div>
        </div>

        <div class="content-page">
            <div class="header">Programación de Clases</div>
            <div class="footer">cuadernodeprofe.com</div>

            <?php
            setlocale(LC_TIME, 'es_ES.UTF-8');
            if (empty($dias)): ?>
                <div class="no-sessions-message">
                    <p>No se encontraron sesiones de programación en el rango de fechas seleccionado.</p>
                </div>
            <?php else:
                foreach ($dias as $fecha => $sesiones_del_dia):
                    $fecha_str = strftime('%A, %e de %B de %Y', strtotime($fecha));
                ?>
                    <div class="day-separator">
                        <h2 class="day-header"><?php echo $fecha_str; ?></h2>
                        <?php foreach ($sesiones_del_dia as $sesion):
                            $sesion = (object)$sesion;
                            $simbolo_str = '';
                            if (!empty($sesion->simbolo_id) && isset($simbolos[$sesion->simbolo_id])) {
                                $simbolo_str = '<span class="symbol" title="' . esc_attr($simbolos[$sesion->simbolo_id]['leyenda']) . '">' . esc_html($simbolos[$sesion->simbolo_id]['simbolo']) . '</span>';
                            }
                        ?>
                            <div class="session" style="border-left-color: <?php echo esc_attr($sesion->color_clase); ?>;">
                                <div class="session-header">
                                    <?php echo $simbolo_str; ?>
                                    <span><?php echo esc_html($sesion->titulo); ?></span>
                                    <span class="clase-name">(<?php echo esc_html($sesion->nombre_clase); ?>)</span>
                                </div>
                                <div class="session-content">
                                    <?php if (!empty($sesion->descripcion)): ?>
                                        <p><?php echo esc_html($sesion->descripcion); ?></p>
                                    <?php endif; ?>

                                    <?php if (!empty($sesion->actividades_programadas)): ?>
                                        <div class="activities">
                                            <p class="activities-title">Actividades:</p>
                                            <ul>
                                            <?php foreach ($sesion->actividades_programadas as $actividad):
                                                $actividad = (object)$actividad;
                                                $tipo_class = (isset($actividad->tipo) && $actividad->tipo === 'evaluable') ? 'evaluable' : '';
                                            ?>
                                                <li class="activity <?php echo $tipo_class; ?>">
                                                    <?php echo esc_html($actividad->titulo); ?>
                                                </li>
                                            <?php endforeach; ?>
                                            </ul>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endforeach;
            endif; ?>
        </div>
    </body>
    </html>
    <?php
    return ob_get_clean();
}
