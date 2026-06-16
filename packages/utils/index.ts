export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const isDefined = <T>(value: T | undefined | null): value is T =>
  value !== undefined && value !== null;

export const formatTimestamp = (date: Date = new Date()): string =>
  date.toISOString();
