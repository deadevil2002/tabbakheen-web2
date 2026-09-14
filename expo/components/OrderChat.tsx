import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MessageCircle, Send, Flag } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { commonStyles as cs } from '@/constants/sharedStyles';
import {
  getOrderChat,
  markOrderChatRead,
  mergeOrderChatMessages,
  pendingOrderChatSend,
  preserveOlderChatCursor,
  reportOrderChat,
  sendOrderChatMessage,
  type OrderChatMessage,
} from '@/services/pushApi';
import { AppAlert } from '@/components/AppDialog';

interface OrderChatProps {
  orderId: string;
  currentUid: string;
  isRTL: boolean;
  locale: 'ar' | 'en';
}

function normalizeDraft(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim();
}

function latestVisibleMessage(messages: OrderChatMessage[]): OrderChatMessage | null {
  return messages.reduce<OrderChatMessage | null>(
    (latest, message) => !latest || message.sequence > latest.sequence || (message.sequence === latest.sequence && message.createdAt > latest.createdAt) ? message : latest,
    null,
  );
}

export function OrderChat({ orderId, currentUid, isRTL, locale }: OrderChatProps) {
  const [messages, setMessages] = useState<OrderChatMessage[]>([]);
  const [writable, setWritable] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMayExistOutsidePage, setUnreadMayExistOutsidePage] = useState(false);
  const [lastReadSequence, setLastReadSequence] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<{ requestId: string; text: string } | null>(null);
  const paginationOrderRef = useRef<string | null>(null);
  const acknowledgementRef = useRef<number | null>(null);

  useEffect(() => {
    paginationOrderRef.current = null;
    setMessages([]);
    setNextCursor(null);
    setUnreadCount(0);
    setUnreadMayExistOutsidePage(false);
    setLastReadSequence(0);
    acknowledgementRef.current = null;
    setLoading(true);
    setPendingMessage(null);
  }, [orderId]);

  const load = useCallback(async () => {
    try {
      const page = await getOrderChat(orderId);
      setMessages((previous) => mergeOrderChatMessages(previous, page.messages));
      setWritable(page.writable);
      setUnreadCount(page.unreadVisibleCount);
      setUnreadMayExistOutsidePage(page.unreadMayExistOutsidePage);
      setLastReadSequence((previous) => Math.max(previous, page.lastReadSequence));
      // Polling must not reset a cursor the user has advanced while paging
      // historical messages. Only the first newest-page response initializes it.
      const cursor = preserveOlderChatCursor(paginationOrderRef.current, orderId, nextCursor, page.nextCursor);
      paginationOrderRef.current = cursor.initializedOrderId;
      setNextCursor(cursor.cursor);
    } catch {
      // Do not replace already-loaded historical messages during a transient
      // network failure. The action below reports an explicit user error.
    } finally {
      setLoading(false);
    }
  }, [nextCursor, orderId]);

  const loadOlder = useCallback(async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await getOrderChat(orderId, nextCursor);
      setMessages((previous) => mergeOrderChatMessages(previous, page.messages));
      setNextCursor(page.nextCursor);
    } catch {
      AppAlert.alert('', locale === 'ar' ? 'تعذر تحميل الرسائل السابقة' : 'Unable to load earlier messages');
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, locale, nextCursor, orderId]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => { void load(); }, 15_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    // A newest-page poll may start far past the stored read marker. Never
    // acknowledge through that unloaded history: advance only through the
    // contiguous sequence range actually retained in this component.
    const bySequence = new Map(messages.filter((message) => message.sequence > 0).map((message) => [message.sequence, message]));
    let contiguousEnd = lastReadSequence;
    while (bySequence.has(contiguousEnd + 1)) contiguousEnd += 1;
    const targetSequence = Math.min(contiguousEnd, lastReadSequence + 30);
    const target = bySequence.get(targetSequence);
    if (!target || targetSequence <= lastReadSequence || acknowledgementRef.current === targetSequence) return;
    acknowledgementRef.current = targetSequence;
    void markOrderChatRead(orderId, target.messageId, lastReadSequence + 1)
      .then((confirmedSequence) => {
        setLastReadSequence((previous) => Math.max(previous, confirmedSequence));
      })
      .catch(() => {
        // Retain the loaded range and retry only after a later state change.
      })
      .finally(() => {
        if (acknowledgementRef.current === targetSequence) acknowledgementRef.current = null;
      });
  }, [lastReadSequence, messages, orderId]);

  const send = useCallback(async (preset?: string) => {
    const text = pendingMessage?.text ?? normalizeDraft(preset ?? draft);
    if (!text || Array.from(text).length > 500 || sending) {
      if (Array.from(text).length > 500) AppAlert.alert('', locale === 'ar' ? 'الرسالة يجب ألا تتجاوز 500 حرف' : 'Messages are limited to 500 characters');
      return;
    }
    const outgoing = pendingOrderChatSend(
      pendingMessage,
      `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      text,
    );
    setSending(true);
    setPendingMessage(outgoing);
    try {
      const message = await sendOrderChatMessage(orderId, outgoing.requestId, outgoing.text);
      setMessages((previous) => mergeOrderChatMessages(previous, [message]));
      setDraft('');
      setPendingMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      AppAlert.alert('', message || (locale === 'ar' ? 'تعذر إرسال الرسالة، حاول مرة أخرى' : 'Unable to send the message. Please try again.'));
    } finally {
      setSending(false);
    }
  }, [draft, locale, orderId, pendingMessage, sending]);

  const report = useCallback(() => {
    AppAlert.alert(
      locale === 'ar' ? 'الإبلاغ عن المحادثة' : 'Report conversation',
      locale === 'ar' ? 'سيتم إرسال بلاغ خاص إلى الإدارة للمراجعة.' : 'A private report will be sent to the administration for review.',
      [
        { text: locale === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: locale === 'ar' ? 'إبلاغ' : 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await reportOrderChat(orderId, latestVisibleMessage(messages)?.messageId);
              AppAlert.alert('', locale === 'ar' ? 'تم إرسال البلاغ' : 'Report sent');
            } catch {
              AppAlert.alert('', locale === 'ar' ? 'تعذر إرسال البلاغ' : 'Unable to send report');
            }
          },
        },
      ],
    );
  }, [locale, messages, orderId]);

  return (
    <View style={cs.sectionCard}>
      <View style={[s.titleRow, isRTL && s.rowRTL]}>
        <View style={[s.titleRow, isRTL && s.rowRTL]}>
          <MessageCircle size={20} color={Colors.primary} />
          <Text style={[cs.sectionTitle, isRTL && cs.rtlText, { marginBottom: 0 }]}>
            {locale === 'ar' ? 'محادثة الطلب' : 'Order chat'}
          </Text>
          {unreadCount > 0 ? <View style={s.unreadBadge}><Text style={s.unreadText}>{unreadCount}</Text></View> : null}
        </View>
        {unreadMayExistOutsidePage ? <Text style={[s.historyNotice, isRTL && cs.rtlText]}>{locale === 'ar' ? 'قد توجد رسائل غير مقروءة أقدم. حمّل الرسائل السابقة لتمييزها كمقروءة.' : 'Older unread messages may exist. Load earlier messages to mark them read.'}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={locale === 'ar' ? 'الإبلاغ عن المحادثة' : 'Report conversation'} onPress={report} style={s.reportButton}>
          <Flag size={17} color={Colors.error} />
          <Text style={s.reportText}>{locale === 'ar' ? 'إبلاغ' : 'Report'}</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator style={s.loader} color={Colors.primary} /> : (
        <View style={s.messageList}>
          {messages.length === 0 ? (
            <Text style={[s.emptyText, isRTL && cs.rtlText]}>
              {locale === 'ar' ? 'ابدأ محادثة قصيرة لتوضيح تفاصيل الطلب.' : 'Start a short conversation to clarify the order.'}
            </Text>
          ) : messages.map((message) => {
            const mine = message.senderUid === currentUid;
            return (
              <View key={message.messageId} style={[s.bubble, mine ? s.mine : s.theirs, isRTL && s.bubbleRTL]}>
                <Text style={[s.messageText, mine && s.mineText, isRTL && cs.rtlText]}>{message.text}</Text>
              </View>
            );
          })}
          {nextCursor ? (
            <Pressable accessibilityRole="button" onPress={() => void loadOlder()} disabled={loadingOlder} style={s.loadOlder}>
              {loadingOlder ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={s.loadOlderText}>{locale === 'ar' ? 'تحميل رسائل أقدم' : 'Load earlier messages'}</Text>}
            </Pressable>
          ) : null}
        </View>
      )}

      {writable ? (
        <>
          <View style={[s.composeRow, isRTL && s.rowRTL]}>
            <TextInput
              style={[s.input, isRTL && cs.inputRTL]}
              placeholder={locale === 'ar' ? 'اكتب رسالتك' : 'Write your message'}
              placeholderTextColor={Colors.textTertiary}
              value={draft}
              onChangeText={setDraft}
              editable={!sending && !pendingMessage}
              maxLength={1000}
              multiline
              textAlign={isRTL ? 'right' : 'left'}
            />
            <Pressable accessibilityRole="button" onPress={() => void send()} disabled={sending} style={[s.sendButton, sending && s.disabled]}>
              {sending ? <ActivityIndicator size="small" color={Colors.white} /> : <Send size={19} color={Colors.white} />}
            </Pressable>
          </View>
          <Text style={[s.counter, isRTL && cs.rtlText]}>{Array.from(normalizeDraft(pendingMessage?.text ?? draft)).length}/500</Text>
          {pendingMessage ? <Text style={[s.retryHint, isRTL && cs.rtlText]}>{locale === 'ar' ? 'تعذر تأكيد الإرسال. اضغط إرسال للمحاولة بنفس الرسالة.' : 'Sending was not confirmed. Press send to retry the same message.'}</Text> : null}
          {!pendingMessage && messages.length > 0 && messages[messages.length - 1].senderUid === currentUid ? null : (
            <View style={[s.quickReplies, isRTL && s.rowRTL]}>
              <Pressable onPress={() => void send(locale === 'ar' ? 'موافق' : 'Okay')} style={s.quickReply}><Text style={s.quickReplyText}>{locale === 'ar' ? 'موافق' : 'Okay'}</Text></Pressable>
              <Pressable onPress={() => void send(locale === 'ar' ? 'غير مناسب' : 'Not suitable')} style={s.quickReply}><Text style={s.quickReplyText}>{locale === 'ar' ? 'غير مناسب' : 'Not suitable'}</Text></Pressable>
            </View>
          )}
        </>
      ) : (
        <Text style={[s.readOnly, isRTL && cs.rtlText]}>
          {locale === 'ar' ? 'المحادثة محفوظة للرجوع إليها، ولا يمكن إرسال رسائل بعد اتخاذ قرار الطلب.' : 'This conversation is retained for reference and becomes read-only after the order decision.'}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowRTL: { flexDirection: 'row-reverse' },
  reportButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 4 },
  reportText: { color: Colors.error, fontSize: 12, fontWeight: '700' },
  unreadBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  historyNotice: { marginTop: 8, color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  loader: { paddingVertical: 18 },
  messageList: { gap: 8, marginTop: 14 },
  emptyText: { color: Colors.textTertiary, fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  bubble: { maxWidth: '86%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14 },
  bubbleRTL: { alignSelf: 'flex-start' },
  mine: { alignSelf: 'flex-end', backgroundColor: Colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: Colors.surfaceSecondary },
  messageText: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  mineText: { color: Colors.white },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 14 },
  input: { flex: 1, minHeight: 44, maxHeight: 100, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: Colors.text, backgroundColor: Colors.background },
  sendButton: { height: 44, width: 44, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.55 },
  counter: { marginTop: 4, color: Colors.textTertiary, fontSize: 11 },
  retryHint: { marginTop: 6, color: Colors.warning, fontSize: 12, lineHeight: 18 },
  quickReplies: { flexDirection: 'row', gap: 8, marginTop: 10 },
  quickReply: { borderWidth: 1, borderColor: Colors.primary, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 7 },
  quickReplyText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  loadOlder: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  loadOlderText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  readOnly: { marginTop: 14, color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
});