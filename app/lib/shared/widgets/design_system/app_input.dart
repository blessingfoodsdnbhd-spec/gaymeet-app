import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';

class AppInput extends StatelessWidget {
  final TextEditingController? controller;
  final String? hintText;
  final String? labelText;
  final bool obscureText;
  final TextInputType? keyboardType;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final void Function(String)? onSubmitted;
  final int? maxLines;
  final int? maxLength;
  final bool autofocus;
  final FocusNode? focusNode;

  const AppInput({
    super.key,
    this.controller,
    this.hintText,
    this.labelText,
    this.obscureText = false,
    this.keyboardType,
    this.prefixIcon,
    this.suffixIcon,
    this.validator,
    this.onChanged,
    this.onSubmitted,
    this.maxLines = 1,
    this.maxLength,
    this.autofocus = false,
    this.focusNode,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      validator: validator,
      onChanged: onChanged,
      onFieldSubmitted: onSubmitted,
      maxLines: maxLines,
      maxLength: maxLength,
      autofocus: autofocus,
      focusNode: focusNode,
      style: AppTypography.body,
      decoration: InputDecoration(
        hintText: hintText,
        labelText: labelText,
        labelStyle: const TextStyle(color: AppColors.textHint),
        hintStyle: const TextStyle(color: AppColors.textHint),
        prefixIcon: prefixIcon != null
            ? IconTheme(
                data: const IconThemeData(color: AppColors.textHint, size: 20),
                child: prefixIcon!,
              )
            : null,
        suffixIcon: suffixIcon != null
            ? IconTheme(
                data: const IconThemeData(color: AppColors.textHint, size: 20),
                child: suffixIcon!,
              )
            : null,
        filled: true,
        fillColor: AppColors.bgCard,
        border: OutlineInputBorder(
          borderRadius: AppRadius.mdRadius,
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdRadius,
          borderSide: BorderSide(
            color: AppColors.pink500.withValues(alpha: 0.15),
            width: 1,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdRadius,
          borderSide: const BorderSide(color: AppColors.pink500, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdRadius,
          borderSide: const BorderSide(color: AppColors.error, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdRadius,
          borderSide: const BorderSide(color: AppColors.error, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        counterStyle: const TextStyle(color: AppColors.textHint, fontSize: 11),
      ),
    );
  }
}
