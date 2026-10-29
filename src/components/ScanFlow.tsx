// Reading a receipt: a full screen with a line sweeping the receipt while the AI works, and a calm
// "couldn't read this one" if the photo didn't work. Success opens the review screen.
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appear } from './motion';
import { Corners, ReadingReceipt, ReceiptPicture, WorkingBar } from './pictures';
import { AppText, Button, haptic, TextLink, TopBar } from './ui';
import { setSettings } from '@/db/settings';
import { ApiError } from '@/lib/api';
import { clearPendingScan, pickImage, runScan, takePendingScan, type PickSource } from '@/lib/scan';
import { colors } from '@/theme/tokens';

type Phase = { phase: 'reading' | 'failed'; source: PickSource; started: number };

/** Errors that mean "the AI couldn't make sense of this photo", rather than "no connection". */
const UNREADABLE = ['ai_declined', 'bad_response', 'ai_error'];

export function useScanFlow(currency: string) {
  const db = useSQLiteContext();
  const [state, setState] = useState<Phase | null>(null);
  const cancelled = useRef(false);

  /** Picks a photo and reads it. Throws for problems the AI tab should show (camera off, offline, needs Pro). */
  const start = async (source: PickSource) => {
    const asset = await pickImage(source);
    if (!asset) return;
    cancelled.current = false;
    setState({ phase: 'reading', source, started: Date.now() });
    try {
      const { id, trialRemaining } = await runScan(asset, { currency });
      if (cancelled.current) return clearPendingScan(id);
      if (trialRemaining !== null) await setSettings(db, { trial_remaining: trialRemaining });
      if (takePendingScan(id)?.result.is_financial_document === false) {
        clearPendingScan(id);
        haptic('warning');
        setState({ phase: 'failed', source, started: Date.now() });
        return;
      }
      haptic('success');
      setState(null);
      router.push({ pathname: '/scan-review', params: { id } });
    } catch (e) {
      if (cancelled.current) return;
      if (e instanceof ApiError && UNREADABLE.includes(e.code)) {
        haptic('warning');
        setState({ phase: 'failed', source, started: Date.now() });
        return;
      }
      setState(null);
      throw e;
    }
  };

  const cancel = () => {
    cancelled.current = true;
    setState(null);
  };

  const element = (
    <Modal visible={!!state} animationType="fade" presentationStyle="fullScreen" onRequestClose={cancel} statusBarTranslucent>
      {state?.phase === 'reading' && <Reading started={state.started} onCancel={cancel} />}
      {state?.phase === 'failed' && (
        <Failed
          onClose={cancel}
          onRetry={() => {
            const source = state.source;
            setState(null);
            // Let the screen close before the camera or the photo picker opens.
            setTimeout(() => start(source).catch(() => undefined), 400);
          }}
          onType={() => {
            cancel();
            router.navigate('/tracker');
          }}
        />
      )}
    </Modal>
  );

  return { start, element, busy: state?.phase === 'reading' };
}

function Reading({ started, onCancel }: { started: number; onCancel: () => void }) {
  const insets = useSafeAreaInsets();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [started]);
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 32 }]}>
      <View style={{ alignItems: 'flex-end' }}>
        <TextLink label="Cancel" onPress={onCancel} />
      </View>
      <View style={styles.inner}>
        <View style={{ marginTop: 36 }}>
          <ReadingReceipt />
        </View>
        <Appear delay={120}>
          <AppText variant="headline" accessibilityRole="header" style={{ marginTop: 48 }}>
            Reading your receipt
          </AppText>
          <AppText muted style={{ marginTop: 12 }}>
            The AI checks every line for the total, and for needs and wants. This can take up to a minute.
          </AppText>
        </Appear>
        <View style={{ marginTop: 'auto' }}>
          <WorkingBar />
          <View style={styles.status}>
            <AppText variant="index" muted>
              Reading
            </AppText>
            <AppText variant="index" muted>
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

const TIPS = ['Lay it flat on a dark surface', 'Fill the frame, edges included', 'Hold still until it’s sharp'];

function Failed({ onClose, onRetry, onType }: { onClose: () => void; onRetry: () => void; onType: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
      <View style={styles.inner}>
        <TopBar onBack={onClose} />
        <Appear>
          <View aria-hidden style={styles.frame}>
            <Corners size={26} inset={0} />
            <View style={{ position: 'absolute', left: 56, right: 56, top: 22, bottom: 22 }}>
              <ReceiptPicture width={88} height={146} dashed />
            </View>
          </View>
          <AppText variant="headline" accessibilityRole="header" style={{ marginTop: 32 }}>
            Couldn’t read this one
          </AppText>
          <AppText muted style={{ marginTop: 12 }}>
            The photo might be too dark, blurry or cut off.
          </AppText>
          <View style={styles.tips}>
            {TIPS.map((tip, i) => (
              <View key={tip} style={styles.tip}>
                <AppText variant="monoSmall" muted style={{ width: 28, lineHeight: 22 }}>
                  {i + 1}
                </AppText>
                <AppText style={{ flex: 1 }}>{tip}</AppText>
              </View>
            ))}
          </View>
          <AppText variant="caption" muted style={{ marginTop: 12 }}>
            Scans that fail don’t use up your free scans.
          </AppText>
        </Appear>
        <View style={{ marginTop: 'auto', gap: 10, paddingTop: 24 }}>
          <Button title="Try again" onPress={onRetry} />
          <Button title="Type it in instead" kind="secondary" onPress={onType} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 24 },
  inner: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  status: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  frame: { alignSelf: 'center', width: 200, height: 190, marginTop: 16 },
  tips: { marginTop: 24, borderTopWidth: 1, borderTopColor: colors.rule },
  tip: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
});
