// Quote every cell AND neutralise spreadsheet formula injection: a menu item
// or name starting with = + - @ would otherwise execute when opened in Excel.
const cell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
const toCsv = (header, rows) => [header.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n");
module.exports = { cell, toCsv };
