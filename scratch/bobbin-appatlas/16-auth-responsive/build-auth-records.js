const fs = require('fs');
const path = require('path');

const root = __dirname;
const section = '16-auth-responsive';
const publicManifest = JSON.parse(fs.readFileSync(path.join(root, 'capture-manifest.json'), 'utf8'));
const tokenManifest = JSON.parse(fs.readFileSync(path.join(root, 'token-capture-manifest.json'), 'utf8'));
const setupManifest = JSON.parse(fs.readFileSync(path.join(root, 'setup-capture-manifest.json'), 'utf8'));
const captures = [...publicManifest, ...tokenManifest, ...setupManifest];

const routeGroup = (id) => {
  if (id.startsWith('setup--')) return 'First-time setup';
  if (id.startsWith('login--') || id.includes('--reauthentication')) return 'Login';
  if (id.startsWith('signup--')) return 'Sign up';
  if (id.startsWith('forgot-password--')) return 'Password recovery';
  if (id.startsWith('set-password--')) return 'Set password';
  if (id.startsWith('confirm-signup--')) return 'Confirm signup';
  if (id.startsWith('accept-invite--')) return 'Accept invitation';
  if (id.startsWith('two-factor-reset--')) return 'Two-factor reset';
  if (id.startsWith('recording-consent--')) return 'Recording consent';
  return 'Authentication';
};

const flowFor = (id) => {
  if (id.startsWith('setup--')) return ['onboarding', 'organization-setup'];
  if (id.startsWith('signup--') || id.startsWith('confirm-signup--')) return ['sign-up', 'onboarding'];
  if (id.startsWith('forgot-password--') || id.startsWith('set-password--')) return ['sign-in', 'password-recovery'];
  if (id.startsWith('accept-invite--')) return ['onboarding', 'team-management', 'invitation'];
  if (id.startsWith('two-factor-reset--') || id.includes('two-factor')) return ['sign-in', 'account-security'];
  if (id.startsWith('recording-consent--')) return ['recording-consent'];
  return ['sign-in'];
};

const stateFor = (id) => {
  const values = ['populated'];
  if (/invalid|rate-limited|mismatch|validation|expired|withdrawn|declined/.test(id)) values.push('error');
  if (/success|already-accepted|already-given|notice/.test(id)) values.push('confirmation');
  if (/reauthentication/.test(id)) values.push('gated');
  return values;
};

const pageTypeFor = (id) => {
  if (id.startsWith('setup--') && id !== 'setup--checklist') return 'modal';
  if (id === 'setup--checklist') return 'onboarding-step';
  if (/invalid-link|invalid-credentials|rate-limited|mismatch|validation|expired|withdrawn|declined/.test(id)) return 'error';
  if (/success|already-accepted|already-given|notice/.test(id)) return 'confirmation';
  return 'auth';
};

const titleFor = (capture) => {
  const heading = capture.headings?.at(-1) || routeGroup(capture.id);
  const controlled = capture.simulatedNetworkOutcome ? ' — controlled response' : capture.simulatedSetupReadModel ? ' — controlled setup model' : '';
  return `${heading} — ${capture.viewport}${controlled}`;
};

const normalizeElement = (control) => {
  const supported = new Set(['button', 'link', 'input', 'textarea', 'select', 'checkbox', 'radio']);
  let type = control.tag;
  if (control.tag === 'input' && control.type === 'checkbox') type = 'checkbox';
  if (control.tag === 'input' && control.type === 'radio') type = 'radio';
  if (!supported.has(type)) type = control.tag === 'a' ? 'link' : 'input';
  const label = control.text || control.label || control.placeholder || control.id || control.type || type;
  const behavior = control.href ? `navigates to ${control.href}` : control.disabled ? 'currently disabled' : control.required ? 'required form control' : 'interactive form control';
  return { type, label, behavior };
};

const records = captures.map((capture) => {
  const stem = `${capture.viewport}--${capture.id}`;
  const evidence = JSON.parse(fs.readFileSync(path.join(root, capture.evidence), 'utf8'));
  const tags = ['form'];
  if (capture.viewport === 'desktop' && !capture.id.startsWith('setup--')) tags.push('hero');
  if (capture.id.startsWith('setup--')) tags.push('stepper', 'progress');
  if (capture.id.startsWith('setup--') && capture.id !== 'setup--checklist') tags.push('modal');
  if (/notice|error|invalid|rate-limited|mismatch|validation/.test(capture.id)) tags.push('banner');
  if (/password-visible|recovery-code/.test(capture.id)) tags.push('disclosure');
  const summaryPrefix = capture.simulatedNetworkOutcome ? 'Controlled API response used to expose this otherwise token- or outcome-gated UI state. ' : capture.simulatedSetupReadModel ? 'The authenticated production UI is shown with only its setup-completion read model reset; no record was created. ' : '';
  return {
    id: `${section}/${stem}`,
    section,
    sectionTitle: 'Authentication — responsive',
    screenshot: `screenshots/${stem}.png`,
    page: routeGroup(capture.id),
    subtab: capture.viewport,
    modal: null,
    title: titleFor(capture),
    route: new URL(capture.finalUrl).pathname + new URL(capture.finalUrl).search,
    pageType: pageTypeFor(capture.id),
    flows: flowFor(capture.id),
    features: ['responsive-auth-layout', ...flowFor(capture.id), ...(capture.simulatedNetworkOutcome ? ['controlled-state-reproduction'] : []), ...(capture.simulatedSetupReadModel ? ['controlled-setup-read-model'] : [])],
    elements: evidence.controls.map(normalizeElement).slice(0, 18),
    states: stateFor(capture.id),
    tags,
    links: [],
    summary: `${summaryPrefix}${evidence.bodyText.slice(0, 320)}`,
  };
});

const byStem = new Map(records.map((record) => [record.id.split('/').at(-1), record]));
const link = (from, to, via, type) => {
  const source = byStem.get(from);
  const target = byStem.get(to);
  if (source && target) source.links.push({ to: target.id, via, type });
};

for (const viewport of ['desktop', 'tablet', 'mobile']) {
  link(`${viewport}--login--default`, `${viewport}--forgot-password--default`, 'Forgot password?', 'navigates');
  link(`${viewport}--login--default`, `${viewport}--signup--default`, 'Create an account', 'navigates');
  link(`${viewport}--login--default`, `${viewport}--login--password-visible`, 'Show password', 'expands');
  link(`${viewport}--login--default`, `${viewport}--login--invalid-credentials`, 'Log in', 'expands');
  link(`${viewport}--login--default`, `${viewport}--login--two-factor-code`, 'successful password check with 2FA', 'cta');
  link(`${viewport}--login--two-factor-code`, `${viewport}--login--two-factor-recovery-code`, 'Use a recovery code', 'expands');
  link(`${viewport}--login--two-factor-code`, `${viewport}--login--two-factor-invalid-code`, 'Verify', 'expands');
  link(`${viewport}--forgot-password--default`, `${viewport}--forgot-password--success`, 'Send reset link', 'expands');
  link(`${viewport}--forgot-password--default`, `${viewport}--forgot-password--rate-limited`, 'Send reset link', 'expands');
  link(`${viewport}--set-password--form`, `${viewport}--set-password--mismatch-validation`, 'Set password & log in', 'expands');
  link(`${viewport}--confirm-signup--form`, `${viewport}--confirm-signup--password-validation`, 'Set password & log in', 'expands');
  link(`${viewport}--accept-invite--existing-account`, `${viewport}--accept-invite--already-accepted`, 'Accept invite', 'expands');
  link(`${viewport}--two-factor-reset--confirmation`, `${viewport}--two-factor-reset--success`, 'Turn off two-factor authentication', 'expands');
  link(`${viewport}--recording-consent--request`, `${viewport}--recording-consent--success`, 'Give consent', 'expands');
  for (const target of ['client-form', 'tutor-form', 'student-form', 'course-form', 'lesson-form']) {
    link(`${viewport}--setup--checklist`, `${viewport}--setup--${target}`, `Open ${target.replace('-', ' ')}`, 'opens-modal');
  }
}

fs.writeFileSync(path.join(root, 'screens.json'), `${JSON.stringify(records, null, 2)}\n`);
console.log(`Wrote ${records.length} structured records.`);
