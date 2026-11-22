import { Alert, Platform } from 'react-native';

/**
 * Boîtes de dialogue compatibles iPhone, Android ET web.
 * (Sur le web, Alert.alert de React Native n'affiche rien : on utilise alors
 * les fenêtres du navigateur.)
 */

/** Message simple avec un bouton OK. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
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
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
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
