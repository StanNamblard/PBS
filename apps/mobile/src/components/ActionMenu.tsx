import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export interface ActionMenuItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  title?: string;
  items: ActionMenuItem[];
  cancelLabel: string;
  onClose: () => void;
}

/** Menu d'actions en bas de l'écran (iPhone, Android et web). */
export function ActionMenu({ visible, title, items, cancelLabel, onClose }: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View style={[styles.group, { backgroundColor: colors.surface }]}>
            {title ? (
              <AppText variant="caption" muted center style={styles.title}>
                {title}
              </AppText>
            ) : null}
            {items.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
                style={[styles.item, { borderTopColor: colors.border }]}
              >
                <AppText variant="bodyStrong" center color={item.destructive ? colors.danger : colors.text}>
                  {item.label}
                </AppText>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={[styles.group, styles.item, { backgroundColor: colors.surface }]}>
            <AppText variant="bodyStrong" center>
              {cancelLabel}
            </AppText>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetWrap: { padding: spacing.md, gap: spacing.sm },
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  title: { padding: spacing.md },
  item: { paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
