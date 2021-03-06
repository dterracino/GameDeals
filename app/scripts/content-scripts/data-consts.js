//     This file is part of Game Deals extension for Chrome and Firefox
//     https://github.com/DanielKamkha/GameDeals
//     (c) 2015 Daniel Kamkha
//     Game Deals is free software distributed under the terms of the MIT license.

(function() {
  "use strict";

  const storeIcons = {
    "Steam": "fa-steam"
    //"Amazon": "fa-amazon" // TODO: bug, does not pick up FontAwesome 4.4, still uses 4.3
  };

  function getStoreIconByTitle(storeTitle) {
    return storeIcons[storeTitle] || "fa-shopping-cart";
  }

  window.GameDeals = window.GameDeals || {};
  window.GameDeals.Consts = {
    getBestDealsString: function(count) { return count === 1 ? "Best deal" : "Best deals"; },
    getStoreIconByTitle: getStoreIconByTitle
  };
})();
