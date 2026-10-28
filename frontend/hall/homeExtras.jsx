// The alerts that sit at the top of the member Home tab: closing-soon reminder and low-wallet warning.
function HallHomeAlerts({ call, goTab, days }) {
  return (
    <>
      <HallCutoffReminder days={days} goTab={goTab} />
      <HallBalanceAlert call={call} goTab={goTab} />
    </>
  );
}
