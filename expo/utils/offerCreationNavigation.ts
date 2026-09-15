export function publicLocationSettingsPath(reopenOfferDraft: boolean): string {
  return reopenOfferDraft
    ? '/(provider)/settings?openPublicLocation=1&returnTo=offers&openCreate=1'
    : '/(provider)/settings?openPublicLocation=1&returnTo=offers';
}

export function shouldReopenOfferDraft(openCreate: string | undefined): boolean {
  return openCreate === '1';
}

export function offersReturnPath(reopenOfferDraft: boolean): string {
  return reopenOfferDraft ? '/(provider)/my-offers?openCreate=1' : '/(provider)/my-offers';
}