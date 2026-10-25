import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { NeedMark } from './sketch';
import { AppText, Button, Row } from './ui';
import { colors, space } from '@/theme/tokens';

export const AI_DISCLOSURE = [
  'Receipt photos you scan, things you check before buying (with a few numbers about this month’s budget), and the monthly totals behind your review are sent securely to our AI service, which uses Anthropic’s Claude.',
  'They are used only to answer that request. We don’t keep them, and Anthropic doesn’t use them to train its AI models.',
  'Everything else, like your history and your account, stays private to your Xpense account and is never shown to the AI.',
];

/** Explicit opt-in required before any personal data is shared with third-party AI (App Review 5.1.2(i)). */
export function ConsentSheet({ visible, onAllow, onCancel }: { visible: boolean; onAllow: () => void; onCancel: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close">
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.grabber} />
          <AppText variant="title">Let the AI read your receipts?</AppText>
          {AI_DISCLOSURE.map((line) => (
            <Row key={line} style={{ alignItems: 'flex-start', gap: space.md }}>
              <View style={{ marginTop: 6 }}>
                <NeedMark size={8} />
              </View>
              <AppText style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>{line}</AppText>
            </Row>
          ))}
          <AppText variant="note" muted>
            you can turn this off any time in Settings
          </AppText>
          <Button title="Allow and continue" onPress={onAllow} />
          <Button title="Not now" kind="ghost" onPress={onCancel} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,17,17,0.35)' },
  sheet: { padding: space.xl, gap: space.md, backgroundColor: colors.paper, paddingBottom: space.xxl + 8, width: '100%', maxWidth: 640, alignSelf: 'center' },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: space.sm, backgroundColor: colors.sand },
});
