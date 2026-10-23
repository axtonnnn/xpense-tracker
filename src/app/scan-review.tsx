import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Platform, Pressable, Switch, TextInput, View } from 'react-native';

import { DatePicker } from '@/components/DatePicker';
import { NeedWantToggle, SplitBar } from '@/components/money-ui';
import { AppText, Banner, Button, Card, EmptyState, Field, Row, Screen } from '@/components/ui';
import { newId } from '@/db/ids';
import { addRecurring, applyDueRecurring } from '@/db/recurring';
import { useSettings } from '@/db/settings';
import { saveScannedReceipt } from '@/db/transactions';
import { categoryInfo } from '@/lib/categories';
import { addMonths, isValidISODate, today } from '@/lib/dates';
import { persistReceiptImage } from '@/lib/files';
import { centsToInput, formatMoney, parseAmount } from '@/lib/money';
import { draftWarnings, itemsTotal, splitTotal, WARNING_TEXT, type DraftItem, type ReceiptDraft } from '@/lib/receipt';
import { clearPendingScan, takePendingScan } from '@/lib/scan';
import { radius, space, useColors } from '@/theme/tokens';

export default function ScanReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pending = takePendingScan(id);
  const db = useSQLiteContext();
  const c = useColors();
  const settings = useSettings();
  const [draft, setDraft] = useState<ReceiptDraft | null>(pending?.draft ?? null);
  const [totalText, setTotalText] = useState(pending ? centsToInput(pending.draft.totalCents) : '');
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const split = useMemo(() => (draft ? splitTotal(draft) : { need: 0, want: 0 }), [draft]);
  const warnings = useMemo(() => (draft ? draftWarnings(draft) : []), [draft]);

  if (!pending || !draft) {
    return (
      <Screen>
        <EmptyState
          icon="scan-outline"
          title="Nothing to review"
          body="This scan has expired. Scan the receipt again from AI mode."
          action={<Button title="Back to AI mode" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const currency = draft.currency;
  const custom = settings?.customCategories ?? [];
  const update = (patch: Partial<ReceiptDraft>) => setDraft({ ...draft, ...patch });
  const updateItem = (key: string, patch: Partial<DraftItem>) =>
    update({ items: draft.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) });

  const save = async () => {
    setError(null);
    const total = parseAmount(totalText);
    if (!total || total <= 0) return setError('Enter the total before saving.');
    if (!isValidISODate(draft.date)) return setError('Pick a valid date.');
    setSaving(true);
    try {
      const final = { ...draft, totalCents: total };
      const imageUri = persistReceiptImage(pending.imageUri, newId());
      await saveScannedReceipt(db, final, imageUri, pending.raw);
      if (makeRecurring && draft.docType === 'bill') {
        await addRecurring(db, {
          type: 'expense',
          label: draft.merchant || 'Bill',
          amountCents: total,
          category: draft.category,
          necessity: draft.necessity,
          cadence: 'monthly',
          // This bill is already saved; start repeating from next month's due date.
          startOn: addMonths(draft.dueDate ?? draft.date, 1),
        });
        await applyDueRecurring(db, today(), currency);
      }
      clearPendingScan(id);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissTo('/history');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      {warnings.map((w) => (
        <Banner key={w} tone={w === 'no_total' || w === 'not_receipt' ? 'danger' : 'warn'}>
          {WARNING_TEXT[w]}
        </Banner>
      ))}

      <Row style={{ alignItems: 'flex-start', gap: space.md }}>
        <Image
          source={{ uri: pending.imageUri }}
          style={{ width: 84, height: 112, borderRadius: radius.sm, backgroundColor: c.surfaceAlt }}
          contentFit="cover"
          accessibilityLabel="Scanned photo"
        />
        <View style={{ flex: 1, gap: space.sm }}>
          <Field label="Merchant" value={draft.merchant} onChangeText={(merchant) => update({ merchant })} />
          <Field label="Total" value={totalText} onChangeText={setTotalText} keyboardType="decimal-pad" />
        </View>
      </Row>

      <View style={{ gap: space.sm }}>
        <AppText variant="caption" muted>
          Date
        </AppText>
        <DatePicker value={draft.date} onChange={(date) => update({ date })} />
      </View>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="title">Needs vs wants</AppText>
          <SplitBar need={split.need} want={split.want} width={80} />
        </Row>
        <Row style={{ gap: space.lg }}>
          <View>
            <AppText style={{ fontWeight: '700' }}>{formatMoney(split.need, currency)}</AppText>
            <AppText variant="caption" muted>
              Needs
            </AppText>
          </View>
          <View>
            <AppText style={{ fontWeight: '700' }}>{formatMoney(split.want, currency)}</AppText>
            <AppText variant="caption" muted>
              Wants
            </AppText>
          </View>
        </Row>
        {draft.items.length === 0 && (
          <>
            <AppText muted>No line items were found. Mark the whole {draft.docType} as:</AppText>
            <NeedWantToggle value={draft.necessity} onChange={(necessity) => update({ necessity })} />
          </>
        )}
      </Card>

      {draft.items.map((it) => (
        <Card key={it.key} style={{ gap: space.sm }}>
          <Row>
            <TextInput
              value={it.name}
              onChangeText={(name) => updateItem(it.key, { name })}
              style={{ flex: 1, color: c.ink, fontSize: 16, fontWeight: '600', padding: 0 }}
              accessibilityLabel="Item name"
            />
            <Pressable
              onPress={() => update({ items: draft.items.filter((x) => x.key !== it.key) })}
              accessibilityLabel={`Remove ${it.name}`}
              hitSlop={8}>
              <Ionicons name="close-circle-outline" size={22} color={c.inkMuted} />
            </Pressable>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <NeedWantToggle value={it.necessity} onChange={(necessity) => updateItem(it.key, { necessity })} />
            <ItemPrice
              cents={it.totalCents}
              label={`${it.name} price`}
              onChange={(totalCents) => updateItem(it.key, { totalCents })}
            />
          </Row>
          {it.reason && (
            <AppText variant="caption" muted>
              {categoryInfo(it.category, custom).label} · {it.reason}
            </AppText>
          )}
        </Card>
      ))}

      <Button
        title="Add a line"
        icon="add"
        kind="ghost"
        onPress={() =>
          update({
            items: [
              ...draft.items,
              { key: `new-${Date.now()}`, name: 'New item', qty: null, totalCents: 0, category: draft.category, necessity: 'need', reason: null },
            ],
          })
        }
      />

      {draft.items.length > 0 && (
        <AppText variant="caption" muted>
          Items add up to {formatMoney(itemsTotal(draft), currency)}. Tax, tip and fees are shared between needs and wants in
          proportion.
        </AppText>
      )}

      {draft.notes && <Banner icon="chatbubble-ellipses-outline">{draft.notes}</Banner>}

      {draft.docType === 'bill' && (
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <AppText>Repeat this bill monthly</AppText>
            <AppText variant="caption" muted>
              Xpense will add it each month and keep it out of your safe-to-spend.
            </AppText>
          </View>
          <Switch value={makeRecurring} onValueChange={setMakeRecurring} trackColor={{ true: c.primary, false: c.border }} />
        </Row>
      )}

      {error && <Banner tone="danger">{error}</Banner>}
      <Button title="Save expense" icon="checkmark" onPress={save} loading={saving} />
      <Button title="Discard" kind="ghost" onPress={() => { clearPendingScan(id); router.back(); }} />
    </Screen>
  );
}

/** Keeps the typed text (e.g. "4.") while editing, and reports cents whenever it parses. */
function ItemPrice({ cents, label, onChange }: { cents: number; label: string; onChange: (cents: number) => void }) {
  const c = useColors();
  const [text, setText] = useState(centsToInput(cents));
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        setText(t);
        const v = parseAmount(t);
        if (v !== null) onChange(v);
      }}
      keyboardType="decimal-pad"
      accessibilityLabel={label}
      style={{
        minWidth: 90,
        textAlign: 'right',
        color: c.ink,
        fontSize: 16,
        fontWeight: '700',
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingVertical: 4,
      }}
    />
  );
}
