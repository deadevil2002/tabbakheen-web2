import { User } from '@/types';

const TRIAL_DAYS = 30;

export function getTrialEndDate(createdAt: string): Date {
  const created = new Date(createdAt);
  return new Date(created.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export function getTrialDaysRemaining(createdAt: string): number {
  const trialEnd = getTrialEndDate(createdAt);
  const now = Date.now();
  const remaining = Math.ceil((trialEnd.getTime() - now) / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
}

export function isTrialExpired(createdAt: string): boolean {
  return getTrialDaysRemaining(createdAt) <= 0;
}

export type AccountGateResult =
  | { allowed: true }
  | { allowed: false; reason: 'suspended' | 'disabled' | 'trial_expired' };

export function checkAccountAccess(user: User): AccountGateResult {
  if (user.role === 'customer') {
    return { allowed: true };
  }

  if (user.accountStatus === 'suspended') {
    return { allowed: false, reason: 'suspended' };
  }

  if (user.accountStatus === 'disabled') {
    return { allowed: false, reason: 'disabled' };
  }

  if (user.activatedByAdmin === true) {
    return { allowed: true };
  }

  if (user.subscriptionStatus === 'active') {
    if (user.subscriptionEndsAt) {
      const endsAt = new Date(user.subscriptionEndsAt);
      if (endsAt.getTime() > Date.now()) {
        return { allowed: true };
      }
    }
    return { allowed: true };
  }

  if (user.trialEndsAt) {
    const trialEnd = new Date(user.trialEndsAt);
    if (trialEnd.getTime() > Date.now()) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'trial_expired' };
  }

  if (user.createdAt) {
    if (!isTrialExpired(user.createdAt)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'trial_expired' };
  }

  return { allowed: true };
}
