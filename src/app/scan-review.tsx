import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CategorySheet } from '@/components/CategorySheet';
import { dayLabel, DateSheet } from '@/components/DateSheet';
import { Icon } from '@/components/icons';
import { Mark } from '@/components/marks';
import { Appear, useEntrance } from '@/components/motion';
import { NeedWantToggle, SplitBar } from '@/components/money-ui';
import { ReceiptPicture, Viewfinder } from '@/components/pictures';
import { useToast } from '@/components/Toast';
import { AppText, Button, EmptyState, haptic, IconButton, Notice, Screen, Switch, TextLink, TopBar } from '@/components/ui';
import { newId } from '@/db/ids';
import { addRecurring, applyDueRecurring } from '@/db/recurring';
import { useSettings } from '@/db/settings';
import { saveScannedReceipt } from '@/db/transactions';
import { categoryInfo } from '@/lib/categories';
import { addMonths, isValidISODate, today } from '@/lib/dates';
import { persistReceiptImage } from '@/lib/files';
import { centsToInput, currencySymbol, formatFigure, formatMoney, parseAmount } from '@/lib/money';
import { draftWarnings, itemsTotal, splitTotal, WARNING_TEXT, type DraftItem, type ReceiptDraft } from '@/lib/receipt';
import { maybeAskForReview } from '@/lib/review';
import { clearPendingScan, takePendingScan } from '@/lib/scan';
import { colors, fonts } from '@/theme/tokens';

const DOC_LABEL = { receipt: 'Receipt', bill: 'Bill', invoice: 'Invoice', other: 'Document' } as const;

export default function ScanReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pending = takePendingScan(id);
  const db = useSQLiteContext();
  const toast = useToast();
  const settings = useSettings();
  const entrance = useEntrance(16);
  const [draft, setDraft] = useState<ReceiptDraft | null>(pending?.draft ?? null);
  const [totalText, setTotalText] = useState(pending ? centsToInput(pending.draft.totalCents) : '');
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'category' | 'date' | null>(null);

  const totalCents = parseAmount(totalText) ?? 0;
  const split = useMemo(() => (draft ? splitTotal({ ...draft, totalCents }) : { need: 0, want: 0 }), [draft, totalCents]);
  const warnings = useMemo(() => (draft ? draftWarnings({ ...draft, totalCents }) : []), [draft, totalCents]);

  if (!pending || !draft) {
    return (
      <Screen>
        <TopBar onBack={() => router.back()} close />
        <EmptyState
          picture={<View style={{ width: 280 }}><Viewfinder /></View>}
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
  const updateItem = (key: string, patch: Partial<DraftItem>) => update({ items: draft.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) });

  const save = async () => {
    setError(null);
    if (totalCents <= 0) {
      haptic('warning');
      return setError('Write the total before saving.');
    }
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

  const discard = () => {
    clearPendingScan(id);
    router.back();
  };

  const lines = draft.items.length;
  const taxTip = (draft.taxCents ?? 0) + (draft.tipCents ?? 0);

  return (
    <Screen>
      <View>
        <TopBar onBack={discard} close />
        <View style={styles.centerTitle} pointerEvents="none">
          <AppText weight="medium">Check the scan</AppText>
        </View>
      </View>

      <Appear>
        <View style={styles.metaRow}>
          <AppText variant="caption" muted>
            {DOC_LABEL[draft.docType]}
            {lines > 0 ? ` · ${lines} ${lines === 1 ? 'line' : 'lines'}` : ''}
          </AppText>
          <AppText variant="caption" muted>
            {draft.confidence === 'high' ? 'Read clearly' : draft.confidence === 'medium' ? 'Mostly clear' : 'Hard to read'}
          </AppText>
        </View>

        <View style={styles.top}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TextInput
              value={draft.merchant}
              onChangeText={(merchant) => update({ merchant })}
              placeholder="Shop or biller"
              placeholderTextColor={colors.grey}
              accessibilityLabel="Shop or biller"
              multiline
              style={styles.merchant}
            />
            <View style={styles.totalRow}>
              <AppText weight="extralight" style={{ fontSize: 26, lineHeight: 38, marginRight: 3 }}>
                {currencySymbol(currency)}
              </AppText>
              <TextInput value={totalText} onChangeText={setTotalText} keyboardType="decimal-pad" inputMode="decimal" accessibilityLabel="Total" style={styles.total} />
            </View>
          </View>
          <View style={styles.photo}>
            {pending.imageUri ? (
              <Image source={{ uri: pending.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Scanned photo" />
            ) : (
              <ReceiptPicture width={64} height={86} rows={3} />
            )}
          </View>
        </View>
      </Appear>

      <View style={{ marginTop: 20 }}>
        <SplitBar need={split.need} want={split.want} currency={currency} />
        <View style={styles.splitKeys}>
          <View style={styles.key}>
            <Mark kind="need" size={10} />
            <AppText variant="caption">
              <AppText variant="monoSmall">{formatFigure(split.need, currency)}</AppText> needs
            </AppText>
          </View>
          <View style={styles.key}>
            <Mark kind="want" size={10} />
            <AppText variant="caption">
              <AppText variant="monoSmall">{formatFigure(split.want, currency)}</AppText> wants
            </AppText>
          </View>
        </View>
      </View>

      {warnings.map((w) => (
        <Notice key={w} tone={w === 'no_total' || w === 'not_receipt' ? 'alert' : 'info'} style={{ marginTop: 16 }}>
          {WARNING_TEXT[w]}
        </Notice>
      ))}

      {lines === 0 ? (
        <View style={{ marginTop: 28, gap: 12 }}>
          <AppText muted>No separate lines were found. The whole {DOC_LABEL[draft.docType].toLowerCase()} is a:</AppText>
          <NeedWantToggle value={draft.necessity} onChange={(necessity) => update({ necessity })} />
        </View>
      ) : (
        <View style={{ marginTop: 28 }}>
          <View style={styles.linesHead}>
            <AppText variant="caption" muted>
              {lines} {lines === 1 ? 'line' : 'lines'} · <AppText variant="monoSmall">{formatFigure(itemsTotal(draft), currency)}</AppText>
            </AppText>
            <AppText variant="small" muted>
              Tap Need or Want to switch
            </AppText>
          </View>
          {draft.items.map((it, i) => (
            <Appear key={it.key} delay={entrance(i) ?? 0} skip={entrance(i) === undefined}>
              <View style={styles.item}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <TextInput value={it.name} onChangeText={(name) => updateItem(it.key, { name })} style={styles.itemName} accessibilityLabel="Item name" />
                  {it.reason ? (
                    <AppText variant="small" muted numberOfLines={1}>
                      {it.reason.charAt(0).toLowerCase() + it.reason.slice(1)}
                    </AppText>
                  ) : null}
                </View>
                <ItemPrice cents={it.totalCents} label={`${it.name} price`} onChange={(totalCents) => updateItem(it.key, { totalCents })} />
                <NeedWantToggle value={it.necessity} label={`${it.name}: need or want`} onChange={(necessity) => updateItem(it.key, { necessity })} />
                <IconButton
                  icon="close"
                  label={`Remove ${it.name}`}
                  size={24}
                  iconSize={12}
                  color={colors.grey}
                  onPress={() => update({ items: draft.items.filter((x) => x.key !== it.key) })}
                />
              </View>
            </Appear>
          ))}
          <TextLink
            label="Add a line"
            onPress={() =>
              update({
                items: [
                  ...draft.items,
                  { key: `new-${Date.now()}`, name: 'New item', qty: null, totalCents: 0, category: draft.category, necessity: 'need', reason: null },
                ],
              })
            }
            style={{ alignSelf: 'flex-start' }}
          />
          {taxTip > 0 && (
            <AppText variant="caption" muted style={{ marginTop: 4 }}>
              {(draft.tipCents ?? 0) > 0 ? 'Tax and tip' : 'Tax'} (<AppText variant="monoSmall" muted>{formatFigure(taxTip, currency)}</AppText>){' '}
              {(draft.tipCents ?? 0) > 0 ? 'are' : 'is'} shared between needs and wants in proportion.
            </AppText>
          )}
        </View>
      )}

      {draft.notes && <Notice style={{ marginTop: 16 }}>{draft.notes}</Notice>}

      <View style={styles.rows}>
        <Row label="Date" value={isValidISODate(draft.date) ? dayLabel(draft.date) : 'Pick a date'} onPress={() => setSheet('date')} />
        <Row label="Category" value={categoryInfo(draft.category, custom).label} onPress={() => setSheet('category')} />
        {draft.docType === 'bill' && (
          <View style={styles.repeatRow}>
            <View style={{ flex: 1 }}>
              <AppText>Repeat this bill every month</AppText>
              <AppText variant="caption" muted>
                Added when it’s due, and kept out of what’s safe to spend.
              </AppText>
            </View>
            <Switch value={makeRecurring} onValueChange={setMakeRecurring} label="Repeat this bill every month" />
          </View>
        )}
      </View>

      {error && (
        <Appear distance={4}>
          <Notice tone="alert" style={{ marginTop: 24 }}>
            {error}
          </Notice>
        </Appear>
      )}
      <Button title="Save expense" onPress={save} loading={saving} style={{ marginTop: 32 }} />
      <TextLink label="Discard" onPress={discard} style={{ alignSelf: 'center', marginTop: 8 }} />

      <CategorySheet
        open={sheet === 'category'}
        onClose={() => setSheet(null)}
        type="expense"
        value={draft.category}
        custom={custom}
        onChange={(category) => update({ category })}
      />
      <DateSheet open={sheet === 'date'} onClose={() => setSheet(null)} value={isValidISODate(draft.date) ? draft.date : today()} onChange={(date) => update({ date })} />
    </Screen>
  );
}

function Row({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Change`} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.5 : 1 }]}>
      <AppText muted>{label}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
        <AppText numberOfLines={1}>{value}</AppText>
        <Icon name="chevron" size={16} strokeWidth={1.5} />
      </View>
    </Pressable>
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
      inputMode="decimal"
      accessibilityLabel={label}
      style={styles.price}
    />
  );
}

const plain = { padding: 0, outlineStyle: 'solid' as const, outlineWidth: 0 };

const styles = StyleSheet.create({
  centerTitle: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  top: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginTop: 12 },
  merchant: { fontFamily: fonts.light, fontSize: 30, lineHeight: 36, letterSpacing: -0.9, color: colors.ink, ...plain },
  totalRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  total: { flex: 1, minWidth: 0, fontFamily: fonts.extralight, fontSize: 72, lineHeight: 76, letterSpacing: -3.6, color: colors.ink, ...plain },
  photo: { width: 64, height: 86, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.page, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  splitKeys: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.ink },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  itemName: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.ink, ...plain },
  price: { width: 56, textAlign: 'right', fontFamily: fonts.mono, fontSize: 14, color: colors.ink, ...plain },
  rows: { marginTop: 24, borderTopWidth: 1, borderTopColor: colors.rule },
  row: { height: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
});
