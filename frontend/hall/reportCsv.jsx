// Reports: download what is on the screen as a spreadsheet (CSV).

// day = GET /api/hall/report/day → one row per meal, then the people who turned a meal OFF
function hallDayToCsv(day) {
  const rows = [["Date", "Meal", "Plates", "ON", "Guest plates", "OFF", "Members", "Final", "Feast"]];
  day.slots.forEach((s) => rows.push([day.date, s.label, s.plates, s.on, s.guests, s.off, s.members, s.locked ? "Yes" : "No", s.feast ? s.feast.title : ""]));
  rows.push([]);
  rows.push(["Date", "Meal", "Turned OFF: name", "ID"]);
  day.slots.forEach((s) => (s.offList || []).forEach((p) => rows.push([day.date, s.label, p.name, p.externalId])));
  return "\uFEFF" + rows.map((r) => r.map(hallCsvCell).join(",")).join("\r\n");
}

// range = GET /api/hall/report/range → plates per day and meal
function hallRangeToCsv(range) {
  const rows = [["Date", ...HALL_SLOTS.map((s) => HALL_SLOT_LABEL[s]), "Total"]];
  range.forEach((r) => rows.push([r.date, ...HALL_SLOTS.map((s) => r[s]), r.total]));
  return "\uFEFF" + rows.map((r) => r.map(hallCsvCell).join(",")).join("\r\n");
}

function HallDayCsvButton({ day }) {
  if (!day) return null;
  return <button className="hl-btn sm ghost" title="Download this day as a spreadsheet" onClick={() => hallDownloadFile(`hall-day-${day.date}.csv`, hallDayToCsv(day), "text/csv;charset=utf-8")}>⬇ CSV</button>;
}

function HallRangeCsvButton({ range }) {
  if (!range || !range.length) return null;
  return <button className="hl-btn sm ghost" title="Download these days as a spreadsheet" onClick={() => hallDownloadFile(`hall-plates-${range[0].date}-to-${range[range.length - 1].date}.csv`, hallRangeToCsv(range), "text/csv;charset=utf-8")}>⬇ CSV</button>;
}
