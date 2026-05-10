'use strict';

/** Google Meet–style code: three groups of lowercase letters (e.g. abc-def-ghi). */
export function generateMeetCode() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const chunk = () =>
    Array.from({ length: 3 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `${chunk()}-${chunk()}-${chunk()}`;
}

export function normalizeMeetCode(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 14);
}
