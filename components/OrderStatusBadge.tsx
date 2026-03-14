import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, Check, X, CheckCircle, ChefHat, Package, Truck, MapPin, Ban, Search } from 'lucide-react-native';
import { OrderStatus } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';
import { getStatusColor } from '@/utils/helpers';

interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: 'small' | 'medium';
}

function OrderStatusBadgeComponent({ status, size = 'medium' }: OrderStatusBadgeProps) {
  const { t } = useLocale();
  const colors = getStatusColor(status);
  const isSmall = size === 'small';

  const iconSize = isSmall ? 12 : 14;

  const getIcon = () => {
    switch (status) {
      case 'pending': return Clock;
      case 'accepted': return Check;
      case 'rejected': return X;
      case 'preparing': return ChefHat;
      case 'ready_for_pickup': return Package;
      case 'searching_driver': return Search;
      case 'assigned_to_driver': return Truck;
      case 'picked_up': return MapPin;
      case 'delivered': return CheckCircle;
      case 'cancelled': return Ban;
      default: return Clock;
    }
  };

  const Icon = getIcon();

  const statusKey = status as keyof ReturnType<typeof t extends (key: infer K) => string ? never : never>;

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, isSmall && styles.badgeSmall]}>
      <Icon size={iconSize} color={colors.text} />
      <Text style={[styles.text, { color: colors.text }, isSmall && styles.textSmall]}>
        {t(status as any)}
      </Text>
    </View>
  );
}

export const OrderStatusBadge = React.memo(OrderStatusBadgeComponent);

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  textSmall: {
    fontSize: 11,
  },
});
