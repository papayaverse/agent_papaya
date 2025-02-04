// Override navigator.globalPrivacyControl to Signal GPC Support
console.log("Checking if GPC content script is running");
 

function injectScript(file) {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(file);
    script.onload = function () {
        this.remove();  // Remove script tag after execution
    };
    (document.head || document.documentElement).appendChild(script);
}

// Inject `injectGPC.js` into the webpage context
injectScript("injectGPC.js");
console.log("✅ GPC content script injected successfully.");