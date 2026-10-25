"use strict";

window.MTMSupplements = (() => {
  const REQUIRED_DAYS = 7;
  const SNAPSHOT_START = "--- MTM supplement summary ---";
  const SNAPSHOT_END = "--- End MTM supplement summary ---";
  const OUTCOMES = Object.freeze({
    reaction: Object.freeze({ label: "Possible reaction", hours: 6 }),
    meltdown: Object.freeze({ label: "Meltdown", hours: 12 }),
    eating: Object.freeze({ label: "Eating change", hours: 12 }),
    behavior: Object.freeze({ label: "Behavior change", hours: 12 }),
    sleep: Object.freeze({ label: "Sleep difficulty", hours: 24 }),
  });

  const dateOnly = (value) => {
    const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  };
  const addDays = (value, days) => {
    const date = dateOnly(value);
    if (!date) return "";
    const parsed = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return "";
    parsed.setUTCDate(parsed.getUTCDate() + Number(days || 0));
    return parsed.toISOString().slice(0, 10);
  };
  const cleanLine = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const time = (entry) => Date.parse(entry?.occurredAt || entry?.createdAt || "");

  function refillDates(supplement) {
    const filled = dateOnly(supplement.lastFilledDate || supplement.startDate);
    const supplyDays = Math.max(1, Math.min(365, Number(supplement.supplyDays) || 30));
    const reminderDays = Math.max(0, Math.min(60, Number.isFinite(Number(supplement.reminderDays)) ? Number(supplement.reminderDays) : 5));
    const dueDate = addDays(filled, supplyDays);
    return { filledDate: filled, supplyDays, reminderDays, dueDate, reminderDate: addDays(dueDate, -reminderDays) };
  }

  function refillState(supplement, today = new Date().toISOString().slice(0, 10)) {
    const current = dateOnly(today), startDate = dateOnly(supplement.startDate), endDate = dateOnly(supplement.endDate);
    const dates = refillDates(supplement);
    if (supplement.active === false) return { ...dates, state: "inactive", label: "Inactive", remind: false };
    if (startDate && current < startDate) return { ...dates, state: "scheduled", label: `Starts ${startDate}`, remind: false };
    if (endDate && current > endDate) return { ...dates, state: "ended", label: `Ended ${endDate}`, remind: false };
    if (!dates.dueDate) return { ...dates, state: "unknown", label: "Add a fill date", remind: false };
    if (endDate && dates.dueDate > endDate) return { ...dates, state: "course-ending", label: `Course ends ${endDate}`, remind: false };
    if (current > dates.dueDate) return { ...dates, state: "overdue", label: `Refill was due ${dates.dueDate}`, remind: true };
    if (current === dates.dueDate) return { ...dates, state: "due", label: "Refill due today", remind: true };
    if (current >= dates.reminderDate) return { ...dates, state: "soon", label: `Refill due ${dates.dueDate}`, remind: true };
    return { ...dates, state: "current", label: `Refill due ${dates.dueDate}`, remind: false };
  }

  function outcomeType(event) {
    if (OUTCOMES[event?.supplementOutcome]) return event.supplementOutcome;
    const label = cleanLine(event?.label).toLocaleLowerCase();
    if (event?.bubbleId === "meltdown" || label.includes("meltdown")) return "meltdown";
    if (event?.category === "sleepOutcome") return "sleep";
    if (event?.category === "behavior") return "behavior";
    if (event?.category === "response") return "reaction";
    return null;
  }

  function matchesWithin(log, observations, outcome) {
    const start = time(log), end = start + OUTCOMES[outcome].hours * 3600000;
    return observations.some((event) => event.profileId === log.profileId && outcomeType(event) === outcome && time(event) >= start && time(event) <= end);
  }

  function analyze(supplements, doseLogs, observations) {
    const takenLogs = (doseLogs || []).filter((log) => log.kind === "supplementDose" && ["taken", "missed", "skipped"].includes(log.status) && Number.isFinite(time(log)));
    const embeddedReactions = takenLogs.filter((log) => cleanLine(log.reactionNotes)).map((log) => ({ profileId: log.profileId, supplementOutcome: "reaction", occurredAt: log.reactionAt || log.occurredAt }));
    const events = [...(observations || []), ...embeddedReactions].filter((event) => Number.isFinite(time(event)) && outcomeType(event));
    return {
      requiredDays: REQUIRED_DAYS,
      supplements: (supplements || []).map((supplement) => {
        const logs = takenLogs.filter((log) => log.supplementId === supplement.id && log.profileId === supplement.profileId),
          taken = logs.filter((log) => log.status === "taken"),
          comparison = logs.filter((log) => log.status !== "taken"),
          days = new Set(logs.map((log) => dateOnly(log.occurredAt))).size,
          ready = days >= REQUIRED_DAYS && taken.length >= 3,
          patterns = [];
        for (const outcome of Object.keys(OUTCOMES)) {
          const takenMatches = taken.filter((log) => matchesWithin(log, events, outcome)).length,
            comparisonMatches = comparison.filter((log) => matchesWithin(log, events, outcome)).length,
            takenRate = taken.length ? takenMatches / taken.length : 0,
            comparisonRate = comparison.length ? comparisonMatches / comparison.length : null;
          if (!ready || (takenMatches < 2 && !(comparison.length >= 3 && Math.abs(takenRate - comparisonRate) >= .25))) continue;
          const overlapCount = taken.filter((log) => takenLogs.some((other) => other.status === "taken" && other.profileId === log.profileId && other.supplementId !== log.supplementId && Math.abs(time(other) - time(log)) <= OUTCOMES[outcome].hours * 3600000)).length;
          patterns.push({
            outcome,
            label: OUTCOMES[outcome].label,
            hours: OUTCOMES[outcome].hours,
            takenMatches,
            takenTotal: taken.length,
            comparisonMatches,
            comparisonTotal: comparison.length,
            overlapCount,
          });
        }
        patterns.sort((a, b) => b.takenMatches / b.takenTotal - a.takenMatches / a.takenTotal || b.takenMatches - a.takenMatches);
        return { supplementId: supplement.id, name: supplement.name, profileId: supplement.profileId, days, ready, takenTotal: taken.length, comparisonTotal: comparison.length, patterns };
      }),
    };
  }

  function stripAppointmentSnapshot(notes) {
    const text = String(notes || ""), start = text.indexOf(SNAPSHOT_START);
    if (start < 0) return text.trim();
    const end = text.indexOf(SNAPSHOT_END, start);
    return `${text.slice(0, start)}${end < 0 ? "" : text.slice(end + SNAPSHOT_END.length)}`.trim();
  }

  function appointmentSummary({ profileName, supplements, doseLogs, analysis, appointmentDate }) {
    const date = dateOnly(appointmentDate) || new Date().toISOString().slice(0, 10), logs = doseLogs || [];
    const active = (supplements || []).filter((item) => item.active !== false && (!item.startDate || date >= item.startDate) && (!item.endDate || date <= item.endDate));
    const lines = [`Child: ${cleanLine(profileName) || "Child"}`, `Prepared for: ${date}`];
    if (!active.length) lines.push("Active supplements: None recorded.");
    else {
      lines.push("Active supplements:");
      for (const item of active) {
        const parts = [cleanLine(item.name)];
        if (item.brand) parts[0] += ` (${cleanLine(item.brand)})`;
        const dose = [cleanLine(item.doseAmount), cleanLine(item.doseUnit)].filter(Boolean).join(" ");
        if (dose) parts.push(dose);
        if (item.schedule) parts.push(cleanLine(item.schedule));
        parts.push(`started ${dateOnly(item.startDate) || "not recorded"}`);
        if (item.endDate) parts.push(`ends ${dateOnly(item.endDate)}`);
        const refill = refillState(item, date);
        if (refill.dueDate && refill.state !== "course-ending") parts.push(`refill due ${refill.dueDate}`);
        lines.push(`- ${parts.join("; ")}`);
      }
    }
    const recentCutoff = Date.parse(`${addDays(date, -30)}T00:00:00Z`), recent = logs.filter((log) => log.kind === "supplementDose" && log.reactionNotes && time(log) >= recentCutoff && time(log) <= Date.parse(`${date}T23:59:59Z`));
    lines.push("Recent possible reactions (past 30 days):");
    if (!recent.length) lines.push("- None recorded.");
    else for (const log of recent.slice(-8)) lines.push(`- ${dateOnly(log.occurredAt)}: ${cleanLine(log.supplementName)} — ${cleanLine(log.reactionNotes)}${log.reactionSeverity ? ` (severity ${log.reactionSeverity}/5)` : ""}`);
    const patterns = (analysis?.supplements || []).flatMap((item) => item.patterns.map((pattern) => ({ ...pattern, supplementName: item.name }))).slice(0, 5);
    lines.push("Possible recorded patterns:");
    if (!patterns.length) lines.push("- No pattern meets the display threshold yet.");
    else for (const pattern of patterns) lines.push(`- ${cleanLine(pattern.label)} followed ${cleanLine(pattern.supplementName)} within ${pattern.hours} hours on ${pattern.takenMatches} of ${pattern.takenTotal} recorded taken doses.${pattern.overlapCount ? " Other supplements overlapped with some observations." : ""}`);
    lines.push("These are recorded associations, not proof that a supplement caused a change. Review doses, products, timing, medicines, diet, illness, and symptoms with the clinician or pharmacist.");
    return lines.join("\n");
  }

  function mergeAppointmentNotes(notes, summary) {
    const base = stripAppointmentSnapshot(notes);
    return `${base}${base ? "\n\n" : ""}${SNAPSHOT_START}\n${String(summary || "").trim()}\n${SNAPSHOT_END}`;
  }

  function observation({ id, profileId, type, occurredAt, intensity, notes, supplementId, createdAt }) {
    if (!OUTCOMES[type]) throw new Error("Choose an observation type.");
    const category = type === "sleep" ? "sleepOutcome" : ["meltdown", "behavior"].includes(type) ? "behavior" : "response";
    return {
      id,
      kind: "dayEvent",
      profileId,
      bubbleId: `supplement-${type}`,
      label: OUTCOMES[type].label,
      emoji: type === "sleep" ? "🌘" : type === "meltdown" ? "🌋" : type === "eating" ? "🍽️" : type === "behavior" ? "🧠" : "⚠️",
      category,
      outcome: true,
      responseWindowHours: OUTCOMES[type].hours,
      supplementOutcome: type,
      supplementId: supplementId || null,
      occurredAt,
      intensity: Number(intensity) || null,
      notes: cleanLine(notes),
      createdAt,
      updatedAt: createdAt,
      syncStatus: "local",
    };
  }

  return { OUTCOMES, REQUIRED_DAYS, SNAPSHOT_START, SNAPSHOT_END, addDays, refillDates, refillState, analyze, appointmentSummary, stripAppointmentSnapshot, mergeAppointmentNotes, observation };
})();
