// "Download CSV" and "Print / PDF" buttons for the My bill tab.
// The CSV is built in the browser from the bill the page already has, so no new API is needed.

// one CSV cell: wrap in quotes when it has a comma, quote or line break
function hallCsvCell(value) {
  const s = String(value == null ? "" : value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// bill = the object returned by GET /api/hall/bill → CSV text (one row per day and meal, then the totals)
function hallBillToCsv(bill) {
  const rows = [["Date", "Meal", "Status", "Meal amount (BDT)", "Guest plates", "Guest amount (BDT)", "Feast", "Price"]];
  bill.days.forEach((d) => {
    HALL_SLOTS.forEach((slot) => {
      const c = d.slots[slot];
      rows.push([d.date, HALL_SLOT_LABEL[slot], String(c.status).toUpperCase(), c.amount, c.guests, c.guestAmount,
        c.feast ? c.feast.title : "", c.locked ? "Confirmed" : "Estimate"]);
    });
  });
  const s = bill.summary;
  rows.push([]);
  rows.push(["Whole month (BDT)", s.total]);
  rows.push(["Confirmed - closed meals (BDT)", s.confirmedTotal]);
  rows.push(["Paid (BDT)", bill.paid]);
  rows.push(["Due now (BDT)", bill.due]);
  rows.push(["Meals ON", s.mealsOn.total]);
  rows.push(["Breakfast ON", s.mealsOn.breakfast]);
  rows.push(["Lunch ON", s.mealsOn.lunch]);
  rows.push(["Dinner ON", s.mealsOn.dinner]);
  rows.push(["Guest plates", s.guestPlates]);
  // the first character makes Excel read the file as UTF-8
  return "\uFEFF" + rows.map((r) => r.map(hallCsvCell).join(",")).join("\r\n");
}

// hands a text file to the browser's download
function hallDownloadFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// printing hides the top bar, tabs and buttons, so the page prints as a clean bill (choose "Save as PDF" in the print window)
const HALL_PRINT_CSS = "@media print { .hl .sticky, .hl .mobile-nav, .hl-strip, .hl button, .hl-toast { display: none !important; } .hl-sec { box-shadow: none !important; } }";

function HallBillActions({ bill, monthName }) {
  const downloadCsv = () => {
    const name = `hall-bill-${bill.year}-${String(bill.month).padStart(2, "0")}.csv`;
    hallDownloadFile(name, hallBillToCsv(bill), "text/csv;charset=utf-8");
  };
  return (
    <>
      <button className="hl-btn sm ghost" onClick={downloadCsv} title={`Download ${monthName} as a spreadsheet file`}>⬇ CSV</button>
      <button className="hl-btn sm ghost" onClick={() => window.print()} title="Print, or choose Save as PDF">🖨 Print</button>
      <style>{HALL_PRINT_CSS}</style>
    </>
  );
}
