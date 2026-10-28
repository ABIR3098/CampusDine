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

  css += `
  /* full-green covers (must beat .cdmb-face background:#111) */
  .cdmb-face.cv.cdmb-leather{background-color:#1a5230;background-image:var(--lthr)}
  .cdmb-face.f.cv.cdmb-leather{background-image:var(--tr),var(--br),var(--lthr);background-position:100% 0,100% 100%,0 0,0 0,0 0;
    background-size:var(--cs) var(--cs),var(--cs) var(--cs),220px 220px,auto,auto;background-repeat:no-repeat,no-repeat,repeat,no-repeat,no-repeat}
  .cdmb-face.b.cv.cdmb-leather{background-image:var(--tl),var(--bl),var(--lthr);background-position:0 0,0 100%,0 0,0 0,0 0;
    background-size:var(--cs) var(--cs),var(--cs) var(--cs),220px 220px,auto,auto;background-repeat:no-repeat,no-repeat,repeat,no-repeat,no-repeat}
  .cdmb-face.cv{box-shadow:none;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .cdmb-face.f.cv{inset:calc(var(--m)*-1) calc(var(--m)*-1) calc(var(--m)*-1) calc(var(--gap)/-2);border-radius:2px 14px 14px 2px}
  .cdmb-face.b.cv{inset:calc(var(--m)*-1) calc(var(--gap)/-2) calc(var(--m)*-1) calc(var(--m)*-1);border-radius:14px 2px 2px 14px}
  .cdmb-face.cv::before{content:"";position:absolute;inset:calc(var(--m)*.32);border:1.5px dashed rgba(210,245,220,.30);border-radius:10px;pointer-events:none}
  .cdmb-face.cv::after{content:"";position:absolute;inset:0;pointer-events:none;
    background:linear-gradient(to right,rgba(0,0,0,.35),transparent 10%),linear-gradient(125deg,rgba(255,255,255,.07),transparent 40%)}
  .cdmb-face.b.cv::after{background:linear-gradient(to left,rgba(0,0,0,.35),transparent 10%),linear-gradient(235deg,rgba(255,255,255,.07),transparent 40%)}
  .cdmb-emboss{position:relative;display:flex;flex-direction:column;align-items:center;gap:6%;width:100%;text-align:center}
  .cdmb-emboss img{width:74%;max-width:400px;display:block;opacity:.88;
    filter:brightness(.55) drop-shadow(0 1.5px 0 rgba(170,240,195,.20)) drop-shadow(0 -1px 1px rgba(0,0,0,.75))}
  .cdmb-emboss .t{font-family:Georgia,"Times New Roman",serif;font-weight:400;letter-spacing:.6em;padding-left:.6em;
    font-size:clamp(1rem,2.2vw,1.7rem);color:rgba(60,115,80,.85);
    text-shadow:0 -1px 1px rgba(0,0,0,.7),0 1.5px 0 rgba(170,240,195,.22)}
  .cdmb-emboss.sm img{width:40%}
  `;

  css += `
  /* thank-you page (last page) */
  .cdmb-face.ty{container-type:inline-size;background:radial-gradient(ellipse at 50% 26%,#1f2a22,#0c0f0d 72%);overflow:hidden}
  .cdmb-ty{position:relative;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;
    text-align:center;padding:6.5cqw 8cqw;gap:2.3cqw;color:#f4efd8}
  .cdmb-ty::before{content:"";position:absolute;inset:3cqw;border:.45cqw solid #e0b43a;border-radius:2.4cqw;pointer-events:none}
  .cdmb-ty::after{content:"";position:absolute;inset:4.4cqw;border:.2cqw solid rgba(224,180,58,.45);border-radius:1.6cqw;pointer-events:none}
  .cdmb-ty>*{opacity:0}
  .cdmb-ty>.chits,.cdmb-ty>.sp,.cdmb-ty>.orn{opacity:1}
  .cdmb-ty .orn{position:absolute;width:23cqw;height:23cqw;pointer-events:none;z-index:0}
  .cdmb-ty .orn.tl{left:3.4cqw;top:3.4cqw}.cdmb-ty .orn.tr{right:3.4cqw;top:3.4cqw;transform:scaleX(-1)}
  .cdmb-ty .orn.bl{left:3.4cqw;bottom:3.4cqw;transform:scaleY(-1)}.cdmb-ty .orn.br{right:3.4cqw;bottom:3.4cqw;transform:scale(-1,-1)}
  .cdmb-ty img{position:relative;width:19cqw;height:auto;display:block;filter:drop-shadow(0 .6cqw 1.2cqw rgba(0,0,0,.6))}
  .cdmb-ty .tt{position:relative;font-family:"Brush Script MT","Segoe Script","Snell Roundhand","Comic Sans MS",cursive;font-size:12cqw;line-height:1;color:#ffc61a;
    text-shadow:0 .6cqw 0 rgba(0,0,0,.45);white-space:nowrap}
  .cdmb-ty .bn{position:relative;font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:5.6cqw;font-weight:700;letter-spacing:.06em;color:#8fd19e;text-shadow:0 .4cqw 0 rgba(0,0,0,.4)}
  .cdmb-ty .chits{position:relative;display:flex;flex-direction:column;gap:3.4cqw;width:100%;align-items:center;margin-top:1.4cqw}
  .cdmb-ty .chit{position:relative;width:68cqw;align-self:flex-start;margin-left:9cqw;padding:3.6cqw 6cqw;color:#35260f;text-align:center;opacity:0;
    font-family:"Noto Sans Bengali","Hind Siliguri","Nirmala UI",Vrinda,sans-serif;font-size:3.9cqw;line-height:1.45;font-weight:600;
    background:linear-gradient(180deg,#f4e6b8,#e8d29a 60%,#dcc384);box-shadow:0 1cqw 2cqw rgba(0,0,0,.5),inset 0 0 3cqw rgba(140,100,30,.28)}
  .cdmb-ty .chit:nth-child(2){width:78cqw;align-self:center;margin-left:0}
  .cdmb-ty .chit::before,.cdmb-ty .chit::after{content:"";position:absolute;top:-.9cqw;bottom:-.9cqw;width:4.6cqw;border-radius:2.3cqw/50%;
    background:linear-gradient(90deg,#8a6a2c,#ecd89f 38%,#c8a65a 70%,#7d5f24);box-shadow:0 .4cqw .8cqw rgba(0,0,0,.4)}
  .cdmb-ty .chit::before{left:-2.3cqw}.cdmb-ty .chit::after{right:-2.3cqw}
  .cdmb-ty .chit .pin{position:absolute;top:-2.3cqw;left:50%;width:4.2cqw;height:4.2cqw;margin-left:-2.1cqw;border-radius:50%;z-index:2;
    background:radial-gradient(circle at 35% 30%,#fff2b8,#e0b43a 45%,#8a6a1f);box-shadow:0 .7cqw 1cqw rgba(0,0,0,.5)}
  .cdmb-ty .chit .deco{position:absolute;right:-15cqw;bottom:-4.5cqw;width:20cqw;height:auto;z-index:3;filter:drop-shadow(0 .6cqw .8cqw rgba(0,0,0,.45));pointer-events:none}
  .cdmb-ty .chit:nth-child(1){--r:-.8deg}.cdmb-ty .chit:nth-child(2){--r:.6deg}.cdmb-ty .chit:nth-child(3){--r:-.5deg}
  .cdmb-ty .hr{position:relative;font-size:5.5cqw;color:#e0302d;line-height:1}
  .cdmb-ty .tg{position:relative;font-family:Georgia,serif;font-style:italic;font-weight:700;font-size:3.6cqw;letter-spacing:.1em;color:#ffc61a}
  .cdmb-ty .sp{position:absolute;color:#ffc61a;font-size:3.4cqw;opacity:0;pointer-events:none}

  /* thank-you animations (start when the page is opened) */
  .cdmb-face.ty.on .cdmb-ty img{animation:cdTyPop .9s cubic-bezier(.2,1.5,.4,1) .9s both}
  .cdmb-face.ty.on .cdmb-ty .tt{animation:cdTyWipe 1.1s steps(14,end) 1.5s both,cdTyGlow 3s ease-in-out 2.8s infinite}
  .cdmb-face.ty.on .cdmb-ty .bn{animation:cdTyUp .7s ease-out 2.5s both}
  .cdmb-face.ty.on .cdmb-ty .orn{animation:cdTyFade 1s ease-out .8s both}
  .cdmb-face.ty.on .cdmb-ty .chit{animation:cdTyChit .7s cubic-bezier(.2,1.35,.4,1) both,cdTyFloat 5s ease-in-out infinite}
  .cdmb-face.ty.on .cdmb-ty .chit:nth-child(1){animation-delay:3.1s,4s}
  .cdmb-face.ty.on .cdmb-ty .chit:nth-child(2){animation-delay:3.9s,5s}
  .cdmb-face.ty.on .cdmb-ty .chit:nth-child(3){animation-delay:4.7s,6s}
  .cdmb-face.ty.on .cdmb-ty .hr{animation:cdTyUp .6s ease-out 5.5s both,cdTyBeat 1.3s ease-in-out 6.2s infinite}
  .cdmb-face.ty.on .cdmb-ty .tg{animation:cdTyUp .8s ease-out 5.8s both}
  .cdmb-face.ty.on .cdmb-ty .sp{animation:cdTyTwinkle 2.6s ease-in-out infinite}
  @keyframes cdTyPop{from{opacity:0;transform:scale(.3) rotate(-25deg)}to{opacity:1;transform:none}}
  @keyframes cdTyWipe{from{opacity:1;clip-path:inset(0 100% 0 0)}to{opacity:1;clip-path:inset(0 0 0 0)}}
  @keyframes cdTyGlow{0%,100%{text-shadow:0 .6cqw 0 rgba(0,0,0,.45),0 0 0 rgba(255,198,26,0)}50%{text-shadow:0 .6cqw 0 rgba(0,0,0,.45),0 0 3cqw rgba(255,198,26,.65)}}
  @keyframes cdTyFade{from{opacity:0}to{opacity:1}}
  @keyframes cdTyUp{from{opacity:0;transform:translateY(3cqw)}to{opacity:1;transform:none}}
  @keyframes cdTyGrow{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:none}}
  @keyframes cdTyChit{from{opacity:0;transform:translateY(14cqw) rotate(calc(var(--r)*4)) scale(.6)}to{opacity:1;transform:rotate(var(--r))}}
  @keyframes cdTyFloat{0%,100%{opacity:1;transform:rotate(var(--r)) translateY(0)}50%{opacity:1;transform:rotate(calc(var(--r)*-.6)) translateY(-.9cqw)}}
  @keyframes cdTyBeat{0%,100%{opacity:1;transform:scale(1)}15%{opacity:1;transform:scale(1.35)}30%{opacity:1;transform:scale(1)}45%{opacity:1;transform:scale(1.2)}}
  @keyframes cdTyTwinkle{0%,100%{opacity:0;transform:scale(.4) rotate(0)}50%{opacity:1;transform:scale(1.2) rotate(90deg)}}
  @media (prefers-reduced-motion:reduce){.cdmb-face.ty.on .cdmb-ty *{animation-duration:.01s!important;animation-delay:0s!important;animation-iteration-count:1!important}}
  `;

  css += `
  /* page thickness + soft shade near the spine */
  .cdmb-stack{position:absolute;top:0;height:100%;width:var(--pw);background:#e8e2cc;transform:translateZ(-2px);transition:opacity .5s}
  .cdmb-stack.l{left:calc(50% - var(--gap)/2 - var(--pw))}
  .cdmb-stack.r{left:calc(50% + var(--gap)/2)}
  .cdmb-face.pg::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(to right,rgba(0,0,0,.42),rgba(0,0,0,0) 9%)}
  .cdmb-face.pg.b::after{background:linear-gradient(to left,rgba(0,0,0,.42),rgba(0,0,0,0) 9%)}

  .cdmb-zone{position:absolute;top:0;bottom:0;width:calc(50% - var(--gap)/2);cursor:pointer;transform:translateZ(60px)}
  .cdmb-zone.l{left:0}.cdmb-zone.r{right:0}
  .cdmb-nav{position:absolute;top:50%;margin-top:-28px;width:56px;height:56px;border-radius:50%;border:1px solid rgba(255,255,255,.35);
    background:rgba(0,0,0,.5);color:#fff;font-size:24px;cursor:pointer;z-index:5;display:flex;align-items:center;justify-content:center}
  .cdmb-nav:hover:not(:disabled){background:#fff;color:#15452a}
  .cdmb-nav:disabled{opacity:.25;cursor:default}
  .cdmb-nav.p{left:20px}.cdmb-nav.n{right:20px}
  .cdmb-closebook{position:absolute;right:20px;top:50%;margin-top:-26px;z-index:5;display:none;cursor:pointer;
    border:0;border-radius:999px;padding:15px 24px;font-weight:700;font-size:1rem;background:#ffc61a;color:#1a1a1a;
    box-shadow:0 8px 24px rgba(255,198,26,.35);transition:transform .2s}
  .cdmb-closebook:hover{transform:scale(1.05)}
  .cdmb-label{display:none;position:absolute;bottom:5px;line-height:1;left:0;right:0;text-align:center;font-size:.8rem;text-shadow:0 1px 3px #000;opacity:.9}
  .cdmb-fab{position:fixed;left:18px;bottom:18px;z-index:2147482000;border:0;border-radius:999px;padding:12px 20px;cursor:pointer;
    background:#15452a;color:#fff;font-weight:700;box-shadow:0 8px 22px rgba(0,0,0,.35)}
  .cdmb-fab:hover{background:#17623a}
  @media(max-width:700px){.cdmb-nav{width:44px;height:44px;font-size:18px}.cdmb-nav.p{left:6px}.cdmb-nav.n{right:6px}
    .cdmb-closebook{right:6px;padding:11px 14px;font-size:.85rem}}
  `;
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---------- DOM ---------- */
  var overlay = document.createElement("div");
  overlay.className = "cdmb-overlay"; overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML =
    '<button class="cdmb-x" aria-label="Close">✕</button>' +
    '<div class="cdmb-stage"><div class="cdmb-book"></div></div>' +
    '<button class="cdmb-nav p" aria-label="Previous page">❮</button>' +
    '<button class="cdmb-nav n" aria-label="Next page">❯</button>' +
    '<button class="cdmb-closebook">Close Book ✕</button>' +
    '<div class="cdmb-label"></div>';
  document.body.appendChild(overlay);

  var book = overlay.querySelector(".cdmb-book");
  var btnPrev = overlay.querySelector(".cdmb-nav.p"), btnNext = overlay.querySelector(".cdmb-nav.n");
  var btnClose = overlay.querySelector(".cdmb-closebook"), label = overlay.querySelector(".cdmb-label");

  overlay.style.setProperty("--flip", "0ms");
  var pairs = [];
  for (var i = 0; i < ITEMS.length; i += 2) pairs.push([ITEMS[i], i + 1 < ITEMS.length ? ITEMS[i + 1] : undefined]);
  if (ITEMS.length % 2 === 0) pairs.push(["__blank__", undefined]);   // endpaper + back cover
  var N = pairs.length;
  var lastCur = N - 1;
  var cur = 0, busy = false, openTimer = null;   // always starts on the closed cover

  book.innerHTML = '<div class="cdmb-tshadow"></div>' +
    '<div class="cdmb-base l cdmb-leather"></div><div class="cdmb-base r cdmb-leather"></div><div class="cdmb-groove"></div>' +
    '<div class="cdmb-stack l"></div><div class="cdmb-stack r"></div>';
  var RING = '<svg viewBox="0 0 100 60"><defs><linearGradient id="cdSv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#c9ced4"/><stop offset=".6" stop-color="#7f858c"/><stop offset="1" stop-color="#e9edf1"/></linearGradient>' +
    '<radialGradient id="cdEy" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#b4bac1"/><stop offset="1" stop-color="#5d636a"/></radialGradient></defs>' +
    '<ellipse cx="50" cy="30" rx="43" ry="22" fill="none" stroke="#3b4046" stroke-width="9.5"/>' +
    '<ellipse cx="50" cy="30" rx="43" ry="22" fill="none" stroke="url(#cdSv)" stroke-width="7"/>' +
    '<path d="M16 17C26 8 74 8 84 17" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.8" stroke-linecap="round"/>' +
    '<rect x="44" y="5" width="12" height="9" rx="2" fill="url(#cdEy)" stroke="#4c5258" stroke-width=".8"/>' +
    '<circle cx="9" cy="33" r="5.2" fill="url(#cdEy)" stroke="#43484e" stroke-width="1"/><circle cx="9" cy="33" r="2" fill="#15191c"/>' +
    '<circle cx="91" cy="33" r="5.2" fill="url(#cdEy)" stroke="#43484e" stroke-width="1"/><circle cx="91" cy="33" r="2" fill="#15191c"/></svg>';
  book.innerHTML = book.innerHTML.split("%RING%").join(RING);
  var ringEls = book.querySelectorAll(".cdmb-ring");
  var stackL = book.querySelector(".cdmb-stack.l"), stackR = book.querySelector(".cdmb-stack.r");
  function stackShadow(n, dir) {
    if (n <= 0) return "none";
    var parts = [];
    for (var i = 1; i <= n; i++) parts.push((dir * i) + "px " + (i * 0.9).toFixed(1) + "px 0 " + (i % 2 ? "#e9e3cd" : "#c7c0a6"));
    parts.push((dir * (n + 3)) + "px " + (n + 8) + "px 18px rgba(0,0,0,.45)");
    return parts.join(",");
  }
  var baseL = book.querySelector(".cdmb-base.l"), baseR = book.querySelector(".cdmb-base.r"), groove = book.querySelector(".cdmb-groove");

  function pageFace(src, side) {
    if (src === "__blank__") {
      var T = CFG.thankYou, b = document.createElement("div"); b.className = "cdmb-face pg ty " + side;
      var sp = [[12,16,.2],[84,12,1.1],[10,60,2],[88,50,.6],[14,86,1.5],[82,88,2.2]].map(function (q) {
        return '<span class="sp" style="left:' + q[0] + '%;top:' + q[1] + '%;animation-delay:' + (q[2] + 3) + 's">✦</span>'; }).join("");
      var ORN = '<svg class="orn %C%" viewBox="0 0 100 100" fill="none" stroke="#e0b43a" stroke-width="1.5" stroke-linecap="round"><path d="M3 44V10Q3 3 10 3H44"/><path d="M10 10C34 8 46 22 38 34C32 42 20 37 24 29C27 24 34 27 32 31"/><path d="M10 10C8 34 22 46 34 38C42 32 37 20 29 24C24 27 27 34 31 31"/><path d="M40 8C54 6 62 12 66 20M8 40C6 54 12 62 20 66"/><circle cx="68" cy="22" r="1.8" fill="#e0b43a"/><circle cx="22" cy="68" r="1.8" fill="#e0b43a"/><path d="M46 14C52 20 52 26 48 30C44 26 43 20 46 14ZM14 46C20 52 26 52 30 48C26 44 20 43 14 46Z" fill="rgba(224,180,58,.25)"/></svg>';
      var DECO = '<svg class="deco" viewBox="0 0 150 120"><g stroke="#4a3719" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">' +
        '<path d="M70 30C60 14 74 12 66 2" fill="none" stroke="rgba(244,230,184,.7)"/><path d="M84 32C76 18 90 14 82 6" fill="none" stroke="rgba(244,230,184,.7)"/>' +
        '<ellipse cx="82" cy="108" rx="62" ry="10" fill="#efe0b0"/><ellipse cx="82" cy="106" rx="40" ry="6" fill="#d9c68f"/>' +
        '<path d="M42 46H122C122 80 106 98 82 98C58 98 42 80 42 46Z" fill="#f6ebc7"/><ellipse cx="82" cy="46" rx="40" ry="8" fill="#f6ebc7"/><ellipse cx="82" cy="47" rx="34" ry="5.5" fill="#8a5a2b"/>' +
        '<path d="M121 54C142 52 142 82 112 84" fill="none"/><path d="M62 46L50 78" fill="none"/><path d="M42 76L52 72L58 84L47 88Z" fill="#fff6d8"/>' +
        '<circle cx="30" cy="40" r="22" fill="#f3e0b0"/><path d="M30 40m-3 0a3 3 0 1 1 6 0a6 6 0 1 1-12 0a10 10 0 1 1 20 0a15 15 0 1 1-30 0a19 19 0 0 1 31-12" fill="none"/>' +
        '<path d="M16 64C6 62 6 52 14 52C16 58 20 60 24 60Z" fill="#7da86f"/><path d="M26 62C32 70 44 70 46 62C38 58 30 58 26 62Z" fill="#7da86f"/></g></svg>';
      var sp = [[12,16,.2],[84,12,1.1],[10,60,2],[88,50,.6],[14,86,1.5],[82,88,2.2]].map(function (q) {
        return '<span class="sp" style="left:' + q[0] + '%;top:' + q[1] + '%;animation-delay:' + (q[2] + 3) + 's">✦</span>'; }).join("");
      b.innerHTML = '<div class="cdmb-ty">' + ["tl","tr","bl","br"].map(function (c) { return ORN.replace("%C%", c); }).join("") + sp +
        '<img src="' + url("logo-foil.png") + '" alt="CampusDine" draggable="false">' +
        '<div class="tt">' + T.title + '</div><div class="bn">' + T.bn + '</div>' +
        '<div class="chits">' + T.chits.map(function (c, i) { return '<div class="chit"><i class="pin"></i>' + c + (i === 1 ? "" : DECO) + '</div>'; }).join("") + '</div>' +
        '<div class="hr">❤</div><div class="tg">' + T.tagline + '</div></div>';
      return b;
    }
    var f = document.createElement("div"); f.className = "cdmb-face pg " + side;
    f.innerHTML = '<img src="' + src + '" alt="Menu page" draggable="false">'; return f;
  }
  function coverFace() {
    var f = document.createElement("div"); f.className = "cdmb-face f cv cdmb-leather";
    f.innerHTML = '<div class="cdmb-emboss"><img src="' + LOGO + '" alt="CampusDine" draggable="false"><div class="t">MENU</div></div>';
    return f;
  }
  function backCoverFace() {
    var f = document.createElement("div"); f.className = "cdmb-face b cv cdmb-leather";
    f.innerHTML = '<div class="cdmb-emboss sm"><img src="' + LOGO + '" alt="" draggable="false"></div>';
    return f;
  }
  var leafEls = pairs.map(function (pr) {
    var el = document.createElement("div"); el.className = "cdmb-leaf";
    el.appendChild(pr[0] === null ? coverFace() : pageFace(pr[0], "f"));
    el.appendChild(pr[1] ? pageFace(pr[1], "b") : backCoverFace());
    book.appendChild(el); return el;
  });

  var zl = document.createElement("div"); zl.className = "cdmb-zone l";
  var zr = document.createElement("div"); zr.className = "cdmb-zone r";
  book.appendChild(zl); book.appendChild(zr);

  /* ---------- logic ---------- */
  var PW = 400, GAP = 30;
  function tilt() { return " rotateX(" + CFG.tilt + "deg)"; }
  function size() {
    var availH = innerHeight * 0.90;
    var totalW = innerWidth * (innerWidth > 900 ? 0.92 : 0.96);
    // cover rim (m) ≈ 7.5% of page width, spine gap ≈ 7.5%  -> total width = PW*(2 + .075 + 2*.075)
    var pwW = totalW / 2.225;
    var pwH = (availH / 1.08) / CFG.pageRatio;          // height incl. top+bottom rim
    PW = Math.min(pwW, pwH); var h = PW * CFG.pageRatio;
    var GAPn = Math.max(26, PW * 0.075), m = Math.max(22, PW * 0.075);
    GAP = GAPn;
    overlay.style.setProperty("--cs", Math.round(m * 1.7) + "px");
    overlay.style.setProperty("--h", h + "px");
    overlay.style.setProperty("--pw", PW + "px");
    overlay.style.setProperty("--gap", GAP + "px");
    overlay.style.setProperty("--m", m + "px");
  }
  function render() {
    leafEls.forEach(function (el, i) {
      el.style.transform = i < cur
        ? "translateX(" + (-GAP) + "px) translateZ(" + (i * GAP_Z) + "px) rotateY(-180deg)"
        : "translateX(0px) translateZ(" + ((N - i) * GAP_Z) + "px) rotateY(0deg)";
    });
    var half = GAP / 2 + PW / 2;
    var shift = cur === 0 ? -half : cur === N ? half : 0;
    if (overlay.classList.contains("cdmb-open")) book.style.transform = "translateX(" + shift + "px)" + tilt();
    baseL.style.opacity = cur > 0 ? 1 : 0;
    baseR.style.opacity = cur < N ? 1 : 0;
    groove.style.opacity = (cur > 0 && cur < N) ? 1 : 0;
    ringEls.forEach(function (r) { r.style.opacity = groove.style.opacity; });
    stackR.style.boxShadow = stackShadow(cur < N ? Math.min(9, Math.round((N - cur) * 1.5)) : 0, 1);
    stackL.style.boxShadow = stackShadow(cur > 0 ? Math.min(9, Math.round(cur * 1.5)) : 0, -1);
    stackR.style.opacity = cur < N ? 1 : 0; stackL.style.opacity = cur > 0 ? 1 : 0;
    var tyEl = book.querySelector(".cdmb-face.ty");
    if (tyEl) {
      if (cur === lastCur) { clearTimeout(tyEl._t); tyEl.classList.add("on"); }
      else if (tyEl.classList.contains("on")) { clearTimeout(tyEl._t); tyEl._t = setTimeout(function () { tyEl.classList.remove("on"); }, 1200); }
    }
    btnPrev.disabled = cur === 0;
    var end = cur >= lastCur;
    btnNext.style.display = end ? "none" : "flex";
    btnClose.style.display = end ? "block" : "none";
    var L = cur * 2, R = L + 1;
    var TOTAL = ITEMS.length;
    label.textContent = cur === 0 ? "Cover" : L > TOTAL ? "Back cover" : "Pages " + L + "–" + Math.min(R, TOTAL) + " of " + TOTAL;
    try { sessionStorage.setItem(KEY, cur); localStorage.setItem(KEY, cur); } catch (e) {}
  }
  function resetTiming() {
    leafEls.forEach(function (el) { el.style.transitionDelay = ""; });
    book.style.transitionDelay = ""; book.style.transitionDuration = "";
    [baseL, groove, stackL].concat([].slice.call(ringEls)).forEach(function (el) { el.style.transitionDelay = ""; el.style.transitionDuration = ""; });
  }
})();
