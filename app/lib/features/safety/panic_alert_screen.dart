import 'package:gaymeet/core/providers/auth_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/api/safe_date_service.dart';
import '../../core/api/api_client.dart';
import '../../core/models/safe_date.dart';

/// Shown when I am someone's trusted contact and they triggered panic.
class PanicAlertScreen extends ConsumerWidget {
  const PanicAlertScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('紧急求助警报'),
        backgroundColor: Colors.red.shade900,
      ),
      backgroundColor: const Color(0xFF0D0000),
      body: FutureBuilder<List<SafeDate>>(
        future: SafeDateService(ref.read(apiClientProvider)).getAlerts(),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final alerts = snap.data ?? [];
          if (alerts.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle_rounded,
                      color: Colors.green, size: 56),
                  const SizedBox(height: 16),
                  Text('没有待处理的警报',
                      style: TextStyle(color: AppTheme.textSecondary)),
                ],
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: alerts.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, i) => _AlertCard(alert: alerts[i]),
          );
        },
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  final SafeDate alert;
  const _AlertCard({required this.alert});

  @override
  Widget build(BuildContext context) {
    final panicAt = alert.panicAt;
    final timeStr = panicAt != null
        ? '${panicAt.hour.toString().padLeft(2, '0')}:${panicAt.minute.toString().padLeft(2, '0')}'
        : '未知时间';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.red.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.withOpacity(0.5), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.warning_rounded,
                    color: Colors.red, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '🆘 紧急求助',
                      style: TextStyle(
                        color: Colors.red,
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      '触发时间：$timeStr',
                      style: TextStyle(
                          color: AppTheme.textSecondary, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const Divider(height: 20, color: Colors.red),

          // Details
          if (alert.meetingWith.isNotEmpty)
            _DetailRow(
              icon: Icons.person_rounded,
              label: '约会对象',
              value: alert.meetingWith,
            ),
          if (alert.venue.isNotEmpty)
            _DetailRow(
              icon: Icons.location_on_rounded,
              label: '约会地点',
              value: alert.venue,
            ),
          if (alert.lat != null && alert.lng != null)
            _DetailRow(
              icon: Icons.my_location_rounded,
              label: '最后位置',
              value: '${alert.lat!.toStringAsFixed(5)}, ${alert.lng!.toStringAsFixed(5)}',
            ),

          const SizedBox(height: 16),

          // Map link placeholder
          if (alert.lat != null && alert.lng != null)
            OutlinedButton.icon(
              onPressed: () {
                // In production: open maps app with coordinates
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                        '位置：${alert.lat!.toStringAsFixed(4)}, ${alert.lng!.toStringAsFixed(4)}'),
                  ),
                );
              },
              icon: const Icon(Icons.map_rounded, size: 18),
              label: const Text('查看地图'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red,
                side: const BorderSide(color: Colors.red),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),

          const SizedBox(height: 8),

          // Call 110 button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('请拨打 110 报警')),
                );
              },
              icon: const Icon(Icons.call_rounded, size: 18),
              label: const Text('拨打 110 报警',
                  style: TextStyle(fontWeight: FontWeight.w700)),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppTheme.textSecondary),
          const SizedBox(width: 8),
          Text('$label：',
              style: TextStyle(
                  color: AppTheme.textSecondary, fontSize: 13)),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
