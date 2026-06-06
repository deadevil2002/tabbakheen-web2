import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Alert } from 'react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';

export type AppAlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AppAlertButton {
  text: string;
  style?: AppAlertButtonStyle;
  onPress?: () => void;
}

interface DialogConfig {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
}

let dispatchConfig: ((config: DialogConfig) => void) | null = null;

export const AppAlert = {
  alert(title: string, message?: string, buttons?: AppAlertButton[]) {
    if (dispatchConfig) {
      dispatchConfig({ title, message, buttons });
    } else {
      Alert.alert(title, message, buttons as never);
    }
  },
};

export function AppDialogHost() {
  const { t, isRTL } = useLocale();
  const [config, setConfig] = useState<DialogConfig | null>(null);

  useEffect(() => {
    dispatchConfig = (next) => setConfig(next);
    return () => {
      dispatchConfig = null;
    };
  }, []);

  const close = useCallback(() => setConfig(null), []);

  const handlePress = useCallback((button: AppAlertButton) => {
    setConfig(null);
    button.onPress?.();
  }, []);

  const buttons: AppAlertButton[] =
    config?.buttons && config.buttons.length > 0
      ? config.buttons
      : [{ text: t('ok'), style: 'default' }];

  const isRow = buttons.length === 2;

  return (
    <Modal
      visible={!!config}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.dialog}>
          {config?.title ? (
            <Text style={[styles.title, isRTL && styles.rtlText]}>{config.title}</Text>
          ) : null}
          {config?.message ? (
            <Text style={[styles.message, isRTL && styles.rtlText]}>{config.message}</Text>
          ) : null}
          <View
            style={[
              styles.buttons,
              isRow ? (isRTL ? styles.buttonsRowRTL : styles.buttonsRow) : styles.buttonsColumn,
            ]}
          >
            {buttons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  onPress={() => handlePress(button)}
                  style={({ pressed }) => [
                    styles.button,
                    isRow ? styles.buttonFlex : styles.buttonFull,
                    isCancel
                      ? styles.buttonCancel
                      : isDestructive
                        ? styles.buttonDestructive
                        : styles.buttonDefault,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel
                        ? styles.buttonTextCancel
                        : isDestructive
                          ? styles.buttonTextDestructive
                          : styles.buttonTextDefault,
                    ]}
                    numberOfLines={1}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
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
    marginBottom: 24,
  },
  rtlText: {
    writingDirection: 'rtl',
  },
  buttons: {
    gap: 10,
  },
  buttonsColumn: {
    flexDirection: 'column',
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
  buttonFull: {
    width: '100%',
  },
  buttonFlex: {
    flex: 1,
  },
  buttonDefault: {
    backgroundColor: Colors.primary,
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
  buttonTextDefault: {
    color: '#FFFFFF',
  },
  buttonTextCancel: {
    color: Colors.textSecondary,
  },
  buttonTextDestructive: {
    color: '#FFFFFF',
  },
});
