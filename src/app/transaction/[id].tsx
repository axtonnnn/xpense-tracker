import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EntryDetail } from '@/components/EntryDetail';
import { useLiveQuery } from '@/db/live';
import { getTransaction } from '@/db/transactions';
import { AppText, Screen, TopBar } from '@/components/ui';

export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLiveQuery((d) => getTransaction(d, id), [id]);
  const title = data ? (data.tx.type === 'income' ? 'Income' : 'Expense') : '';
  return (
    <Screen>
      <View>
        <TopBar onBack={() => router.back()} />
        <View style={styles.title} pointerEvents="none">
          <AppText weight="medium">{title}</AppText>
        </View>
      </View>
      <View style={{ marginTop: 16 }}>
        <EntryDetail id={id} onDone={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
});
