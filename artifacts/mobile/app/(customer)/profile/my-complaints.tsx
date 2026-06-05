import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { commonStyles as cs } from '@/constants/sharedStyles';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { fsSubscribeCustomerComplaints, type CustomerComplaint } from '@/services/firestoreComplaints';
import { formatDate } from '@/utils/helpers';

export default function MyComplaintsScreen() {
  const router = useRouter();
  const { t, isRTL, locale } = useLocale();
  const { user } = useAuth();
  const r = isRTL;
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const [complaints, setComplaints] = useState<CustomerComplaint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setComplaints([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = fsSubscribeCustomerComplaints(user.uid, (items) => {
      setComplaints(items);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const statusLabel = (s: string): string => {
    if (s === 'resolved') return t('complaintStatusResolved');
    if (s === 'closed') return t('complaintStatusClosed');
    return t('complaintStatusPending');
  };

  const statusColors = (s: string): { text: string; bg: string } => {
    if (s === 'resolved') return { text: Colors.success, bg: Colors.successLight ?? Colors.surfaceSecondary };
    if (s === 'closed') return { text: Colors.error, bg: Colors.errorLight };
    return { text: Colors.warning ?? Colors.primary, bg: Colors.surfaceSecondary };
  };

  const targetLabel = (c: CustomerComplaint): string => {
    if (c.target === 'provider') return t('complaintAgainstProvider');
    if (c.target === 'driver') return t('complaintAgainstDriver');
    if (c.type === 'customer_rejected_receipt') return t('complaintAgainstDriver');
    return '-';
  };

  const typeLabel = (c: CustomerComplaint): string => {
    if (c.type === 'customer_complaint') return t('complaintTypeGeneral');
    if (c.type === 'customer_rejected_receipt') return t('complaintTypeRejectedReceipt');
    return c.type || '-';
  };

  const fmt = (ms: number | null): string => (ms ? formatDate(new Date(ms).toISOString(), locale) : '-');

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={[styles.headerRow, r && styles.rowRTL]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <BackIcon size={22} color={Colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, r && styles.rtlText]}>{t('myComplaints')}</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : complaints.length === 0 ? (
        <View style={styles.center}>
          <FileText size={48} color={Colors.textTertiary} />
          <Text style={[styles.emptyText, r && styles.rtlText]}>{t('complaintsEmpty')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {complaints.map((c) => {
            const sc = statusColors(c.complaintStatus);
            return (
              <View key={c.id} style={styles.card}>
                <View style={[styles.cardTop, r && styles.rowRTL]}>
                  <Text style={[styles.orderNumber, r && styles.rtlText]}>
                    {t('orderNumber')}: {c.orderNumber || '-'}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.badgeText, { color: sc.text }]}>{statusLabel(c.complaintStatus)}</Text>
                  </View>
                </View>

                <Row label={t('complaintTypeLabel')} value={typeLabel(c)} r={r} />
                <Row label={t('complaintAgainstLabel')} value={targetLabel(c)} r={r} />
                <Row label={t('complaintNoteFieldLabel')} value={c.note || '-'} r={r} />
                {c.adminNote ? <Row label={t('complaintAdminReplyLabel')} value={c.adminNote} r={r} highlight /> : null}
                <Row label={t('complaintCreatedAtLabel')} value={fmt(c.createdAt)} r={r} />
                <Row label={t('complaintUpdatedAtLabel')} value={fmt(c.updatedAt)} r={r} />
              </View>
            );
          })}
          <View style={cs.bottomSpacer} />
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value, r, highlight }: { label: string; value: string; r: boolean; highlight?: boolean }) {
  return (
    <View style={[styles.row, r && styles.rowRTL]}>
      <Text style={[styles.rowLabel, r && styles.rtlText]}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight, r && styles.rtlText]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerSafe: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  rowRTL: { flexDirection: 'row-reverse' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' as const, color: Colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  orderNumber: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' as const },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  rowLabel: { fontSize: 13, color: Colors.textTertiary, minWidth: 96 },
  rowValue: { fontSize: 13, color: Colors.text, flex: 1, fontWeight: '500' as const },
  rowValueHighlight: { color: Colors.primary, fontWeight: '700' as const },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});
