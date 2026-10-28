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

})();
