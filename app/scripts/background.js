//     This file is part of Game Deals extension for Chrome and Firefox
//     https://github.com/DanielKamkha/GameDeals
//     (c) 2015 Daniel Kamkha
//     Game Deals is free software distributed under the terms of the MIT license.

(function() {
  "use strict";

  const ratesCachePeriod = 12 * 60 * 60 * 1000; // 12 hours
  const isChrome = typeof chrome !== "undefined";

  const cartImportant =  {
    "19": "images/cart-gray-important-19.png",
    "38": "images/cart-gray-important-38.png"
  };

  let dealsPerTab = {};

  function getTableFromStorage(tableName, callback) {
    if (isChrome) { // Chrome
      chrome.storage.local.get(tableName, callback);
    } else { // Firefox
      self.port.once("get", callback);
      self.port.emit("get", tableName);
    }
  }

  function setTableToStorage(data) {
    if (isChrome) { // Chrome
      chrome.storage.local.set(data);
    } else { // Firefox
      self.port.emit("set", data);
    }
  }

  function makeCachedRequest(requestFunc, tableName, id1, id2) {
    let varArgs = Array.prototype.slice.call(arguments, 2);
    return new Promise(function (resolve, reject) {
      getTableFromStorage(tableName, function(storage) {
        let table = storage[tableName] || (storage[tableName] = {});
        let subTable = table[id1] || (table[id1] = {});
        let value = subTable[id2];
        if (value !== undefined) {
          resolve(value);
        } else {
          requestFunc.apply(null, varArgs)
            .then(function(value) {
              subTable[id2] = value;
              setTableToStorage(storage);
              resolve(value);
            }, reject);
        }
      });
    });
  }

  function makeBackgroundRequest(message, sendResponse) {
    let requestFunc = GameDeals.Itad[message.requestName];
    let varArgs = message.args;
    if (message.cache) {
      varArgs = [requestFunc, message.requestName].concat(varArgs);
      requestFunc = makeCachedRequest;
    }
    requestFunc.apply(null, varArgs)
      .then(function (value) {
        sendResponse({value: value});
      }, function (response) {
        sendResponse({response: response});
      });
  }

  function cacheDealsPerTab(tabId, message) {
    dealsPerTab[tabId] = { price: message.price, deals: message.deals };
  }

  function showPageAction(message, sender) {
    let tabId = sender.tab.id;
    cacheDealsPerTab(tabId, message);
    if (message.show) {
      chrome.pageAction.show(tabId);
      if (message.important) {
        chrome.pageAction.setIcon({tabId: tabId, path: cartImportant});
      }
    } else {
      chrome.pageAction.hide(tabId);
    }
  }

  function showPageActionIfOption(message, sender) {
    chrome.storage.sync.get(
      { usePageAction: true },
      function(items) {
        if (items.usePageAction) {
          showPageAction(message, sender);
        }
      }
    );
  }

  function getDealsForTab(message, sendResponse) {
    sendResponse(dealsPerTab[message.tabId]);
  }

  function getExchangeRates(sendResponse) {
    const tableName = "exchangeRates";
    const baseCurrency = "USD"; // TODO: option
    return new Promise(function (resolve, reject) {
      getTableFromStorage(tableName, function(storage) {
        let table = storage[tableName] || (storage[tableName] = {});
        let cachedValue = table[baseCurrency];
        if (cachedValue !== undefined && Date.now() - cachedValue.timestamp < ratesCachePeriod) {
          resolve(cachedValue.rates);
        } else {
          GameDeals.Fixer.getExchangeRates(baseCurrency)
            .then(function(value) {
              table[baseCurrency] = { timestamp: Date.now(), rates: value };
              setTableToStorage(storage);
              resolve(value);
            }, reject);
        }
      });
    }).then(function (value) {
        sendResponse({value: value});
      }, function (response) {
        sendResponse({response: response});
      });
  }

  if (isChrome) { // Chrome
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      switch (message.messageName) {
        case "makeBackgroundRequest":
          makeBackgroundRequest(message, sendResponse);
          return true;
        case "showPageAction":
          showPageActionIfOption(message, sender);
          break;
        case "getDealsForTab":
          getDealsForTab(message, sendResponse);
          break;
        case "getExchangeRates":
          getExchangeRates(sendResponse);
          return true;
      }
    });
  } else { // Firefox
    self.port.on("makeBackgroundRequest", function(message) {
      makeBackgroundRequest(message, function(response) {
        response.tabId = message.tabId;
        response.messageId = message.messageId;
        self.port.emit("makeBackgroundRequest", response);
      });
    });
    self.port.on("showPageAction", function(message) {
      cacheDealsPerTab(message.tabId, message);
    });
    self.port.on("getDealsForTab", function(message) {
      getDealsForTab(message, function(response) {
        self.port.emit("getDealsForTab", response);
      });
    });
    self.port.on("getExchangeRates", function(message) {
      getExchangeRates(function(response) {
        response.tabId = message.tabId;
        response.messageId = message.messageId;
        self.port.emit("getExchangeRates", response);
      });
    });
  }
})();

