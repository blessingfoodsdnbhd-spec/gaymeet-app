import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';

class AppAvatar extends StatelessWidget {
  final String? imageUrl;
  final String? initials;
  final double size;
  final bool isOnline;
  final bool isPremium;
  final bool rainbowBorder;

  const AppAvatar({
    super.key,
    this.imageUrl,
    this.initials,
    this.size = 48,
    this.isOnline = false,
    this.isPremium = false,
    this.rainbowBorder = false,
  });

  @override
  Widget build(BuildContext context) {
    final borderWidth = size * 0.06;
    final innerSize = size - borderWidth * 2;

    Widget avatar = Container(
      width: innerSize,
      height: innerSize,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.bgSurface,
        image: imageUrl != null
            ? DecorationImage(
                image: NetworkImage(imageUrl!),
                fit: BoxFit.cover,
              )
            : null,
      ),
      child: imageUrl == null
          ? Center(
              child: Text(
                initials ?? '?',
                style: TextStyle(
                  fontSize: innerSize * 0.38,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            )
          : null,
    );

    if (rainbowBorder || isPremium) {
      avatar = Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: rainbowBorder
              ? AppColors.rainbowGradient
              : AppColors.goldGradient,
        ),
        child: Padding(
          padding: EdgeInsets.all(borderWidth),
          child: avatar,
        ),
      );
    } else {
      avatar = SizedBox(width: size, height: size, child: avatar);
    }

    if (isOnline) {
      final dotSize = size * 0.27;
      return Stack(
        clipBehavior: Clip.none,
        children: [
          avatar,
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: dotSize,
              height: dotSize,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.online,
                border: Border.all(color: AppColors.bgDark, width: 2),
              ),
            ),
          ),
        ],
      );
    }

    return avatar;
  }
}
