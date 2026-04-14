import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/health_reminder_provider.dart';

class HealthReminderScreen extends ConsumerStatefulWidget {
  const HealthReminderScreen({super.key});

  @override
  ConsumerState<HealthReminderScreen> createState() =>
      _HealthReminderScreenState();
}

class _HealthReminderScreenState extends ConsumerState<HealthReminderScreen> {
  // Teal color palette — calming, not the usual pink
  static const _teal = Color(0xFF00B4D8);
  static const _tealLight = Color(0xFF90E0EF);
  static const _bg = Color(0xFF0A1628);
  static const _surface = Color(0xFF112240);

  Future<void> _pickDate() async {
    final state = ref.read(healthReminderProvider);
    final picked = await showDatePicker(
      context: context,
      initialDate: state.lastTestDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      builder: (ctx, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(primary: _teal),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      await ref.read(healthReminderProvider.notifier).setLastTestDate(picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(healthReminderProvider);
    final daysSince = state.daysSinceLastTest;

    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        foregroundColor: Colors.white,
        title: const Text('健康提醒'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Center(
              child: Column(
                children: [
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _teal.withValues(alpha: 0.15),
                      border:
                          Border.all(color: _teal.withValues(alpha: 0.4), width: 2),
                    ),
                    child: const Center(
                        child: Text('🩺', style: TextStyle(fontSize: 36))),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    '健康提醒',
                    style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: Colors.white),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '定期检测，关爱自己',
                    style: TextStyle(color: _tealLight, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Info card
            _InfoCard(
              icon: Icons.info_outline_rounded,
              color: _teal,
              surface: _surface,
              text:
                  '定期HIV检测是保护自己和伴侣的重要方式。建议每3-6个月检测一次，尤其是有新伴侣时。',
            ),
            const SizedBox(height: 20),

            // Last test date
            _Section(
              title: '上次检测日期',
              surface: _surface,
              child: InkWell(
                onTap: _pickDate,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      Icon(Icons.calendar_today_rounded,
                          size: 20, color: _teal),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              state.lastTestDate != null
                                  ? _formatDate(state.lastTestDate!)
                                  : '点击设置日期',
                              style: TextStyle(
                                color: state.lastTestDate != null
                                    ? Colors.white
                                    : Colors.white38,
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (daysSince >= 0) ...[
                              const SizedBox(height: 2),
                              Text(
                                '距上次检测已 $daysSince 天',
                                style: TextStyle(
                                  color: daysSince > 180
                                      ? Colors.orange
                                      : _tealLight,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded,
                          color: Colors.white38, size: 20),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Reminder toggle
            _Section(
              title: '提醒设置',
              surface: _surface,
              child: Column(
                children: [
                  SwitchListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 16),
                    title: const Text('开启定期提醒',
                        style: TextStyle(color: Colors.white, fontSize: 15)),
                    subtitle: Text(
                      '在下次检测日期前提醒你',
                      style: TextStyle(color: Colors.white54, fontSize: 12),
                    ),
                    value: state.reminderEnabled,
                    activeThumbColor: _teal,
                    inactiveThumbColor: Colors.white38,
                    inactiveTrackColor: Colors.white12,
                    onChanged: (v) => ref
                        .read(healthReminderProvider.notifier)
                        .setReminderEnabled(v),
                  ),
                  if (state.reminderEnabled) ...[
                    const Divider(color: Colors.white10),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('提醒频率',
                              style: TextStyle(
                                  color: Colors.white54, fontSize: 12)),
                          const SizedBox(height: 10),
                          Row(
                            children: [3, 6, 12].map((m) {
                              final selected = state.intervalMonths == m;
                              return Padding(
                                padding: const EdgeInsets.only(right: 10),
                                child: ChoiceChip(
                                  label: Text('$m 个月'),
                                  selected: selected,
                                  selectedColor: _teal.withValues(alpha: 0.25),
                                  backgroundColor: Colors.white10,
                                  labelStyle: TextStyle(
                                    color: selected ? _teal : Colors.white60,
                                    fontWeight: selected
                                        ? FontWeight.w700
                                        : FontWeight.normal,
                                  ),
                                  side: BorderSide(
                                    color:
                                        selected ? _teal : Colors.transparent,
                                  ),
                                  onSelected: (_) => ref
                                      .read(healthReminderProvider.notifier)
                                      .setInterval(m),
                                ),
                              );
                            }).toList(),
                          ),
                          if (state.nextReminderDate != null) ...[
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Icon(Icons.notifications_active_rounded,
                                    size: 14, color: _tealLight),
                                const SizedBox(width: 6),
                                Text(
                                  '下次提醒：${_formatDate(state.nextReminderDate!)}',
                                  style: TextStyle(
                                      color: _tealLight, fontSize: 12),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Resources
            _Section(
              title: '检测资源',
              surface: _surface,
              child: Column(
                children: [
                  _ResourceTile(
                    icon: '📍',
                    title: '马来西亚检测点查询',
                    subtitle: '全国免费HIV检测点',
                    color: _teal,
                  ),
                  const Divider(color: Colors.white10, height: 1),
                  _ResourceTile(
                    icon: '🔒',
                    title: '匿名检测服务',
                    subtitle: '保护你的隐私',
                    color: _teal,
                  ),
                  const Divider(color: Colors.white10, height: 1),
                  _ResourceTile(
                    icon: '💊',
                    title: 'PrEP 信息',
                    subtitle: '暴露前预防用药',
                    color: _teal,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Privacy note
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white10),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('🔒', style: TextStyle(fontSize: 14)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '此信息仅存储在您的设备上，不会与其他用户分享，我们无法访问您的健康数据。',
                      style: TextStyle(
                          color: Colors.white38, fontSize: 12, height: 1.5),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) =>
      '${dt.year}年${dt.month}月${dt.day}日';
}

class _Section extends StatelessWidget {
  final String title;
  final Widget child;
  final Color surface;
  const _Section(
      {required this.title, required this.child, required this.surface});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            title,
            style: const TextStyle(
                color: Colors.white54,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.8),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white10),
          ),
          child: child,
        ),
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final Color surface;
  final String text;
  const _InfoCard(
      {required this.icon,
      required this.color,
      required this.surface,
      required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: TextStyle(
                    color: Colors.white70, fontSize: 13, height: 1.6)),
          ),
        ],
      ),
    );
  }
}

class _ResourceTile extends StatelessWidget {
  final String icon;
  final String title;
  final String subtitle;
  final Color color;
  const _ResourceTile(
      {required this.icon,
      required this.title,
      required this.subtitle,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Text(icon, style: const TextStyle(fontSize: 22)),
      title: Text(title,
          style: const TextStyle(
              color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
      subtitle: Text(subtitle,
          style: const TextStyle(color: Colors.white38, fontSize: 12)),
      trailing: Icon(Icons.open_in_new_rounded, size: 16, color: color),
      onTap: () {
        // Placeholder — no real URL to avoid generating one
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('即将推出')),
        );
      },
    );
  }
}
