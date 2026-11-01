// CampusDine: Modular Multi-Gateway Payment Modal (bKash / Nagad / Rocket / Upay)
(function () {
  const { useState } = React;

  function PaymentGatewayModal({ amount = 150, order, onSuccess, onClose }) {
    const [gateway, setGateway] = useState("bkash");
    const [step, setStep] = useState(1); // 1: mobile, 2: otp, 3: success
    const [mobile, setMobile] = useState("01712345678");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [trxId, setTrxId] = useState("");

    const gateways = [
      { id: "bkash", name: "bKash", color: "from-pink-600 to-rose-600", activeBg: "bg-pink-600", icon: "📱" },
      { id: "nagad", name: "Nagad", color: "from-orange-500 to-amber-600", activeBg: "bg-orange-500", icon: "⚡" },
      { id: "rocket", name: "Rocket", color: "from-purple-600 to-indigo-700", activeBg: "bg-purple-600", icon: "🚀" }
    ];

    const handleSendOtp = () => {
      if (!mobile || mobile.length < 11) {
        alert("Please enter a valid 11-digit mobile number");
        return;
      }
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStep(2);
      }, 700);
    };

    const handleConfirmPayment = () => {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        const generated = (gateway.toUpperCase().slice(0, 3)) + "-" + Date.now().toString().slice(-6);
        setTrxId(generated);
        setStep(3);
        if (window.CDComponents && window.CDComponents.AudioPlayer) {
          window.CDComponents.AudioPlayer.play("win");
        }
        if (onSuccess) {
          onSuccess({ gateway, trxId: generated, amount });
        }
      }, 1200);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in font-sans">
        <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-slate-900 dark:text-white">
          {/* Header Banner */}
          <div className={"p-5 text-white bg-gradient-to-r " + (gateways.find(g => g.id === gateway)?.color || "from-pink-600 to-rose-600")}>
            <div className="flex items-center justify-between">
              <span className="font-display font-black text-lg flex items-center gap-2">
                <span>{gateways.find(g => g.id === gateway)?.icon}</span>
                <span>{gateways.find(g => g.id === gateway)?.name} Payment</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-white/80 hover:text-white rounded-full bg-black/20"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex justify-between items-baseline">
              <span className="text-xs text-white/80 font-semibold">Payable Amount:</span>
              <span className="font-mono font-black text-2xl">৳{amount}</span>
            </div>
          </div>

          {/* Gateway Switcher Tabs */}
          {step === 1 && (
            <div className="flex border-b border-slate-100 dark:border-slate-800 p-2 gap-1.5 bg-slate-50 dark:bg-slate-800/40">
              {gateways.map((gw) => (
                <button
                  key={gw.id}
                  type="button"
                  onClick={() => setGateway(gw.id)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    gateway === gw.id
                      ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {gw.name}
                </button>
              ))}
            </div>
          )}

          {/* Body Content */}
          <div className="p-5 space-y-4">
            {step === 1 && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Enter your {gateway.toUpperCase()} Account Number:
                </label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-base font-bold outline-none focus:ring-2 focus:ring-pink-500/30"
                />
                <p className="text-[11px] text-slate-400">
                  Demo Sandbox: Use any 11-digit mobile number to simulate payment.
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSendOtp}
                  className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-950 font-bold text-sm transition-all flex items-center justify-center gap-2 shadow"
                >
                  {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                  <span>Proceed with OTP</span>
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Enter 6-digit OTP sent to {mobile}:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full px-4 py-3 text-center tracking-widest rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xl font-black outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>Demo OTP: <b>123456</b></span>
                  <button type="button" onClick={() => setOtp("123456")} className="text-emerald-500 font-bold hover:underline">
                    Auto-Fill OTP
                  </button>
                </div>
                <button
                  type="button"
                  disabled={loading || !otp}
                  onClick={handleConfirmPayment}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow"
                >
                  {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>Confirm ৳{amount} Payment</span>
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="text-center py-2 space-y-3 animate-fade-in">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-2xl text-emerald-600">
                  ✓
                </div>
                <h4 className="font-display font-black text-lg text-emerald-600 dark:text-emerald-400">
                  Payment Successful!
                </h4>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Transaction ID:</span>
                    <span className="font-mono font-bold">{trxId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gateway:</span>
                    <span className="font-bold uppercase">{gateway}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount Paid:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">৳{amount}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.PaymentGatewayModal = PaymentGatewayModal;
})();
