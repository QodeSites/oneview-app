/**
 * Ported verbatim from qode-oneview's `src/features/review/strategy-scoring.ts`
 * — the same allocation arithmetic the website's portfolio-analyzer and
 * `PersonalizedRecommendation.tsx` use. Not a secret: it ships in that
 * page's client-side bundle already. Kept here rather than called over the
 * network because it's a pure function with no DB/session dependency.
 */

export interface StrategyDef {
  code: 'QAW' | 'QTF' | 'QGF';
  title: string;
  description: string;
  weights: number[][];
}

export const STRATEGIES: StrategyDef[] = [
  {
    code: 'QAW',
    title: 'Qode All Weather (QAW)',
    description: 'Diversified strategy built for resilient performance',
    weights: [
      [0, 0, 10, 30, 60],
      [60, 40, 0, 0, 0],
      [70, 30, 0, 0, 0],
      [70, 30, 0, 0, 0],
      [40, 40, 20, 0, 0],
      [60, 30, 10, 0, 0],
    ],
  },
  {
    code: 'QTF',
    title: 'Qode Tactical Fund (QTF)',
    description: 'Momentum-driven strategy aiming for higher returns with the timing model',
    weights: [
      [0, 0, 20, 60, 20],
      [10, 10, 80, 0, 0],
      [5, 45, 45, 5, 0],
      [5, 45, 45, 5, 0],
      [0, 20, 50, 30, 0],
      [0, 20, 60, 20, 0],
    ],
  },
  {
    code: 'QGF',
    title: 'Qode Growth Fund (QGF)',
    description: 'Pure equity, quant-driven strategy focused on quality and growth',
    weights: [
      [10, 50, 20, 20, 0],
      [0, 0, 20, 70, 10],
      [0, 0, 0, 80, 20],
      [0, 0, 0, 90, 10],
      [0, 0, 0, 50, 50],
      [0, 0, 20, 60, 20],
    ],
  },
];

export interface Scored extends StrategyDef {
  score: number;
  allocation: number;
  topAlloc?: number;
}

const roundToNearestFive = (value: number): number => Math.round(value / 5) * 5;

export function calculateScores(userAnswers: number[]): Scored[] {
  const rawScores = STRATEGIES.map((strategy) => {
    let total = 0;
    userAnswers.forEach((answer, questionIndex) => {
      if (answer > 0) total += strategy.weights[questionIndex][answer - 1];
    });
    return { ...strategy, score: total, allocation: 0 };
  });

  const totalScore = rawScores.reduce((sum, s) => sum + s.score, 0);

  const allocations = rawScores.map((strategy) => {
    const percentage = totalScore ? (strategy.score / totalScore) * 100 : 0;
    let allocation = roundToNearestFive(percentage);
    if (strategy.score > 0 && allocation === 0) allocation = 5;
    return { ...strategy, allocation };
  });

  const difference = 100 - allocations.reduce((sum, s) => sum + s.allocation, 0);
  if (difference !== 0) allocations[0].allocation += difference;
  return allocations;
}

export function calculateTopTwo(allScores: Scored[]): Scored[] {
  const topStrategies = [...allScores].sort((a, b) => b.score - a.score).slice(0, 2);
  const total = topStrategies.reduce((sum, s) => sum + s.score, 0);

  const allocations = topStrategies.map((strategy) => {
    const percentage = total ? (strategy.score / total) * 100 : 0;
    let topAlloc = roundToNearestFive(percentage);
    if (strategy.score > 0 && topAlloc === 0) topAlloc = 5;
    return { ...strategy, topAlloc };
  });

  const difference = 100 - allocations.reduce((sum, s) => sum + (s.topAlloc || 0), 0);
  if (difference !== 0 && allocations[0]) {
    allocations[0].topAlloc = (allocations[0].topAlloc || 0) + difference;
  }
  return allocations;
}
