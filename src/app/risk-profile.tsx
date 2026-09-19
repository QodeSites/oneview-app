import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Donut } from '@/components/charts/Donut';
import { PageHeader } from '@/components/PageHeader';
import { ErrorView, LoadingView } from '@/components/RemoteStateView';
import { QodeColor, QodeFont, QodeRadius, QodeSpace, StrategyColor } from '@/constants/qode-theme';
import { useRemoteData } from '@/hooks/use-remote-data';
import { saveStrategyAnswers } from '@/lib/api';
import { getRiskProfileData } from '@/lib/reviewApi';
import { calculateScores, calculateTopTwo, type Scored } from '@/lib/strategy-scoring';
import { track } from '@/lib/telemetry';

interface Question {
  question: string;
  options: string[];
}

/**
 * Verbatim from qode-oneview's `PersonalizedRecommendation.tsx` — order and
 * option count matter, each strategy's weight matrix (`strategy-scoring.ts`)
 * is indexed by [question][optionIndex]. A prospect on the website and a
 * customer here must get the same recommendation from the same answers, so
 * this can't be reworded independently of that file.
 */
const QUESTIONS: Question[] = [
  {
    question: 'What % of your investment portfolio do you plan to invest?',
    options: ['<10%', '10-25%', '25-50%', '50-75%', '>75%'],
  },
  {
    question: 'What is your primary objective?',
    options: [
      'Capital protection',
      'Stable income / low volatility',
      'Balanced growth',
      'High growth',
      'Aggressive wealth creation',
    ],
  },
  {
    question: 'How important is it that your portfolio avoids large drawdown periods?',
    options: ['Critical', 'Important', 'Neutral', 'Somewhat', 'Not important'],
  },
  {
    question: 'Which statement best describes your comfort with short-term swings in your portfolio value?',
    options: ['Not at all', 'Slightly', 'Neutral', 'Comfortable', 'Very comfortable'],
  },
  {
    question: 'What is your investment horizon?',
    options: ['<1 yr', '1-3 yrs', '3-5 yrs', '5-7 yrs', '>7 yrs'],
  },
  {
    question: 'How many years of direct equity-market experience do you have?',
    options: ['None', '<3 yrs', '3-5 yrs', '5-10 yrs', '>10 yrs'],
  },
];

/**
 * Risk Profile — real data from qode-oneview's `getStrategyAnswers(custId)`
 * via `GET /api/mobile/risk-profile`, and a mobile port of the same
 * `PersonalizedRecommendation.tsx` quiz + allocation-scoring the web app's
 * Risk Profile page now shows in place of the original six-question WhatsApp
 * -style flow (removed there on request 3 Sep — see that file's own
 * comment). Saving posts to the existing, unmodified
 * `POST /api/review/strategy-answers` (src/lib/api.ts).
 */
export default function RiskProfileScreen() {
  const { state, refreshing, refresh, revalidate } = useRemoteData(getRiskProfileData);

  if (state.status === 'loading') {
    return (
      <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <LoadingView />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (state.status === 'error') {
    return (
      <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ErrorView message={state.message} onRetry={refresh} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <RiskProfileBody
      savedAnswers={state.data}
      refreshing={refreshing}
      onRefresh={refresh}
      onSaved={revalidate}
    />
  );
}

function isComplete(saved: number[] | null): saved is number[] {
  return Array.isArray(saved) && saved.length === QUESTIONS.length;
}

function RiskProfileBody({
  savedAnswers,
  refreshing,
  onRefresh,
  onSaved,
}: {
  savedAnswers: number[] | null;
  refreshing: boolean;
  onRefresh: () => void;
  onSaved: () => void;
}) {
  const hasSaved = isComplete(savedAnswers);
  const [answers, setAnswers] = useState<number[]>(hasSaved ? [...savedAnswers] : Array(QUESTIONS.length).fill(0));
  const [scores, setScores] = useState<Scored[]>(hasSaved ? calculateScores(savedAnswers) : []);
  const [topTwo, setTopTwo] = useState<Scored[]>(hasSaved ? calculateTopTwo(calculateScores(savedAnswers)) : []);
  const [show, setShow] = useState(hasSaved);
  const [editing, setEditing] = useState(!hasSaved);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // The state above is seeded from `savedAnswers` once. When the server
  // later reports different answers (edited on web), take them in — unless
  // this screen is mid-edit or mid-save, where they would overwrite the
  // reader's own unsaved or just-saved choices. Before this, even
  // pull-to-refresh fetched the new answers but never showed them.
  const savedKey = JSON.stringify(savedAnswers);
  const [appliedKey, setAppliedKey] = useState(savedKey);
  if (savedKey !== appliedKey && !editing && !saving) {
    setAppliedKey(savedKey);
    if (isComplete(savedAnswers)) {
      const all = calculateScores(savedAnswers);
      setAnswers([...savedAnswers]);
      setScores(all);
      setTopTwo(calculateTopTwo(all));
      setShow(true);
    } else {
      setAnswers(Array(QUESTIONS.length).fill(0));
      setScores([]);
      setTopTwo([]);
      setShow(false);
      setEditing(true);
    }
  }

  function pick(questionIndex: number, value: number) {
    const next = [...answers];
    next[questionIndex] = value;
    setAnswers(next);
    if (error && next.every((a) => a > 0)) setError('');
  }

  function analyse() {
    if (!answers.every((a) => a > 0)) {
      setError('Answer every question first — the recommendation weighs all six.');
      return;
    }
    const all = calculateScores(answers);
    const recommended = calculateTopTwo(all);
    setScores(all);
    setTopTwo(recommended);
    setShow(true);
    // risk_band = the top recommended strategy (QAW / QTF / QGF) — this questionnaire's own outcome.
    track('risk_profile_completed', { risk_band: recommended[0]?.code ?? 'unknown' });
    setEditing(false);
    setSaving(true);
    // Re-check only once the save has landed, so the server echoes the new
    // answers back rather than the old ones.
    void saveStrategyAnswers(answers).finally(() => {
      setSaving(false);
      onSaved();
    });
  }

  const answeredCount = answers.filter((a) => a > 0).length;
  const remaining = QUESTIONS.length - answeredCount;
  const allAnswered = remaining === 0;

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={QodeColor.cream} />}
        >
          <PageHeader
            title="Risk Profile"
            subtitle="Six questions, so your call starts from how you actually invest."
            navAsOf={null}
          />

          {!editing ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your answers are saved</Text>
              <Text style={styles.completeBody}>The recommendation below is built from them.</Text>
              <Pressable
                style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                onPress={() => setEditing(true)}>
                <Text style={styles.editButtonText}>Edit my answers</Text>
              </Pressable>
            </View>
          ) : null}

          {editing ? (
            <View style={styles.card}>
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${(answeredCount / QUESTIONS.length) * 100}%` }]} />
                </View>
                <Text style={styles.progressCount}>
                  {answeredCount} of {QUESTIONS.length}
                </Text>
              </View>

              {QUESTIONS.map((q, i) => (
                <View key={q.question} style={[styles.question, i === 0 && styles.questionFirst]}>
                  <Text style={styles.questionText}>
                    {i + 1}. {q.question}
                  </Text>
                  <View style={styles.pillRow}>
                    {q.options.map((label, oi) => {
                      const value = oi + 1;
                      const on = answers[i] === value;
                      return (
                        <Pressable
                          key={label}
                          onPress={() => pick(i, value)}
                          style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && styles.pressed]}>
                          <Text style={[styles.pillText, on && styles.pillTextOn]}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.foot}>
                <Pressable
                  onPress={analyse}
                  style={({ pressed }) => [styles.submit, !allAnswered && styles.submitOff, pressed && styles.pressed]}>
                  <Text style={[styles.submitText, !allAnswered && styles.submitTextOff]}>
                    {show ? 'Save & update my recommendation' : 'Analyze my answers'}
                  </Text>
                </Pressable>
                {!allAnswered ? (
                  <Text style={styles.foodNote}>
                    {remaining} question{remaining === 1 ? '' : 's'} still to answer
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {show ? (
            <>
              <Text style={styles.resultsHeading}>Your recommended strategy allocation</Text>
              <Text style={styles.resultsSub}>
                Based on your answers, tailored for different portfolio sizes. A model output, not personal
                investment advice.
              </Text>
              <AllocationCard title="Under ₹5 Crores" sub="focused approach with your top strategies" rows={topTwo.map((s) => ({ code: s.code, title: s.title, description: s.description, percent: s.topAlloc ?? 0 }))} />
              <AllocationCard title="Above ₹5 Crores" sub="diversified multi-strategy portfolio" rows={scores.map((s) => ({ code: s.code, title: s.title, description: s.description, percent: s.allocation }))} />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function AllocationCard({
  title,
  sub,
  rows,
}: {
  title: string;
  sub: string;
  rows: { code: 'QAW' | 'QTF' | 'QGF'; title: string; description: string; percent: number }[];
}) {
  const shown = rows.filter((r) => r.percent > 0);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {title} <Text style={styles.cardTitleSub}>· {sub}</Text>
      </Text>
      <View style={styles.donutRow}>
        <Donut size={150} slices={shown.map((r) => ({ label: r.title, percent: r.percent, color: StrategyColor[r.code] }))} />
      </View>
      <View style={styles.allocList}>
        {shown.map((r) => (
          <View key={r.code} style={styles.allocRow}>
            <View style={[styles.allocDot, { backgroundColor: StrategyColor[r.code] }]} />
            <View style={styles.allocTextCol}>
              <Text style={styles.allocTitle}>{r.title}</Text>
              <Text style={styles.allocDescription}>{r.description}</Text>
            </View>
            <Text style={styles.allocPercent}>{r.percent}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // See holdings.tsx's own comment on this shared style.
  pressed: {
    opacity: 0.85,
  },
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[4],
    paddingBottom: QodeSpace[8],
    gap: QodeSpace[4],
  },
  card: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
  },
  cardTitle: { fontFamily: QodeFont.display, fontSize: 17, color: QodeColor.cream },
  cardTitleSub: { fontFamily: QodeFont.uiRegular, fontSize: 13, color: QodeColor.textMuted },
  completeBody: { fontFamily: QodeFont.uiRegular, fontSize: 13, color: QodeColor.textSecondary, marginTop: QodeSpace[1] },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: QodeSpace[3] },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: QodeRadius.pill,
    backgroundColor: QodeColor.surfaceRaised,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: QodeRadius.pill, backgroundColor: QodeColor.accent },
  progressCount: { fontFamily: QodeFont.ui, fontSize: 12, color: QodeColor.textMuted },
  question: {
    marginTop: QodeSpace[4],
    paddingTop: QodeSpace[4],
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
  },
  questionFirst: { marginTop: QodeSpace[4], paddingTop: 0, borderTopWidth: 0 },
  questionText: { fontFamily: QodeFont.ui, fontSize: 14, color: QodeColor.textPrimary, marginBottom: QodeSpace[2] },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: QodeSpace[2] },
  pill: {
    paddingVertical: QodeSpace[2],
    paddingHorizontal: QodeSpace[3],
    borderRadius: QodeRadius.pill,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
  },
  pillOn: {
    borderWidth: 1.5,
    borderColor: QodeColor.accent,
    backgroundColor: QodeColor.accentSoft,
  },
  pillText: { fontFamily: QodeFont.uiRegular, fontSize: 13, color: QodeColor.textPrimary },
  pillTextOn: { fontFamily: QodeFont.ui, color: QodeColor.accent },
  errorText: { fontFamily: QodeFont.uiRegular, fontSize: 13, color: QodeColor.error, marginTop: QodeSpace[3] },
  foot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: QodeSpace[3],
    marginTop: QodeSpace[5],
    paddingTop: QodeSpace[4],
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
  },
  submit: {
    backgroundColor: QodeColor.accent,
    borderWidth: 1,
    borderColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  submitOff: {
    backgroundColor: 'transparent',
    borderColor: QodeColor.surfaceBorder,
  },
  submitText: { fontFamily: QodeFont.ui, fontSize: 14, color: QodeColor.textOnAccent },
  submitTextOff: { color: QodeColor.textMuted },
  foodNote: { fontFamily: QodeFont.uiRegular, fontSize: 12, color: QodeColor.textMuted },
  editButton: {
    borderWidth: 1,
    borderColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: QodeSpace[4],
  },
  editButtonText: { fontFamily: QodeFont.ui, fontSize: 13, color: QodeColor.accent },
  resultsHeading: { fontFamily: QodeFont.display, fontSize: 17, color: QodeColor.cream, marginTop: QodeSpace[2] },
  resultsSub: { fontFamily: QodeFont.uiRegular, fontSize: 12.5, color: QodeColor.textMuted, marginTop: -QodeSpace[2] },
  donutRow: {
    alignItems: 'center',
    marginTop: QodeSpace[2],
  },
  allocList: { gap: QodeSpace[3], marginTop: QodeSpace[3] },
  allocRow: { flexDirection: 'row', alignItems: 'center', gap: QodeSpace[3] },
  allocDot: { width: 10, height: 10, borderRadius: 3 },
  allocTextCol: { flex: 1 },
  allocTitle: { fontFamily: QodeFont.ui, fontSize: 13.5, color: QodeColor.textPrimary },
  allocDescription: { fontFamily: QodeFont.uiRegular, fontSize: 11.5, color: QodeColor.textMuted, marginTop: 1 },
  // Lato Bold, not Playfair — confirmed against web's own
  // PersonalizedRecommendation.tsx, where this exact allocation percent
  // renders as a plain `<strong style={{ fontSize: 18 }}>{r.percent}%</strong>`:
  // no className, so no Playfair and no gold — just the page's inherited
  // body font (Lato) at browser-default bold weight. Cream stays, since
  // nothing there overrides the inherited text color either.
  allocPercent: {
    fontFamily: QodeFont.ui,
    fontSize: 16,
    color: QodeColor.cream,
    fontVariant: ['tabular-nums'],
  },
});
