import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { MessageCircle, Mail, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';

const WHATSAPP_NUMBER = '966570758881';
const SUPPORT_EMAIL = 'tabbakheen@gmail.com';

interface SupportDialogProps {
  visible: boolean;
  onClose: () => void;
}

export default function SupportDialog({ visible, onClose }: SupportDialogProps) {
  const { t, isRTL } = useLocale();

  const handleWhatsApp = async () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        onClose();
      } else {
        Alert.alert(t('error'), t('whatsappError'));
      }
    } catch {
      Alert.alert(t('error'), t('whatsappError'));
    }
  };

  const handleEmail = async () => {
    const subject = encodeURIComponent(t('supportEmailSubject'));
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
        onClose();
        return;
      }
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        onClose();
      } else {
        Alert.alert(t('error'), t('emailError'));
      }
    } catch {
      Alert.alert(t('error'), t('emailError'));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.dialogHeader, isRTL && styles.rowRTL]}>
            <Text style={[styles.dialogTitle, isRTL && styles.rtlText]}>{t('supportTitle')}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <X size={20} color={Colors.textTertiary} />
            </Pressable>
          </View>

          <View style={styles.optionsContainer}>
            <Pressable
              style={({ pressed }) => [styles.optionBtn, styles.whatsappBtn, pressed && styles.optionPressed]}
              onPress={handleWhatsApp}
            >
              <View style={[styles.optionContent, isRTL && styles.rowRTL]}>
                <View style={[styles.iconCircle, { backgroundColor: '#E7F5EC' }]}>
                  <MessageCircle size={22} color="#25D366" />
                </View>
                <Text style={[styles.optionText, isRTL && styles.rtlText]}>{t('supportWhatsapp')}</Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.optionBtn, styles.emailBtn, pressed && styles.optionPressed]}
              onPress={handleEmail}
            >
              <View style={[styles.optionContent, isRTL && styles.rowRTL]}>
                <View style={[styles.iconCircle, { backgroundColor: Colors.infoLight }]}>
                  <Mail size={22} color={Colors.info} />
                </View>
                <Text style={[styles.optionText, isRTL && styles.rtlText]}>{t('supportEmail')}</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  dialog: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    width: '100%',
    maxWidth: 360,
    padding: 24,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnPressed: {
    backgroundColor: Colors.background,
  },
  optionsContainer: {
    gap: 12,
  },
  optionBtn: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  whatsappBtn: {
    backgroundColor: '#F0FFF4',
    borderColor: '#C6F6D5',
  },
  emailBtn: {
    backgroundColor: Colors.infoLight,
    borderColor: '#BFDBFE',
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
