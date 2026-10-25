import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DatePicker } from '@/components/DatePicker';
import { ViewfinderSketch } from '@/components/illustrations';
import { NeedWantToggle } from '@/components/money-ui';
import { NeedMark, SketchFrame, SketchRule, SplitBar, WantMark } from '@/components/sketch';
import { useToast } from '@/components/Toast';
import { AppText, Banner, Button, EmptyState, Label, Row, Screen, tabular, TextLink, Toggle } from '@/components/ui';
import { newId } from '@/db/ids';
import { addRecurring, applyDueRecurring } from '@/db/recurring';
import { useSettings } from '@/db/settings';
import { saveScannedReceipt } from '@/db/transactions';
import { categoryInfo } from '@/lib/categories';
import { addMonths, formatDay, isValidISODate, today } from '@/lib/dates';
import { persistReceiptImage } from '@/lib/files';
import { centsToInput, currencySymbol, formatMoney, parseAmount } from '@/lib/money';
import { draftWarnings, itemsTotal, splitTotal, WARNING_TEXT, type DraftItem, type ReceiptDraft } from '@/lib/receipt';
import { maybeAskForReview } from '@/lib/review';
import { clearPendingScan, takePendingScan } from '@/lib/scan';
import { colors, fonts, space } from '@/theme/tokens';

const DOC_LABEL = { receipt: 'receipt', bill: 'bill', invoice: 'invoice', other: 'document' } as const;

export default function ScanReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pending = takePendingScan(id);
  const db = useSQLiteContext();
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
          illustration={<ViewfinderSketch width={220} />}
          title="Nothing to check"
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
    if (totalCents <= 0) return setError('Write the total before saving.');
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
      toast({ message: `${draft.merchant || 'Receipt'} saved · ${formatMoney(totalCents, currency)}` });
      router.dismissTo('/history');
      maybeAskForReview(db);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    clearPendingScan(id);
    router.back();
  };

  return (
    <Screen contentStyle={{ paddingBottom: 48 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="caption" muted>
          {isValidISODate(draft.date) ? formatDay(draft.date, { weekday: 'short', day: 'numeric', month: 'short' }) : 'No date'} ·{' '}
          {categoryInfo(draft.category, custom).label} · {DOC_LABEL[draft.docType]}
        </AppText>
        <AppText variant="note" muted style={{ fontSize: 18 }}>
          {draft.confidence === 'high' ? 'read clearly' : draft.confidence === 'medium' ? 'mostly clear' : 'hard to read'}
        </AppText>
      </Row>

      <Row style={{ alignItems: 'flex-start', gap: space.lg }}>
        <View style={{ flex: 1, gap: 2 }}>
          <TextInput
            value={draft.merchant}
            onChangeText={(merchant) => update({ merchant })}
            placeholder="Shop or biller"
            placeholderTextColor={colors.pencil}
            accessibilityLabel="Shop or biller"
            multiline
            style={styles.merchant}
          />
          <Row style={{ alignItems: 'baseline', gap: 2 }}>
            <AppText style={{ fontFamily: fonts.serif, fontSize: 30, color: colors.graphite }}>{currencySymbol(currency)}</AppText>
            <TextInput value={totalText} onChangeText={setTotalText} keyboardType="decimal-pad" accessibilityLabel="Total" style={[styles.total, tabular]} />
          </Row>
        </View>
        {pending.imageUri ? (
          <View style={styles.photo}>
            <Image source={{ uri: pending.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Scanned photo" />
            <SketchFrame seed={91} />
          </View>
        ) : null}
      </Row>

      <View style={{ gap: 8 }}>
        <SplitBar need={split.need} want={split.want} height={14} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: 6 }}>
            <NeedMark size={10} />
            <AppText variant="caption" muted>
              <AppText variant="caption" weight="semibold" style={tabular}>
                {formatMoney(split.need, currency)}
              </AppText>{' '}
              needs
            </AppText>
          </Row>
          <Row style={{ gap: 6 }}>
            <WantMark size={10} />
            <AppText variant="caption" muted>
              <AppText variant="caption" weight="semibold" style={tabular}>
                {formatMoney(split.want, currency)}
              </AppText>{' '}
              wants
            </AppText>
          </Row>
        </Row>
      </View>

      {warnings.map((w) => (
        <Banner key={w} tone={w === 'no_total' || w === 'not_receipt' ? 'danger' : 'warn'}>
          {WARNING_TEXT[w]}
        </Banner>
      ))}

      {draft.items.length === 0 ? (
        <View style={{ gap: space.sm }}>
          <AppText muted>No separate lines were found. The whole {DOC_LABEL[draft.docType]} is a:</AppText>
          <NeedWantToggle value={draft.necessity} onChange={(necessity) => update({ necessity })} />
        </View>
      ) : (
        <View>
          <Row style={{ justifyContent: 'space-between', marginBottom: 2 }}>
            <Label>
              {draft.items.length} {draft.items.length === 1 ? 'line' : 'lines'} · {formatMoney(itemsTotal(draft), currency)}
            </Label>
            <AppText variant="note" muted style={{ fontSize: 19, transform: [{ rotate: '-2deg' }] }}>
              tap to switch ↓
            </AppText>
          </Row>
          {draft.items.map((it, i) => (
            <View key={it.key} style={styles.item}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Row style={{ gap: 8 }}>
                  <TextInput value={it.name} onChangeText={(name) => updateItem(it.key, { name })} style={styles.itemName} accessibilityLabel="Item name" />
                  <ItemPrice cents={it.totalCents} label={`${it.name} price`} onChange={(totalCents) => updateItem(it.key, { totalCents })} />
                </Row>
                {it.reason ? (
                  <AppText variant="note" faint numberOfLines={1} style={{ fontSize: 18, lineHeight: 20 }}>
                    {it.reason.charAt(0).toLowerCase() + it.reason.slice(1)}
                  </AppText>
                ) : null}
              </View>
              <NeedWantToggle value={it.necessity} onChange={(necessity) => updateItem(it.key, { necessity })} />
              <Pressable
                onPress={() => update({ items: draft.items.filter((x) => x.key !== it.key) })}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${it.name}`}
                hitSlop={8}>
                <AppText faint style={{ fontSize: 20 }}>
                  ×
                </AppText>
              </Pressable>
              {i < draft.items.length - 1 && <SketchRule seed={60 + i} opacity={0.2} style={styles.itemRule} />}
            </View>
          ))}
          <View style={{ marginTop: space.sm }}>
            <TextLink
              label="+ Add a line"
              onPress={() =>
                update({
                  items: [
                    ...draft.items,
                    { key: `new-${Date.now()}`, name: 'New item', qty: null, totalCents: 0, category: draft.category, necessity: 'need', reason: null },
                  ],
                })
              }
            />
          </View>
        </View>
      )}

      {draft.items.length > 0 && (draft.taxCents ?? 0) + (draft.tipCents ?? 0) > 0 && (
        <AppText variant="caption" faint>
          Tax and tip ({formatMoney((draft.taxCents ?? 0) + (draft.tipCents ?? 0), currency)}) are shared between needs and wants in proportion.
        </AppText>
      )}

      {draft.notes && <Banner>{draft.notes}</Banner>}

      <View style={{ gap: space.sm }}>
        <Label>Date</Label>
        <DatePicker value={draft.date} onChange={(date) => update({ date })} />
      </View>

      {draft.docType === 'bill' && (
        <Row style={{ justifyContent: 'space-between', gap: space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText weight="medium">Repeat this bill every month</AppText>
            <AppText variant="caption" faint>
              Xpense adds it when it’s due and keeps it out of what’s safe to spend.
            </AppText>
          </View>
          <Toggle value={makeRecurring} onValueChange={setMakeRecurring} label="Repeat this bill every month" />
        </Row>
      )}

      {error && <Banner tone="danger">{error}</Banner>}
      <Button title="Save expense" onPress={save} loading={saving} />
      <Button title="Discard" kind="ghost" onPress={discard} />
    </Screen>
  );
}

/** Keeps the typed text (e.g. "4.") while editing, and reports cents whenever it parses. */
function ItemPrice({ cents, label, onChange }: { cents: number; label: string; onChange: (cents: number) => void }) {
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
      style={[styles.price, tabular]}
    />
  );
}

const styles = StyleSheet.create({
  merchant: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, color: colors.ink, padding: 0, outlineStyle: 'solid', outlineWidth: 0 },
  total: { flex: 1, minWidth: 0, fontFamily: fonts.serif, fontSize: 52, lineHeight: 60, color: colors.ink, padding: 0, outlineStyle: 'solid', outlineWidth: 0 },
  photo: { width: 72, height: 96, backgroundColor: colors.page, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  itemRule: { position: 'absolute', left: 0, right: 0, bottom: -3 },
  itemName: { flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, padding: 0, outlineStyle: 'solid', outlineWidth: 0 },
  price: { width: 70, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, padding: 0, outlineStyle: 'solid', outlineWidth: 0 },
});
