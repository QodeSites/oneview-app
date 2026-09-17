import { Circle, Path, Rect, Svg } from 'react-native-svg';

import { QodeColor, StrategyColor } from '@/constants/qode-theme';

export type WelcomeArtKind = 'accounts' | 'link' | 'insight' | 'plan';

/**
 * Line illustrations for the welcome slides — outlined and quiet, in the
 * brand's cream/gold, per the brand guide's icon style. Drawn on a 200×200
 * box and scaled to `size`.
 */
export function WelcomeArt({ kind, size }: { kind: WelcomeArtKind; size: number }) {
  const stroke = QodeColor.cream;
  const faint = QodeColor.ghost;
  const gold = QodeColor.accent;

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Circle cx={100} cy={100} r={92} stroke={faint} strokeWidth={1} strokeDasharray="3 6" />
      {kind === 'accounts' ? (
        <>
          {/* four asset types converging on one view */}
          <Rect x={62} y={62} width={76} height={76} rx={18} stroke={gold} strokeWidth={2.5} />
          <Path d="M82 112l12-12 10 8 16-18" stroke={gold} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {[
            [100, 22],
            [178, 100],
            [100, 178],
            [22, 100],
          ].map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={11} stroke={stroke} strokeWidth={2} />
          ))}
          <Path d="M100 33v29M167 100h-29M100 167v-29M33 100h29" stroke={faint} strokeWidth={1.5} strokeDasharray="4 4" />
        </>
      ) : null}
      {kind === 'link' ? (
        <>
          {/* shield: read-only, consent-based */}
          <Path
            d="M100 40l46 16v36c0 30-20 55-46 66-26-11-46-36-46-66V56l46-16z"
            stroke={stroke}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Path d="M80 100l14 14 28-30" stroke={gold} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {kind === 'insight' ? (
        <>
          {/* the Aperture's strategy colours as a donut, with a trend line */}
          <Circle cx={100} cy={100} r={48} stroke={StrategyColor.QAW} strokeWidth={14} strokeDasharray="130 172" />
          <Circle
            cx={100}
            cy={100}
            r={48}
            stroke={StrategyColor.QGF}
            strokeWidth={14}
            strokeDasharray="80 222"
            strokeDashoffset={-134}
          />
          <Circle
            cx={100}
            cy={100}
            r={48}
            stroke={gold}
            strokeWidth={14}
            strokeDasharray="78 224"
            strokeDashoffset={-218}
          />
          <Path d="M40 168l30-22 22 12 30-30 38-20" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {kind === 'plan' ? (
        <>
          {/* a report with a checklist */}
          <Rect x={58} y={40} width={84} height={112} rx={10} stroke={stroke} strokeWidth={2.5} />
          {[70, 96, 122].map((y) => (
            <Path key={y} d={`M72 ${y}l6 6 10-12`} stroke={gold} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {[72, 98, 124].map((y) => (
            <Path key={y} d={`M96 ${y}h32`} stroke={faint} strokeWidth={3} strokeLinecap="round" />
          ))}
          <Circle cx={142} cy={150} r={18} stroke={gold} strokeWidth={2.5} />
          <Path d="M142 141v12M136 148l6 6 6-6" stroke={gold} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
    </Svg>
  );
}
