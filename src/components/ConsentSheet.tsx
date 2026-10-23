import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, StyleSheet, View } from 'react-native';

import { AppText, Button, Row } from './ui';
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
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          <Row>
            <Ionicons name="shield-checkmark" size={24} color={c.primary} />
            <AppText variant="title">Allow AI to read your receipts?</AppText>
          </Row>
          {AI_DISCLOSURE.map((line) => (
            <Row key={line} style={{ alignItems: 'flex-start' }}>
              <Ionicons name="checkmark-circle-outline" size={18} color={c.primary} style={{ marginTop: 2 }} />
              <AppText style={{ flex: 1 }}>{line}</AppText>
            </Row>
          ))}
          <AppText variant="caption" muted>
            You can turn this off any time in Settings.
          </AppText>
          <Button title="Allow and continue" icon="sparkles" onPress={onAllow} />
          <Button title="Not now" kind="ghost" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { padding: space.xl, gap: space.md, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, paddingBottom: space.xxl },
});
