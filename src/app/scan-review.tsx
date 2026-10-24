import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DatePicker } from '@/components/DatePicker';
import { ReceiptScan } from '@/components/illustrations';
import { NeedWantToggle } from '@/components/money-ui';
import { useToast } from '@/components/Toast';
import { AppText, Banner, Button, Card, Divider, EmptyState, Pill, Row, Screen, Toggle } from '@/components/ui';
import { newId } from '@/db/ids';
import { addRecurring, applyDueRecurring } from '@/db/recurring';
import { useSettings } from '@/db/settings';
import { saveScannedReceipt } from '@/db/transactions';
import { categoryInfo } from '@/lib/categories';
import { addMonths, isValidISODate, today } from '@/lib/dates';
import { persistReceiptImage } from '@/lib/files';
import { centsToInput, currencySymbol, formatMoney, parseAmount } from '@/lib/money';
import { draftWarnings, itemsTotal, splitTotal, WARNING_TEXT, type DraftItem, type ReceiptDraft } from '@/lib/receipt';
import { maybeAskForReview } from '@/lib/review';
import { clearPendingScan, takePendingScan } from '@/lib/scan';
import { fonts, radius, space, useColors } from '@/theme/tokens';

const DOC_LABEL = { receipt: 'Receipt', bill: 'Bill', invoice: 'Invoice', other: 'Document' } as const;

export default function ScanReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pending = takePendingScan(id);
  const db = useSQLiteContext();
  const c = useColors();
  const toast = useToast();
  const settings = useSettings();
  const [draft, setDraft] = useState<ReceiptDraft | null>(pending?.draft ?? null);
  const [totalText, setTotalText] = useState(pending ? centsToInput(pending.draft.totalCents) : '');
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCents = parseAmount(totalText) ?? 0;
  const split = useMemo(() => (draft ? splitTotal({ ...draft, totalCents }) : { need: 0, want: 0 }), [draft, totalCents]);
  const warnings = useMemo(() => (draft ? draftWarnings({ ...draft, totalCents }) : []), [draft, totalCents]);

  if (!pending || !draft) {
    return (
      <Screen>
        <EmptyState
          illustration={<ReceiptScan />}
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
  const total = split.need + split.want;

  const save = async () => {
    setError(null);
    if (totalCents <= 0) return setError('Enter the total before saving.');
    if (!isValidISODate(draft.date)) return setError('Pick a valid date.');
    setSaving(true);
    try {
      const final = { ...draft, totalCents };
      const imageUri = persistReceiptImage(pending.imageUri, newId());
      await saveScannedReceipt(db, final, imageUri, pending.raw);
      if (makeRecurring && draft.docType === 'bill') {
        await addRecurring(db, {
          type: 'expense',
          label: draft.merchant || 'Bill',
          amountCents: totalCents,
          category: draft.category,
          necessity: draft.necessity,
          cadence: 'monthly',
          // This bill is already saved; start repeating from next month's due date.
          startOn: addMonths(draft.dueDate ?? draft.date, 1),
        });
        await applyDueRecurring(db, today(), currency);
      }
      clearPendingScan(id);
      toast({ message: `${draft.merchant || DOC_LABEL[draft.docType]} saved · ${formatMoney(totalCents, currency)}` });
      router.dismissTo('/history');
      maybeAskForReview(db);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Card style={{ flexDirection: 'row', gap: space.lg, alignItems: 'stretch' }}>
        <Image
          source={{ uri: pending.imageUri }}
          style={[styles.photo, { backgroundColor: c.surfaceAlt }]}
          contentFit="cover"
          accessibilityLabel="Scanned photo"
        />
        <View style={{ flex: 1, gap: space.sm, justifyContent: 'space-between' }}>
          <Pill icon="scan" label={DOC_LABEL[draft.docType]} color={c.primary} bg={c.primarySoft} />
          <TextInput
            value={draft.merchant}
            onChangeText={(merchant) => update({ merchant })}
            placeholder="Merchant"
            placeholderTextColor={c.inkMuted}
            accessibilityLabel="Merchant"
            style={[styles.merchant, { color: c.ink, borderColor: c.border }]}
          />
          <View>
            <AppText variant="label" muted>
              Total
            </AppText>
            <Row style={[styles.totalRow, { borderColor: c.border }]}>
              <AppText style={[styles.symbol, { color: c.inkMuted }]}>{currencySymbol(currency)}</AppText>
              <TextInput
                value={totalText}
                onChangeText={setTotalText}
                keyboardType="decimal-pad"
                accessibilityLabel="Total"
                style={[styles.total, { color: c.ink }]}
              />
            </Row>
          </View>
        </View>
      </Card>

      {warnings.map((w) => (
        <Banner key={w} tone={w === 'no_total' || w === 'not_receipt' ? 'danger' : 'warn'}>
          {WARNING_TEXT[w]}
        </Banner>
      ))}

      <View style={{ gap: space.sm }}>
        <AppText variant="label" muted>
          Date
        </AppText>
        <DatePicker value={draft.date} onChange={(date) => update({ date })} />
      </View>

      <Card>
        <AppText variant="title">Needs vs wants</AppText>
        <View style={styles.splitTrack}>
          {split.need > 0 && <View style={{ flex: split.need, backgroundColor: c.need, borderRadius: 5 }} />}
          {split.want > 0 && <View style={{ flex: split.want, backgroundColor: c.want, borderRadius: 5 }} />}
          {total <= 0 && <View style={{ flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 5 }} />}
        </View>
        <Row style={{ gap: space.xl }}>
          <SplitValue color={c.need} label="Needs" value={formatMoney(split.need, currency)} />
          <SplitValue color={c.want} label="Wants" value={formatMoney(split.want, currency)} />
        </Row>
        {draft.items.length === 0 && (
          <>
            <AppText muted>No line items were found. Mark the whole {DOC_LABEL[draft.docType].toLowerCase()} as:</AppText>
            <NeedWantToggle value={draft.necessity} onChange={(necessity) => update({ necessity })} />
          </>
        )}
      </Card>

      {draft.items.length > 0 && (
        <Card style={{ gap: 0, paddingVertical: space.sm }}>
          <Row style={{ justifyContent: 'space-between', paddingVertical: space.sm }}>
            <AppText variant="title">Items</AppText>
            <AppText variant="caption" weight="semibold" muted>
              {draft.items.length} · {formatMoney(itemsTotal(draft), currency)}
            </AppText>
          </Row>
          {draft.items.map((it) => (
            <View key={it.key}>
              <Divider />
              <View style={{ gap: space.sm, paddingVertical: space.md }}>
                <Row>
                  <TextInput
                    value={it.name}
                    onChangeText={(name) => updateItem(it.key, { name })}
                    style={[styles.itemName, { color: c.ink }]}
                    accessibilityLabel="Item name"
                  />
                  <ItemPrice cents={it.totalCents} label={`${it.name} price`} onChange={(totalCents) => updateItem(it.key, { totalCents })} />
                  <Pressable
                    onPress={() => update({ items: draft.items.filter((x) => x.key !== it.key) })}
                    accessibilityLabel={`Remove ${it.name}`}
                    hitSlop={8}>
                    <Ionicons name="close-circle" size={22} color={c.border} />
                  </Pressable>
                </Row>
                <NeedWantToggle value={it.necessity} onChange={(necessity) => updateItem(it.key, { necessity })} />
                {it.reason && (
                  <AppText variant="caption" muted numberOfLines={2}>
                    {categoryInfo(it.category, custom).label} · {it.reason}
                  </AppText>
                )}
              </View>
            </View>
          ))}
          <Divider />
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
        </Card>
      )}

      {draft.items.length > 0 && (
        <AppText variant="caption" muted center>
          Tax, tip and fees are shared between needs and wants in proportion.
        </AppText>
      )}

      {draft.notes && <Banner icon="chatbubble-ellipses-outline">{draft.notes}</Banner>}

      {draft.docType === 'bill' && (
        <Card>
          <Row style={{ justifyContent: 'space-between', gap: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText weight="semibold">Repeat this bill monthly</AppText>
              <AppText variant="caption" muted>
                Xpense adds it each month and keeps it out of your safe-to-spend.
              </AppText>
            </View>
            <Toggle value={makeRecurring} onValueChange={setMakeRecurring} label="Repeat this bill monthly" />
          </Row>
        </Card>
      )}

      {error && <Banner tone="danger">{error}</Banner>}
      <Button title="Save expense" icon="checkmark" onPress={save} loading={saving} />
      <Button
        title="Discard"
        kind="ghost"
        onPress={() => {
          clearPendingScan(id);
          router.back();
        }}
      />
    </Screen>
  );
}

function SplitValue({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText weight="extrabold" style={{ fontSize: 18 }}>
        {value}
      </AppText>
      <Row style={{ gap: 6 }}>
        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
        <AppText variant="caption" weight="semibold" muted>
          {label}
        </AppText>
      </Row>
    </View>
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
      style={[styles.price, { color: c.ink, backgroundColor: c.surfaceAlt }]}
    />
  );
}

const styles = StyleSheet.create({
  photo: { width: 96, height: 128, borderRadius: radius.sm },
  merchant: { fontFamily: fonts.bold, fontSize: 18, borderBottomWidth: 1, paddingVertical: 4, paddingHorizontal: 0, minWidth: 0, outlineStyle: 'solid', outlineWidth: 0 },
  totalRow: { gap: 4, borderBottomWidth: 1 },
  symbol: { fontFamily: fonts.extrabold, fontSize: 20 },
  total: { flex: 1, minWidth: 0, fontFamily: fonts.extrabold, fontSize: 28, paddingVertical: 2, paddingHorizontal: 0, outlineStyle: 'solid', outlineWidth: 0 },
  splitTrack: { flexDirection: 'row', height: 10, gap: 3 },
  itemName: { flex: 1, minWidth: 0, fontFamily: fonts.semibold, fontSize: 16, padding: 0, outlineStyle: 'solid', outlineWidth: 0 },
  price: { width: 92, textAlign: 'right', fontFamily: fonts.bold, fontSize: 16, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, outlineStyle: 'solid', outlineWidth: 0 },
});
