import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, ImagePlus, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { TagChip } from '../../components/TagChip';
import { INTEREST_TAGS, type InterestTagId } from '../../data/interestTags';
import { postMoment } from '../../api/moments';
import { uploadFile } from '../../api/upload';

const MAX_PHOTOS = 9;
const MAX_CONTENT = 500;

export function ComposerScreen() {
  const theme = useTheme();
  const nav = useNavigation();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [tag, setTag] = useState<InterestTagId | null>(null);

  const submitMut = useMutation({
    mutationFn: async () => {
      // Upload all picked photos to /api/upload, get back permanent URLs.
      // Skip URIs that already look like https — they're already uploaded.
      const uploadedUrls: string[] = [];
      for (const uri of photos) {
        if (/^https?:\/\//.test(uri)) {
          uploadedUrls.push(uri);
        } else {
          const url = await uploadFile(uri);
          uploadedUrls.push(url);
        }
      }
      return postMoment({
        content: content.trim(),
        images: uploadedUrls,
        // tag isn't currently a backend field on Moment — kept client-side for v2.
        // The server will ignore it. TODO: add `tag` to Moment model.
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moments'] });
      nav.goBack();
    },
    onError: () => {
      Alert.alert('发送失败', '稍后再试。');
    },
  });

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要照片权限', '在系统设置中允许 Meyou 访问你的照片。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.8,
    });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri);
    // TODO: upload to /api/upload first; for now we keep local URIs as a
    // placeholder so the visual flow works in dev.
    setPhotos([...photos, ...uris].slice(0, MAX_PHOTOS));
  };

  const removeAt = (i: number) => setPhotos(photos.filter((_, j) => j !== i));

  const canSubmit = (content.trim().length > 0 || photos.length > 0) && !submitMut.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
          justifyContent: 'space-between',
        }}
      >
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
          新动态
        </Text>
        <Pressable
          onPress={() => canSubmit && submitMut.mutate()}
          disabled={!canSubmit}
          hitSlop={8}
        >
          <Text
            style={{
              color: canSubmit ? theme.colors.primary : theme.colors.muted,
              fontSize: 14,
              fontWeight: '600',
            }}
          >
            发布
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="分享一些什么..."
            placeholderTextColor={theme.colors.muted}
            multiline
            maxLength={MAX_CONTENT}
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: theme.colors.text,
              minHeight: 120,
              paddingTop: 8,
              paddingBottom: 8,
              textAlignVertical: 'top',
            }}
          />
          <Text style={{ alignSelf: 'flex-end', fontSize: 11, color: theme.colors.muted }}>
            {content.length} / {MAX_CONTENT}
          </Text>

          {/* Photo grid */}
          {(photos.length > 0 || photos.length < MAX_PHOTOS) && (
            <View style={styles.photoGrid}>
              {photos.map((uri, i) => (
                <View key={uri + i} style={styles.photoTile}>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                  <Pressable
                    onPress={() => removeAt(i)}
                    style={[styles.removeBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                  >
                    <X size={14} color="#FFFFFF" strokeWidth={2.4} />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <Pressable
                  onPress={pickImages}
                  style={[
                    styles.photoTile,
                    {
                      backgroundColor: theme.colors.surface2,
                      borderWidth: 1,
                      borderColor: theme.colors.line,
                      borderStyle: 'dashed',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  ]}
                >
                  <ImagePlus size={28} color={theme.colors.muted} strokeWidth={1.6} />
                </Pressable>
              )}
            </View>
          )}

          <Text
            style={{
              fontSize: 12,
              color: theme.colors.muted,
              letterSpacing: 0.72,
              textTransform: 'uppercase',
              marginTop: 24,
              marginBottom: 10,
            }}
          >
            兴趣标签 (可选)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {INTEREST_TAGS.map((tg) => (
              <TagChip
                key={tg.id}
                tag={tg}
                selected={tag === tg.id}
                onPress={() => setTag(tag === tg.id ? null : tg.id)}
              />
            ))}
          </View>
        </ScrollView>

        <View style={{ padding: 20 }}>
          <Button
            label="发布动态"
            onPress={() => submitMut.mutate()}
            disabled={!canSubmit}
            loading={submitMut.isPending}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  photoTile: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
