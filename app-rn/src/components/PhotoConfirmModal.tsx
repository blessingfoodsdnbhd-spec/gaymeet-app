import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Send } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Full-screen preview + confirm before sending a picked photo (VVVV). Standard
 * WhatsApp/iMessage flow: pick → preview (big) → optional caption → Send. Cancel
 * dismisses without sending. onSend receives the (trimmed by caller) caption.
 */
export function PhotoConfirmModal({
  uri,
  open,
  sending = false,
  onCancel,
  onSend,
}: {
  uri: string | null;
  open: boolean;
  sending?: boolean;
  onCancel: () => void;
  onSend: (caption: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [caption, setCaption] = useState('');
  // Reset the caption each time a new photo is opened.
  useEffect(() => {
    if (open) setCaption('');
  }, [open, uri]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Pressable onPress={onCancel} hitSlop={10}>
              <X size={26} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
          </View>

          <KeyboardAvoidingView behavior="padding">
            <View style={styles.bottomRow}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder={t('chat.photoConfirm.captionPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.5)"
                style={styles.caption}
                multiline
              />
              <Pressable
                onPress={() => onSend(caption)}
                disabled={sending}
                style={[styles.sendBtn, { backgroundColor: theme.colors.primary, opacity: sending ? 0.6 : 1 }]}
                accessibilityLabel={t('chat.photoConfirm.send')}
              >
                {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Send size={20} color="#FFFFFF" />}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  header: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10 },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  caption: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    color: '#FFFFFF',
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
