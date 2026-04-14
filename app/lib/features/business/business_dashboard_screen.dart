import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/models/business_profile.dart';
import '../../core/providers/business_provider.dart';
import '../../shared/widgets/promoted_badge.dart';

class BusinessDashboardScreen extends ConsumerStatefulWidget {
  const BusinessDashboardScreen({super.key});

  @override
  ConsumerState<BusinessDashboardScreen> createState() => _BusinessDashboardScreenState();
}

class _BusinessDashboardScreenState extends ConsumerState<BusinessDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(businessProvider.notifier).getDashboard();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(businessProvider);
    final profile = state.profile;

    if (profile == null) {
      // Not registered — redirect
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.pushReplacement('/business/register');
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('商家后台'),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_rounded),
            onPressed: () => _showEditSheet(context, profile),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Business card ─────────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: profile.isPromoted
                    ? const Color(0xFFFFB300).withValues(alpha: 0.5)
                    : Colors.transparent,
                width: 1.5,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: AppTheme.surface,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Center(
                        child: Text(
                          BusinessProfile.categoryEmoji(profile.category),
                          style: const TextStyle(fontSize: 28),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  profile.businessName,
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
                                ),
                              ),
                              if (profile.isPromoted) const PromotedBadge(),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${BusinessProfile.categoryEmoji(profile.category)} ${BusinessProfile.categoryLabel(profile.category)}',
                            style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (profile.description.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(profile.description,
                      style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.4)),
                ],
                if (profile.address.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(children: [
                    Icon(Icons.location_on_outlined, size: 14, color: AppTheme.textHint),
                    const SizedBox(width: 4),
                    Expanded(child: Text(profile.address,
                        style: TextStyle(color: AppTheme.textSecondary, fontSize: 12))),
                  ]),
                ],
                if (profile.isPromoted && profile.promotedUntil != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFB300).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.bolt_rounded, color: Color(0xFFFFB300), size: 14),
                        const SizedBox(width: 4),
                        Text(
                          '推广至 ${_formatDate(profile.promotedUntil!)}',
                          style: const TextStyle(
                              color: Color(0xFFFFB300), fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 20),

          // ── Stats ─────────────────────────────────────────────────────────────
          const _SectionHeader(title: 'STATS'),
          Row(
            children: [
              Expanded(child: _StatCard(
                icon: Icons.visibility_rounded,
                value: '${profile.totalViews}',
                label: '总曝光',
                color: AppTheme.primary,
              )),
              const SizedBox(width: 12),
              Expanded(child: _StatCard(
                icon: Icons.touch_app_rounded,
                value: '${profile.totalClicks}',
                label: '总点击',
                color: const Color(0xFF4CAF50),
              )),
              const SizedBox(width: 12),
              Expanded(child: _StatCard(
                icon: Icons.trending_up_rounded,
                value: '${profile.weeklyViews}',
                label: '本周曝光',
                color: const Color(0xFFFFB300),
              )),
            ],
          ),

          const SizedBox(height: 20),

          // ── Promote ───────────────────────────────────────────────────────────
          const _SectionHeader(title: 'PROMOTE'),
          _PromotePlanCard(
            plan: 'weekly',
            title: '周推广',
            price: 'RM 50',
            days: 7,
            isActive: profile.isPromoted,
            isLoading: state.isLoading,
            onTap: () => _promote(context, 'weekly'),
          ),
          const SizedBox(height: 12),
          _PromotePlanCard(
            plan: 'monthly',
            title: '月推广',
            price: 'RM 150',
            days: 30,
            isActive: profile.isPromoted,
            isLoading: state.isLoading,
            onTap: () => _promote(context, 'monthly'),
          ),

          const SizedBox(height: 20),

          // ── Benefits ──────────────────────────────────────────────────────────
          const _SectionHeader(title: 'BENEFITS'),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                _BenefitRow(icon: '⭐', text: '在找店页面置顶显示'),
                _BenefitRow(icon: '🔥', text: '专属推广徽章，吸引更多用户'),
                _BenefitRow(icon: '📊', text: '实时曝光统计数据'),
                _BenefitRow(icon: '🎯', text: '精准触达本地LGBT群体'),
              ],
            ),
          ),

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Future<void> _promote(BuildContext context, String plan) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: const Text('确认推广'),
        content: Text(plan == 'weekly'
            ? '周推广套餐：RM 50 / 7天\n\n确认购买吗？'
            : '月推广套餐：RM 150 / 30天\n\n确认购买吗？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('确认', style: TextStyle(color: AppTheme.primary)),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final err = await ref.read(businessProvider.notifier).promote(plan);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(err ?? '推广已开通 🎉'),
    ));
  }

  void _showEditSheet(BuildContext context, BusinessProfile profile) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EditSheet(profile: profile),
    );
  }

  String _formatDate(DateTime d) => '${d.month}/${d.day}';
}

// ── Edit sheet ────────────────────────────────────────────────────────────────

class _EditSheet extends ConsumerStatefulWidget {
  final BusinessProfile profile;
  const _EditSheet({required this.profile});

  @override
  ConsumerState<_EditSheet> createState() => _EditSheetState();
}

class _EditSheetState extends ConsumerState<_EditSheet> {
  late final TextEditingController _descCtrl;
  late final TextEditingController _addressCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _hoursCtrl;

  @override
  void initState() {
    super.initState();
    _descCtrl = TextEditingController(text: widget.profile.description);
    _addressCtrl = TextEditingController(text: widget.profile.address);
    _phoneCtrl = TextEditingController(text: widget.profile.phone ?? '');
    _hoursCtrl = TextEditingController(text: widget.profile.openingHours ?? '');
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _addressCtrl.dispose();
    _phoneCtrl.dispose();
    _hoursCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(businessProvider);
    return Container(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('编辑商家资料', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              const Spacer(),
              IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.pop(context)),
            ],
          ),
          const SizedBox(height: 16),
          TextField(controller: _descCtrl, maxLines: 3,
              decoration: const InputDecoration(labelText: '商家简介')),
          const SizedBox(height: 12),
          TextField(controller: _addressCtrl,
              decoration: const InputDecoration(labelText: '地址')),
          const SizedBox(height: 12),
          TextField(controller: _phoneCtrl, keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: '电话')),
          const SizedBox(height: 12),
          TextField(controller: _hoursCtrl,
              decoration: const InputDecoration(labelText: '营业时间')),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: state.isLoading ? null : () async {
                final err = await ref.read(businessProvider.notifier).update({
                  'description': _descCtrl.text.trim(),
                  'address': _addressCtrl.text.trim(),
                  'phone': _phoneCtrl.text.trim(),
                  'openingHours': _hoursCtrl.text.trim(),
                });
                if (!context.mounted) return;
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(err ?? '更新成功 ✓')),
                );
              },
              child: state.isLoading
                  ? const SizedBox(width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('保存'),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Small widgets ─────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(title,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: AppTheme.textHint, letterSpacing: 1.2)),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;
  const _StatCard({required this.icon, required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppTheme.card, borderRadius: BorderRadius.circular(16)),
      child: Column(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: color)),
          Text(label, style: TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
        ],
      ),
    );
  }
}

class _PromotePlanCard extends StatelessWidget {
  final String plan;
  final String title;
  final String price;
  final int days;
  final bool isActive;
  final bool isLoading;
  final VoidCallback onTap;

  const _PromotePlanCard({
    required this.plan,
    required this.title,
    required this.price,
    required this.days,
    required this.isActive,
    required this.isLoading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: isLoading ? null : onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFFFB300).withValues(alpha: 0.3), width: 1),
        ),
        child: Row(
          children: [
            Container(
              width: 44, height: 44,
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [Color(0xFFFFB300), Color(0xFFFF6D00)]),
                shape: BoxShape.circle,
              ),
              child: const Center(child: Icon(Icons.bolt_rounded, color: Colors.white, size: 22)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                Text('$days天推广 · $price', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
              ]),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFFFFB300), Color(0xFFFF6D00)]),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(price, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}

class _BenefitRow extends StatelessWidget {
  final String icon;
  final String text;
  const _BenefitRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(children: [
        Text(icon, style: const TextStyle(fontSize: 16)),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: TextStyle(color: AppTheme.textSecondary, fontSize: 13))),
      ]),
    );
  }
}
