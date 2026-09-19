import { REDACTED, scrubSentryEvent, scrubText, scrubValue } from '@/lib/telemetry-scrub';

describe('scrubText', () => {
  it('masks emails, PAN, Aadhaar/card numbers, phones and rupee amounts', () => {
    expect(scrubText('mail a.b@example.com now')).toBe('mail [email] now');
    expect(scrubText('PAN ABCDE1234F on file')).toBe('PAN [pan] on file');
    expect(scrubText('aadhaar 1234 5678 9012')).toBe('aadhaar [number]');
    expect(scrubText('card 4111-1111-1111-1111')).toBe('card [number]');
    expect(scrubText('call +91 98765 43210')).toBe('call [number]');
    expect(scrubText('worth ₹7,03,679.50 today')).toBe('worth [amount] today');
  });

  it('leaves ordinary text alone', () => {
    expect(scrubText('Could not reach the server (502)')).toBe('Could not reach the server (502)');
  });
});

describe('scrubValue', () => {
  it('drops sensitive keys at any depth and scrubs strings elsewhere', () => {
    expect(
      scrubValue({ pan: 'X', nested: { phone: '1', bankAccount: '2', note: 'hi a@b.co' }, list: [{ portfolioValue: 5 }] }),
    ).toEqual({ pan: REDACTED, nested: { phone: REDACTED, bankAccount: REDACTED, note: 'hi [email]' }, list: [{ portfolioValue: REDACTED }] });
  });
});

describe('scrubSentryEvent', () => {
  it('removes request bodies/cookies, scrubs headers and keeps only the user id', () => {
    const out = scrubSentryEvent({
      request: { data: { otp: '123456' }, cookies: 'sid=1', headers: { Authorization: 'Bearer x', Accept: 'json' } },
      user: { id: 'u_abc', email: 'a@b.co', ip_address: '1.2.3.4' },
      contexts: { device: { name: "Sanket's iPhone", model: 'iPhone17,3' }, os: { name: 'iOS' }, custom: { holdings: [1] } },
      exception: { values: [{ value: 'failed for 9876543210' }] },
    });
    expect(out.request).toEqual({ headers: { Authorization: REDACTED, Accept: 'json' } });
    expect(out.user).toEqual({ id: 'u_abc' });
    expect(out.contexts).toEqual({
      device: { name: REDACTED, model: 'iPhone17,3' },
      os: { name: 'iOS' },
      custom: { holdings: REDACTED },
    });
    expect(out.exception?.values?.[0].value).toBe('failed for [number]');
  });
});
