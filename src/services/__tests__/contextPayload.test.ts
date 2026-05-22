import { describe, it, expect, vi } from 'vitest';
import {
  setPending, consumePending, peekPending, PENDING_TTL_MS,
  type ContextPayload,
} from '../contextPayload';

const sample = (over: Partial<ContextPayload> = {}): ContextPayload => ({
  kind: 'article',
  text: 'hello world',
  sourceUrl: 'https://example.com/a',
  sourceTitle: 'Example',
  charCount: 11,
  truncated: false,
  createdAt: Date.now(),
  ...over,
});

describe('contextPayload', () => {
  it('round-trips a payload through storage', async () => {
    const p = sample();
    await setPending(p);
    const got = await peekPending();
    expect(got).toEqual(p);
  });

  it('consumePending deletes after read', async () => {
    await setPending(sample());
    expect(await consumePending()).not.toBeNull();
    expect(await peekPending()).toBeNull();
  });

  it('returns null when payload is older than TTL', async () => {
    const stale = sample({ createdAt: Date.now() - PENDING_TTL_MS - 1 });
    await setPending(stale);
    expect(await consumePending()).toBeNull();
  });

  it('returns null when nothing is stored', async () => {
    expect(await consumePending()).toBeNull();
    expect(await peekPending()).toBeNull();
  });
});
