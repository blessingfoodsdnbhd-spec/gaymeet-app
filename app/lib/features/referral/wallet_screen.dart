import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/theme.dart';
import '../../core/providers/referral_provider.dart';
import '../../core/api/referral_service.dart';

const _goldGradient = LinearGradient(
  colors: [Color(0xFFFFB300), Color(0xFFFF6D00)],
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
);

class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  bool _showWithdrawForm = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(referralProvider.notifier).loadWallet();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(referralProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('奖励中心')),
      body: state.isLoading && state.transactions.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () => ref.read(referralProvider.notifier).loadWallet(),
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  _BalanceCard(
                    balance: state.walletBalance,
                    totalEarned: state.totalEarned,
                    totalWithdrawn: state.totalWithdrawn,
                    onWithdraw: () => setState(() => _showWithdrawForm = !_showWithdrawForm),
                  ),
                  if (_showWithdrawForm) ...[
                    const SizedBox(height: 16),
                    _RedeemForm(
                      maxAmount: state.walletBalance,
                      onSuccess: () => setState(() => _showWithdrawForm = false),
                    ),
                  ],
                  const SizedBox(height: 24),
                  _TransactionHistory(transactions: state.transactions),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }
}

// ── Balance card ──────────────────────────────────────────────────────────────

class _BalanceCard extends StatelessWidget {
  final double balance;
  final double totalEarned;
  final double totalWithdrawn;
  final VoidCallback onWithdraw;

  const _BalanceCard({
    required this.balance,
    required this.totalEarned,
    required this.totalWithdrawn,
    required this.onWithdraw,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: _goldGradient,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFB300).withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '金币余额',
            style: TextStyle(color: Colors.black54, fontSize: 13, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            '${(balance * 10).toInt()} 🪙',
            style: const TextStyle(
              color: Colors.black,
              fontSize: 40,
              fontWeight: FontWeight.w900,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _MiniStat(label: '累计获得', value: '${(totalEarned * 10).toInt()}🪙'),
              const SizedBox(width: 24),
              _MiniStat(label: '已兑换', value: '${(totalWithdrawn * 10).toInt()}🪙'),
            ],
          ),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: onWithdraw,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Center(
                child: Text(
                  '兑换 Premium 会员',
                  style: TextStyle(
                    color: Color(0xFFFFB300),
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              '金币可兑换Premium会员或其他特权',
              style: TextStyle(color: Colors.black.withValues(alpha: 0.5), fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: Colors.black.withValues(alpha: 0.55), fontSize: 11)),
        const SizedBox(height: 2),
        Text(value,
            style: const TextStyle(
                color: Colors.black, fontWeight: FontWeight.w700, fontSize: 14)),
      ],
    );
  }
}

// ── Redeem form (premium exchange) ───────────────────────────────────────────

class _RedeemForm extends ConsumerStatefulWidget {
  final double maxAmount;
  final VoidCallback onSuccess;

  const _RedeemForm({required this.maxAmount, required this.onSuccess});

  @override
  ConsumerState<_RedeemForm> createState() => _RedeemFormState();
}

class _RedeemFormState extends ConsumerState<_RedeemForm> {
  // Redeem options: displayed as coin packages, mapped internally to RM amounts
  static const _options = [
    {'label': '1 个月 Premium', 'coins': 299, 'rm': 29.9, 'icon': '👑'},
    {'label': '3 个月 Premium', 'coins': 799, 'rm': 79.9, 'icon': '💎'},
    {'label': '100 金币充值', 'coins': 99, 'rm': 9.9, 'icon': '🪙'},
  ];

  int _selected = 0;
  bool _isLoading = false;
  bool _showCashout = false;

  // Cashout fields (hidden behind "联系客服")
  final _detailsC = TextEditingController();
  String _method = 'ewallet';

  @override
  void dispose() {
    _detailsC.dispose();
    super.dispose();
  }

  int get _availableCoins => (widget.maxAmount * 10).toInt();

  Future<void> _redeem() async {
    final opt = _options[_selected];
    final coinsNeeded = opt['coins'] as int;
    if (_availableCoins < coinsNeeded) {
      _snack('金币不足，继续邀请好友赚取更多金币！');
      return;
    }
    setState(() => _isLoading = true);
    // Internally this maps to a withdrawal for admin tracking
    final rmAmount = opt['rm'] as double;
    final error = await ref.read(referralProvider.notifier).requestWithdrawal(
          amount: rmAmount,
          method: 'manual',
          accountDetails: '兑换：${opt['label']}',
        );
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (error == null) {
      _snack('兑换申请已提交！客服将在1-2个工作日内处理');
      widget.onSuccess();
    } else {
      _snack('兑换失败: $error');
    }
  }

  Future<void> _submitCashout() async {
    if (_detailsC.text.trim().isEmpty) {
      _snack('请填写账户信息');
      return;
    }
    final minRm = 10.0;
    if (widget.maxAmount < minRm) {
      _snack('金币不足，最低兑换 RM10 等值金币');
      return;
    }
    setState(() => _isLoading = true);
    final error = await ref.read(referralProvider.notifier).requestWithdrawal(
          amount: widget.maxAmount,
          method: _method,
          accountDetails: _detailsC.text.trim(),
        );
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (error == null) {
      _snack('申请已提交，客服将联系你处理');
      widget.onSuccess();
    } else {
      _snack('提交失败: $error');
    }
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: AppTheme.card,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFFB300).withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('兑换特权',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              const Spacer(),
              Text(
                '可用：$_availableCoins🪙',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '金币可兑换Premium会员或联系客服提现',
            style: TextStyle(color: AppTheme.textHint, fontSize: 11),
          ),
          const SizedBox(height: 16),

          // Redeem options
          ..._options.asMap().entries.map((e) {
            final i = e.key;
            final opt = e.value;
            final coins = opt['coins'] as int;
            final selected = _selected == i;
            final canAfford = _availableCoins >= coins;
            return GestureDetector(
              onTap: canAfford ? () => setState(() => _selected = i) : null,
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  gradient: selected ? _goldGradient : null,
                  color: selected ? null : AppTheme.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: selected
                        ? Colors.transparent
                        : canAfford
                            ? AppTheme.surface
                            : AppTheme.surface,
                  ),
                ),
                child: Row(
                  children: [
                    Text(opt['icon'] as String,
                        style: const TextStyle(fontSize: 22)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        opt['label'] as String,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: selected
                              ? Colors.black
                              : canAfford
                                  ? AppTheme.textPrimary
                                  : AppTheme.textHint,
                        ),
                      ),
                    ),
                    Text(
                      '$coins🪙',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: selected ? Colors.black : const Color(0xFFFFB300),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),

          const SizedBox(height: 16),

          // Main CTA
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _redeem,
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.zero,
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
              ),
              child: Ink(
                decoration: BoxDecoration(
                  gradient: _goldGradient,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Center(
                    child: _isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                color: Colors.black, strokeWidth: 2),
                          )
                        : const Text(
                            '立即兑换',
                            style: TextStyle(
                              color: Colors.black,
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                  ),
                ),
              ),
            ),
          ),

          // Subtle cashout link
          const SizedBox(height: 16),
          Center(
            child: GestureDetector(
              onTap: () => setState(() => _showCashout = !_showCashout),
              child: Text(
                '联系客服提现',
                style: TextStyle(
                  color: AppTheme.textHint,
                  fontSize: 12,
                  decoration: TextDecoration.underline,
                  decorationColor: AppTheme.textHint,
                ),
              ),
            ),
          ),

          // Hidden cashout form
          if (_showCashout) ...[
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 12),
            Text(
              '客服提现申请',
              style: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            // Method selector
            Row(
              children: [
                {'value': 'ewallet', 'label': 'eWallet', 'icon': '📱'},
                {'value': 'bank_transfer', 'label': '银行', 'icon': '🏦'},
              ].map((m) {
                final sel = _method == m['value'];
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _method = m['value']!),
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: sel ? const Color(0xFF2A2A2A) : AppTheme.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: sel
                              ? const Color(0xFFFFB300).withValues(alpha: 0.5)
                              : Colors.transparent,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          '${m['icon']} ${m['label']}',
                          style: TextStyle(
                            fontSize: 12,
                            color: sel
                                ? const Color(0xFFFFB300)
                                : AppTheme.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _detailsC,
              decoration: InputDecoration(
                hintText: _method == 'bank_transfer'
                    ? '银行名称 + 账号'
                    : '手机号码 (TnG / GrabPay)',
              ),
            ),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: _isLoading ? null : _submitCashout,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: AppTheme.textHint.withValues(alpha: 0.3)),
                ),
                child: Center(
                  child: Text(
                    '提交客服提现申请',
                    style: TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Transaction history ───────────────────────────────────────────────────────

class _TransactionHistory extends StatelessWidget {
  final List<WalletTransaction> transactions;
  const _TransactionHistory({required this.transactions});

  @override
  Widget build(BuildContext context) {
    if (transactions.isEmpty) {
      return Center(
        child: Text(
          '暂无交易记录',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('交易记录',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        ...transactions.map((t) => _TxTile(tx: t)),
      ],
    );
  }
}

class _TxTile extends StatelessWidget {
  final WalletTransaction tx;
  const _TxTile({required this.tx});

  @override
  Widget build(BuildContext context) {
    final isCommission = tx.type == 'commission';
    final coins = (tx.amount.abs() * 10).toInt();
    final amountStr = isCommission ? '+${coins}🪙' : '-${coins}🪙';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: isCommission
                  ? const Color(0xFF1B5E20)
                  : AppTheme.surface,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                isCommission ? '💰' : '🏦',
                style: const TextStyle(fontSize: 18),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isCommission
                      ? '奖励金币 · ${tx.fromUserNickname ?? '好友'}'
                      : _redeemLabel(tx.method ?? ''),
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
                const SizedBox(height: 2),
                Text(
                  _formatDate(tx.createdAt),
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                amountStr,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: isCommission
                      ? const Color(0xFF4CAF50)
                      : AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 2),
              _StatusBadge(status: tx.status),
            ],
          ),
        ],
      ),
    );
  }

  String _redeemLabel(String m) {
    switch (m) {
      case 'ewallet':
        return '客服提现申请';
      case 'bank_transfer':
        return '客服提现申请';
      case 'manual':
        return '兑换特权';
      default:
        return '金币兑换';
    }
  }

  String _formatDate(DateTime dt) {
    return '${dt.year}/${dt.month.toString().padLeft(2, '0')}/${dt.day.toString().padLeft(2, '0')}';
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label;
    switch (status) {
      case 'approved':
      case 'completed':
        bg = const Color(0xFF1B5E20);
        fg = const Color(0xFF4CAF50);
        label = '已到账';
        break;
      case 'pending':
        bg = const Color(0xFF3E2723);
        fg = const Color(0xFFFFB300);
        label = '兑换中';
        break;
      case 'rejected':
        bg = const Color(0xFFB71C1C);
        fg = AppTheme.error;
        label = '已拒绝';
        break;
      default:
        bg = AppTheme.surface;
        fg = AppTheme.textHint;
        label = status;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: fg)),
    );
  }
}
