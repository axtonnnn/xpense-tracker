import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, IconCircle, Row } from './ui';
import { radius, space, useColors } from '@/theme/tokens';

export const AI_DISCLOSURE = [
  'Receipt photos you scan, items you check before buying, and the monthly totals behind your AI review are sent securely to our AI service, which uses Anthropic’s Claude.',
  'They are used only to answer that request. We don’t keep them, and Anthropic doesn’t use them to train its AI models.',
  'Everything else — your transactions, income and history — stays on this phone.',
];

/** Explicit opt-in required before any personal data is shared with third-party AI (App Review 5.1.2(i)). */
export function ConsentSheet({ visible, onAllow, onCancel }: { visible: boolean; onAllow: () => void; onCancel: () => void }) {
  const c = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => undefined}>
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          <IconCircle icon="shield-checkmark" size={52} />
          <AppText variant="display" style={{ fontSize: 24, lineHeight: 30 }}>
            Allow AI to read your receipts?
          </AppText>
          {AI_DISCLOSURE.map((line) => (
            <Row key={line} style={{ alignItems: 'flex-start', gap: space.md }}>
              <Ionicons name="checkmark-circle" size={20} color={c.need} style={{ marginTop: 1 }} />
              <AppText style={{ flex: 1 }}>{line}</AppText>
            </Row>
          ))}
          <AppText variant="caption" muted>
            You can turn this off any time in Settings.
          </AppText>
          <Button title="Allow and continue" icon="sparkles" onPress={onAllow} />
          <Button title="Not now" kind="ghost" onPress={onCancel} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,20,17,0.45)' },
  sheet: { padding: space.xl, gap: space.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: space.xxl + 8 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: space.sm },
});
