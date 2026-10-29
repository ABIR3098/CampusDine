// The alerts that sit at the top of the member Home tab: diet warning, last-call plates, closing-soon reminder and low-wallet warning.
function HallHomeAlerts({ call, goTab, days }) {
  return (
    <>
      <HallDietAlert call={call} goTab={goTab} />
      <HallLastCallBanner call={call} goTab={goTab} />
      <HallCutoffReminder days={days} goTab={goTab} />
      <HallBalanceAlert call={call} goTab={goTab} />
    </>
  );
}
