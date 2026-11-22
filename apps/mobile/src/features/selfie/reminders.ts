import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/lib/i18n';

import { deviceOffsetMinutes, upcomingWaves } from './waves';

/**
 * Rappels de la vague quotidienne, programmés SUR LE TÉLÉPHONE (notifications
 * locales) pour les 7 prochains jours. Fonctionne dans Expo Go, sans serveur
 * de notifications. (Les notifications « tu as un match » arriveront avec le
 * build de développement et le compte Apple Developer.)
 */

const ENABLED_KEY = 'bps.dailyReminder';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Toucher une notification BPS ouvre l'écran indiqué (ex. « /selfie »). */
export function listenToNotificationTaps(open: (url: string) => void): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  });
  return () => sub.remove();
}

export async function isReminderEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) !== 'off';
}

/** Demande l'autorisation si besoin. Renvoie true si les notifications sont autorisées. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** (Re)programme les rappels des 7 prochains jours. */
export async function scheduleDailyReminders(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!(await isReminderEnabled())) return 0;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return 0;

  const waves = upcomingWaves(new Date(), deviceOffsetMinutes(), 7);
  for (const date of waves) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t('selfie.reminderTitle'),
        body: i18n.t('selfie.reminderBody'),
        data: { url: '/selfie' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
  return waves.length;
}

export async function setReminderEnabled(enabled: boolean) {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? 'on' : 'off');
  if (enabled) await ensureNotificationPermission();
  await scheduleDailyReminders();
}

/** Prochaine vague (pour l'affichage). */
export function nextWave(): Date | undefined {
  return upcomingWaves(new Date(), deviceOffsetMinutes(), 1)[0];
}
