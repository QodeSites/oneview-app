import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import {
  getInboundAddress,
  markReviewUploaded,
  requestCamsStatement,
  startDematFetch,
  uploadCasStatement,
  verifyDematOtp,
} from '@/lib/api';
import { getHoldingsData } from '@/lib/reviewApi';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * "Data looks incomplete?" — the real, self-serve recovery path.
 *
 * Ported from qode-oneview's `src/components/review/CasUpload.tsx`, whose
 * own comment explains why this exists: measured across 40 consents, 87%
 * came back partial or empty, and the customer's own CAS statement (the
 * same holdings, from the same registrars, in a document they already get
 * every month) is the honest way out of that. Four independent doors onto
 * the same result, all landing back on the review dashboard:
 *
 *  A. Manual PDF upload (any of CAMS/KFin/NSDL/CDSL) — `ManualUploadForm`.
 *  B. CAMS/KFin ask-by-email — `CamsRequestSection`, which ends at A once
 *     the mailed PDF is ready.
 *  C. Live CDSL fetch + OTP, no file at all — `CdslFetchSection`, with A
 *     kept as its own fallback if casparser is down.
 *  D. Forward-by-email to a personal address — pure information, no form.
 *
 * All five backing routes (`/api/cas/upload`, `/api/cas/generate`,
 * `/api/demat/fetch`, `/api/demat/verify`, `/api/inbound-address`, plus
 * `/api/review/completeness` on success) are qode-oneview's real,
 * unmodified routes — see the JSDoc on each function in `src/lib/api.ts`
 * for the exact contract confirmed against each route's own source.
 *
 * This screen is a plain Stack route (not a tab), reached from
 * `PageHeader`'s "Data looks incomplete?" banner on every review screen,
 * and from a dedicated card on the Holdings tab — both gated on
 * `casUploadEnabled`/`have`, the same two fields `GET /api/mobile/holdings`
 * already returns for the Holdings tab's own use (`HoldingsPayload` in
 * reviewApi.ts) — reused here via the same `getHoldingsData()` rather than
 * a second, parallel endpoint reader.
 *
 * DOB is three plain digit fields (Day/Month/Year), not a native date
 * picker — deliberately: this session already hit one real Expo-Go outage
 * from adding a native module (`expo-otp-autofill-consent`) that wasn't
 * part of Expo Go's own compiled module set, and the project's own
 * priority right now is staying inside Expo Go (see MOBILE_BACKEND_
 * CHANGES.md, 16 Sep). `@react-native-community/datetimepicker` is a
 * plausible-but-unconfirmed case of the same risk, so it was left out
 * rather than gambled on.
 */
export default function UploadStatementScreen() {
  const router = useRouter();
  const [gate, setGate] = useState<GateState>({ status: 'loading' });
  const [inboundAddress, setInboundAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Doesn't set `gate` to `'loading'` itself — the initial `useState` above
  // already starts there, and setting it again synchronously from inside
  // the mount effect below trips `react-hooks/set-state-in-effect` (every
  // setState call here happens inside the `.then` continuation, once the
  // fetch genuinely completes, never synchronously during the effect body
  // itself). `retryGate` below is the one place that also needs to reset
  // to `'loading'` — from a Pressable's `onPress`, not an effect, so it's
  // free to call `setGate` directly.
  const fetchGate = useCallback(() => {
    getHoldingsData().then((result) => {
      if (result.ok) {
        setGate({
          status: 'ready',
          data: { casUploadEnabled: result.data.casUploadEnabled, have: result.data.have },
        });
      } else {
        setGate({ status: 'error', message: result.error });
      }
    });
  }, []);

  function retryGate() {
    setGate({ status: 'loading' });
    fetchGate();
  }

  useEffect(() => {
    fetchGate();
    // Best-effort and independent of the main gate: a missing forwarding
    // address just means section D doesn't render (see getInboundAddress's
    // own comment) — never something that should block or error the rest
    // of this screen.
    getInboundAddress().then((result) => {
      if (result.ok) setInboundAddress(result.address);
    });
  }, [fetchGate]);

  /**
   * Shared by all three working flows (A/B's-upload/C). Mirrors web's
   * `finishAfterParse`: mark the review as "uploaded" (best-effort, fire-
   * and-forget — see `markReviewUploaded`'s own comment on why a failed
   * write here must never block navigation), then leave for the dashboard
   * that can now start reflecting the newly-arrived holdings once they're
   * priced. `/performance` rather than `router.back()` here specifically —
   * whatever screen the reader started from, the freshly-changed data
   * belongs on the dashboard, not back on a screen that was rendered
   * before this upload happened.
   */
  const finishAfterSuccess = useCallback(() => {
    setCompleted(true);
    void markReviewUploaded();
    setTimeout(() => router.replace('/performance'), 1100);
  }, [router]);

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Upload a statement</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.headerClose}>Close</Text>
          </Pressable>
        </View>

        {gate.status === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={QodeColor.accent} />
          </View>
        ) : gate.status === 'error' ? (
          <View style={styles.centered}>
            <Text style={styles.message}>{gate.message}</Text>
            <Pressable style={styles.retryButton} onPress={retryGate}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : !gate.data.casUploadEnabled ? (
          <View style={styles.centered}>
            <Text style={styles.message}>
              Statement upload is not available right now. Write to us and we&apos;ll add your holdings for you.
            </Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                Linking.openURL('mailto:investor.relations@qodeinvest.com').catch(() => {});
              }}>
              <Text style={styles.retryText}>Email investor.relations@qodeinvest.com</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            pointerEvents={completed ? 'none' : 'auto'}>
            <Text style={styles.intro}>Skip the wait — bring your holdings in from right here.</Text>
            <ReadyBody have={gate.data.have} onSuccess={finishAfterSuccess} />
            {inboundAddress ? (
              <ForwardEmailNote
                address={inboundAddress}
                copied={copied}
                onCopy={() => copyToClipboard(inboundAddress, setCopied)}
              />
            ) : null}
          </ScrollView>
        )}

        {completed ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={QodeColor.accent} size="large" />
            <Text style={styles.overlayTitle}>Statement received</Text>
            <Text style={styles.overlaySub}>Your holdings are in. Building your review…</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

type UploadGate = { casUploadEnabled: boolean; have: { funds: boolean; shares: boolean } };
type GateState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: UploadGate };

async function copyToClipboard(value: string, setCopied: (v: boolean) => void) {
  try {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // Best-effort — a failed copy just means the reader selects the text themselves.
  }
}

/**
 * The two registrar-family cards, exactly mirroring `CasUpload`'s own
 * `needShares`/`needFunds` suppression: a customer who already has one
 * asset class on file only sees the card for what's actually missing. Both
 * cards render when neither (or both) are present — matching web's own
 * logic verbatim rather than inventing a stricter gate, since this
 * component is only reachable at all when `casUploadEnabled` is true.
 */
function ReadyBody({ have, onSuccess }: { have: { funds: boolean; shares: boolean }; onSuccess: () => void }) {
  const needShares = have.funds && !have.shares;
  const needFunds = have.shares && !have.funds;

  return (
    <>
      {needFunds ? null : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stocks &amp; ETFs</Text>
          <Text style={styles.cardBody}>
            {needShares
              ? 'Your funds are already in — this adds your stocks, straight from CDSL.'
              : 'Fetched straight from CDSL — no website, no PDF.'}
          </Text>
          <CdslFetchSection onSuccess={onSuccess} />
        </View>
      )}
      {needShares ? null : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mutual Funds</Text>
          <Text style={styles.cardBody}>
            {needFunds
              ? 'Your stocks are already in — this adds your funds. We request the statement for you.'
              : 'We request your CAMS/KFintech statement for you — it lands in your email.'}
          </Text>
          <CamsRequestSection onSuccess={onSuccess} />
        </View>
      )}
    </>
  );
}

function ErrorLine({ text }: { text: string }) {
  if (!text) return null;
  return (
    <Text accessibilityRole="alert" style={styles.errorLine}>
      {text}
    </Text>
  );
}

function LinkChip({ href, children }: { href: string; children: string }) {
  return (
    <Pressable style={styles.linkChip} onPress={() => void Linking.openURL(href)}>
      <Text style={styles.linkChipText}>{children} →</Text>
    </Pressable>
  );
}

/**
 * The plain file+password upload, shared as the fallback under both cards
 * — same shape as web's `UploadForm`: PDF only, up to 10MB, an optional
 * password (usually the customer's own PAN). Reusable both standalone
 * (behind "Got the PDF? Upload it here") and after `CamsRequestSection`
 * sends one by email.
 */
function ManualUploadForm({ onSuccess }: { onSuccess: () => void }) {
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick() {
    setError('');
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    const looksLikePdf = asset.mimeType === 'application/pdf' || asset.name.toLowerCase().endsWith('.pdf');
    if (!looksLikePdf) {
      setError('That is not a PDF. Please upload the PDF you were emailed.');
      return;
    }
    if (typeof asset.size === 'number' && asset.size > MAX_FILE_BYTES) {
      setError('That file is larger than 10MB. Please upload the statement on its own.');
      return;
    }
    setFile(asset);
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError('');
    const result = await uploadCasStatement({ uri: file.uri, name: file.name, password: password || undefined });
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    onSuccess();
  }

  return (
    <View style={styles.form}>
      <Text style={styles.fieldLabel}>Statement (PDF, up to 10MB)</Text>
      <Pressable style={styles.fileField} onPress={() => void pick()} disabled={busy}>
        <Text style={file ? styles.fileFieldValue : styles.fileFieldPlaceholder} numberOfLines={1}>
          {file ? file.name : 'Choose a PDF'}
        </Text>
      </Pressable>

      <Text style={styles.fieldLabel}>Password, if the file asks for one</Text>
      <TextInput
        style={styles.input}
        placeholder="Often your PAN, in capitals"
        placeholderTextColor={QodeColor.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="off"
        value={password}
        onChangeText={setPassword}
        editable={!busy}
      />

      <ErrorLine text={error} />

      <Pressable
        style={[styles.submit, (!file || busy) && styles.submitOff]}
        disabled={!file || busy}
        onPress={() => void submit()}>
        <Text style={[styles.submitText, (!file || busy) && styles.submitTextOff]}>
          {busy ? 'Reading your statement…' : 'Upload statement'}
        </Text>
      </Pressable>
    </View>
  );
}

/** In-app CAMS/KFin request: the camsonline.com form, filled by us. */
function CamsRequestSection({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const canSubmit = password.length >= 6 && EMAIL_RE.test(email);

  async function send() {
    setBusy(true);
    setError('');
    const result = await requestCamsStatement(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <View style={styles.form}>
        <Text style={styles.note}>
          <Text style={styles.noteStrong}>Requested. </Text>
          CAMS is emailing your statement to {email} — usually a few minutes. When it arrives, upload it below with
          the same password you just set.
        </Text>
        <ManualUploadForm onSuccess={onSuccess} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.fieldLabel}>Email registered on your folios</Text>
      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        placeholderTextColor={QodeColor.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={(v) => setEmail(v.trim())}
        editable={!busy}
      />
      <Text style={styles.fieldLabel}>Set a password for the statement</Text>
      <TextInput
        style={styles.input}
        placeholder="You will use it once, below"
        placeholderTextColor={QodeColor.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="off"
        value={password}
        onChangeText={setPassword}
        editable={!busy}
      />
      <ErrorLine text={error} />
      <Pressable
        style={[styles.submit, (!canSubmit || busy) && styles.submitOff]}
        disabled={!canSubmit || busy}
        onPress={() => void send()}>
        <Text style={[styles.submitText, (!canSubmit || busy) && styles.submitTextOff]}>
          {busy ? 'Requesting…' : 'Email me my statement'}
        </Text>
      </Pressable>
      <Text style={styles.hint}>We fill the camsonline form for you; the PDF goes only to your email.</Text>

      <Pressable onPress={() => setShowUpload((v) => !v)} style={styles.disclosure}>
        <Text style={styles.disclosureText}>{showUpload ? 'Hide upload' : 'Got the PDF? Upload it here'}</Text>
      </Pressable>
      {showUpload ? <ManualUploadForm onSuccess={onSuccess} /> : null}
    </View>
  );
}

/** In-app CDSL fetch: BO ID + PAN + DOB → OTP → parsed, no PDF or CDSL website needed. */
function CdslFetchSection({ onSuccess }: { onSuccess: () => void }) {
  const [stage, setStage] = useState<'form' | 'otp'>('form');
  const [boId, setBoId] = useState('');
  const [pan, setPan] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [otp, setOtp] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const dobValid =
    dobDay.length > 0 &&
    dobMonth.length > 0 &&
    dobYear.length === 4 &&
    Number(dobDay) >= 1 &&
    Number(dobDay) <= 31 &&
    Number(dobMonth) >= 1 &&
    Number(dobMonth) <= 12;
  const canStart = boId.length === 16 && pan.length === 10 && dobValid;

  async function start() {
    if (!dobValid) return;
    setBusy(true);
    setError('');
    const dob = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;
    const result = await startDematFetch({ pan, boId, dob });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSessionId(result.sessionId);
    setStage('otp');
  }

  async function verify(code?: string) {
    const value = code ?? otp;
    // CDSL sends 4-digit codes as often as 6 — demanding exactly six would
    // leave the Confirm button dead under a real code (matches web's own
    // CdslFetch, which allows this same minimum).
    if (busy || value.length < 4) return;
    setBusy(true);
    setError('');
    const result = await verifyDematOtp({ sessionId, otp: value, pan });
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    onSuccess();
  }

  function handleOtpChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    if (error) setError('');
    if (digits.length === 6 && !busy) void verify(digits);
  }

  if (stage === 'otp') {
    return (
      <View style={styles.form}>
        <Text style={styles.fieldLabel}>Enter the code CDSL just sent to your phone</Text>
        <TextInput
          style={styles.input}
          placeholder="······"
          placeholderTextColor={QodeColor.textMuted}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={6}
          value={otp}
          onChangeText={handleOtpChange}
          editable={!busy}
          autoFocus
        />
        <ErrorLine text={error} />
        <Pressable
          style={[styles.submit, (busy || otp.length < 4) && styles.submitOff]}
          disabled={busy || otp.length < 4}
          onPress={() => void verify()}>
          <Text style={[styles.submitText, (busy || otp.length < 4) && styles.submitTextOff]}>
            {busy ? 'Collecting your statement…' : 'Confirm'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.fieldLabel}>BO ID (16 digits)</Text>
      <TextInput
        style={styles.input}
        placeholder="1234567890123456"
        placeholderTextColor={QodeColor.textMuted}
        keyboardType="number-pad"
        maxLength={16}
        value={boId}
        onChangeText={(v) => setBoId(v.replace(/\D/g, '').slice(0, 16))}
        editable={!busy}
      />
      <Text style={styles.hint}>
        In your broker app under Profile (Zerodha Console, Groww, Upstox all show it). Starts with &quot;IN&quot;?
        That is NSDL — use the PDF upload below instead.
      </Text>

      <Text style={styles.fieldLabel}>PAN</Text>
      <TextInput
        style={styles.input}
        placeholder="ABCDE1234F"
        placeholderTextColor={QodeColor.textMuted}
        autoCapitalize="characters"
        maxLength={10}
        value={pan}
        onChangeText={(v) => setPan(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        editable={!busy}
      />

      <Text style={styles.fieldLabel}>Date of birth</Text>
      <View style={styles.dobRow}>
        <TextInput
          style={[styles.input, styles.dobField]}
          placeholder="DD"
          placeholderTextColor={QodeColor.textMuted}
          keyboardType="number-pad"
          maxLength={2}
          value={dobDay}
          onChangeText={(v) => setDobDay(v.replace(/\D/g, '').slice(0, 2))}
          editable={!busy}
        />
        <TextInput
          style={[styles.input, styles.dobField]}
          placeholder="MM"
          placeholderTextColor={QodeColor.textMuted}
          keyboardType="number-pad"
          maxLength={2}
          value={dobMonth}
          onChangeText={(v) => setDobMonth(v.replace(/\D/g, '').slice(0, 2))}
          editable={!busy}
        />
        <TextInput
          style={[styles.input, styles.dobFieldYear]}
          placeholder="YYYY"
          placeholderTextColor={QodeColor.textMuted}
          keyboardType="number-pad"
          maxLength={4}
          value={dobYear}
          onChangeText={(v) => setDobYear(v.replace(/\D/g, '').slice(0, 4))}
          editable={!busy}
        />
      </View>

      <ErrorLine text={error} />

      <Pressable
        style={[styles.submit, (!canStart || busy) && styles.submitOff]}
        disabled={!canStart || busy}
        onPress={() => void start()}>
        <Text style={[styles.submitText, (!canStart || busy) && styles.submitTextOff]}>
          {busy ? 'Talking to CDSL — about 20 seconds…' : 'Fetch my holdings from CDSL'}
        </Text>
      </Pressable>
      <Text style={styles.hint}>
        CDSL sends a code to your registered phone; nothing is changed or moved — this only reads your statement.
      </Text>

      <Pressable onPress={() => setShowUpload((v) => !v)} style={styles.disclosure}>
        <Text style={styles.disclosureText}>
          {showUpload ? 'Hide upload' : 'Or upload the PDF yourself (NSDL or CDSL)'}
        </Text>
      </Pressable>
      {showUpload ? (
        <>
          <View style={styles.linkRow}>
            <LinkChip href="https://www.cdslindia.com/CAS/LoginCAS.aspx">Open CDSL CAS</LinkChip>
            <LinkChip href="https://nsdlcas.nsdl.com/">Open NSDL CAS</LinkChip>
          </View>
          <ManualUploadForm onSuccess={onSuccess} />
        </>
      ) : null}
    </View>
  );
}

function ForwardEmailNote({ address, copied, onCopy }: { address: string; copied: boolean; onCopy: () => void }) {
  return (
    <Text style={styles.forwardNote}>
      Prefer email? Forward any CAS you receive (CAMS, KFin, NSDL or CDSL) to{' '}
      <Text style={styles.forwardAddress} onPress={onCopy}>
        {address}
      </Text>{' '}
      {copied ? '— copied!' : '(tap to copy)'} — it files itself, no upload needed.
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: QodeSpace[5],
    paddingVertical: QodeSpace[3],
    borderBottomWidth: 1,
    borderBottomColor: QodeColor.divider,
  },
  headerTitle: {
    fontFamily: QodeFont.display,
    fontSize: 17,
    color: QodeColor.cream,
  },
  headerClose: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    color: QodeColor.accent,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: QodeSpace[4],
    paddingHorizontal: QodeSpace[5],
  },
  message: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    color: QodeColor.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryText: {
    fontFamily: QodeFont.ui,
    fontSize: 14,
    color: QodeColor.textOnAccent,
  },
  scroll: {
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[4],
    paddingBottom: QodeSpace[8],
    gap: QodeSpace[4],
  },
  intro: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    lineHeight: 19,
    color: QodeColor.textSecondary,
  },
  card: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
    gap: QodeSpace[3],
  },
  cardTitle: { fontFamily: QodeFont.display, fontSize: 17, color: QodeColor.cream },
  cardBody: { fontFamily: QodeFont.uiRegular, fontSize: 12.5, lineHeight: 18, color: QodeColor.textMuted },
  form: { gap: QodeSpace[2] },
  fieldLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: QodeColor.textMuted,
    marginTop: QodeSpace[2],
  },
  input: {
    backgroundColor: QodeColor.surfaceRaised,
    borderWidth: 1,
    borderColor: QodeColor.controlBorder,
    borderRadius: QodeRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    color: QodeColor.textPrimary,
  },
  dobRow: { flexDirection: 'row', gap: QodeSpace[2] },
  dobField: { flex: 1, textAlign: 'center' },
  dobFieldYear: { flex: 1.6, textAlign: 'center' },
  fileField: {
    backgroundColor: QodeColor.surfaceRaised,
    borderWidth: 1,
    borderColor: QodeColor.controlBorder,
    borderRadius: QodeRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fileFieldValue: { fontFamily: QodeFont.ui, fontSize: 14, color: QodeColor.textPrimary },
  fileFieldPlaceholder: { fontFamily: QodeFont.uiRegular, fontSize: 14, color: QodeColor.textMuted },
  errorLine: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12.5,
    color: QodeColor.warning,
    marginTop: QodeSpace[1],
  },
  submit: {
    backgroundColor: QodeColor.accent,
    borderWidth: 1,
    borderColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: QodeSpace[2],
  },
  submitOff: {
    backgroundColor: 'transparent',
    borderColor: QodeColor.surfaceBorder,
  },
  submitText: { fontFamily: QodeFont.ui, fontSize: 14, color: QodeColor.textOnAccent },
  submitTextOff: { color: QodeColor.textMuted },
  hint: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11.5,
    lineHeight: 16,
    color: QodeColor.textMuted,
    marginTop: -QodeSpace[1],
  },
  note: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    lineHeight: 19,
    color: QodeColor.textSecondary,
  },
  noteStrong: { fontFamily: QodeFont.ui, color: QodeColor.textPrimary },
  disclosure: {
    marginTop: QodeSpace[2],
    alignSelf: 'flex-start',
  },
  disclosureText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.accent,
    textDecorationLine: 'underline',
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: QodeSpace[2],
    marginTop: QodeSpace[1],
  },
  linkChip: {
    borderWidth: 1,
    borderColor: QodeColor.accentBorder,
    borderRadius: QodeRadius.pill,
    paddingVertical: QodeSpace[1],
    paddingHorizontal: QodeSpace[3],
  },
  linkChipText: { fontFamily: QodeFont.uiRegular, fontSize: 12.5, color: QodeColor.accent },
  forwardNote: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: QodeColor.textMuted,
  },
  forwardAddress: {
    color: QodeColor.accent,
    textDecorationLine: 'underline',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: QodeSpace[2],
    paddingHorizontal: QodeSpace[6],
    backgroundColor: QodeColor.background,
  },
  overlayTitle: { fontFamily: QodeFont.display, fontSize: 20, color: QodeColor.cream, marginTop: QodeSpace[2] },
  overlaySub: { fontFamily: QodeFont.uiRegular, fontSize: 13, color: QodeColor.textMuted, textAlign: 'center' },
});
