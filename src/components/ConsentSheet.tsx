import { Linking, View } from 'react-native';

import { Mark } from './marks';
import { Sheet } from './Sheet';
import { AppText, Button, TextLink } from './ui';
import { PRIVACY_URL } from '@/lib/config';

// What the AI sees, in the app's words. The privacy policy names the AI provider.
export const AI_DISCLOSURE = [
  'Receipt photos, things you check before buying (with a few numbers about this month’s budget) and the totals behind your review go securely to our AI service, which runs on an outside AI provider.',
  'They’re used only to answer that request. We don’t keep them, and they aren’t used to train AI models.',
  'Everything else, like your history and your account, stays private and is never shown to the AI.',
];

export function DisclosureList({ size = 15 }: { size?: number }) {
  return (
    <View style={{ gap: 14 }}>
      {AI_DISCLOSURE.map((line) => (
        <View key={line} style={{ flexDirection: 'row', gap: 14 }}>
          <Mark kind="need" size={6} style={{ marginTop: size === 15 ? 8 : 7 }} />
          <AppText style={{ flex: 1, fontSize: size, lineHeight: size === 15 ? 22 : 20 }}>{line}</AppText>
        </View>
      ))}
      {PRIVACY_URL ? (
        <TextLink label="Who runs the AI: privacy policy" small onPress={() => Linking.openURL(PRIVACY_URL)} style={{ alignSelf: 'flex-start', marginLeft: 20 }} />
      ) : null}
    </View>
  );
}

/** Explicit opt-in before any personal data goes to a third-party AI (App Review 5.1.2(i)). */
export function ConsentSheet({ visible, onAllow, onCancel }: { visible: boolean; onAllow: () => void; onCancel: () => void }) {
  return (
    <Sheet open={visible} onClose={onCancel}>
      <AppText weight="light" accessibilityRole="header" style={{ fontSize: 32, lineHeight: 36, letterSpacing: -0.96, marginTop: 20 }}>
        Let the AI read your receipts?
      </AppText>
      <View style={{ marginTop: 20 }}>
        <DisclosureList />
      </View>
      <AppText variant="caption" muted style={{ marginTop: 16 }}>
        You can turn this off any time in Settings.
      </AppText>
      <Button title="Allow and continue" onPress={onAllow} style={{ marginTop: 24 }} />
      <TextLink label="Not now" onPress={onCancel} style={{ alignSelf: 'center', marginTop: 8 }} />
    </Sheet>
  );
}
