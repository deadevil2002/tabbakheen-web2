import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';

interface ComplaintNoteModalProps {
  visible: boolean;
  title: string;
  message?: string;
  onCancel: () => void;
  onSubmit: (note: string) => void | Promise<void>;
}

export function ComplaintNoteModal({
  visible,
  title,
  message,
  onCancel,
  onSubmit,
}: ComplaintNoteModalProps) {
  const { t, isRTL } = useLocale();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setNote('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      setError(t('complaintNoteRequired'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.dialog}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, isRTL && styles.rtlText]}>{message}</Text>
          ) : null}
          <TextInput
            style={[styles.input, isRTL && styles.rtlInput, error && styles.inputError]}
            value={note}
            onChangeText={(v) => {
              setNote(v);
              if (error) setError(null);
            }}
            placeholder={t('complaintNotePlaceholder')}
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlign={isRTL ? 'right' : 'left'}
            editable={!submitting}
          />
          {error ? (
            <Text style={[styles.errorText, isRTL && styles.rtlText]}>{error}</Text>
          ) : null}
          <View
            style={[styles.buttons, isRTL ? styles.buttonsRowRTL : styles.buttonsRow]}
          >
            <Pressable
              onPress={onCancel}
              disabled={submitting}
              style={({ pressed }) => [
                styles.button,
                styles.buttonFlex,
                styles.buttonCancel,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={[styles.buttonText, styles.buttonTextCancel]} numberOfLines={1}>
                {t('cancel')}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.button,
                styles.buttonFlex,
                styles.buttonDestructive,
                pressed && styles.buttonPressed,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text
                  style={[styles.buttonText, styles.buttonTextDestructive]}
                  numberOfLines={1}
                >
                  {t('sendComplaint')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
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
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontSize: 19,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surfaceSecondary,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  rtlInput: {
    writingDirection: 'rtl',
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    marginTop: 8,
  },
  rtlText: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  buttons: {
    gap: 10,
    marginTop: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
  },
  buttonsRowRTL: {
    flexDirection: 'row-reverse',
  },
  button: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFlex: {
    flex: 1,
  },
  buttonCancel: {
    backgroundColor: Colors.surfaceSecondary,
  },
  buttonDestructive: {
    backgroundColor: Colors.error,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  buttonTextCancel: {
    color: Colors.textSecondary,
  },
  buttonTextDestructive: {
    color: '#FFFFFF',
  },
});

export default ComplaintNoteModal;
