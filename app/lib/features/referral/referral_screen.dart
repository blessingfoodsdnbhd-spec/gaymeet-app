import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../core/providers/referral_provider.dart';

// Gold/orange gradient for rewards UI
const _goldGradient = LinearGradient(
  colors: [Color(0xFFFFB300), Color(0xFFFF6D00)],
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
);

class ReferralScreen extends ConsumerStatefulWidget {
  const ReferralScreen({super.key});

  @override
  ConsumerState<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends ConsumerState<ReferralScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(referralProvider.notifier).load();
    });
  }

  void _copyCode(String code) {
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('邀请码已复制！'),
        backgroundColor: AppTheme.card,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _share(String message) {
    // Share via platform share sheet
    Clipboard.setData(ClipboardData(text: message));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('分享内容已复制到剪贴板'),
        backgroundColor: AppTheme.card,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(referralProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('邀请好友'),
        actions: [
          IconButton(
            icon: const Icon(Icons.card_giftcard_rounded),
            onPressed: () => context.push('/wallet'),
            tooltip: '奖励中心',
          ),
        ],
      ),
      body: state.isLoading && state.myCode.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () => ref.read(referralProvider.notifier).load(),
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  _HeroBanner(onShare: () => _share(state.shareMessage)),
                  const SizedBox(height: 20),
                  _CodeCard(
                    code: state.myCode,
                    onCopy: () => _copyCode(state.myCode),
                    onShare: () => _share(state.shareMessage),
                  ),
                  const SizedBox(height: 20),
                  _StatsRow(
                    count: state.referralCount,
                    earned: state.totalEarned,
                    balance: state.walletBalance,
                    onWalletTap: () => context.push('/wallet'),
                  ),
                  const SizedBox(height: 24),
                  _HowItWorksCard(),
                  const SizedBox(height: 24),
                  _ReferralList(entries: state.referralList),
                  const SizedBox(height: 24),
                  _WithdrawButton(
                    balance: state.walletBalance,
                    onTap: () => context.push('/wallet'),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }
}

// ── Hero banner ───────────────────────────────────────────────────────────────

class _HeroBanner extends StatelessWidget {
  final VoidCallback onShare;
  const _HeroBanner({required this.onShare});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: _goldGradient,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFB300).withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          )
        ],
      ),
      child: Column(
        children: [
          const Text('💰', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          const Text(
            '邀请好友得金币奖励',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Colors.black,
              height: 1.2,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            '朋友用你的邀请码注册，双方都获得金币奖励\n金币可兑换Premium会员及更多特权',
            style: TextStyle(
              fontSize: 13,
              color: Colors.black.withOpacity(0.7),
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: onShare,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                '立即分享',
                style: TextStyle(
                  color: Color(0xFFFFB300),
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Code card ─────────────────────────────────────────────────────────────────

class _CodeCard extends StatelessWidget {
  final String code;
  final VoidCallback onCopy;
  final VoidCallback onShare;

  const _CodeCard({required this.code, required this.onCopy, required this.onShare});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFFB300).withOpacity(0.3), width: 1),
      ),
      child: Column(
        children: [
          Text(
            '我的邀请码',
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: onCopy,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  code.isEmpty ? '加载中...' : code,
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 6,
                    color: Color(0xFFFFB300),
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.copy_rounded, size: 18, color: Color(0xFFFFB300)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '点击复制',
            style: TextStyle(color: AppTheme.textHint, fontSize: 11),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _ActionButton(
                  icon: Icons.copy_rounded,
                  label: '复制码',
                  onTap: onCopy,
                  primary: false,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _ActionButton(
                  icon: Icons.share_rounded,
                  label: '分享',
                  onTap: onShare,
                  primary: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool primary;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.primary,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          gradient: primary ? _goldGradient : null,
          color: primary ? null : AppTheme.surface,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 16,
                color: primary ? Colors.black : AppTheme.textSecondary),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: primary ? Colors.black : AppTheme.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Stats row ─────────────────────────────────────────────────────────────────

class _StatsRow extends StatelessWidget {
  final int count;
  final double earned;
  final double balance;
  final VoidCallback onWalletTap;

  const _StatsRow({
    required this.count,
    required this.earned,
    required this.balance,
    required this.onWalletTap,
  });

  // Convert RM amounts to coin display (1 RM = 10 coins for display purposes)
  String _toCoins(double rm) => '${(rm * 10).toInt()}🪙';

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _StatChip(value: '$count', label: '已邀请'),
        const SizedBox(width: 10),
        _StatChip(value: _toCoins(earned), label: '累计奖励'),
        const SizedBox(width: 10),
        Expanded(
          child: GestureDetector(
            onTap: onWalletTap,
            child: _StatChip(
              value: _toCoins(balance),
              label: '可兑换奖励',
              highlight: true,
            ),
          ),
        ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  final String value;
  final String label;
  final bool highlight;

  const _StatChip({required this.value, required this.label, this.highlight = false});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          gradient: highlight ? _goldGradient : null,
          color: highlight ? null : AppTheme.card,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: highlight ? Colors.black : AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: highlight ? Colors.black54 : AppTheme.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── How it works ──────────────────────────────────────────────────────────────

class _HowItWorksCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '如何运作',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          _Step(n: '1', text: '分享你的邀请码给朋友'),
          _Step(n: '2', text: '朋友用你的码注册Meyou'),
          _Step(n: '3', text: '朋友完成注册后，双方各获得金币奖励'),
          _Step(n: '4', text: '金币可兑换Premium会员或其他特权'),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  final String n;
  final String text;
  const _Step({required this.n, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: const BoxDecoration(gradient: _goldGradient, shape: BoxShape.circle),
            child: Center(
              child: Text(n,
                  style: const TextStyle(
                      color: Colors.black, fontWeight: FontWeight.w800, fontSize: 12)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(text,
                style: const TextStyle(fontSize: 14, height: 1.4)),
          ),
        ],
      ),
    );
  }
}

// ── Referral list ─────────────────────────────────────────────────────────────

class _ReferralList extends StatelessWidget {
  final List<ReferralEntry> entries;
  const _ReferralList({required this.entries});

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return Column(
        children: [
          Text(
            '还没有邀请任何人',
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
          ),
          const SizedBox(height: 6),
          Text(
            '快去分享你的邀请码吧！',
            style: TextStyle(color: AppTheme.textHint, fontSize: 12),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text('我的邀请列表',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            const Spacer(),
            Text('${entries.length}人',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          ],
        ),
        const SizedBox(height: 12),
        ...entries.map((e) => _ReferralTile(entry: e)),
      ],
    );
  }
}

class _ReferralTile extends StatelessWidget {
  final ReferralEntry entry;
  const _ReferralTile({required this.entry});

  @override
  Widget build(BuildContext context) {
    final isActive = entry.status == 'active';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: AppTheme.surface,
            backgroundImage:
                entry.avatarUrl != null ? NetworkImage(entry.avatarUrl!) : null,
            child: entry.avatarUrl == null
                ? Text(
                    entry.nickname.isNotEmpty ? entry.nickname[0].toUpperCase() : '?',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  )
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entry.nickname,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                const SizedBox(height: 2),
                Text(
                  '加入 ${_formatDate(entry.joinDate)}',
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (entry.totalCommission > 0)
                Text(
                  '+${(entry.totalCommission * 10).toInt()}🪙',
                  style: const TextStyle(
                    color: Color(0xFFFFB300),
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isActive
                      ? const Color(0xFF1B5E20)
                      : AppTheme.surface,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  isActive ? '已激活' : '待激活',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: isActive ? const Color(0xFF4CAF50) : AppTheme.textHint,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime dt) {
    return '${dt.year}/${dt.month.toString().padLeft(2, '0')}/${dt.day.toString().padLeft(2, '0')}';
  }
}

// ── Withdraw button ───────────────────────────────────────────────────────────

class _WithdrawButton extends StatelessWidget {
  final double balance;
  final VoidCallback onTap;
  const _WithdrawButton({required this.balance, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFFFB300).withOpacity(0.4)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: const BoxDecoration(
                gradient: _goldGradient,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.account_balance_wallet_rounded,
                  color: Colors.black, size: 22),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('奖励中心',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  Text(
                    '${(balance * 10).toInt()}🪙 可兑换',
                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFFFFB300)),
          ],
        ),
      ),
    );
  }
}
