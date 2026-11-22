import Feather from '@expo/vector-icons/Feather';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Animated, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { UserRow } from '@/components/UserRow';
import { useAuth } from '@/features/auth/AuthProvider';
import { deleteStory, getStoryViewers, getUserStories, markStoryViewed } from '@/features/social/api';
import { keys, useProfile } from '@/features/social/hooks';
import { publicUrl, useSignedUrls } from '@/lib/media';
import { timeAgo } from '@/lib/time';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const STORY_DURATION_MS = 5000;

/**
 * Visionneuse de stories plein écran.
 * - appui à droite : suivante ; à gauche : précédente ; appui long : pause
 * - enchaîne automatiquement sur les stories du compte suivant du bandeau
 * - l'auteur voit le nombre de vues et la liste des personnes
 */
export default function StoryViewerScreen() {
  const { userId, next } = useLocalSearchParams<{ userId: string; next?: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { userId: me } = useAuth();
  const qc = useQueryClient();
  const isMine = userId === me;
  const queue = useMemo(() => (next ? next.split(',').filter(Boolean) : []), [next]);

  const { data: profile } = useProfile(userId);
  const storiesQuery = useQuery({ queryKey: ['stories', userId], queryFn: () => getUserStories(userId) });
  const stories = storiesQuery.data ?? [];
  const { data: urls } = useSignedUrls('stories', stories.map((s) => s.storage_path));

  const [index, setIndex] = useState(0);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const startedAt = useRef(false);

  // Commence à la première story non vue (sauf pour mes propres stories)
  useEffect(() => {
    if (startedAt.current || stories.length === 0) return;
    startedAt.current = true;
    const firstUnseen = stories.findIndex((s) => !s.viewed);
    setIndex(!isMine && firstUnseen > 0 ? firstUnseen : 0);
  }, [stories, isMine]);

  // Plus de story (expirée / supprimée) → on ferme
  useEffect(() => {
    if (storiesQuery.isSuccess && stories.length === 0) router.back();
  }, [storiesQuery.isSuccess, stories.length]);

  // Rafraîchit le bandeau (anneaux « vu ») en quittant
  useEffect(() => () => void qc.invalidateQueries({ queryKey: keys.tray }), [qc]);

  const current = stories[index];

  const close = useCallback(() => router.back(), []);

  const goNext = useCallback(() => {
    if (index < stories.length - 1) {
      setIndex((i) => i + 1);
    } else if (queue[0]) {
      router.replace({ pathname: '/story/[userId]', params: { userId: queue[0], next: queue.slice(1).join(',') } });
    } else {
      close();
    }
  }, [index, stories.length, queue, close]);

  const goPrev = useCallback(() => {
    if (index > 0) setIndex((i) => i - 1);
    else progress.setValue(0);
  }, [index, progress]);

  // Marque comme vue dès l'affichage
  useEffect(() => {
    if (current && !isMine && loadedId === current.id && !current.viewed) {
      void markStoryViewed(current.id);
    }
  }, [current, isMine, loadedId]);

  // Valeur courante de la progression (pour reprendre après une pause)
  const progressValue = useRef(0);
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressValue.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  // Nouvelle story → barre à zéro (doit précéder le démarrage ci-dessous)
  useEffect(() => {
    progress.setValue(0);
    progressValue.current = 0;
  }, [index, progress]);

  // Barre de progression : démarre quand l'image est chargée, s'arrête en pause
  useEffect(() => {
    if (!current || loadedId !== current.id || paused || viewersOpen) return;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION_MS * (1 - progressValue.current),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => anim.stop();
  }, [current, loadedId, paused, viewersOpen, progress, goNext]);

  const remove = () => {
    if (!current) return;
    setPaused(true);
    Alert.alert(t('story.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel', onPress: () => setPaused(false) },
      {
        text: t('story.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteStory(current).catch(() => Alert.alert(t('errors.generic')));
          await qc.invalidateQueries({ queryKey: ['stories', userId] });
          await qc.invalidateQueries({ queryKey: keys.tray });
          setIndex((i) => Math.max(0, i - 1));
          setPaused(false);
        },
      },
    ]);
  };

  const uri = current ? urls?.[current.storage_path] : undefined;

  return (
    <View style={styles.root}>
      {uri && current ? (
        <Image
          source={{ uri, cacheKey: current.storage_path }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onLoad={() => setLoadedId(current.id)}
        />
      ) : null}
      {!uri || loadedId !== current?.id ? <ActivityIndicator style={styles.loader} color="#FFFFFF" /> : null}

      {/* Zones d'appui : gauche = précédente, droite = suivante, appui long = pause */}
      <View style={styles.touchRow}>
        <Pressable style={styles.touchLeft} onPress={goPrev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
        <Pressable style={styles.touchRight} onPress={goNext} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
      </View>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.bars}>
          {stories.map((s, i) => (
            <View key={s.id} style={styles.track}>
              <Animated.View
                style={[
                  styles.fill,
                  {
                    width:
                      i < index
                        ? '100%'
                        : i === index
                          ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                          : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.top}>
          <Avatar uri={publicUrl(profile?.avatar_path)} name={profile?.username} size={32} />
          <AppText variant="bodyStrong" color="#FFFFFF">
            {profile?.username}
          </AppText>
          {current ? (
            <AppText variant="caption" color="rgba(255,255,255,0.75)">
              {timeAgo(current.created_at, t, i18n.language)}
            </AppText>
          ) : null}
          <View style={styles.flex} />
          <Pressable hitSlop={12} onPress={close} accessibilityLabel="close">
            <Feather name="x" size={28} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.flex} pointerEvents="none" />

        {isMine && current ? (
          <View style={styles.bottom}>
            <Pressable style={styles.viewsButton} onPress={() => setViewersOpen(true)}>
              <Feather name="eye" size={20} color="#FFFFFF" />
              <AppText variant="bodyStrong" color="#FFFFFF">
                {t('story.views', { n: current.view_count ?? 0 })}
              </AppText>
            </Pressable>
            <Pressable hitSlop={12} onPress={remove} accessibilityLabel={t('story.delete')}>
              <Feather name="trash-2" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>

      {current ? (
        <ViewersSheet storyId={current.id} visible={viewersOpen} onClose={() => setViewersOpen(false)} colors={colors} />
      ) : null}
    </View>
  );
}

function ViewersSheet({
  storyId,
  visible,
  onClose,
  colors,
}: {
  storyId: string;
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const { t } = useTranslation();
  const { data = [], isPending } = useQuery({
    queryKey: ['storyViewers', storyId],
    queryFn: () => getStoryViewers(storyId),
    enabled: visible,
  });
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={styles.sheetHeader}>
          <AppText variant="subtitle">{t('story.viewers')}</AppText>
          <Pressable hitSlop={12} onPress={onClose}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
        </View>
        <FlatList
          data={data}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <UserRow user={item} />}
          ListEmptyComponent={
            isPending ? undefined : (
              <AppText muted center style={{ padding: spacing.xl }}>
                {t('story.noViewers')}
              </AppText>
            )
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  loader: { position: 'absolute', top: '50%', alignSelf: 'center' },
  touchRow: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  touchLeft: { flex: 1 },
  touchRight: { flex: 2 },
  overlay: { ...StyleSheet.absoluteFill },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  fill: { height: 3, backgroundColor: '#FFFFFF' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  viewsButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
});
