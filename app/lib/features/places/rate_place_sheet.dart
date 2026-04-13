import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/theme.dart';
import '../../core/models/place.dart';
import '../../core/providers/places_provider.dart';

class RatePlaceSheet extends ConsumerStatefulWidget {
  final String placeId;
  final String placeName;
  final ValueChanged<Place> onSubmitted;

  const RatePlaceSheet({
    super.key,
    required this.placeId,
    required this.placeName,
    required this.onSubmitted,
  });

  @override
  ConsumerState<RatePlaceSheet> createState() => _RatePlaceSheetState();
}

class _RatePlaceSheetState extends ConsumerState<RatePlaceSheet> {
  int _score = 0;
  final _reviewC = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _reviewC.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_score == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('请选择星级评分'),
          backgroundColor: AppTheme.card,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final svc = ref.read(placesServiceProvider);
      final data = await svc.ratePlace(widget.placeId, _score, _reviewC.text.trim());
      if (!mounted) return;
      final updated = Place.fromJson(data['place'] as Map<String, dynamic>);
      widget.onSubmitted(updated);
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('评价失败: $e'),
          backgroundColor: AppTheme.card,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 32,
      ),
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppTheme.textHint,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),

          // Title
          Text(
            widget.placeName,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            '分享你的体验',
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
          ),
          const SizedBox(height: 24),

          // Star picker
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (i) {
              final filled = i < _score;
              return GestureDetector(
                onTap: () => setState(() => _score = i + 1),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 150),
                    child: Icon(
                      filled ? Icons.star_rounded : Icons.star_outline_rounded,
                      key: ValueKey('$i-$filled'),
                      color: filled ? const Color(0xFFFFD700) : AppTheme.textHint,
                      size: 44,
                    ),
                  ),
                ),
              );
            }),
          ),

          // Label
          if (_score > 0) ...[
            const SizedBox(height: 8),
            Text(
              _scoreLabel(_score),
              style: const TextStyle(
                  color: Color(0xFFFFD700),
                  fontSize: 14,
                  fontWeight: FontWeight.w600),
            ),
          ],

          const SizedBox(height: 20),

          // Review input
          TextField(
            controller: _reviewC,
            maxLines: 3,
            maxLength: 300,
            decoration: InputDecoration(
              hintText: '写下你的评价（选填）',
              counterStyle: TextStyle(color: AppTheme.textHint, fontSize: 11),
            ),
          ),
          const SizedBox(height: 20),

          // Submit
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _submit,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : const Text(
                      '提交评价',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w700),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  String _scoreLabel(int score) {
    switch (score) {
      case 1: return '很差';
      case 2: return '一般';
      case 3: return '还好';
      case 4: return '很好';
      case 5: return '非常棒！';
      default: return '';
    }
  }
}
