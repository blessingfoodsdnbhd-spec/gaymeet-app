import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../config/theme.dart';
import '../../core/models/event.dart';
import '../../core/providers/events_provider.dart';

class EventDetailScreen extends ConsumerStatefulWidget {
  final AppEvent event;
  const EventDetailScreen({super.key, required this.event});

  @override
  ConsumerState<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends ConsumerState<EventDetailScreen> {
  late AppEvent _event;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _event = widget.event;
  }

  Future<void> _join(String status) async {
    setState(() => _loading = true);
    final ok =
        await ref.read(eventsProvider.notifier).joinEvent(_event.id, status: status);
    if (ok) {
      setState(() {
        _event = _event.copyWith(
          isAttending: true,
          myStatus: status,
          currentAttendees: _event.currentAttendees + 1,
        );
      });
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('参加失败，请检查金币余额或名额')),
      );
    }
    setState(() => _loading = false);
  }

  Future<void> _leave() async {
    setState(() => _loading = true);
    await ref.read(eventsProvider.notifier).leaveEvent(_event.id);
    setState(() {
      _event = _event.copyWith(
        isAttending: false,
        myStatus: 'cancelled',
        currentAttendees: (_event.currentAttendees - 1).clamp(0, _event.maxAttendees),
      );
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isFree = _event.price == 0;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // ── Cover image app bar ─────────────────────────────────────────
          SliverAppBar(
            expandedHeight: 220,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: _event.coverImage != null
                  ? Stack(
                      fit: StackFit.expand,
                      children: [
                        CachedNetworkImage(
                          imageUrl: _event.coverImage!,
                          fit: BoxFit.cover,
                        ),
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Colors.transparent, Colors.black87],
                            ),
                          ),
                        ),
                      ],
                    )
                  : Container(
                      decoration: BoxDecoration(
                        gradient: _categoryGradient(_event.category),
                      ),
                      child: Center(
                        child: Text(
                          _categoryEmoji(_event.category),
                          style: const TextStyle(fontSize: 64),
                        ),
                      ),
                    ),
            ),
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Title + price ─────────────────────────────────────
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          _event.title,
                          style: const TextStyle(
                              fontSize: 20, fontWeight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 5),
                        decoration: BoxDecoration(
                          color: isFree
                              ? const Color(0xFF4CAF50)
                              : AppTheme.primary,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          isFree
                              ? '免费'
                              : '${_event.currency} ${_event.price.toStringAsFixed(0)}',
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // ── Info cards ─────────────────────────────────────────
                  _InfoCard(children: [
                    _InfoRow(
                      icon: Icons.calendar_today_rounded,
                      color: AppTheme.primary,
                      label: DateFormat('yyyy年M月d日 HH:mm')
                          .format(_event.date),
                    ),
                    if (_event.endDate != null)
                      _InfoRow(
                        icon: Icons.access_time_rounded,
                        color: AppTheme.textSecondary,
                        label:
                            '结束：${DateFormat('HH:mm').format(_event.endDate!)}',
                      ),
                    _InfoRow(
                      icon: Icons.location_on_rounded,
                      color: const Color(0xFF4CAF50),
                      label:
                          '${_event.venue}\n${_event.address}',
                    ),
                    _InfoRow(
                      icon: Icons.people_rounded,
                      color: const Color(0xFF2196F3),
                      label:
                          '${_event.currentAttendees} / ${_event.maxAttendees} 人',
                    ),
                  ]),

                  const SizedBox(height: 16),

                  // ── Description ───────────────────────────────────────
                  if (_event.description.isNotEmpty) ...[
                    const Text('活动详情',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    Text(_event.description,
                        style: const TextStyle(
                            fontSize: 14, height: 1.6)),
                    const SizedBox(height: 16),
                  ],

                  // ── Attendee avatars ──────────────────────────────────
                  if (_event.attendees.isNotEmpty) ...[
                    const Text('参与者',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 44,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _event.attendees.length,
                        itemBuilder: (_, i) => Container(
                          width: 40,
                          height: 40,
                          margin: const EdgeInsets.only(right: 6),
                          decoration:
                              const BoxDecoration(shape: BoxShape.circle),
                          clipBehavior: Clip.antiAlias,
                          child: _event.attendees[i].avatarUrl != null
                              ? CachedNetworkImage(
                                  imageUrl:
                                      _event.attendees[i].avatarUrl!,
                                  fit: BoxFit.cover)
                              : Container(
                                  color: AppTheme.card,
                                  child: const Icon(Icons.person_rounded,
                                      color: Color(0xFF3A3A3A),
                                      size: 20)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // ── Organizer card ────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppTheme.card,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration:
                              const BoxDecoration(shape: BoxShape.circle),
                          clipBehavior: Clip.antiAlias,
                          child: _event.organizer.avatarUrl != null
                              ? CachedNetworkImage(
                                  imageUrl: _event.organizer.avatarUrl!,
                                  fit: BoxFit.cover)
                              : Container(
                                  color: AppTheme.surface,
                                  child: const Icon(Icons.person_rounded,
                                      color: Color(0xFF3A3A3A))),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text('主办：',
                                      style: TextStyle(
                                          color: AppTheme.textHint,
                                          fontSize: 12)),
                                  Text(_event.organizer.nickname,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 13)),
                                  if (_event.organizer.isPremium) ...[
                                    const SizedBox(width: 4),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 5, vertical: 1),
                                      decoration: BoxDecoration(
                                        gradient: AppTheme.brandGradient,
                                        borderRadius:
                                            BorderRadius.circular(4),
                                      ),
                                      child: const Text('VIP',
                                          style: TextStyle(
                                              fontSize: 9,
                                              color: Colors.white,
                                              fontWeight: FontWeight.w700)),
                                    ),
                                  ],
                                ],
                              ),
                              if (_event.organizer.bio != null &&
                                  _event.organizer.bio!.isNotEmpty)
                                Text(
                                  _event.organizer.bio!,
                                  style: TextStyle(
                                      color: AppTheme.textSecondary,
                                      fontSize: 12),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),

      // ── Bottom CTA ─────────────────────────────────────────────────────
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(
            16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
        decoration: const BoxDecoration(
          color: AppTheme.surface,
          border: Border(top: BorderSide(color: Color(0xFF2A2A2A), width: 0.5)),
        ),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _event.isAttending
                ? Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _leave,
                          style: OutlinedButton.styleFrom(
                              side: BorderSide(
                                  color: AppTheme.textHint)),
                          child: const Text('取消参加'),
                        ),
                      ),
                    ],
                  )
                : _event.isFull
                    ? Center(
                        child: Text('名额已满',
                            style: TextStyle(
                                color: AppTheme.textHint, fontSize: 15)),
                      )
                    : Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => _join('interested'),
                              child: const Text('感兴趣'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            flex: 2,
                            child: ElevatedButton(
                              onPressed: () => _join('going'),
                              child: Text(isFree
                                  ? '参加活动'
                                  : '参加（${_event.currency} ${_event.price.toStringAsFixed(0)}）'),
                            ),
                          ),
                        ],
                      ),
      ),
    );
  }

  LinearGradient _categoryGradient(String cat) {
    switch (cat) {
      case 'makan':
        return const LinearGradient(
            colors: [Color(0xFF8B1A1A), Color(0xFFD4380D)]);
      case 'party':
        return const LinearGradient(
            colors: [Color(0xFF4A0E82), Color(0xFFAD4ECC)]);
      case 'sports':
        return const LinearGradient(
            colors: [Color(0xFF004D8C), Color(0xFF0095FF)]);
      default:
        return AppTheme.brandGradient;
    }
  }

  String _categoryEmoji(String cat) {
    switch (cat) {
      case 'makan': return '🍜';
      case 'party': return '🎉';
      case 'sports': return '💪';
      case 'hangout': return '☕';
      default: return '📅';
    }
  }
}

// ── Info helpers ──────────────────────────────────────────────────────────────

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          children: children
              .expand((w) => [w, const Divider(height: 12, color: Color(0xFF2A2A2A))])
              .toList()
            ..removeLast(),
        ),
      );
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  const _InfoRow({required this.icon, required this.color, required this.label});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(fontSize: 13, height: 1.4),
              ),
            ),
          ],
        ),
      );
}
