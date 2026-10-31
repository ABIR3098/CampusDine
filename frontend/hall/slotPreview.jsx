// Meal times (admin): says in plain words what the cut-off you are typing means.

const HALL_PREVIEW_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ("Lunch", 1, "21:00") → { rule: "Lunch closes at 9:00 PM the day before.", example: "For a Friday lunch, students can change it until Thursday 9:00 PM." }
function hallCutoffSentence(label, daysBefore, time) {
  const d = Number(daysBefore) || 0;
  const clock = hallClockLabel(time);
  const when = d === 0 ? "on the same day" : d === 1 ? "the day before" : `${d} days before`;
  const dayName = HALL_PREVIEW_DAYS[(5 - d + 7) % 7];   // the meal is on a Friday in the example
  return {
    rule: `${label} closes at ${clock} ${when}.`,
    example: `For a Friday ${label.toLowerCase()}, students can change it until ${dayName} ${clock}.`,
  };
}

function HallCutoffPreview({ label, daysBefore, time }) {
  const t = hallCutoffSentence(label, daysBefore, time);
  return (
    <div className="text-xs hl-muted" style={{ marginTop: 6 }}>
      <div><b>{t.rule}</b></div>
      <div>{t.example}</div>
    </div>
  );
}
