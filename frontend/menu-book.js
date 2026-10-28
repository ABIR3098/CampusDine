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

  css += `
  /* deep-green leather */
  .cdmb-leather{background-color:#15452a;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .45 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"),linear-gradient(135deg,rgba(130,230,165,.14),rgba(0,0,0,.28))}
  .cdmb-base{position:absolute;top:calc(var(--m)*-1);bottom:calc(var(--m)*-1);transform:translateZ(-4px);transition:opacity .5s;
    box-shadow:0 20px 44px rgba(0,0,0,.65),inset 0 0 0 1px rgba(255,255,255,.08)}
  .cdmb-base.l{left:calc(var(--m)*-1);right:50%;border-radius:14px 2px 2px 14px;box-shadow:-1px 1px 0 #0d3a20,-2px 2px 0 #0a2f1a,-3px 3px 0 #082613,-4px 4px 0 #061d0f,-5px 6px 0 #04160b,-4px 24px 44px rgba(0,0,0,.65)}
  .cdmb-base.r{left:50%;right:calc(var(--m)*-1);border-radius:2px 14px 14px 2px;box-shadow:1px 1px 0 #0d3a20,2px 2px 0 #0a2f1a,3px 3px 0 #082613,4px 4px 0 #061d0f,5px 6px 0 #04160b,4px 24px 44px rgba(0,0,0,.65)}
  .cdmb-base{overflow:hidden}
  .cdmb-base::after{content:"";position:absolute;inset:calc(var(--m)*.32);border:1.5px dashed rgba(210,245,220,.34);border-radius:10px}
  .cdmb-base.l::before,.cdmb-base.r::before{content:"";position:absolute;inset:0;pointer-events:none;background-repeat:no-repeat;background-size:var(--cs) var(--cs)}
  .cdmb-base.l::before{background-image:var(--tl),var(--bl);background-position:0 0,0 100%}
  .cdmb-base.r::before{background-image:var(--tr),var(--br);background-position:100% 0,100% 100%}
  .cdmb-overlay{--gold1:#f6e08e;--gold2:#c9a03a;--gold3:#8a6a1f;
    --tl:linear-gradient(135deg,var(--gold1) 0,var(--gold2) 30%,var(--gold3) 49%,transparent 50%);
    --tr:linear-gradient(225deg,var(--gold1) 0,var(--gold2) 30%,var(--gold3) 49%,transparent 50%);
    --bl:linear-gradient(45deg,var(--gold1) 0,var(--gold2) 30%,var(--gold3) 49%,transparent 50%);
    --br:linear-gradient(315deg,var(--gold1) 0,var(--gold2) 30%,var(--gold3) 49%,transparent 50%);
    --lthr:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .38 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"),
      radial-gradient(ellipse at 30% 20%,rgba(120,220,150,.20),transparent 60%),
      linear-gradient(160deg,#1f6038 0%,#14472a 55%,#0f3820 100%)}
  /* spine: plain ribbed leather hinge + two silver binder rings */
  .cdmb-groove{position:absolute;top:calc(var(--m)*-1);bottom:calc(var(--m)*-1);left:calc(50% - var(--gap)/2);width:var(--gap);
    transform:translateZ(-3px);transition:opacity .5s;overflow:hidden;
    background-color:#0f3d22;
    background-image:
      linear-gradient(90deg,rgba(0,0,0,.72) 0,rgba(0,0,0,.05) 22%,rgba(0,0,0,.35) 50%,rgba(0,0,0,.05) 78%,rgba(0,0,0,.72) 100%),
      repeating-linear-gradient(90deg,rgba(0,0,0,.20) 0 1px,rgba(150,240,180,.06) 1px 3px),
      var(--lthr),
      linear-gradient(180deg,#17603a,#0d3b21 50%,#17603a);
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.05),inset 0 8px 14px rgba(0,0,0,.35),inset 0 -8px 14px rgba(0,0,0,.35)}
  /* rings sit above the pages (like a real ring binder) and drop in after the cover opens */
  .cdmb-ring{position:absolute;left:calc(50% - var(--gap)*1.3);width:calc(var(--gap)*2.6);height:calc(var(--gap)*1.55);margin-top:calc(var(--gap)*-.775);
    transform:translateZ(14px);pointer-events:none;transition:opacity .35s;
    filter:drop-shadow(0 3px 3px rgba(0,0,0,.65)) drop-shadow(0 0 1px rgba(0,0,0,.9))}
  .cdmb-ring svg{display:block;width:100%;height:100%;overflow:visible}
  .cdmb-ring.r1{top:calc(var(--m)*-1 + (var(--h) + var(--m)*2)*.24)}
  .cdmb-ring.r2{top:calc(var(--m)*-1 + (var(--h) + var(--m)*2)*.76)}

  .cdmb-leaf{position:absolute;top:0;left:calc(50% + var(--gap)/2);width:var(--pw);height:100%;transform-origin:left center;transform-style:preserve-3d;
    transition:transform var(--flip,1000ms) cubic-bezier(.645,.045,.355,1)}
  .cdmb-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:#111;
    box-shadow:0 2px 8px rgba(0,0,0,.45)}
  .cdmb-face.b{transform:rotateY(180deg)}
  .cdmb-face img{width:100%;height:100%;object-fit:cover;display:block;user-select:none;-webkit-user-drag:none}

  `;

})();
