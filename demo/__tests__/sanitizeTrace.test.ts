import { sanitizeTraceValue } from '../sanitizeTrace';

describe('sanitizeTraceValue', () => {
  it('redacts token-like fields while preserving useful authorization evidence', () => {
    expect(
      sanitizeTraceValue({
        decision: 'ALLOW',
        requestId: 'request-1',
        tokens: [{ mapping: 'access_token', payload: 'header.payload.signature' }],
        nested: { clientSecret: 'secret-value', role: 'reader' },
      })
    ).toEqual({
      decision: 'ALLOW',
      requestId: 'request-1',
      tokens: '[REDACTED]',
      nested: { clientSecret: '[REDACTED]', role: 'reader' },
    });
  });

  it('redacts JWT strings and local archive locations', () => {
    expect(sanitizeTraceValue('header.payload.signature')).toBe('[REDACTED]');
    expect(sanitizeTraceValue('file:///fixture/policy-store.cjar')).toBe('[FILE_URI]');
    expect(sanitizeTraceValue('/home/developer/policy-store.cjar')).toBe('[LOCAL_PATH]');
    expect(sanitizeTraceValue('asset:///policy-store.cjar')).toBe('[ASSET_URI]');
  });

  it('sanitizes JSON-encoded diagnostic values', () => {
    expect(sanitizeTraceValue('{"authorization":"Bearer secret","value":true}')).toEqual({
      authorization: '[REDACTED]',
      value: true,
    });
  });

  it('handles circular values without failing the diagnostics panel', () => {
    const input: Record<string, unknown> = { value: true };
    input.self = input;
    expect(sanitizeTraceValue(input)).toEqual({ value: true, self: '[CIRCULAR]' });
  });
});
