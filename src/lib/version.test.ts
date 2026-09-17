import { compareVersions } from '@/lib/version';

describe('compareVersions', () => {
  it('orders by each numeric part, not as strings', () => {
    expect(compareVersions('1.2.10', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
  });

  it('treats missing parts as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('2', '1.9.9')).toBeGreaterThan(0);
  });

  it('does not throw on junk', () => {
    expect(compareVersions('abc', '0.0.0')).toBe(0);
    expect(compareVersions('', '1.0.0')).toBeLessThan(0);
  });
});
