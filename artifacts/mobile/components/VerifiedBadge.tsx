import React from 'react';
import { BadgeCheck } from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { User } from '@/types';

export const VERIFIED_BLUE = '#1D9BF0';

interface VerifiedBadgeProps {
  status?: User['verificationStatus'];
  size?: number;
}

function VerifiedBadgeComponent({ status, size = 16 }: VerifiedBadgeProps) {
  if (status !== 'verified') return null;
  return <BadgeCheck size={size} color={Colors.white} fill={VERIFIED_BLUE} />;
}

export const VerifiedBadge = React.memo(VerifiedBadgeComponent);
export default VerifiedBadge;
