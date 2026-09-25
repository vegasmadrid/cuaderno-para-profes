/**
 * JS para el módulo de Comunidad, Sugerencias y Preguntas
 */
(function($) {
    'use strict';

    var CppSugerenciasApp = {
        activeTab: 'propuestas', // 'propuestas' o 'dudas'
        activeOrden: 'votos',    // 'votos' o 'recientes'
        currentSugerenciaId: null,

        init: function() {
            this.bindEvents();
        },

        bindEvents: function() {
            var self = this;

            // Abrir pantalla de Sugerencias
            $(document).on('click', '#cpp-btn-sugerencias-topbar', function(e) {
                e.preventDefault();
                self.openSugerenciasPage();
            });

            // Cerrar pantalla de Sugerencias
            $(document).on('click', '#cpp-close-sugerencias-btn', function(e) {
                e.preventDefault();
                self.closeSugerenciasPage();
            });

            // Cambiar de subpestaña (Propuestas / Dudas)
            $(document).on('click', '.cpp-sugerencia-tab-link', function(e) {
                e.preventDefault();
                $('.cpp-sugerencia-tab-link').removeClass('active');
                $(this).addClass('active');

                self.activeTab = $(this).data('sugerencia-tab');
                self.updateHeaderInfo();
                self.cargarSugerencias();
            });

            // Cambiar ordenación (votos / recientes)
            $(document).on('change', '#cpp-sugerencia-orden-filter', function() {
                self.activeOrden = $(this).val();
                self.cargarSugerencias();
            });

            // Votar / Desvotar
            $(document).on('click', '.cpp-sugerencia-voto-box', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var $box = $(this);
                var sugerenciaId = $box.data('id');
                self.toggleVoto(sugerenciaId, $box);
            });

            // Abrir modal de nueva sugerencia
            $(document).on('click', '#cpp-btn-nueva-sugerencia', function(e) {
                e.preventDefault();
                $('#cpp-sugerencia-tipo-input').val(self.activeTab === 'dudas' ? 'duda' : 'propuesta');
                $('#cpp-form-crear-sugerencia')[0].reset();
                $('#cpp-sugerencia-tipo-input').val(self.activeTab === 'dudas' ? 'duda' : 'propuesta');
                $('#cpp-modal-crear-sugerencia').css('display', 'flex').hide().fadeIn(200);
            });

            // Guardar nueva sugerencia
            $(document).on('submit', '#cpp-form-crear-sugerencia', function(e) {
                e.preventDefault();
                self.crearSugerencia();
            });

            // Abrir detalle / comentarios
            $(document).on('click', '.cpp-btn-comentarios-trigger, .cpp-sugerencia-title', function(e) {
                e.preventDefault();
                var $card = $(this).closest('.cpp-sugerencia-card');
                var id = $card.data('id');
                self.openDetalleModal(id);
            });

            // Enviar nuevo comentario
            $(document).on('submit', '#cpp-form-nuevo-comentario', function(e) {
                e.preventDefault();
                self.agregarComentario();
            });
        },

        openSugerenciasPage: function() {
            if (typeof cpp !== 'undefined' && cpp.config) {
                cpp.config.tabBeforeSettings = $('.cpp-main-tab-link.active').data('tab') || 'cuaderno';
            }
            $('#cpp-sugerencias-page-container').fadeIn(200);
            this.updateHeaderInfo();
            this.cargarSugerencias();
        },

        closeSugerenciasPage: function() {
            $('#cpp-sugerencias-page-container').fadeOut(200, function() {
                if (typeof cpp !== 'undefined' && cpp.config && cpp.config.tabBeforeSettings) {
                    $('.cpp-main-tab-link[data-tab="' + cpp.config.tabBeforeSettings + '"]').trigger('click');
                }
            });
        },

        updateHeaderInfo: function() {
            if (this.activeTab === 'dudas') {
                $('#cpp-sugerencia-section-title').text('Dudas, Preguntas y Comentarios 💬');
                $('#cpp-sugerencia-section-desc').text('Haz preguntas sobre el uso del cuaderno, comparte opiniones o debate con otros profesores.');
            } else {
                $('#cpp-sugerencia-section-title').text('Solicitudes de Mejoras y Funcionalidades 💡');
                $('#cpp-sugerencia-section-desc').text('Propón nuevas ideas para el cuaderno y vota las que más te gusten para implementarlas entre todos.');
            }
        },

        cargarSugerencias: function() {
            var self = this;
            var $container = $('#cpp-sugerencias-lista-container');
            $container.html('<p class="cpp-cuaderno-cargando">Cargando...</p>');

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cpp_get_sugerencias',
                    nonce: cppFrontendData.nonce,
                    tipo: self.activeTab === 'dudas' ? 'duda' : 'propuesta',
                    orden: self.activeOrden
                },
                success: function(response) {
                    if (response.success) {
                        self.renderLista(response.data.items);
                    } else {
                        $container.html('<p class="cpp-error-message">' + response.data.message + '</p>');
                    }
                },
                error: function() {
                    $container.html('<p class="cpp-error-message">Error de conexión al cargar las entradas.</p>');
                }
            });
        },

        renderLista: function(items) {
            var $container = $('#cpp-sugerencias-lista-container');
            if (!items || items.length === 0) {
                $container.html(
                    '<div class="cpp-empty-panel" style="padding: 40px; text-align: center;">' +
                    '<span class="dashicons dashicons-format-chat" style="font-size: 48px; width: 48px; height: 48px; color: #ccc;"></span>' +
                    '<h3>Aún no hay publicaciones aquí</h3>' +
                    '<p style="color: #666; margin-top: 5px;">¡Sé el primero en compartir una ' + (this.activeTab === 'dudas' ? 'duda o comentario' : 'propuesta o sugerencia') + '!</p>' +
                    '</div>'
                );
                return;
            }

            var html = '';
            items.forEach(function(item) {
                var isVotado = parseInt(item.votado_por_usuario, 10) === 1;
                var badgeClass = 'cpp-badge-' + item.estado;
                var estadoLabel = item.estado.charAt(0).toUpperCase() + item.estado.slice(1);
                if (item.estado === 'estudio') estadoLabel = 'En estudio';

                html += '<div class="cpp-sugerencia-card" data-id="' + item.id + '">';
                html += '  <div class="cpp-sugerencia-voto-box ' + (isVotado ? 'votado' : '') + '" data-id="' + item.id + '" title="' + (isVotado ? 'Quitar voto' : 'Votar esta entrada') + '">';
                html += '    <span class="cpp-sugerencia-voto-icon">▲</span>';
                html += '    <span class="cpp-sugerencia-voto-count">' + item.num_votos + '</span>';
                html += '  </div>';
                html += '  <div class="cpp-sugerencia-content-main">';
                html += '    <div class="cpp-sugerencia-header-row">';
                html += '      <h3 class="cpp-sugerencia-title" style="cursor: pointer;">' + self.escapeHtml(item.titulo) + '</h3>';
                if (item.tipo === 'propuesta') {
                    html += '      <span class="cpp-sugerencia-badge ' + badgeClass + '">' + estadoLabel + '</span>';
                }
                html += '    </div>';
                html += '    <div class="cpp-sugerencia-desc">' + self.escapeHtml(item.descripcion) + '</div>';
                html += '    <div class="cpp-sugerencia-meta">';
                html += '      <span>Publicado por <strong>' + self.escapeHtml(item.autor_nombre || 'Docente') + '</strong></span>';
                html += '      <button type="button" class="cpp-btn-comentarios-trigger"><span class="dashicons dashicons-admin-comments"></span> ' + item.num_comentarios + ' comentarios</button>';
                html += '    </div>';
                html += '  </div>';
                html += '</div>';
            });

            $container.html(html);
        },

        toggleVoto: function(sugerenciaId, $box) {
            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cpp_toggle_voto_sugerencia',
                    nonce: cppFrontendData.nonce,
                    sugerencia_id: sugerenciaId
                },
                success: function(response) {
                    if (response.success) {
                        if (response.data.votado) {
                            $box.addClass('votado');
                        } else {
                            $box.removeClass('votado');
                        }
                        $box.find('.cpp-sugerencia-voto-count').text(response.data.num_votos);
                    }
                }
            });
        },

        crearSugerencia: function() {
            var self = this;
            var tipo = $('#cpp-sugerencia-tipo-input').val();
            var titulo = $.trim($('#cpp-sugerencia-titulo-input').val());
            var descripcion = $.trim($('#cpp-sugerencia-descripcion-input').val());

            if (!titulo || !descripcion) {
                alert('Por favor rellena el título y la descripción.');
                return;
            }

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cpp_crear_sugerencia',
                    nonce: cppFrontendData.nonce,
                    tipo: tipo,
                    titulo: titulo,
                    descripcion: descripcion
                },
                success: function(response) {
                    if (response.success) {
                        $('#cpp-modal-crear-sugerencia').fadeOut(150);
                        if (typeof cpp !== 'undefined' && cpp.showToast) {
                            cpp.showToast('Entrada publicada correctamente.', 'success');
                        }
                        self.cargarSugerencias();
                    } else {
                        alert(response.data.message);
                    }
                }
            });
        },

        openDetalleModal: function(sugerenciaId) {
            var self = this;
            self.currentSugerenciaId = sugerenciaId;
            var $modal = $('#cpp-modal-detalle-sugerencia');
            var $body = $('#cpp-sugerencia-detalle-body');

            $body.html('<p class="cpp-cuaderno-cargando">Cargando...</p>');
            $modal.css('display', 'flex').hide().fadeIn(200);

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cpp_get_comentarios_sugerencia',
                    nonce: cppFrontendData.nonce,
                    sugerencia_id: sugerenciaId
                },
                success: function(response) {
                    if (response.success) {
                        self.renderDetalle(response.data.sugerencia, response.data.comentarios);
                    } else {
                        $body.html('<p class="cpp-error-message">' + response.data.message + '</p>');
                    }
                }
            });
        },

        renderDetalle: function(sugerencia, comentarios) {
            var self = this;
            var $body = $('#cpp-sugerencia-detalle-body');

            var html = '';
            html += '<h2 style="margin-bottom: 10px;">' + self.escapeHtml(sugerencia.titulo) + '</h2>';
            html += '<p style="color: #666; font-size: 13px; margin-bottom: 15px;">Publicado por <strong>' + self.escapeHtml(sugerencia.autor_nombre || 'Docente') + '</strong></p>';
            html += '<div class="cpp-sugerencia-desc" style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; margin-bottom: 20px;">' + self.escapeHtml(sugerencia.descripcion) + '</div>';

            html += '<h3>Comentarios (' + comentarios.length + ')</h3>';
            html += '<div class="cpp-comentarios-list">';

            if (comentarios.length === 0) {
                html += '<p style="color: #888; font-style: italic;">Sé el primero en dejar un comentario.</p>';
            } else {
                comentarios.forEach(function(c) {
                    var isAdmin = c.es_admin;
                    html += '<div class="cpp-comentario-item ' + (isAdmin ? 'admin-comment' : '') + '">';
                    html += '  <div class="cpp-comentario-meta">';
                    html += '    <strong>' + self.escapeHtml(c.autor_nombre || 'Docente') + (isAdmin ? ' <span style="color:#1a73e8;">(Administrador)</span>' : '') + '</strong>';
                    html += '    <span>' + c.fecha_comentario + '</span>';
                    html += '  </div>';
                    html += '  <div class="cpp-comentario-texto">' + self.escapeHtml(c.comentario) + '</div>';
                    html += '</div>';
                });
            }
            html += '</div>';

            html += '<form id="cpp-form-nuevo-comentario" style="margin-top: 20px;">';
            html += '  <div class="cpp-form-group">';
            html += '    <label for="cpp-comentario-input">Escribe tu respuesta o comentario:</label>';
            html += '    <textarea id="cpp-comentario-input" name="comentario" rows="3" required placeholder="Añade tu opinión o respuesta..."></textarea>';
            html += '  </div>';
            html += '  <div style="text-align: right;">';
            html += '    <button type="submit" class="cpp-btn cpp-btn-primary"><span class="dashicons dashicons-send"></span> Enviar Comentario</button>';
            html += '  </div>';
            html += '</form>';

            $body.html(html);
        },

        agregarComentario: function() {
            var self = this;
            var comentario = $.trim($('#cpp-comentario-input').val());

            if (!comentario) return;

            $.ajax({
                url: cppFrontendData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'cpp_agregar_comentario_sugerencia',
                    nonce: cppFrontendData.nonce,
                    sugerencia_id: self.currentSugerenciaId,
                    comentario: comentario
                },
                success: function(response) {
                    if (response.success) {
                        self.openDetalleModal(self.currentSugerenciaId);
                        self.cargarSugerencias();
                    } else {
                        alert(response.data.message);
                    }
                }
            });
        },

        escapeHtml: function(text) {
            if (!text) return '';
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
    };

    $(document).ready(function() {
        CppSugerenciasApp.init();
    });

})(jQuery);
