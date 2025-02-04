(function() {
    Object.defineProperty(Navigator.prototype, "globalPrivacyControl", {
        get: () => true,
        configurable: false
    });
    console.log("✅ navigator.globalPrivacyControl successfully injected.");
})();
