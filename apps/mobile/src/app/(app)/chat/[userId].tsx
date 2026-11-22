import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { SmallButton } from '@/components/SmallButton';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  acceptConversation,
  blockUser,
  deleteConversation,
  markRead,
  sendPhoto,
  sendText,
  type Message,
} from '@/features/messages/api';
import { msgKeys, useConversation, useMessages } from '@/features/messages/hooks';
import { formatTime, useRecentMatches } from '@/features/selfie/hooks';
import { confirm, notify } from '@/lib/dialogs';
import { serverErrorKey } from '@/lib/errors';
import { publicUrl, useSignedUrls } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

/** Conversation privée avec un utilisateur (temps réel). */
export default function ChatScreen() {
  const { userId: otherId } = useLocalSearchParams<{ userId: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId: me } = useAuth();
  const qc = useQueryClient();
  const conv = useConversation(otherId);
  const info = conv.data;
  const messagesQuery = useMessages(info?.conversation_id);
  const messages = useMemo(() => messagesQuery.data?.pages.flat() ?? [], [messagesQuery.data]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Photos des messages (bucket privé « dm »)
  const mediaPaths = messages.map((m) => m.media_path).filter((p): p is string => !!p);
  const { data: urls } = useSignedUrls('dm', mediaPaths);

  // Échange de selfies de moins de 24 h avec cette personne → affiché en haut
  const { data: recentMatches = [] } = useRecentMatches();
  const match = recentMatches.find((m) => m.other_id === otherId && m.their_selfie_path);

  // Marquer comme lu à l'ouverture et à chaque nouveau message
  const newest = messages[0]?.created_at;
  useEffect(() => {
    if (info?.conversation_id) {
      void markRead(info.conversation_id).then(() => qc.invalidateQueries({ queryKey: msgKeys.counts }));
    }
  }, [info?.conversation_id, newest, qc]);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: msgKeys.conversation(otherId) });
    await qc.invalidateQueries({ queryKey: ['messages'] });
    await qc.invalidateQueries({ queryKey: ['inbox'] });
  };

  const handleError = (e: unknown) => {
    const key = serverErrorKey(e);
    notify(t(key === 'selfie.rate_limited' ? 'errors.tooManyAttempts' : key));
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await sendText(otherId, body);
      setText('');
      await refresh();
    } catch (e) {
      handleError(e);
    } finally {
      setSending(false);
    }
  };

  const pickPhoto = async () => {
    if (!me) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    setSending(true);
    try {
      await sendPhoto(me, otherId, result.assets[0].uri);
      await refresh();
    } catch (e) {
      handleError(e);
    } finally {
      setSending(false);
    }
  };

  const accept = async () => {
    if (!info?.conversation_id) return;
    await acceptConversation(info.conversation_id);
    await refresh();
  };

  const remove = async () => {
    if (!info?.conversation_id) return;
    const ok = await confirm({ title: t('messages.deleteConfirm'), confirmText: t('messages.delete'), cancelText: t('common.cancel'), destructive: true });
    if (!ok) return;
    await deleteConversation(info.conversation_id);
    await qc.invalidateQueries({ queryKey: ['inbox'] });
    router.back();
  };

  const block = async () => {
    if (!info) return;
    const ok = await confirm({
      title: t('messages.blockConfirm', { username: info.other_username }),
      confirmText: t('messages.block'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await blockUser(info.other_id);
    await qc.invalidateQueries();
    notify(t('messages.blocked', { username: info.other_username }));
    router.back();
  };

  if (conv.isPending) return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  if (!info) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <TopBar title="" />
        <AppText muted center style={styles.pad}>
          {t('messages.unavailable')}
        </AppText>
      </SafeAreaView>
    );
  }

  const isRequest = info.my_folder === 'requests' && !info.i_accepted;
  // « Vu » sous mon dernier message, si l'autre l'a lu (jamais pour une demande)
  const myLast = messages.find((m) => m.sender_id === me);
  const seen = !!(myLast && info.other_last_read_at && info.other_last_read_at >= myLast.created_at);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <TopBar
        title={info.other_username}
        avatar={info.other_avatar_path}
        onPress={() => router.push(`/user/${info.other_id}`)}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onEndReached={() => messagesQuery.hasNextPage && void messagesQuery.fetchNextPage()}
          renderItem={({ item, index }) => (
            <Bubble
              message={item}
              mine={item.sender_id === me}
              imageUrl={item.media_path ? urls?.[item.media_path] : undefined}
              showTime={shouldShowTime(messages, index)}
              seen={seen && item.id === myLast?.id}
            />
          )}
          ListFooterComponent={
            match ? <MatchCard theirPath={match.their_selfie_path!} myPath={match.my_selfie_path} expiresAt={match.media_expires_at} /> : undefined
          }
          ListEmptyComponent={
            <AppText muted center style={styles.pad}>
              {t('messages.firstMessage', { username: info.other_username })}
            </AppText>
          }
        />

        {isRequest ? (
          <View style={[styles.requestBox, { borderTopColor: colors.border }]}>
            <AppText variant="caption" muted center>
              {t('messages.requestBanner', { username: info.other_username })}
            </AppText>
            <View style={styles.requestActions}>
              <SmallButton flex label={t('messages.block')} onPress={() => void block()} />
              <SmallButton flex label={t('messages.delete')} onPress={() => void remove()} />
              <SmallButton flex variant="primary" label={t('messages.accept')} onPress={() => void accept()} />
            </View>
          </View>
        ) : info.can_send ? (
          <View style={[styles.inputBar, { borderTopColor: colors.border }]}>
            {info.other_accepted ? (
              <Pressable hitSlop={8} onPress={() => void pickPhoto()} disabled={sending} accessibilityLabel={t('messages.photo')}>
                <Feather name="image" size={24} color={colors.primary} />
              </Pressable>
            ) : null}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('messages.placeholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
              style={[typography.body, styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            />
            <Pressable
              onPress={() => void send()}
              disabled={!text.trim() || sending}
              accessibilityLabel={t('messages.send')}
              style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: !text.trim() || sending ? 0.4 : 1 }]}
            >
              {sending ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Feather name="send" size={18} color={colors.onPrimary} />}
            </Pressable>
          </View>
        ) : (
          <View style={[styles.requestBox, { borderTopColor: colors.border }]}>
            <AppText variant="caption" muted center>
              {info.blocked_reason === 'request_pending'
                ? t('messages.requestPending', { username: info.other_username })
                : t('messages.mustFollow', { username: info.other_username })}
            </AppText>
          </View>
        )}
        {!isRequest && info.can_send && !info.other_accepted && info.conversation_id ? (
          <AppText variant="caption" muted center style={styles.hint}>
            {t('messages.noPhotoYet', { username: info.other_username })}
          </AppText>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Heure affichée si plus de 10 min séparent deux messages (liste inversée). */
function shouldShowTime(messages: Message[], index: number): boolean {
  const current = messages[index];
  const older = messages[index + 1];
  if (!current) return false;
  if (!older) return true;
  return new Date(current.created_at).getTime() - new Date(older.created_at).getTime() > 10 * 60 * 1000;
}

function TopBar({ title, avatar, onPress }: { title: string; avatar?: string | null; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
      <Pressable hitSlop={12} onPress={() => router.back()}>
        <Feather name="chevron-left" size={26} color={colors.text} />
      </Pressable>
      <Pressable style={styles.topIdentity} onPress={onPress} disabled={!onPress}>
        {title ? <Avatar uri={publicUrl(avatar)} name={title} size={32} /> : null}
        <AppText variant="subtitle" numberOfLines={1}>
          {title}
        </AppText>
      </Pressable>
    </View>
  );
}

function Bubble({ message, mine, imageUrl, showTime, seen }: { message: Message; mine: boolean; imageUrl?: string; showTime: boolean; seen: boolean }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.bubbleWrap, mine ? styles.mine : styles.theirs]}>
      {showTime ? (
        <AppText variant="caption" muted center style={styles.time}>
          {formatTime(message.created_at, i18n.language)}
        </AppText>
      ) : null}
      {message.media_path ? (
        <Image
          source={imageUrl ? { uri: imageUrl, cacheKey: message.media_path } : undefined}
          style={[styles.photo, { backgroundColor: colors.surfaceAlt }]}
          contentFit="cover"
          transition={150}
        />
      ) : null}
      {message.body ? (
        <View style={[styles.bubble, { backgroundColor: mine ? colors.primary : colors.surfaceAlt }]}>
          <AppText color={mine ? colors.onPrimary : colors.text} selectable>
            {message.body}
          </AppText>
        </View>
      ) : null}
      {seen ? (
        <AppText variant="caption" muted>
          {t('messages.seen')}
        </AppText>
      ) : null}
    </View>
  );
}

function MatchCard({ theirPath, myPath, expiresAt }: { theirPath: string; myPath: string | null; expiresAt: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const paths = [theirPath, myPath].filter((p): p is string => !!p);
  const { data: urls } = useSignedUrls('selfies', paths);
  return (
    <View style={[styles.matchCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="bodyStrong">📸 {t('messages.matchCard')}</AppText>
      <View style={styles.matchPhotos}>
        {paths.map((p) => (
          <Image key={p} source={urls?.[p] ? { uri: urls[p], cacheKey: p } : undefined} style={[styles.matchPhoto, { backgroundColor: colors.surfaceAlt }]} contentFit="cover" />
        ))}
      </View>
      <AppText variant="caption" muted>
        {t('selfie.expiresAt', { time: formatTime(expiresAt, i18n.language) })}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 120 },
  pad: { padding: spacing.xl },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  topIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  list: { padding: spacing.md, gap: spacing.xs },
  bubbleWrap: { maxWidth: '80%', gap: 2, marginVertical: 2 },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  photo: { width: 220, height: 280, borderRadius: radius.lg },
  time: { alignSelf: 'center', marginVertical: spacing.xs },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 42, maxHeight: 120, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  requestBox: { padding: spacing.md, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  requestActions: { flexDirection: 'row', gap: spacing.sm },
  hint: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  matchCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md, alignItems: 'center' },
  matchPhotos: { flexDirection: 'row', gap: spacing.sm },
  matchPhoto: { width: 110, height: 146, borderRadius: radius.md },
});
