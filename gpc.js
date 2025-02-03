
  // Override navigator.globalPrivacyControl to Signal GPC Support
  (function() {
      Object.defineProperty(navigator, "globalPrivacyControl", {
          get: function() { return true; },
          configurable: false
      });
  })();
  