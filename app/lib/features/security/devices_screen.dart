import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../config/theme.dart';
import '../../core/api/security_service.dart';
import '../../core/providers/auth_provider.dart';

class DevicesScreen extends ConsumerStatefulWidget {
  const DevicesScreen({super.key});

  @override
  ConsumerState<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends ConsumerState<DevicesScreen> {
  late SecurityService _svc;
  List<Map<String, dynamic>> _devices = [];
  bool _loading = true;
  String? _error;
  String? _currentDeviceId; // In a real app, stored in secure storage

  @override
  void initState() {
    super.initState();
    _svc = SecurityService(ref.read(apiClientProvider));
    _loadDevices();
  }

  Future<void> _loadDevices() async {
    setState(() { _loading = true; _error = null; });
    try {
      final devices = await _svc.getDevices();
      setState(() {
        _devices = devices;
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _removeDevice(String deviceId, String deviceName) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: const Text('注销设备'),
        content: Text('确定要注销"$deviceName"吗？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('取消')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('注销', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _svc.removeDevice(deviceId);
      await _loadDevices();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('设备已注销')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('操作失败: $e')),
        );
      }
    }
  }

  String _formatDate(dynamic date) {
    if (date == null) return '未知';
    try {
      final dt = date is DateTime ? date : DateTime.parse(date.toString());
      return DateFormat('yyyy-MM-dd HH:mm').format(dt.toLocal());
    } catch (_) {
      return date.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('已登录设备'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadDevices,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, color: AppTheme.error, size: 48),
                      const SizedBox(height: 12),
                      Text(_error!),
                      const SizedBox(height: 16),
                      ElevatedButton(
                          onPressed: _loadDevices, child: const Text('重试')),
                    ],
                  ),
                )
              : _devices.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.devices_rounded,
                              size: 64, color: AppTheme.textHint),
                          const SizedBox(height: 12),
                          Text(
                            '暂无登录设备',
                            style:
                                TextStyle(color: AppTheme.textSecondary),
                          ),
                        ],
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _devices.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final device = _devices[i];
                        final deviceId =
                            device['deviceId'] as String? ?? '';
                        final deviceName =
                            device['deviceName'] as String? ??
                                'Unknown Device';
                        final lastUsed = device['lastUsed'];
                        final ip = device['ip'] as String?;
                        final isCurrent = deviceId == _currentDeviceId;

                        return Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: isCurrent
                                ? AppTheme.primary.withValues(alpha: 0.08)
                                : AppTheme.card,
                            borderRadius: BorderRadius.circular(12),
                            border: isCurrent
                                ? Border.all(
                                    color: AppTheme.primary.withValues(alpha: 0.4))
                                : null,
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: AppTheme.surface,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(
                                  Icons.phone_android_rounded,
                                  color: isCurrent
                                      ? AppTheme.primary
                                      : AppTheme.textSecondary,
                                  size: 22,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Flexible(
                                          child: Text(
                                            deviceName,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w600),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        if (isCurrent) ...[
                                          const SizedBox(width: 6),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: AppTheme.primary
                                                  .withValues(alpha: 0.15),
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              '当前设备',
                                              style: TextStyle(
                                                  fontSize: 10,
                                                  color: AppTheme.primary,
                                                  fontWeight:
                                                      FontWeight.w600),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '最后使用: ${_formatDate(lastUsed)}',
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: AppTheme.textSecondary),
                                    ),
                                    if (ip != null && ip.isNotEmpty)
                                      Text(
                                        'IP: $ip',
                                        style: TextStyle(
                                            fontSize: 11,
                                            color: AppTheme.textHint),
                                      ),
                                  ],
                                ),
                              ),
                              if (!isCurrent)
                                TextButton(
                                  onPressed: () =>
                                      _removeDevice(deviceId, deviceName),
                                  child: const Text(
                                    '注销',
                                    style: TextStyle(color: Colors.red),
                                  ),
                                ),
                            ],
                          ),
                        );
                      },
                    ),
    );
  }
}
