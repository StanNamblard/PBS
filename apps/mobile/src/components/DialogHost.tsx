import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useDialogStore } from '@/lib/dialogs';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';

/** Affiche les confirmations demandées via confirm()/notify() (version web). */
export function DialogHost() {
  const { colors } = useTheme();
  const { current, set } = useDialogStore();
  if (!current) return null;

  const close = (ok: boolean) => {
    set(null);
    current.resolve(ok);
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(false)}>
      <Pressable style={styles.backdrop} onPress={() => close(false)}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => {}}>
          <AppText variant="subtitle">{current.title}</AppText>
          {current.message ? <AppText muted>{current.message}</AppText> : null}
          <View style={styles.actions}>
            <Button
              testID="dialog-confirm"
              variant={current.destructive ? 'danger' : 'primary'}
              label={current.confirmText}
              onPress={() => close(true)}
            />
            {current.cancelText ? (
              <Button testID="dialog-cancel" variant="ghost" label={current.cancelText} onPress={() => close(false)} />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: spacing.lg },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.md, maxWidth: 420, width: '100%', alignSelf: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
