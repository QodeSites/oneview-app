import { calculateScores, calculateTopTwo, resolveRecommendation, type ServerRecommendation } from '@/lib/strategy-scoring';

const answers = [4, 3, 2, 4, 3, 3];

/** What qode-oneview returns for `answers` — built from the same arithmetic the server shares. */
function serverFor(a: number[]): ServerRecommendation {
  const scored = calculateScores(a);
  return {
    scores: scored.map(({ code, title, score, allocation }) => ({ code, title, score, allocation })),
    recommended: calculateTopTwo(scored).map((s) => s.code),
  };
}

const pick = (list: { code: string; allocation: number; topAlloc?: number }[]) =>
  list.map(({ code, allocation, topAlloc }) => ({ code, allocation, topAlloc }));

describe('resolveRecommendation', () => {
  it('matches local scoring exactly when the server agrees (incl. the top-two split)', () => {
    const local = calculateScores(answers);
    const resolved = resolveRecommendation(answers, serverFor(answers));
    expect(pick(resolved.scores)).toEqual(pick(local));
    expect(pick(resolved.topTwo)).toEqual(pick(calculateTopTwo(local)));
  });

  it("uses the server's numbers and pair when they differ from the app's", () => {
    const server: ServerRecommendation = {
      scores: [
        { code: 'QAW', title: 'x', score: 10, allocation: 20 },
        { code: 'QTF', title: 'x', score: 30, allocation: 60 },
        { code: 'QGF', title: 'x', score: 10, allocation: 20 },
      ],
      recommended: ['QTF', 'QGF'],
    };
    const resolved = resolveRecommendation(answers, server);
    expect(resolved.scores.map((s) => [s.code, s.allocation])).toEqual([
      ['QAW', 20],
      ['QTF', 60],
      ['QGF', 20],
    ]);
    expect(resolved.topTwo.map((s) => [s.code, s.topAlloc])).toEqual([
      ['QTF', 75],
      ['QGF', 25],
    ]);
    // Descriptions still come from the app's own strategy definitions.
    expect(resolved.scores[0].description.length).toBeGreaterThan(0);
  });

  it('falls back to local scoring for a missing or malformed server result', () => {
    const local = pick(calculateScores(answers));
    expect(pick(resolveRecommendation(answers, null).scores)).toEqual(local);
    const bad = { scores: [{ code: 'QAW', title: 'x', score: 1, allocation: 100 }], recommended: ['QAW'] };
    expect(pick(resolveRecommendation(answers, bad).scores)).toEqual(local);
    const unknown = { ...serverFor(answers), recommended: ['NOPE'] };
    expect(pick(resolveRecommendation(answers, unknown).scores)).toEqual(local);
  });
});
