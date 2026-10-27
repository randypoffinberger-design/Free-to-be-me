const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'supplements.js'), 'utf8'), context);
const supplements = context.window.MTMSupplements;

test('combined tracker offers medication and supplement types', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /Medication & supplement tracker/);
  assert.match(app, /id="supplementItemType"/);
  assert.match(app, /value="supplement"/);
  assert.match(app, /value="medication"/);
  assert.match(app, /Babysitter care sheet/);
  assert.match(app, /includeBabysitterTrackedItems/);
  assert.match(app, /class="supplement-item-notes"/);
  assert.match(app, /<strong>Notes<\/strong><p>\$\{esc\(item\.notes\)\}<\/p>/);
});

test('My Day displays the same medication and supplement analysis', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /id = "my-day-medication-patterns"/);
  assert.match(app, /MTMSupplements\.analyze\(trackedItems, doseLogs, insightEvents\)/);
  assert.match(app, /Medication & supplement correlations/);
  assert.match(app, /supplementCorrelationTable\(medicationReports, profiles/);
  assert.match(app, /Open medication & supplement tracker/);
});

test('daily scheduled doses are marked automatic and remain editable', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /id="supplementAutoRecord"/);
  assert.match(app, /ensureScheduledDoseLogs/);
  assert.match(app, /autoRecordStartDate/);
  assert.match(app, /autoRecorded: true/);
  assert.match(app, /scheduledWindowStart/);
  assert.match(app, /autoReviewed: existing\?\.autoRecorded \? true/);
  assert.match(app, /class="small-action edit-supplement-log"/);
});

test('daily schedule waits for the window, avoids duplicates, and respects dates', () => {
  const item = { id: 'med-1', active: true, autoRecordDose: true, autoRecordStartDate: '2026-10-24', startDate: '2026-10-01', endDate: '2026-10-26', autoRecordWindowStart: '08:00', autoRecordWindowEnd: '09:00' };
  const existing = [{ itemId: 'med-1', status: 'skipped', localDate: '2026-10-25', localMinutes: 8 * 60 + 30 }];
  const afterWindow = supplements.scheduledDosePlan([item], existing, { today: '2026-10-26', currentMinutes: 9 * 60 + 5 });
  assert.deepEqual([...afterWindow].map((entry) => ({ date: entry.date, timeMinutes: entry.timeMinutes })), [
    { date: '2026-10-24', timeMinutes: 8 * 60 + 30 },
    { date: '2026-10-26', timeMinutes: 8 * 60 + 30 },
  ]);
  const beforeWindowEnds = supplements.scheduledDosePlan([item], existing, { today: '2026-10-26', currentMinutes: 8 * 60 + 30 });
  assert.deepEqual([...beforeWindowEnds].map((entry) => entry.date), ['2026-10-24']);
  assert.equal(supplements.scheduledDosePlan([{ ...item, autoRecordWindowEnd: '07:00' }], [], { today: '2026-10-26', currentMinutes: 600 }).length, 0);
});

test('multiple daily windows create independent morning and evening doses', () => {
  const item = { id: 'med-1', active: true, autoRecordDose: true, autoRecordStartDate: '2026-10-26', startDate: '2026-10-01', autoRecordWindows: [
    { id: 'morning', label: 'Morning', start: '08:00', end: '09:00' },
    { id: 'night', label: 'Night', start: '20:00', end: '21:00' },
  ] };
  const morningOnly = supplements.scheduledDosePlan([item], [], { today: '2026-10-26', currentMinutes: 10 * 60 });
  assert.deepEqual([...morningOnly].map((entry) => entry.scheduleSlotId), ['morning']);
  const manualMorning = [{ itemId: 'med-1', localDate: '2026-10-26', localMinutes: 8 * 60 + 15, status: 'taken' }];
  const afterNight = supplements.scheduledDosePlan([item], manualMorning, { today: '2026-10-26', currentMinutes: 21 * 60 + 5 });
  assert.deepEqual([...afterNight].map((entry) => ({ slot: entry.scheduleSlotId, label: entry.scheduleLabel, time: entry.timeMinutes })), [{ slot: 'night', label: 'Night', time: 20 * 60 + 30 }]);
  const editedScheduledMorning = [{ itemId: 'med-1', localDate: '2026-10-26', localMinutes: 15 * 60, scheduleSlotId: 'morning', status: 'missed' }];
  assert.deepEqual([...supplements.scheduledDosePlan([item], editedScheduledMorning, { today: '2026-10-26', currentMinutes: 21 * 60 + 5 })].map((entry) => entry.scheduleSlotId), ['night']);
});

test('quick observations are shared child-level My Day events', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /data-quick-observation/);
  assert.match(app, /itemId: null/);
  assert.match(app, /It is now in My Day and observation history/);
  assert.match(app, /id="supplementDoseHistory"/);
  assert.match(app, /id="supplementObservationHistory"/);
  assert.match(app, /id="supplementLogSearch"/);
  assert.match(app, /id="supplementObservationSearch"/);
});

test('correlation table summarizes doses and expandable pattern counts', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /supplement-correlation-table/);
  assert.match(app, /Doses given/);
  assert.match(app, /Possible correlations/);
  assert.match(app, /report\.takenTotal/);
  assert.match(app, /report\.patterns\.length/);
});

test('tracker rendering never shadows the browser window object', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.doesNotMatch(app, /\b(?:const|let|var)\s+window\s*=/);
  assert.match(app, /doseWindows = autoDoseWindows\(item\)/);
});

test('30-day supply defaults to a five-day refill reminder', () => {
  const item = { startDate: '2026-10-01', lastFilledDate: '2026-10-01', supplyDays: 30 };
  assert.deepEqual({ ...supplements.refillDates(item) }, {
    filledDate: '2026-10-01', supplyDays: 30, reminderDays: 5,
    dueDate: '2026-10-31', reminderDate: '2026-10-26',
  });
  assert.equal(supplements.refillState(item, '2026-10-25').remind, false);
  assert.equal(supplements.refillState(item, '2026-10-26').state, 'soon');
  assert.equal(supplements.refillState(item, '2026-10-31').state, 'due');
  assert.equal(supplements.refillState(item, '2026-11-01').state, 'overdue');
});

test('custom reminder and end date stop unnecessary refill notices', () => {
  const custom = { startDate: '2026-10-01', supplyDays: 30, reminderDays: 10 };
  assert.equal(supplements.refillDates(custom).reminderDate, '2026-10-21');
  const course = { ...custom, endDate: '2026-10-20' };
  assert.equal(supplements.refillState(course, '2026-10-15').state, 'course-ending');
  assert.equal(supplements.refillState(course, '2026-10-15').remind, false);
  assert.equal(supplements.refillState(course, '2026-10-21').state, 'ended');
});

test('possible patterns work for medications and require seven recorded days', () => {
  const item = { id: 'med-1', profileId: 'child-1', itemType: 'medication', name: 'Example medication' };
  const logs = Array.from({ length: 10 }, (_, index) => ({
    id: `dose-${index}`,
    kind: 'supplementDose',
    itemId: item.id,
    itemName: item.name,
    profileId: item.profileId,
    status: index < 7 ? 'taken' : 'missed',
    occurredAt: `2026-10-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
  }));
  const observations = [0, 1, 2, 7].map((index) => ({
    id: `event-${index}`,
    kind: 'dayEvent',
    profileId: item.profileId,
    supplementOutcome: 'behavior',
    occurredAt: `2026-10-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
  }));
  const report = supplements.analyze([item], logs, observations).supplements[0];
  assert.equal(report.ready, true);
  const behavior = report.patterns.find((pattern) => pattern.outcome === 'behavior');
  assert.deepEqual({ takenMatches: behavior.takenMatches, takenTotal: behavior.takenTotal, comparisonMatches: behavior.comparisonMatches, comparisonTotal: behavior.comparisonTotal }, { takenMatches: 3, takenTotal: 7, comparisonMatches: 1, comparisonTotal: 3 });
  const tooSoon = supplements.analyze([item], logs.slice(0, 6), observations).supplements[0];
  assert.equal(tooSoon.ready, false);
  assert.equal(tooSoon.patterns.length, 0);
});

test('overlapping medications and supplements are surfaced as a confounder', () => {
  const first = { id: 'a', profileId: 'child-1', itemType: 'medication', name: 'A' }, second = { id: 'b', profileId: 'child-1', itemType: 'supplement', name: 'B' };
  const logs = [];
  const events = [];
  for (let day = 1; day <= 7; day++) {
    const date = String(day).padStart(2, '0');
    logs.push({ id: `a-${day}`, kind: 'supplementDose', itemId: 'a', profileId: 'child-1', status: 'taken', occurredAt: `2026-10-${date}T08:00:00Z` });
    logs.push({ id: `b-${day}`, kind: 'supplementDose', itemId: 'b', profileId: 'child-1', status: 'taken', occurredAt: `2026-10-${date}T08:30:00Z` });
    if (day <= 3) events.push({ id: `r-${day}`, profileId: 'child-1', supplementOutcome: 'reaction', occurredAt: `2026-10-${date}T09:00:00Z` });
  }
  const pattern = supplements.analyze([first, second], logs, events).supplements[0].patterns[0];
  assert.equal(pattern.overlapCount, 7);
});

test('doctor appointment summary can be refreshed without duplicating old snapshots', () => {
  const item = { id: 'supp-1', profileId: 'child-1', name: 'Vitamin D', brand: 'Example', doseAmount: '1', doseUnit: 'drop', schedule: 'Each morning', startDate: '2026-10-01', supplyDays: 30, reminderDays: 5 };
  const medication = { id: 'med-1', profileId: 'child-1', itemType: 'medication', name: 'Example medicine', doseAmount: '5', doseUnit: 'mL', schedule: 'Twice daily', startDate: '2026-10-10', supplyDays: 10 };
  const doseLogs = [{ kind: 'supplementDose', profileId: 'child-1', itemName: 'Example medicine', occurredAt: '2026-10-10T08:00:00Z', reactionNotes: 'Brief rash', reactionSeverity: 2 }];
  const summary = supplements.appointmentSummary({ profileName: 'Sam', supplements: [item, medication], doseLogs, analysis: { supplements: [] }, appointmentDate: '2026-10-20' });
  assert.match(summary, /Active medications:\n- Example medicine; 5 mL; Twice daily/);
  assert.match(summary, /Active supplements:\n- Vitamin D/);
  assert.match(summary, /Vitamin D \(Example\); 1 drop; Each morning/);
  assert.match(summary, /refill due 2026-10-31/);
  assert.match(summary, /Brief rash \(severity 2\/5\)/);
  assert.match(summary, /recorded associations, not proof/);
  const first = supplements.mergeAppointmentNotes('Bring lab report.', summary);
  const second = supplements.mergeAppointmentNotes(first, summary.replace('2026-10-20', '2026-10-21'));
  assert.equal((second.match(/--- MTM medication and supplement summary ---/g) || []).length, 1);
  assert.match(second, /^Bring lab report\./);
  assert.match(second, /2026-10-21/);
  const legacy = `Keep this note.\n\n--- MTM supplement summary ---\nOld snapshot\n--- End MTM supplement summary ---`;
  assert.equal(supplements.stripAppointmentSnapshot(legacy), 'Keep this note.');
});

test('babysitter summary includes only current names, doses, and schedules', () => {
  const items = [
    { id: 'med-1', itemType: 'medication', name: 'Example medicine', brand: 'Exact brand', doseAmount: '5', doseUnit: 'mL', schedule: 'At 7 PM', startDate: '2026-10-01', reactionNotes: 'Private detail' },
    { id: 'supp-1', itemType: 'supplement', name: 'Vitamin D', startDate: '2026-10-01' },
    { id: 'old-1', itemType: 'medication', name: 'Old medicine', startDate: '2026-09-01', endDate: '2026-09-30' },
  ];
  const summary = supplements.babysitterSummary({ items, asOfDate: '2026-10-25' });
  assert.match(summary, /Medications:\n- Example medicine \(Exact brand\): 5 mL; At 7 PM/);
  assert.match(summary, /Supplements:\n- Vitamin D: dose not recorded; timing not recorded/);
  assert.doesNotMatch(summary, /Old medicine|Private detail|refill|correlation/i);
  assert.match(summary, /not permission to give a dose/i);
});

test('quick observations become synchronized My Day outcomes', () => {
  const event = supplements.observation({ id: 'event-1', profileId: 'child-1', type: 'eating', occurredAt: '2026-10-20T12:00:00Z', intensity: 3, notes: 'Ate much less than usual', itemId: 'med-1', createdAt: '2026-10-20T12:05:00Z' });
  assert.equal(event.kind, 'dayEvent');
  assert.equal(event.category, 'response');
  assert.equal(event.supplementOutcome, 'eating');
  assert.equal(event.outcome, true);
  assert.equal(event.itemId, 'med-1');
  assert.equal(event.supplementId, 'med-1');
});
