import React from 'react';
import { expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

const host = (name) => ({ children, accessibilityRole: _role, accessibilityLabel, ...props }) =>
  React.createElement(name, {
    ...props,
    ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
  }, children);

// Render the actual component without native runtime/device dependencies.
mock.module('react-native', () => ({
  ActivityIndicator: host('activity'),
  Pressable: host('pressable'),
  Text: host('text'),
  TextInput: host('input'),
  View: host('view'),
  StyleSheet: { create: (styles) => styles },
  Platform: { select: (options) => options.default ?? options.web },
}));
mock.module('lucide-react-native', () => ({
  MessageCircle: host('message-circle'),
  Send: host('send'),
  Flag: host('flag'),
}));
mock.module('@/components/AppDialog', () => ({ AppAlert: { alert: () => {} } }));

const { OrderChat } = await import('./OrderChat');

test('OrderChat renders the Arabic-first private report entry point', () => {
  const markup = renderToStaticMarkup(
    <OrderChat orderId="order-1" currentUid="customer-1" isRTL locale="ar" />,
  );
  expect(markup).toContain('محادثة الطلب');
  expect(markup).toContain('إبلاغ');
  expect(markup).toContain('الإبلاغ عن المحادثة');
});