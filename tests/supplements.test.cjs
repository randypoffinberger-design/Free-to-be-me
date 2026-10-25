const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'supplements.js'), 'utf8'), context);
const supplements = context.window.MTMSupplements;

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

test('possible patterns require seven recorded days and keep missed-dose comparison', () => {
  const item = { id: 'supp-1', profileId: 'child-1', name: 'Example supplement' };
  const logs = Array.from({ length: 10 }, (_, index) => ({
    id: `dose-${index}`,
    kind: 'supplementDose',
    supplementId: item.id,
    supplementName: item.name,
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

test('overlapping supplements are surfaced as a confounder', () => {
  const first = { id: 'a', profileId: 'child-1', name: 'A' }, second = { id: 'b', profileId: 'child-1', name: 'B' };
  const logs = [];
  const events = [];
  for (let day = 1; day <= 7; day++) {
    const date = String(day).padStart(2, '0');
    logs.push({ id: `a-${day}`, kind: 'supplementDose', supplementId: 'a', profileId: 'child-1', status: 'taken', occurredAt: `2026-10-${date}T08:00:00Z` });
    logs.push({ id: `b-${day}`, kind: 'supplementDose', supplementId: 'b', profileId: 'child-1', status: 'taken', occurredAt: `2026-10-${date}T08:30:00Z` });
    if (day <= 3) events.push({ id: `r-${day}`, profileId: 'child-1', supplementOutcome: 'reaction', occurredAt: `2026-10-${date}T09:00:00Z` });
  }
  const pattern = supplements.analyze([first, second], logs, events).supplements[0].patterns[0];
  assert.equal(pattern.overlapCount, 7);
});

test('doctor appointment summary can be refreshed without duplicating old snapshots', () => {
  const item = { id: 'supp-1', profileId: 'child-1', name: 'Vitamin D', brand: 'Example', doseAmount: '1', doseUnit: 'drop', schedule: 'Each morning', startDate: '2026-10-01', supplyDays: 30, reminderDays: 5 };
  const doseLogs = [{ kind: 'supplementDose', profileId: 'child-1', supplementName: 'Vitamin D', occurredAt: '2026-10-10T08:00:00Z', reactionNotes: 'Brief rash', reactionSeverity: 2 }];
  const summary = supplements.appointmentSummary({ profileName: 'Sam', supplements: [item], doseLogs, analysis: { supplements: [] }, appointmentDate: '2026-10-20' });
  assert.match(summary, /Vitamin D \(Example\); 1 drop; Each morning/);
  assert.match(summary, /refill due 2026-10-31/);
  assert.match(summary, /Brief rash \(severity 2\/5\)/);
  assert.match(summary, /recorded associations, not proof/);
  const first = supplements.mergeAppointmentNotes('Bring lab report.', summary);
  const second = supplements.mergeAppointmentNotes(first, summary.replace('2026-10-20', '2026-10-21'));
  assert.equal((second.match(/--- MTM supplement summary ---/g) || []).length, 1);
  assert.match(second, /^Bring lab report\./);
  assert.match(second, /2026-10-21/);
});

test('quick observations become synchronized My Day outcomes', () => {
  const event = supplements.observation({ id: 'event-1', profileId: 'child-1', type: 'eating', occurredAt: '2026-10-20T12:00:00Z', intensity: 3, notes: 'Ate much less than usual', supplementId: 'supp-1', createdAt: '2026-10-20T12:05:00Z' });
  assert.equal(event.kind, 'dayEvent');
  assert.equal(event.category, 'response');
  assert.equal(event.supplementOutcome, 'eating');
  assert.equal(event.outcome, true);
  assert.equal(event.supplementId, 'supp-1');
});
