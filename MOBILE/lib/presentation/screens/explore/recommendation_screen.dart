import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:smartur/l10n/app_localizations.dart';

import '../../../core/theme/style_guide.dart';
import '../../../core/constants/api_constants.dart';
import '../../../data/services/api_client.dart';
import '../../../data/services/auth_service.dart';
import '../../../data/services/user_content_service.dart';
import '../../../core/utils/notifications.dart';
import '../../../core/utils/image_export_service.dart';
import '../../widgets/smartur_background.dart';

class RecommendationScreen extends StatefulWidget {
  final String? city;

  const RecommendationScreen({super.key, this.city});

  @override
  State<RecommendationScreen> createState() => _RecommendationScreenState();
}

class _RecommendationScreenState extends State<RecommendationScreen> {
  bool _isFetchingRecommendations = false;
  List<dynamic> _recommendations = [];
  String? _perfilLabel;
  String? _beneficioObjetivo;
  double? _stressConfidence;

  int _q1 = 2;
  int _q2 = 2;
  int _q3 = 2;
  int _q4 = 2;

  Future<void> _fetchRecommendations() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _isFetchingRecommendations = true;
      _recommendations = [];
    });

    try {
      final auth = AuthService();
      final userId = await auth.getUserId();
      
      if (userId == null) {
        if (!mounted) return;
        SmarturNotifications.showError(context, l10n?.sessionExpiredPreferences ?? 'Error: Usuario no autenticado');
        setState(() => _isFetchingRecommendations = false);
        return;
      }

      // Request GPS location in parallel with the rest of the setup.
      // If denied or unavailable, lat/lon will be null and the backend
      // falls back to the Altas Montañas geographic center (18.95, -97.05).
      final url = Uri.parse('${ApiConstants.baseUrl}/ml/recommend/$userId');
      final payload = jsonEncode({
        'q1': _q1,
        'q2': _q2,
        'q3': _q3,
        'q4': _q4,
        'top_n': 3,
      });

      final response = await ApiClient.post(
        url,
        body: payload,
        extraHeaders: {'Content-Type': 'application/json'},
        timeout: const Duration(seconds: 25),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final recs = data['recommendations'] as List<dynamic>? ?? [];
        setState(() {
          _recommendations = recs;
          _perfilLabel = data['perfil_estres_label'] as String?;
          _beneficioObjetivo = data['beneficio_objetivo'] as String?;
          final conf = data['stress_confidence'];
          _stressConfidence = conf is num ? conf.toDouble() : null;
        });
        if (recs.isNotEmpty && mounted) {
          _showResultsModal(context, recs, _perfilLabel, _beneficioObjetivo, _stressConfidence);
        }
      } else {
        throw Exception('Server returned ${response.statusCode}');
      }
    } catch (e) {
      if (mounted) {
        SmarturNotifications.showError(context, 'Error obteniendo recomendaciones: $e');
      }
    } finally {
      if (mounted) {
        setState(() {
          _isFetchingRecommendations = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final displayCity = widget.city ?? 'México Wellness';
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: scheme.surface,
      appBar: AppBar(
        title: Text(
          l10n?.recommendationsInCity(displayCity) ?? 'Recomendaciones IA',
          style: SmarturStyle.calSansTitle.copyWith(fontSize: 20),
        ),
        elevation: 0,
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
      ),
      body: SmarturBackgroundTop(
        child: SingleChildScrollView(
          child: _buildForm(scheme),
        ),
      ),
    );
  }

  Widget _buildForm(ColorScheme scheme) {
    return Padding(
      padding: const EdgeInsets.all(SmarturStyle.spacingMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Cuestionario de bienestar',
            style: SmarturStyle.calSansTitle.copyWith(fontSize: 18, color: scheme.primary),
          ),
          const SizedBox(height: 8),
          Text(
            '4 preguntas para identificar tu perfil de estrés y recomendar destinos terapéuticos en México.',
            style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 14),
          ),
          const SizedBox(height: SmarturStyle.spacingMd),
          _buildLikert('Q1 · Energía cognitiva', _q1, 3, (v) => setState(() => _q1 = v)),
          _buildLikert('Q2 · Tensión física', _q2, 4, (v) => setState(() => _q2 = v)),
          _buildLikert('Q3 · Rumiación', _q3, 3, (v) => setState(() => _q3 = v)),
          _buildLikert('Q4 · Activación negativa', _q4, 3, (v) => setState(() => _q4 = v)),
          const SizedBox(height: SmarturStyle.spacingLg),
          ElevatedButton(
            onPressed: _isFetchingRecommendations ? null : _fetchRecommendations,
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
              backgroundColor: SmarturStyle.purple,
              foregroundColor: Colors.white,
            ),
            child: _isFetchingRecommendations
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Ver destinos recomendados', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildLikert(String label, int value, int max, ValueChanged<int> onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 8),
          Row(
            children: List.generate(max, (i) {
              final v = i + 1;
              final selected = value == v;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: OutlinedButton(
                    onPressed: () => onChanged(v),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: selected ? SmarturStyle.purple.withValues(alpha: 0.15) : null,
                      foregroundColor: selected ? SmarturStyle.purple : null,
                    ),
                    child: Text('$v'),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  void _showResultsModal(
    BuildContext context,
    List<dynamic> recommendations, [
    String? perfilLabel,
    String? beneficioObjetivo,
    double? stressConfidence,
  ]) {
    final scheme = Theme.of(context).colorScheme;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(ctx).size.height * 0.75,
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(color: scheme.outlineVariant, borderRadius: BorderRadius.circular(2)),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Text('Tus destinos wellness', style: SmarturStyle.calSansTitle.copyWith(fontSize: 22)),
                  if (perfilLabel != null) ...[
                    const SizedBox(height: 6),
                    Text(perfilLabel, style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w600)),
                  ],
                  if (stressConfidence != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Confianza del modelo: ${(stressConfidence * 100).toStringAsFixed(0)}%',
                      style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12),
                    ),
                  ],
                  if (beneficioObjetivo != null && beneficioObjetivo.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      beneficioObjetivo,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
                    ),
                  ],
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: recommendations.length,
                itemBuilder: (c, i) {
                  final item = recommendations[i];
                  final name = item['nombre_lugar'] ?? item['title'] ?? 'Destino ${i + 1}';
                  final match = item['match_pct'] ?? item['score'] ?? 0.0;
                  final beneficio = item['beneficio_optimo_pct'];
                  final estado = item['estado'] ?? '';
                  final subtitleParts = <String>[];
                  if (estado.isNotEmpty) subtitleParts.add(estado);
                  if (beneficio is num) subtitleParts.add('Beneficio óptimo ${beneficio.toStringAsFixed(0)}%');
                  return Card(
                    elevation: 0,
                    color: scheme.surfaceContainerHighest.withValues(alpha: 0.3),
                    margin: const EdgeInsets.only(bottom: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: SmarturStyle.purple,
                        child: Text('${match is num ? match.toStringAsFixed(0) : match}%', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                      title: Text(name, style: const TextStyle(fontFamily: 'Outfit', fontWeight: FontWeight.bold)),
                      subtitle: subtitleParts.isNotEmpty ? Text(subtitleParts.join(' · ')) : null,
                      trailing: const Icon(Icons.chevron_right),
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 30),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                   _buildActionButton(ctx, Icons.people_outline, 'Comunidad', SmarturStyle.purple, () async {
                      if (recommendations.isEmpty) return;
                      // El backend requiere un ID numérico.
                      final text = recommendations.take(3).map((e) => "• ${e['nombre_lugar'] ?? e['title'] ?? e['name']}").join("\n");
                      final caption = "¡Ey! Mira lo que me recomienda SMARTUR en esta ciudad:\n\n$text\n\n¿Cuál debería visitar primero? #SmarturIA";
                      
                      try {
                        SmarturNotifications.showInfo(context, 'Publicando en comunidad...');
                        // Nota: El backend espera un ID real de lugar. Si item_id es un string de Yelp,
                        // el UserContentService podría fallar. Usaremos el primer lugar como ancla.
                        // Intentamos parsear un id numérico si existe, si no avisamos.
                        await UserContentService().createCommunityPost(
                          placeKind: 'poi', // Genérico para recomendaciones externas
                          placeId: 1, // Placeholder ya que las recomendaciones de IA son externas a la DB local por ahora
                          caption: caption,
                        );
                        if (context.mounted) {
                          SmarturNotifications.showSuccess(context, '¡Publicado en la Comunidad!');
                        }
                      } catch (e) {
                         if (context.mounted) {
                            SmarturNotifications.showError(context, 'No se pudo publicar: $e');
                         }
                      }
                   }),
                   _buildActionButton(ctx, Icons.image_outlined, 'Imagen', SmarturStyle.blue, () async {
                      try {
                        SmarturNotifications.showInfo(context, 'Generando tarjeta SMARTUR...');
                        await ImageExportService.shareRecommendationsImage(context, recommendations, widget.city ?? 'Altas Montañas');
                      } catch (e) {
                         if (context.mounted) {
                            SmarturNotifications.showError(context, 'Error al generar imagen: $e');
                         }
                      }
                   }),
                   _buildActionButton(ctx, Icons.chat_outlined, 'WhatsApp', const Color(0xFF25D366), () async {
                      final text = recommendations.take(5).map((e) => "*${e['nombre_lugar'] ?? e['title'] ?? e['name']}*").join("%0A");
                      final message = "Mis%20recomendaciones%20SMARTUR:%0A%0A$text";
                      
                      // Usar api.whatsapp.com es más robusto para saltar bloqueos de seguridad del OS
                      final url = Uri.parse("https://api.whatsapp.com/send?text=$message");
                      
                      try {
                        if (await canLaunchUrl(url)) {
                          await launchUrl(url, mode: LaunchMode.externalApplication);
                        } else {
                          if (context.mounted) {
                            SmarturNotifications.showError(context, 'No se pudo abrir WhatsApp');
                          }
                        }
                      } catch (e) {
                         if (context.mounted) {
                            SmarturNotifications.showError(context, 'Error al abrir WhatsApp: $e');
                         }
                      }
                   }),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton(BuildContext context, IconData icon, String label, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(fontSize: 11, fontFamily: 'Outfit', fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
