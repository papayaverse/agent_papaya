let buttonData = [];

let buttonCache = {};

// Load stored button data at startup
chrome.storage.local.get(['buttonCache'], (data) => {
  if (data.buttonCache) {
    buttonCache = data.buttonCache;
    console.log("🔄 Loaded cached button data:", buttonCache);
  }
});

// Function to cache button data
function cacheButtonData(domain, buttonData) {
  buttonCache[domain] = buttonData;
  chrome.storage.local.set({ buttonCache }, () => {
    console.log(`✅ Cached button data for ${domain}`);
  });
}


// Load the JSON data once when the service worker starts and store it in a Promise
const loadButtonData = () => {
  return fetch(chrome.runtime.getURL('url_data2.json'))
    .then(response => response.json())
    .then(data => {
      buttonData = data;
      console.log('Button data loaded in background script:', buttonData);
      return data;
    })
    .catch(error => {
      console.error('Error loading button data in background script:', error);
      throw error;
    });
};

chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: [1],
  addRules: [{
    id: 1,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [{
        header: "Sec-GPC",
        operation: "set",
        value: "1"
      }]
    },
    condition: {
      urlFilter: "*",
      resourceTypes: ["main_frame", "sub_frame"]
    }
  }]
}, () => {
  if (chrome.runtime.lastError) {
    console.error("Failed to update GPC rules:", chrome.runtime.lastError);
  } else {
    console.log("✅ GPC header rule applied successfully!");
  }
});



chrome.runtime.onInstalled.addListener((details) => {
  if (details && details.reason === 'install') {
    // Initialize counters on first install
    chrome.storage.local.set({ totalClicks: 0, uniqueSites: {} }, () => {
      console.log('Counters initialized on first install.');
    });
    chrome.storage.local.set({ gpcEnabled: true });

    // Collect cookie preferences for the first time after install
    collectCookiePreferences();
  } else if (details && details.reason === 'update') {
    // Collect preferences after an extension update
    collectCookiePreferences();
    console.log('Extension updated, collecting preferences.');
    chrome.storage.local.set({ gpcEnabled: true });
  }
});

// Function to collect cookie preferences
function collectCookiePreferences() {
  // Check if preferences are already saved
  chrome.storage.local.get(['marketing', 'performance'], (data) => {
    if (data.marketing !== undefined && data.performance !== undefined) {
      console.log('Preferences already exist, no need to collect again.');
      // Send the existing preferences to the backend 
      const cPrefs = {
        allow_marketing: data.marketing,
        allow_performance: data.performance
      }
      saveBackendCookiePreferences(cPrefs);
    } else {
      // If preferences don't exist, collect them (you could trigger the popup or save defaults)
      const defaultPreferences = {
        allow_marketing: false,
        allow_performance: false
      };
      
      chrome.storage.local.set({ marketing: defaultPreferences.allow_marketing, performance: defaultPreferences.allow_performance }, () => {
        console.log('Default preferences saved locally.');
        // Optionally, send these preferences to the backend
        saveBackendCookiePreferences(defaultPreferences);
      });
    }
  });
}

// Call the loadButtonData function and store the Promise
const buttonDataPromise = loadButtonData();

let sessionPromise = null;

// Function to get or create a Gemini Nano session
function getGeminiNanoSession() {
  if (!sessionPromise) {
    //somePromise = chrome.aiOriginTrial.languageModel.capabilities().then((result) => {console.log("Do AI capabilities exist?", result)});
    sessionPromise = chrome.aiOriginTrial.languageModel.create({
      systemPrompt: "You are a friendly, helpful assistant specialized in detecting buttons corresponding to options such as 'accept_all', 'reject_all', 'manage_preferences', etc. in cookie consent banners.",
    }).then((newSession) => {
      console.log("Gemini Nano session created:", newSession);
      return newSession;
    }).catch((error) => {
      console.error("Failed to create Gemini Nano session:", error.message);
      sessionPromise = null; // Reset so it can retry later
      throw error;
    });
  }
  return sessionPromise;
}




// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getButtonData') {
    const domain = message.domain;
    // Wait for the button data to be loaded before responding
    buttonDataPromise.then(() => {
      sendResponse(buttonData[domain]); // change
      //sendResponse(null); // change
    }).catch(error => {
      console.error('Error sending button data:', error);
      sendResponse({});
    });
    return true; // Will respond asynchronously
  } else if (message.action === 'collectData') {
    saveBackendData(message.data);
    return true; // Will respond asynchronously
  } else if (message.action === 'updateIcon') {
    let iconPath = '';
    if (message.icon === 'active') {
      chrome.action.setBadgeText({ text: "✅" }); // Display a small alert
      iconPath = 'agentPapayaCuteSmall.png'; // Path to your active icon
    } else {
      chrome.action.setBadgeText({ text: "" }); // Clear the alert
      iconPath = 'agentPapayaCuteSmall.png'; // Path to your default icon
    }
    chrome.action.setIcon({ path: iconPath, tabId: sender.tab.id });
  } else if (message.action === 'bannerClicked') {
    const domain = new URL(sender.tab.url).hostname;
    function updateClickData(domain) {
      chrome.storage.local.get(['totalClicks', 'uniqueSites'], (data) => {
        let { totalClicks, uniqueSites } = data;
        if (!totalClicks) {
          totalClicks = 0;
        }
        if (!uniqueSites) {
          uniqueSites = {};
        }
        const newTotalClicks = totalClicks + 1;
        const updatedUniqueSites = { ...uniqueSites };
        updatedUniqueSites[domain] = message.text; // Mark this site as clicked
        chrome.storage.local.set({ totalClicks: newTotalClicks, uniqueSites: updatedUniqueSites });
      });
    }
    updateClickData(domain);
  } else if (message.type === "makeGeminiNano") {
    getGeminiNanoSession()
    .then(() => sendResponse({ success: true, message: "Gemini Nano session is ready." }))
    .catch((error) => sendResponse({ success: false, error: error.message }));
  return true; // Respond asynchronously
  } else if (message.type === "usePrompt") {
    getGeminiNanoSession()
      .then((session) => session.prompt(message.prompt))
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Respond asynchronously
  } else if (message.action === "getCachedButtonData") {
    //sendResponse(null); // change
    sendResponse(buttonCache[message.domain] || null); // change
    return true;
  } else if (message.action === "cacheButtonData") {
    console.log("Caching button data for", message.domain); // change
    cacheButtonData(message.domain, message.buttonData); // change
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'toggleGPC') {
    const gpcEnabled = message.enabled;
  } else if (message.action == 'flushData') {
    let domain = message.domain;
    unCacheButtonData(domain);
    sendResponse({ success: true });
  }
});

function unCacheButtonData(domain) {
  delete buttonCache[domain];
  chrome.storage.local.set({ buttonCache }, () => {
    console.log(`✅ Uncached button data for ${domain}`);
  });
}

//Save Data to the backend
function saveBackendData(dataBrowsing){
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['userIdentifier'], (data) => {
        const userIdentifier = data.userIdentifier;
        const identifierParam = userIdentifier ? userIdentifier : 'null';
        const apiUrl = `https://cookie-monster-preferences-api-499c0307911c.herokuapp.com/dataBrowsing?identifier=${encodeURIComponent(identifierParam)}`;
        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataBrowsing)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to save data. Status: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            console.log('Server response:', data);
            if (data.id && !userIdentifier) {
                // Store the returned ID in local storage if it's not already stored
                chrome.storage.local.set({ userIdentifier: data.id }, () => {
                    resolve();
                });
            } else {
                //alert('Cookie preferences saved successfully for id ' + userIdentifier);
                resolve();
            }
        })
        .catch(error => {
            console.error('Error saving data:', error, ' with data ', dataBrowsing);
            reject(error);
        });
    });
});
}

// Save preferences to the backend
function saveBackendCookiePreferences(cookiePreferences) {
  return new Promise((resolve, reject) => {
      chrome.storage.local.get(['userIdentifier'], (data) => {
          const userIdentifier = data.userIdentifier;
          const identifierParam = userIdentifier ? userIdentifier : 'null';
          const apiUrl = `https://cookie-monster-preferences-api-499c0307911c.herokuapp.com/cookiePreferences?identifier=${encodeURIComponent(identifierParam)}`;
          fetch(apiUrl, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(cookiePreferences)
          })
          .then(response => {
              if (!response.ok) {
                  throw new Error('Failed to save preferences. Status: ' + response.status);
              }
              return response.json();
          })
          .then(data => {
              console.log('Server response:', data);
              if (data.id && !userIdentifier) {
                  // Store the returned ID in local storage if it's not already stored
                  chrome.storage.local.set({ userIdentifier: data.id }, () => {
                      //alert(`Preferences saved successfully for ID: ${data.id}`);
                      //alert('Cookie preferences saved successfully!');
                      resolve();
                  });
              } else {
                  //alert('Cookie preferences saved successfully for id ' + userIdentifier);
                  resolve();
              }
          })
          .catch(error => {
              console.error('Error saving preferences:', error);
              reject(error);
          });
      });
  });
}


