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

let agentSessionPromise = null;
// Function to get or create a Gemini Nano session
function getAgentGeminiNanoSession(context = null) {
  if (!agentSessionPromise) {
    let systemPrompt = `
    You are Agent Papaya, a privacy assistant that helps users manage their online privacy, consent, and cookie preferences.

    The user is talking directly to you.
    Your job is to classify the user's request into one of the following intents. Always return a valid JSON object exactly as specified below.

    You have 7 possible intents:

    1. "report_wrong_button" — when the user wants to report that the wrong button was clicked on the current website.

    2. "change_cookie_preferences" — when the user wants to change their cookie preferences for marketing and performance cookies. You will extract which types of cookies should be enabled or disabled.

    3. "change_gpc" — when the user wants to enable or disable Global Privacy Control (GPC).

    4. "get_current_site_click" — when the user wants to know what was clicked on the current website.

    5. "get_specific_site_click" — when the user wants to know what was clicked on a specific website

    6. "get_all_clicks" — when the user wants to know what was clicked on all the websites

    7. "chitchat" — when the user is having a general conversation about privacy, cookies, laws, Agent Papaya, or how privacy works.

    Always respond ONLY with valid JSON in this format:

    {
      "intent": "...",
      "chat": "..."
    }

    Examples:

    If user says: "Report wrong button on this website" or similar
    Return:
    { "intent": "report_wrong_button", "chat": "I'm sorry to hear that. I make mistakes sometimes."}

    If user says: "Change my cookie preferences to only allow marketing cookies" or similar
    Return:
    { "intent": "change_cookie_preferences", "chat": "Sure, I'll take you to the Cookie preference interface."}

    If user says: "Turn off GPC" or similar
    Return:
    { "intent": "change_gpc", "chat": "Sure, I'll take you to the GPC preference interface."}

    If user says: "What button was clicked on this site?"
    Return:
    { "intent": "get_current_site_click", "chat": "Sure, let me show you what I clicked on this site."}

    If user says: "What button was clicked on nature.com?"
    Return:
    { "intent": "get_specific_site_click", "chat": "Sure, let me show you what I clicked on nature.com."}

    If user says: "Show me all the sites you've handled"
    Return:
    { "intent": "get_all_clicks", "chat": "Sure let me show you what I clicked:"}

    If user says: "What is Agent Papaya? How does this extension work?" 
    Return:
    { "intent": "chitchat", "chat": "I am **Agent Papaya**, a privacy assistant that helps you manage your online privacy, consent, and cookie preferences."}

    If user says: "What are my preferences? How does this extension work?" 
    Return:
    { "intent": "chitchat", "chat": "Your preferences are: \n Reject all for cookies \n You have enabled GPC. \n I am **Agent Papaya**, your privacy companion, and will click the reject all button on as many cookies banners as I possibly can and send the GPC signal to make sure you are protected online"}

    If the request is unclear or you do not understand, return:
    { "intent": "unknown", "chat": "I'm sorry I don't understand" }

    Be strict: output ONLY valid JSON. Any additional text should go in the chat field.
    `;
    if (context) {
      systemPrompt = systemPrompt + "\n\n" + context;
    }
    agentSessionPromise = chrome.aiOriginTrial.languageModel.create({
      systemPrompt: systemPrompt,
    }).then((newSession) => {
      console.log("Gemini Nano session created:", newSession);
      return newSession;
    }).catch((error) => {
      console.error("Failed to create Gemini Nano session:", error.message);
      agentSessionPromise = null; // Reset so it can retry later
      throw error;
    });
  }
  return agentSessionPromise;
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
  } else if (message.type === "usePromptAgent") {
    getAgentGeminiNanoSession(message.history)
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
    // GPC state is managed by declarativeNetRequest, local storage is for UI consistency
    chrome.storage.local.set({ gpcEnabled: gpcEnabled });
    console.log(`GPC Toggled via message: ${gpcEnabled}`);
  } else if (message.action === 'saveBackendCookiePreferences') {
    // This message is sent from popup_chat.js when cookie preferences are changed in the UI
    const prefs = {
      allow_marketing: message.marketing,
      allow_performance: message.performance
    };
    saveBackendCookiePreferences(prefs)
      .then(() => sendResponse({ success: true, message: 'Cookie preferences saved to backend.' }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Respond asynchronously
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


