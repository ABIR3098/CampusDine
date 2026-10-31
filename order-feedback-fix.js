// order-feedback-fix.js — Checkout always gives feedback: success message with token, errors scroll into view,
// and the location prompt can never freeze the button.
// Run from the project main folder:  node order-feedback-fix.js
const fs = require("fs");
const FILE = "frontend/campusdine.html";

if (!fs.existsSync(FILE)) {
  console.error("Run this from the project's main folder (frontend/campusdine.html not found).");
  process.exit(1);
}

const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("/* Fix: order feedback */")) {
  console.log("Already applied — nothing to do.");
  process.exit(0);
}

function replaceOnce(label, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) {
    console.error(`Patch failed at "${label}" (anchor found ${n} times). File not changed.`);
    process.exit(1);
  }
  s = s.replace(from, () => to);
}

// 1) never wait forever for the browser's location prompt
replaceOnce("location timeout",
`      const deliveryLocation = await new Promise(resolve => {
        if (!navigator.geolocation) return resolve(undefined);`,
`      const deliveryLocation = await new Promise(resolve => {
        /* Fix: order feedback */
        setTimeout(() => resolve(undefined), 2500); // give up on the location after 2.5s
        if (!navigator.geolocation) return resolve(undefined);`);

// 2) keep the server's answer (it has the token)
replaceOnce("keep result",
`      await call("/api/orders", {`,
`      const placed = await call("/api/orders", {`);

// 3) tell the student it worked (with the token); scroll up so success/error banners are seen
replaceOnce("feedback",
`paymentMethod === "wallet" ? refreshWallet() : Promise.resolve()]);
      setTab("track");
    } catch (e) { showError(e); }`,
`paymentMethod === "wallet" ? refreshWallet() : Promise.resolve()]);
      setTab("track");
      showSuccess("✅ Order placed! Your token is " + placed.token + " — you can see it here in the Orders tab.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { showError(e); window.scrollTo({ top: 0, behavior: "smooth" }); }`);

fs.copyFileSync(FILE, FILE + ".bak8");
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Done: checkout now shows 'Order placed' with the token, and errors appear at the top.");
