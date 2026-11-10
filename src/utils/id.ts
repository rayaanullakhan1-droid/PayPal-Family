/**
 * Reference ID generator for transactions and requests
 */

export function generateTransactionReference(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `TXN-${datePart}-${randomPart}`;
}

export function generateRequestId(): string {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `REQ-${randomPart}`;
}

export function generateMemberId(): string {
  return `usr_${Math.random().toString(36).substring(2, 9)}`;
}

