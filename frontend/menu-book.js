/*!
 * CampusDine – 3D Leather Menu Book (drop-in overlay)
 * Usage: add <script src="menu-book.js"></script> before </body> of your site.
 * Needs the "images/" folder (menu pages + logo-foil.png) next to this file.
 * Open manually: CampusDineMenuBook.open()  |  or any element with [data-open-menu-book]
 */
(function () {
  if (window.CampusDineMenuBook) return;

  var CFG = Object.assign({
    imageFolder: "images/",
    logo: "logo-engrave.png",
    autoOpen: true,
    oncePerSession: true,
    floatingButton: true,
    thankYou: {                       // last page (edit freely)
      title: "Thank You!",
      bn: "Taste the Freshness",
      chits: [                        // scroll notes that pop in one by one
        "আমাদের সাথে কাটানো সময়টি আপনার জন্য আনন্দদায়ক হোক! - বিদায়, আবার দেখা হবে!",
        "পেট ঠান্ডা তো মাথা ঠান্ডা, পরীক্ষার হলে আমাদের বিরিয়ানির কথা মনে রেখো!",
        "ক্লাস মিস দিলে চলে, কিন্তু বন্ধুদের সাথে আড্ডা আর আমাদের চা মিস দিলে চলে না!"
      ],
      tagline: "Good Food • Better Days"
    },
    pageRatio: 1.5,      // poster height / width
    tilt: 22,            // slope in degrees (0 = flat to the screen)
    pages: [
      "CampusDine_Menu_Book_Poster.webp",   // page 2 (inside of cover): food picture - change to any image
      "CampusDine_Chicken_Favorites.webp",
      "CampusDine_Fast_Food_Menu.webp",
      "CampusDine_Chinese_Food_Menu.webp",
      "Bangladeshi_Food_Menu_Poster.webp",
      "Rice___Biryani_Feast_Menu.webp",
      "CampusDine_Snacks_Menu.webp",
      "CampusDine_Drinks___Beverages_Menu.webp",
      "CampusDine_Dessert_Delights.webp",
      "CampusDine_Combo_Offers_Menu.webp",
      "CampusDine_Fast_Food_Combos.webp"
    ]
  }, window.CampusDineMenuBookConfig || {});

  function url(f) { return /^(https?:|\/|data:)/.test(f) ? f : CFG.imageFolder + f; }
  var ITEMS = [null].concat(CFG.pages.map(url));   // item 0 = green cover
  var PAGE_COUNT = CFG.pages.length;
  var GAP_Z = 0.7, KEY = "cdmb_page3", SEENKEY = "cdmb_seen";
  var LOGO = url(CFG.logo);

  /* ---------- CSS ---------- */
  var css = `
  .cdmb-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;
    background:rgba(6,16,9,.74);backdrop-filter:blur(9px) saturate(.8);-webkit-backdrop-filter:blur(9px) saturate(.8);
    opacity:0;visibility:hidden;transition:opacity .45s,visibility .45s;font-family:inherit;color:#fff}
  .cdmb-overlay.cdmb-open{opacity:1;visibility:visible}
  .cdmb-overlay *{box-sizing:border-box;margin:0;padding:0}
  .cdmb-x{position:absolute;top:18px;right:20px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.35);
    background:rgba(0,0,0,.45);color:#fff;font-size:20px;cursor:pointer;z-index:5}
  .cdmb-x:hover{background:#fff;color:#111}
  .cdmb-stage{perspective:2600px;perspective-origin:50% 35%}
  .cdmb-book{position:relative;width:calc(var(--pw)*2 + var(--gap));height:var(--h);transform-style:preserve-3d;
    transition:transform var(--flip,1000ms) cubic-bezier(.645,.045,.355,1)}
  .cdmb-overlay:not(.cdmb-open) .cdmb-book{opacity:0;transform:translateY(40px) rotateX(5deg) scale(.92)}
  .cdmb-tshadow{position:absolute;left:-2%;right:-2%;bottom:-16px;height:50px;border-radius:50%;
    background:radial-gradient(ellipse,rgba(0,0,0,.8),transparent 70%);filter:blur(12px);transform:translateZ(-8px)}

  `;

})();
