import { Alert, Platform } from 'react-native';
import { create } from 'zustand';

/**
 * Boîtes de dialogue compatibles iPhone, Android ET web.
 * - Mobile : fenêtres natives (Alert).
 * - Web : fenêtre dessinée par l'app (<DialogHost />), car Alert ne fait rien
 *   sur le web et window.confirm est bloqué par les navigateurs intégrés
 *   (WhatsApp, Discord, Instagram…).
 */

export interface DialogRequest {
  title: string;
  message?: string;
  confirmText: string;
  /** Absent = simple message avec un seul bouton */
  cancelText?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

export const useDialogStore = create<{ current: DialogRequest | null; set: (d: DialogRequest | null) => void }>((set) => ({
  current: null,
  set: (current) => set({ current }),
}));

function showInApp(req: Omit<DialogRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().set({ ...req, resolve });
  });
}

/** Message simple avec un bouton OK. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    void showInApp({ title, message, confirmText: 'OK' });
    return;
  }
  Alert.alert(title, message);
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
}

/** Demande une confirmation. Renvoie true si l'utilisateur confirme. */
export function confirm({ title, message, confirmText, cancelText, destructive }: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return showInApp({ title, message, confirmText, cancelText, destructive });
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
