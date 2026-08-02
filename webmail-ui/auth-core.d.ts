export function normalizeUserId(value: string | undefined): string;
export function isValidUserId(value: string): boolean;
export function sessionToken(userId: string, secret: string): string;
export function verifySessionToken(value: string, secret: string): string;
