import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeader } from '@/components/PageHeader';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { mockReviewData } from '@/lib/mock-data';

interface Option {
  value: string;
  label: string;
}
interface Question {
  key: string;
  question: string;
  options: Option[];
}

/**
 * Six questions, ported from qode-oneview's original flow-spec component
 * (src/components/review/RiskProfile.tsx) — the interactive quiz + answered
 * summary pattern, not the read-only PersonalizedRecommendation.tsx the
 * current web page happens to show instead. Options are invented (the real
 * question/option text lives server-side in features/risk/repository.ts,
 * which mobile-profile's backend doesn't expose yet) but plausible.
 */
const QUESTIONS: Question[] = [
  {
    key: 'horizon',
    question: 'What is your investment horizon for this money?',
    options: [
      { value: 'lt1', label: '< 1 year' },
      { value: '1-3', label: '1–3 years' },
      { value: '3-5', label: '3–5 years' },
      { value: '5plus', label: '5+ years' },
    ],
  },
  {
    key: 'drawdown',
    question: 'Your portfolio falls 20% in a month. What do you do?',
    options: [
      { value: 'sell', label: "I'd sell to stop the loss" },
      { value: 'wait', label: "I'd wait it out" },
      { value: 'add', label: "I'd add more at lower prices" },
    ],
  },
  {
    key: 'experience',
    question: 'How much direct equity market experience do you have?',
    options: [
      { value: 'new', label: 'New to investing' },
      { value: 'some', label: 'Some experience' },
      { value: 'experienced', label: 'Very experienced' },
    ],
  },
  {
    key: 'income',
    question: 'How would you describe your income stability?',
    options: [
      { value: 'variable', label: 'Variable or uncertain' },
      { value: 'stable', label: 'Stable' },
      { value: 'very-stable', label: 'Very stable, plus other income' },
    ],
  },
  {
    key: 'liquidity',
    question: 'How soon might you need to withdraw this money?',
    options: [
      { value: 'soon', label: 'Might need it soon' },
      { value: '2-3y', label: 'Not for 2–3 years' },
      { value: '5plus', label: 'Not for 5+ years' },
    ],
  },
  {
    key: 'goal',
    question: 'What is your primary objective?',
    options: [
      { value: 'protect', label: 'Capital protection' },
      { value: 'income', label: 'Steady income' },
      { value: 'growth', label: 'Long-term growth' },
      { value: 'aggressive', label: 'Aggressive growth' },
    ],
  },
];

/**
 * Risk Profile — MVP preview, matching qode-oneview's RiskProfile.tsx: two
 * states, "not yet completed" (the six questions) and "completed" (a
 * summary with Edit). Mock/local-state only — no fetch, no persistence
 * across a reload. Defaults to the unanswered state so the full flow
 * (answer all six → see the summary) is reachable for the demo.
 */
export default function RiskProfileScreen() {
  const [editing, setEditing] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const answeredCount = QUESTIONS.filter((q) => answers[q.key]).length;
  const remaining = QUESTIONS.length - answeredCount;
  const allAnswered = remaining === 0;

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.dummyBadge}>Preview data</Text>
          <PageHeader
            title="Risk Profile"
            subtitle="Six questions, so your call starts from how you actually invest."
            navAsOf={mockReviewData.client.navAsOf}
          />

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
                <View key={q.key} style={[styles.question, i === 0 && styles.questionFirst]}>
                  <Text style={styles.questionText}>
                    {i + 1}. {q.question}
                  </Text>
                  <View style={styles.pillRow}>
                    {q.options.map((o) => {
                      const on = answers[q.key] === o.value;
                      return (
                        <Pressable
                          key={o.value}
                          onPress={() => setAnswers((prev) => ({ ...prev, [q.key]: o.value }))}
                          style={[styles.pill, on && styles.pillOn]}>
                          <Text style={[styles.pillText, on && styles.pillTextOn]}>{o.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              <View style={styles.foot}>
                <Pressable
                  disabled={!allAnswered}
                  onPress={() => setEditing(false)}
                  style={[styles.submit, !allAnswered && styles.submitOff]}>
                  <Text style={[styles.submitText, !allAnswered && styles.submitTextOff]}>
                    Complete my risk profile
                  </Text>
                </Pressable>
                {!allAnswered ? (
                  <Text style={styles.foodNote}>
                    {remaining} question{remaining === 1 ? '' : 's'} still to answer
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <>
              <View style={styles.completeCard}>
                <Text style={styles.cardTitle}>Your risk profile is complete</Text>
                <Text style={styles.completeBody}>
                  Thank you — our team will walk you through your profile and your portfolio review on your call.
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Your answers</Text>
                {QUESTIONS.map((q) => (
                  <View key={q.key} style={styles.answerRow}>
                    <Text style={styles.answerQuestion}>{q.question}</Text>
                    <Text style={styles.answerValue}>
                      {q.options.find((o) => o.value === answers[q.key])?.label ?? '—'}
                    </Text>
                  </View>
                ))}
                <Pressable style={styles.editButton} onPress={() => setEditing(true)}>
                  <Text style={styles.editButtonText}>Edit my answers</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[4],
    paddingBottom: QodeSpace[8],
    gap: QodeSpace[4],
  },
  dummyBadge: { fontFamily: QodeFont.uiRegular, fontSize: 11, color: QodeColor.warning, textAlign: 'center' },
  card: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
  },
  cardTitle: { fontFamily: QodeFont.display, fontSize: 17, color: QodeColor.cream },
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
  completeCard: {
    backgroundColor: QodeColor.accentSoft,
    borderWidth: 1,
    borderColor: QodeColor.accentBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
  },
  completeBody: { fontFamily: QodeFont.uiRegular, fontSize: 13, color: QodeColor.textSecondary, marginTop: QodeSpace[1] },
  answerRow: {
    paddingVertical: QodeSpace[2],
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
  },
  answerQuestion: { fontFamily: QodeFont.uiRegular, fontSize: 12.5, color: QodeColor.textMuted },
  answerValue: { fontFamily: QodeFont.ui, fontSize: 14, color: QodeColor.textPrimary, marginTop: 2 },
  editButton: {
    borderWidth: 1,
    borderColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: QodeSpace[4],
  },
  editButtonText: { fontFamily: QodeFont.ui, fontSize: 13, color: QodeColor.accent },
});
