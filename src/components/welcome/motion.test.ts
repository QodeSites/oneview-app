import { formatLike } from './motion';

describe('formatLike', () => {
  it('ends on the exact figure', () => {
    expect(formatLike('₹7,03,679', 1)).toBe('₹7,03,679');
    expect(formatLike('+24.07%', 1)).toBe('+24.07%');
    expect(formatLike('−1.00%', 1)).toBe('−1.00%');
    expect(formatLike('15', 1)).toBe('15');
  });

  it('keeps Indian grouping, sign and decimals part-way', () => {
    expect(formatLike('₹1,67,390', 0.5)).toBe('₹83,695');
    expect(formatLike('₹8,81,873', 0)).toBe('₹0');
    expect(formatLike('+24.07%', 0.5)).toBe('+12.04%');
  });

  it('leaves text that is not a figure alone', () => {
    expect(formatLike('7 Sept 2026', 0.3)).toBe('7 Sept 2026');
    expect(formatLike('Sept 2025 – Sept 2026', 0.3)).toBe('Sept 2025 – Sept 2026');
  });
});
