// Reports: print the page, or choose "Save as PDF" in the print window. The top bar, tabs and buttons are hidden while printing.
function HallReportPrintButton() {
  return (
    <>
      <button className="hl-btn sm ghost" title="Print, or choose Save as PDF" onClick={() => window.print()}>🖨 Print</button>
      <style>{HALL_PRINT_CSS}</style>
    </>
  );
}
