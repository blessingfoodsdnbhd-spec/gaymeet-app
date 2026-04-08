import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../config/theme.dart';
import '../../core/providers/events_provider.dart';

class CreateEventScreen extends ConsumerStatefulWidget {
  const CreateEventScreen({super.key});

  @override
  ConsumerState<CreateEventScreen> createState() => _CreateEventScreenState();
}

class _CreateEventScreenState extends ConsumerState<CreateEventScreen> {
  final _titleC = TextEditingController();
  final _descC = TextEditingController();
  final _venueC = TextEditingController();
  final _addressC = TextEditingController();

  DateTime _date = DateTime.now().add(const Duration(days: 7, hours: 1));
  int _maxAttendees = 20;
  double _price = 0;
  String _category = 'hangout';
  bool _creating = false;

  static const _categories = [
    ('makan', '聚餐', '🍜'),
    ('party', '派对', '🎉'),
    ('sports', '运动', '💪'),
    ('hangout', '闲逛', '☕'),
    ('other', '其他', '📅'),
  ];

  @override
  void dispose() {
    _titleC.dispose();
    _descC.dispose();
    _venueC.dispose();
    _addressC.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (_titleC.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('请输入活动标题')));
      return;
    }

    setState(() => _creating = true);

    try {
      final created = await ref.read(eventsProvider.notifier).createEvent({
        'title': _titleC.text.trim(),
        'description': _descC.text.trim(),
        'venue': _venueC.text.trim(),
        'address': _addressC.text.trim(),
        'date': _date.toIso8601String(),
        'maxAttendees': _maxAttendees,
        'price': _price,
        'category': _category,
      });
      if (mounted && created != null) {
        context.pop(true);
      } else if (mounted) {
        throw Exception('创建失败');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('创建失败：$e')));
      }
    }
    if (mounted) setState(() => _creating = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('创建活动'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: _creating
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2)))
                : TextButton(
                    onPressed: _create,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 6),
                      decoration: BoxDecoration(
                        gradient: AppTheme.brandGradient,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text('创建',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700)),
                    ),
                  ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Category selector ──────────────────────────────────────────
          const Text('活动类型',
              style:
                  TextStyle(fontSize: 13, color: Colors.white70)),
          const SizedBox(height: 10),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: _categories.map((cat) {
                final selected = _category == cat.$1;
                return GestureDetector(
                  onTap: () => setState(() => _category = cat.$1),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 4),
                    decoration: BoxDecoration(
                      color: selected ? AppTheme.primary : AppTheme.card,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Row(
                      children: [
                        Text(cat.$3),
                        const SizedBox(width: 4),
                        Text(cat.$2,
                            style: TextStyle(
                              color: selected
                                  ? Colors.white
                                  : AppTheme.textSecondary,
                              fontWeight: selected
                                  ? FontWeight.w700
                                  : FontWeight.normal,
                            )),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 20),

          // ── Fields ─────────────────────────────────────────────────────
          _Field(
            label: '活动标题 *',
            child: TextField(
              controller: _titleC,
              decoration: const InputDecoration(
                hintText: 'Rainbow Makan Night...',
                border: InputBorder.none,
              ),
            ),
          ),
          const SizedBox(height: 12),
          _Field(
            label: '活动描述',
            child: TextField(
              controller: _descC,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: '告诉大家这个活动是关于什么的...',
                border: InputBorder.none,
              ),
            ),
          ),
          const SizedBox(height: 12),
          _Field(
            label: '地点名称',
            child: TextField(
              controller: _venueC,
              decoration: const InputDecoration(
                hintText: 'Nobu KL, Pavilion...',
                border: InputBorder.none,
              ),
            ),
          ),
          const SizedBox(height: 12),
          _Field(
            label: '详细地址',
            child: TextField(
              controller: _addressC,
              decoration: const InputDecoration(
                hintText: '168 Jalan Bukit Bintang, KL...',
                border: InputBorder.none,
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Date/time picker ───────────────────────────────────────────
          _Field(
            label: '日期与时间',
            child: GestureDetector(
              onTap: _pickDate,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Icon(Icons.calendar_today_rounded,
                        color: AppTheme.primary, size: 18),
                    const SizedBox(width: 10),
                    Text(
                      DateFormat('yyyy年M月d日  HH:mm').format(_date),
                      style: const TextStyle(fontSize: 15),
                    ),
                    const Spacer(),
                    Icon(Icons.chevron_right_rounded,
                        color: AppTheme.textHint, size: 18),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Max attendees ─────────────────────────────────────────────
          _Field(
            label: '最多参加人数：$_maxAttendees 人',
            child: Slider(
              value: _maxAttendees.toDouble(),
              min: 2,
              max: 100,
              divisions: 98,
              activeColor: AppTheme.primary,
              inactiveColor: AppTheme.card,
              onChanged: (v) => setState(() => _maxAttendees = v.round()),
            ),
          ),
          const SizedBox(height: 12),

          // ── Price ──────────────────────────────────────────────────────
          _Field(
            label: _price == 0 ? '票价：免费' : '票价：RM ${_price.toStringAsFixed(0)}',
            child: Slider(
              value: _price,
              min: 0,
              max: 200,
              divisions: 40,
              activeColor: AppTheme.primary,
              inactiveColor: AppTheme.card,
              onChanged: (v) => setState(() => _price = v),
            ),
          ),

          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: ColorScheme.dark(primary: AppTheme.primary),
        ),
        child: child!,
      ),
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_date),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: ColorScheme.dark(primary: AppTheme.primary),
        ),
        child: child!,
      ),
    );
    if (time == null) return;

    setState(() {
      _date = DateTime(
          date.year, date.month, date.day, time.hour, time.minute);
    });
  }
}

class _Field extends StatelessWidget {
  final String label;
  final Widget child;
  const _Field({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
                color: AppTheme.textHint,
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.3),
          ),
          child,
        ],
      ),
    );
  }
}
