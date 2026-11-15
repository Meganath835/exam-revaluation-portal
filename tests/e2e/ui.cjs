// Happy path through the React UI with Playwright, plus the Process View role checks.
// Run against a fresh stack: node ui.cjs   (BASE defaults to http://localhost:3000)
const { chromium } = require('playwright');
const SHOTS = (process.env.SHOTS || './screenshots') + '/';
require('fs').mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:3000';
const assert = (ok, msg) => { if (!ok) throw new Error('ASSERTION: ' + msg); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const as = async (user) => {
    const users = await (await page.request.get(BASE + '/api/users')).json();
    const u = users.find((x) => x.username === user);
    await page.goto(BASE + '/login');
    await page.evaluate((u) => localStorage.setItem('revaluation.user', JSON.stringify(u)), u);
  };
  // SHOTS_BOTH=1 also saves a dark-theme copy of every screenshot (for reviewing both themes).
  const shot = async (n) => {
    if (process.env.SHOTS_BOTH) await page.waitForTimeout(700); // let entrance animations finish
    await page.screenshot({ path: SHOTS + n + '.png', fullPage: true });
    if (!process.env.SHOTS_BOTH) return;
    const wasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (wasDark) return;
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(250);
    await page.screenshot({ path: SHOTS + n + '-dark.png', fullPage: true });
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
  };
  const step = (s) => console.log('•', s);
  globalThis.failShot = () => page.screenshot({ path: SHOTS + 'FAILED.png', fullPage: true });
  const nav = () => page.getByRole('navigation', { name: 'Main' });
  const openTask = async (name, rid, code, group = false) => {
    await page.goto(BASE + '/tasks');
    if (group) await page.getByRole('tab', { name: /Group tasks/ }).click();
    await page.getByRole('button', { name: new RegExp(`${name}[\\s\\S]*${rid}${code ? ` · ${code}` : ''}`) }).click({ timeout: 30000 });
  };
  const findAssignee = async (rid, element, code) => {
    for (let i = 0; i < 30; i++) {
      for (const ex of ['examiner.cs01', 'examiner.cs02', 'examiner.cs03']) {
        const ts = await (await page.request.get(BASE + '/api/tasks?view=mine', { headers: { 'X-User': ex } })).json();
        if (ts.some((t) => t.elementId === element && t.requestId === rid && t.subjectCode === code)) return ex;
      }
      await page.waitForTimeout(1000);
    }
    throw new Error(`no ${element} task for ${code}`);
  };
  const SUBJECTS = [['CS301', '46', '50'], ['CS305', '54', '52']];

  // 1. student signs in: no Process View anywhere
  await page.goto(BASE + '/login');
  await page.getByText('Continue as').waitFor();
  await shot('01-login');
  await page.getByRole('button', { name: /Continue as Sample Student/ }).click();
  await page.waitForURL('**/requests');
  assert(await nav().getByText('Process view').count() === 0, 'student nav must not offer Process view');
  await page.goto(BASE + '/process');
  await page.waitForURL('**/requests');
  step('student: no Process view link, /process redirects to /requests');

  // 2. new request with validation errors first
  await page.goto(BASE + '/requests/new');
  await page.getByLabel('Subject, row 1').selectOption('CS301');
  await page.getByLabel('Your marks, row 1').fill('38');
  await page.getByRole('button', { name: '+ Add subject' }).click();
  await page.getByLabel('Subject, row 2').selectOption('CS301');
  await page.getByLabel('Your marks, row 2').fill('154');
  await page.getByRole('button', { name: 'Submit request' }).click();
  await page.getByText(/Fix \d problem/).waitFor();
  await shot('02-new-request-errors');
  await page.getByLabel('Subject, row 2').selectOption('CS305');
  await page.getByLabel('Your marks, row 2').fill('54');
  await page.getByLabel(/I confirm these marks/).check();
  await page.getByRole('button', { name: 'Submit request' }).click();
  await page.waitForURL(/\/requests\/REV-/, { timeout: 30000 });
  const rid = page.url().split('/').pop();
  step('submitted ' + rid);

  // 3. exam cell verifies the application
  await as('examcell.clerk');
  await openTask('Exam cell verifies application', rid, null, true);
  await page.getByLabel('Accept the application').check();
  await shot('03-clerk-verify-application');
  await page.getByRole('button', { name: 'Save verification' }).click();
  await page.getByText('Verification saved').waitFor();
  step('exam cell accepted the application');

  // 4. eligible -> student pays (mock checkout)
  await as('21CS042');
  await page.goto(`${BASE}/requests/${rid}`);
  await page.getByRole('link', { name: /^Pay / }).waitFor({ timeout: 30000 });
  assert(await page.getByRole('heading', { name: 'Process view' }).count() === 0, 'student request page must not show Process view');
  await shot('03b-student-request-payment-due');
  await page.goto(`${BASE}/requests/${rid}/pay`);
  await page.getByRole('button', { name: /\(success\)/ }).waitFor({ timeout: 30000 });
  await shot('04-payment');
  await page.getByRole('button', { name: /\(success\)/ }).click();
  await page.waitForURL(new RegExp(`/requests/${rid}$`));
  await page.getByText('Payment verified').waitFor();
  step('paid and verified');

  // 4. exam cell: Process View dashboard
  await as('examcell.clerk');
  await page.goto(BASE + '/tasks');
  await nav().getByRole('link', { name: 'Process view' }).click();
  await page.waitForURL('**/process');
  await page.locator('.djs-container').waitFor({ timeout: 30000 });
  await page.getByRole('link', { name: rid }).waitFor();
  await page.waitForTimeout(1500);
  await shot('05-clerk-process-view');
  step('clerk: Process view shows the deployed model and ' + rid);

  // 5. Examination and Revaluation lane, one step at a time for every subject
  for (const [code] of SUBJECTS) {
    await openTask('Clerk assigns independent examiner', rid, code, true);
    if (code === 'CS301') await shot('06-clerk-assign-examiner');
    await page.getByRole('button', { name: 'Assign examiner' }).click();
    await page.getByText('Examiner assigned').waitFor();
  }
  step('first examiners assigned');
  for (const [code, m1] of SUBJECTS) {
    await as(await findAssignee(rid, 'examinerSendsMarks', code));
    await openTask('Examiner sends updated marks to clerk', rid, code);
    await page.getByRole('spinbutton', { name: 'Updated marks' }).fill(m1);
    await page.getByRole('textbox', { name: 'Remarks for the exam cell' }).fill('Rechecked every answer.');
    if (code === 'CS301') await shot('07-examiner-blind');
    await page.getByRole('button', { name: 'Send marks to the exam cell' }).click();
    await page.getByText('Marks sent to the exam cell').waitFor();
  }
  step('first evaluations sent');
  await as('examcell.clerk');
  for (const [code] of SUBJECTS) {
    await openTask('Clerk assigns second independent examiner', rid, code, true);
    await page.getByRole('button', { name: 'Assign second examiner' }).click();
    await page.getByText('Second examiner assigned').waitFor();
  }
  step('second examiners assigned');
  for (const [code, , m2] of SUBJECTS) {
    await as(await findAssignee(rid, 'reEvaluateScript', code));
    await openTask('Re-evaluate answer script', rid, code);
    await page.getByRole('spinbutton', { name: 'Your marks' }).fill(m2);
    await page.getByRole('textbox', { name: 'Remarks for the exam cell' }).fill('Second evaluation done.');
    await page.getByRole('button', { name: 'Submit evaluation' }).click();
    await page.getByText('Evaluation submitted').waitFor();
  }
  step('second evaluations submitted');

  // 6. Marks increased? yes -> HOD recommends, CoE approves
  await as('hod.cse');
  await openTask('HOD reviews mark increase', rid, null, true);
  await page.getByLabel('Approve the increase').check();
  await shot('08-hod-review');
  await page.getByRole('button', { name: 'Send recommendation' }).click();
  await page.getByText('Recommendation sent to the CoE').waitFor();
  await as('coe');
  await openTask('CoE approves revised result', rid, null, true);
  await page.getByText(/HOD recommends/).waitFor();
  await page.getByLabel('Approve the increase').check();
  await page.getByRole('button', { name: 'Record final decision' }).click();
  await page.getByText('Final decision recorded').waitFor();
  step('HOD recommended, CoE approved');

  // 7. Increase approved? yes -> exam cell updates the official result
  await as('examcell.clerk');
  await openTask('Update official result', rid, null, true);
  await shot('09-update-result');
  await page.getByLabel(/revised marks are entered/).check();
  await page.getByRole('button', { name: 'Mark result as updated' }).click();
  await page.getByText('Official result updated').waitFor();
  step('result updated');

  // 7. clerk: per-request Process view with the workflow task table
  await page.goto(`${BASE}/requests/${rid}`);
  await page.getByRole('heading', { name: 'Process view' }).waitFor();
  await page.getByRole('heading', { name: 'Workflow tasks' }).waitFor();
  await page.getByText('Finished').waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  await shot('09-clerk-request-process');
  step('clerk: request page shows the instance diagram and its tasks');

  // 8. student sees the published result, still without any Process view
  await as('21CS042');
  await page.goto(`${BASE}/requests/${rid}`);
  await page.getByText('Finished').waitFor({ timeout: 30000 });
  await page.getByText('Marks increased').first().waitFor();
  assert(await page.getByRole('heading', { name: 'Process view' }).count() === 0, 'student must not see Process view');
  await shot('10-student-result');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await shot('11-student-result-phone');
  step('student sees the result; phone horizontal overflow: ' + overflow);

  // 9. dark mode: switch with the toggle, check it applies and survives a reload
  await page.setViewportSize({ width: 1280, height: 900 });
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
  await page.getByRole('button', { name: /Change theme/ }).click();
  await page.getByRole('menuitem', { name: 'Dark' }).click();
  assert(await isDark(), 'dark class after choosing Dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert(bg !== 'rgb(255, 255, 255)' && bg !== 'rgb(243, 244, 246)', 'dark background, got ' + bg);
  await page.waitForTimeout(800);
  await shot('12-dark-student-result');
  await page.reload();
  await page.getByText('Finished').waitFor({ timeout: 30000 });
  assert(await isDark(), 'dark mode kept after reload');
  await as('examcell.clerk');
  await page.goto(BASE + '/process');
  await page.locator('.djs-container').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot('13-dark-clerk-process-view');
  await page.getByRole('button', { name: /Change theme/ }).click();
  await page.getByRole('menuitem', { name: 'Light' }).click();
  assert(!(await isDark()), 'back to light');
  step('dark mode: toggles, persists across reload, back to light');

  // Only API errors we provoked on purpose are acceptable (none in this flow).
  console.log('console/page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) process.exit(1);
})().catch(async (e) => { console.error('FAILED:', e.message); try { await globalThis.failShot(); } catch {} process.exit(1); });
