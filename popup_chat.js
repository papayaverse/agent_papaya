let chatHistory = [];
const chatHistoryDiv = document.getElementById('chatHistory');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

// Session context is reset when popup is closed
function resetChat() {
  chatHistory = [];
  if (chatHistoryDiv) chatHistoryDiv.innerHTML = '';
}

// Simple markdown-to-HTML converter (supports bold, italics, code, links, lists, line breaks)
function markdownToHtml(md) {
  // Convert markdown to HTML
  let html = md
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^\s*\- (.*)$/gm, '<li>$1</li>')
    .replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>');
  // Merge consecutive <ul>s
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  return html;
}

function appendMessage(sender, text) {
  const msgDiv = document.createElement('div');
  // Use 'agent' class for 'assistant' sender to match existing CSS for agent bubbles
  const displaySender = sender === 'assistant' ? 'agent' : sender;
  msgDiv.className = `chat-message ${displaySender}`;
  const bubble = document.createElement('div');
  bubble.className = `bubble ${displaySender}`;
  bubble.innerHTML = markdownToHtml(text);
  msgDiv.appendChild(bubble);
  chatHistoryDiv.appendChild(msgDiv);
  chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
}

function appendFaqButtons() {
  const faqContainer = document.createElement('div');
  faqContainer.className = 'faq-buttons-container';

  const faqs = [
    { text: "What do you do?", query: "What does Agent Papaya do?" },
    //{ text: "What are my preferences?", query: "What are my preferences?"},
    { text: "What did you click on this current website?", query: "What did you click on this current website?" },
    { text: "Report a wrong button being clicked", query: "Report a wrong button being clicked" }
  ];

  faqs.forEach(faq => {
    const button = document.createElement('button');
    button.className = 'faq-button';
    button.textContent = faq.text;
    button.addEventListener('click', () => {
      handleUserInput(faq.query);
      // Optionally remove FAQ buttons after one is clicked to prevent clutter
      // faqContainer.remove(); 
    });
    faqContainer.appendChild(button);
  });

  chatHistoryDiv.appendChild(faqContainer);
  chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
}

function getGreetingAndStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['totalClicks', 'marketing', 'performance', 'gpcEnabled'], (data) => {
      const count = data.totalClicks || 0;
      let prefText = 'unknown';
      if (data.marketing && data.performance) prefText = 'Accept All';
      else if (!data.marketing &&!data.performance) prefText = 'Reject All';
      else if (data.marketing &&!data.performance) prefText = 'Only Marketing';
      else if (!data.marketing && data.performance) prefText = 'Only Performance';
      const gpcText = data.gpcEnabled? 'Enabled' : 'Disabled';
      let greeting = `Hi! \n I am **Agent Papaya: Your Privacy Companion**. \n\n I've clicked **${count} cookie banner${count === 1 ? '' : 's'}** for you so far. \n\n Your **Cookie Preference** is **${prefText}** \n\n Your **GPC (Global Privacy Control) Signal** is **${gpcText}** \n How can I help you today?`;
      resolve(greeting);
    });
  });
}

// MCP Action Handlers
// getBaseDomain is removed. Domain processing for actions like 'reportWrongButtonClick' 
// will rely on sending the full URL or hostname to background.js if complex parsing is needed there,
// or use simple new URL().hostname for local display.

async function getCurrentSiteClick() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0 || !tabs[0].url) {
        resolve('Could not determine the current website.');
        return;
      }
      const currentUrl = tabs[0].url;
      let displayDomain = 'the current site';
      let lookupHostname = '';
      try {
        const urlObj = new URL(currentUrl);
        displayDomain = urlObj.hostname;
        lookupHostname = urlObj.hostname; // Use full hostname for lookup
      } catch (e) {
        console.error('Error parsing current URL:', e);
        resolve('Could not determine the domain of the current website.');
        return;
      }

      chrome.storage.local.get(['uniqueSites'], (data) => {
        const siteInfo = data.uniqueSites && data.uniqueSites[lookupHostname];
        if (siteInfo && siteInfo !== true) {
          resolve(`On ${displayDomain}, the button clicked was: "${siteInfo}".`);
        } else if (siteInfo === true) {
          resolve(`On ${displayDomain}, a cookie banner was handled, but no specific button text was recorded.`);
        } else {
          resolve(`No cookie banner interaction has been recorded for ${displayDomain}.`);
        }
      });
    });
  });
}

async function reportWrongButtonClick() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0 || !tabs[0].url) {
        resolve('Could not determine the current website to report.');
        return;
      }
      const currentUrl = tabs[0].url;
      let domainToReportDisplay = 'the current site';
      let domainToReportMessage = '';
      try {
        const urlObj = new URL(currentUrl);
        domainToReportDisplay = urlObj.hostname;
        domainToReportMessage = urlObj.hostname; // Send full hostname to background
      } catch (e) {
         console.error('Error parsing current URL for report:', e);
         resolve('Could not determine the domain of the current website to report.');
         return;
      }
      chrome.runtime.sendMessage({ action: 'flushData', domain: domainToReportMessage }, () => {
        resolve(`Reported a wrong button for ${domainToReportDisplay}. The stored button data for this site has been cleared. Hopefully, I'll do better next time!`);
      });
    });
  });
}

async function changeCookiePreferences(marketing, performance) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ marketing, performance }, () => {
      // Message background to save to backend. Background will handle the structure.
      chrome.runtime.sendMessage({ action: 'saveBackendCookiePreferences', marketing: marketing, performance: performance }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending cookie preferences to background:', chrome.runtime.lastError.message);
          // Resolve with local success, but indicate sync issue
        } else if (response && !response.success) {
          console.error('Backend sync failed for cookie preferences:', response.error);
        }
      });
      let prefTextUpdate = 'unknown';
      if (marketing && performance) prefTextUpdate = 'Accept All';
      else if (!marketing && !performance) prefTextUpdate = 'Reject All';
      else if (marketing && !performance) prefTextUpdate = 'Only Marketing';
      else if (!marketing && performance) prefTextUpdate = 'Only Performance';
      resolve(`Cookie preferences updated to: ${prefTextUpdate}.`);
    });
  });
}

async function changeGPCPreference(gpcEnabled) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ gpcEnabled }, () => {
      chrome.runtime.sendMessage({ action: 'toggleGPC', enabled: gpcEnabled }); // Ensure action matches background.js`)
      resolve(`Global Privacy Control (GPC) has been ${gpcEnabled ? 'ENABLED' : 'DISABLED'}.`);
    });
  });
}

async function getAllSitesClicks() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['uniqueSites'], (data) => {
      const sites = data.uniqueSites;
      if (!sites || Object.keys(sites).length === 0) {
        resolve('No cookie banner interactions have been recorded yet.');
        return;
      }
      let responseText = 'Here are the sites where cookie banners were handled:\n';
      for (const [domain, info] of Object.entries(sites)) {
        if (info === true) {
          responseText += `- ${domain}: A banner was handled (no specific button text).\n`;
        } else {
          responseText += `- ${domain}: Button "${info}" was clicked.\n`;
        }
      }
      resolve(responseText);
    });
  });
}

async function getSiteClick(domainQuery) {
  return new Promise((resolve) => {
    // Domain query should be a clean hostname. Background.js stores by hostname.
    const domainToSearch = domainQuery.trim(); 
    if (!domainToSearch) {
        resolve(`Invalid domain provided: ${domainQuery}`);
        return;
    }
    chrome.storage.local.get(['uniqueSites'], (data) => {
      const siteInfo = data.uniqueSites && data.uniqueSites[domainToSearch];
      if (siteInfo && siteInfo !== true) {
        resolve(`For ${domainToSearch}, the button clicked was: "${siteInfo}".`);
      } else if (siteInfo === true) {
        resolve(`For ${domainToSearch}, a cookie banner was handled, but no specific button text was recorded.`);
      } else {
        resolve(`No cookie banner interaction has been recorded for ${domainToSearch}.`);
      }
    });
  });
}

function parse_json(input) {
  // Remove "```json" and "```" from the start and end of the input
  input = input.trim();
  if (input.startsWith('```json') && input.endsWith('```')) {
    input = input.slice(7, -3);
  }
  return JSON.parse(input);
}


async function handleUserInput(userInput) {
  appendMessage('user', userInput);
    // General query to Gemini Nano, include standard context
    chrome.storage.local.get(['marketing', 'performance', 'totalClicks', 'gpcEnabled'], (data) => {
      const prefs = data || {};
      const currentGpcEnabled = prefs.gpcEnabled || false;
      const gpcContext = currentGpcEnabled? 'GPC is currently enabled.' : 'GPC is currently disabled.';
      let prefText = 'unknown';
    if (prefs.marketing && prefs.performance) prefText = 'Accept All';
    else if (!prefs.marketing && !prefs.performance) prefText = 'Reject All';
    else if (prefs.marketing && !prefs.performance) prefText = 'Only Marketing';
    else if (!prefs.marketing && prefs.performance) prefText = 'Only Performance';
      const contextMsg = `Your user's preferences are as follows:\n Cookie Preference: ${prefText} cookies. \n GPC (Global Privacy control): ${gpcContext} \n Also, Agent papaya, you have clicked: ${prefs.totalClicks || 0} banners for your user\n`;
      appendMessage('agent', 'Let me think...');
      chrome.runtime.sendMessage({ type: 'usePromptAgent', prompt: userInput, history: contextMsg }, (response) => {
        const agentBubble = chatHistoryDiv.lastChild.querySelector('.bubble.agent');
        if (response && response.success) {
          // Parse the response as JSON
          let response_json;
          try {
            response_json = parse_json(response.result);
          } catch (e) {
            console.error("Failed to parse LLM response:", e, response.result);
            agentBubble.innerHTML = markdownToHtml("Sorry, I encountered an issue processing the response.");
            chatHistory.push({ role: 'user', content: userInput });
            chatHistory.push({ role: 'agent', content: "Sorry, I encountered an issue processing the response." });
            return;
          }

          //let agent_response_text = response_json.chat || ""; // Default to chat, can be overridden by MCP actions
          let agent_response_text = response_json.chat || "";
          const updateAgentBubble = (text) => {
            agentBubble.innerHTML = markdownToHtml(text);
            chatHistory.push({ role: 'user', content: userInput });
            chatHistory.push({ role: 'agent', content: text });
          };

          // The showTab function defined in DOMContentLoaded will be used.
          // No need for a separate one here if it's globally available and correctly defined.

          switch(response_json.intent) {
            /*
            1. "report_wrong_button" — when the user wants to report that the wrong button was clicked on the current website.

            2. "change_cookie_preferences" — when the user wants to change their cookie preferences for marketing and performance cookies. You will extract which types of cookies should be enabled or disabled.

            3. "change_gpc" — when the user wants to enable or disable Global Privacy Control (GPC).

            4. "get_current_site_click" — when the user wants to know what was clicked on the current website.

            5. "get_specific_site_click" — when the user wants to know what was clicked on a specific website

            6. "get_all_clicks" — when the user wants to know what was clicked on all the websites

            7. "chitchat" — when the user is having a general conversation about privacy, cookies, laws, Agent Papaya, or how privacy works.
            */
            case 'report_wrong_button':
              reportWrongButtonClick().then(mcpResponse => {
                // Display the report confirmation directly in the chat bubble
                updateAgentBubble(mcpResponse);
              });
              break;
            case 'change_cookie_preferences':
              // Redirect to cookie preferences tab
              updateAgentBubble(agent_response_text + "\nPlease use the settings pannel to change your cookie preferences.");
              showTab('cookiePreferences');
              // Optionally, pre-fill or provide guidance via chat
              // The actual change will be handled by the UI elements in the 'cookiePreferences' tab and its JS
              break;
            case 'change_gpc':
              // Redirect to GPC/Trackers tab
              updateAgentBubble(agent_response_text + "\nPlease use the toggle in the settings pannel to change GPC.");
              showTab('gpc');
              // The actual change will be handled by the UI elements in the 'gpc' tab and its JS
              break;
            case 'get_current_site_click':
                getCurrentSiteClick().then(mcpResponse => {
                  updateAgentBubble(mcpResponse);
                });
                break;
            case 'get_specific_site_click':
                // Assuming LLM provides domain entity
                const domainQuery = response_json.domain;
                if (domainQuery) {
                    getSiteClick(domainQuery).then(mcpResponse => {
                        updateAgentBubble(mcpResponse);
                    });
                } else {
                    updateAgentBubble(agent_response_text + "\nCould not extract domain from your query.");
                }
                break;
            case 'get_all_clicks':
                getAllSitesClicks().then(mcpResponse => {
                    updateAgentBubble(agent_response_text + "\n" + mcpResponse);
                });
                break;
            case 'chitchat':
            default:
                updateAgentBubble(agent_response_text);
                break;
          }
        } else {
          agentBubble.textContent = 'Sorry, I could not process that.';
          chatHistory.push({ role: 'user', content: userInput });
          chatHistory.push({ role: 'agent', content: 'Sorry, I could not process that.' });
        }
      });
    });
  chatInput.value = ''; // Clear input after processing
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const userInput = chatInput.value.trim();
  if (!userInput) return;
  handleUserInput(userInput);
  chatInput.value = '';
});

// Consolidated function to show a specific tab and hide others, adapted for popup2.html structure
function showTab(tabIdToShow) {
  console.log("Attempting to show tab:", tabIdToShow);
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(tab => {
    if (tab.id === tabIdToShow) {
      tab.style.display = 'block';
    } else {
      tab.style.display = 'none';
    }
  });

  // Update active state for sidebar items (divs with class .sidebar-item)
  const sidebarItems = document.querySelectorAll('.sidebar .sidebar-item');
  sidebarItems.forEach(item => {
    // Determine the target tab ID from the item's ID
    let itemTargetTabId = '';
    if (item.id === 'dashboardLink') itemTargetTabId = 'dashboard';
    else if (item.id === 'cookiePreferencesLink') itemTargetTabId = 'cookiePreferences';
    else if (item.id === 'gpcLink') itemTargetTabId = 'gpc';
    else if (item.id === 'updatesLink') itemTargetTabId = 'updates';
    // Add more mappings if new sidebar items are added

    if (itemTargetTabId === tabIdToShow) {
      item.classList.add('active'); // Assuming an 'active' class for styling
    } else {
      item.classList.remove('active');
    }
  });

  // If dashboard (which contains chat) is selected, ensure chat history is visible and input is focused
  if (tabIdToShow === 'dashboard') { 
    if (chatHistoryDiv) chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
    if (chatInput) chatInput.focus();
  }
}

// Initial setup: Show dashboard (chat) by default and handle sidebar clicks
document.addEventListener('DOMContentLoaded', () => {
  resetChat(); // Clear chat from previous sessions
  getGreetingAndStats().then(greeting => {
    if (greeting && chatHistoryDiv) {
      appendMessage('assistant', greeting);
      appendFaqButtons(); // Add FAQ buttons after the greeting
    }
  });
  showTab('dashboard'); // Show dashboard (which includes chat) by default

  // Sidebar navigation - IDs match the <div> elements in popup2.html
  document.getElementById('dashboardLink')?.addEventListener('click', (e) => { e.preventDefault(); showTab('dashboard'); });
  document.getElementById('cookiePreferencesLink')?.addEventListener('click', (e) => { e.preventDefault(); showTab('cookiePreferences'); });
  document.getElementById('gpcLink')?.addEventListener('click', (e) => { e.preventDefault(); showTab('gpc'); });
  document.getElementById('updatesLink')?.addEventListener('click', (e) => { e.preventDefault(); showTab('updates'); });
  // Note: 'faq' link/tab was an assumption and is not in popup2.html, so it's removed.

  // Load preferences for cookie settings tab
  loadPreferences();

  // Save preferences for cookie settings tab (button ID from popup2.html)
  const saveCookieButton = document.getElementById('savePreferences'); // Corrected ID
  if (saveCookieButton) {
    saveCookieButton.addEventListener('click', savePreferences);
  }

  // GPC toggle functionality (toggle ID from popup2.html)
  const gpcToggle = document.getElementById('gpcToggle');
  if (gpcToggle) {
    chrome.storage.local.get('gpcEnabled', (data) => {
      // Default to true if not set (consistent with background.js onInstall)
      gpcToggle.checked = data.gpcEnabled !== undefined ? data.gpcEnabled : true;
      // update gpcStatus element in the HTML
      const gpcStatus = document.getElementById('gpcStatus');
      if (gpcStatus) {
        gpcStatus.textContent = 'Global Privacy Control is ' + (data.gpcEnabled ? 'Enabled' : 'Disabled');
      }
    });

    gpcToggle.addEventListener('change', function () {
      const enabled = this.checked;
      chrome.storage.local.set({ gpcEnabled: enabled }, () => {
        chrome.runtime.sendMessage({ action: 'toggleGPC', enabled: enabled });
        // Provide feedback in chat or a less obtrusive way than alert
        appendMessage('assistant', `Global Privacy Control (GPC) has been ${enabled ? 'ENABLED' : 'DISABLED'}.`);
      });
    });
  }

  // Function to load cookie preferences into the UI (IDs from popup2.html's cookie tab)
  function loadPreferences() {
    const marketingCheckbox = document.getElementById('marketing'); // from popup2.html
    const performanceCheckbox = document.getElementById('performance'); // from popup2.html
    const acceptAllRadio = document.querySelector("input[name='cookieSetting'][value='acceptAll']");
    const rejectAllRadio = document.querySelector("input[name='cookieSetting'][value='rejectAll']");
    const onlyMarketingRadio = document.querySelector("input[name='cookieSetting'][value='onlyMarketing']");
    const onlyPerformanceRadio = document.querySelector("input[name='cookieSetting'][value='onlyPerformance']");

    // Ensure radio buttons exist before trying to use them
    if (!acceptAllRadio || !rejectAllRadio || !onlyMarketingRadio || !onlyPerformanceRadio) {
        console.warn('Cookie preference radio buttons not all found.');
        // Fallback or alternative logic if using checkboxes primarily
        if (marketingCheckbox && performanceCheckbox) {
            chrome.storage.local.get(['marketing', 'performance'], (preferences) => {
                marketingCheckbox.checked = preferences.marketing !== undefined ? preferences.marketing : false;
                performanceCheckbox.checked = preferences.performance !== undefined ? preferences.performance : false;
            });
        }
        return;
    }

    chrome.storage.local.get(['marketing', 'performance'], (preferences) => {
      // Default to false if not set
      const marketing = preferences.marketing !== undefined ? preferences.marketing : false;
      const performance = preferences.performance !== undefined ? preferences.performance : false;

      if (marketing && performance) {
        acceptAllRadio.checked = true;
      } else if (!marketing && !performance) {
        rejectAllRadio.checked = true;
      } else if (marketing && !performance) {
        onlyMarketingRadio.checked = true;
      } else if (!marketing && performance) {
        onlyPerformanceRadio.checked = true;
      } 
      // Also update checkboxes if they exist, for consistency or if UI uses both
      if (marketingCheckbox) marketingCheckbox.checked = marketing;
      if (performanceCheckbox) performanceCheckbox.checked = performance;
    });
  }

  // Function to save cookie preferences from the UI (using radio buttons from popup2.html)
  function savePreferences() {
    const selectedOptionInput = document.querySelector("input[name='cookieSetting']:checked");
    if (!selectedOptionInput) {
        appendMessage('assistant', "Please select a cookie preference option.");
        return;
    }

    let marketing, performance;
    switch (selectedOptionInput.value) {
      case 'acceptAll':
        marketing = true;
        performance = true;
        break;
      case 'rejectAll':
        marketing = false;
        performance = false;
        break;
      case 'onlyMarketing':
        marketing = true;
        performance = false;
        break;
      case 'onlyPerformance':
        marketing = false;
        performance = true;
        break;
      default:
        appendMessage('assistant', "Invalid cookie preference selected.");
        return;
    }

    // Save preferences in local storage
    chrome.storage.local.set({ marketing, performance }, () => {
      console.log('Cookie preferences saved locally:', { marketing, performance });
      // Also update checkboxes if they exist for UI consistency
      const marketingCheckbox = document.getElementById('marketing');
      const performanceCheckbox = document.getElementById('performance');
      if (marketingCheckbox) marketingCheckbox.checked = marketing;
      if (performanceCheckbox) performanceCheckbox.checked = performance;
    });

    // Send preferences to background script for backend syncing
    chrome.runtime.sendMessage({ action: 'saveBackendCookiePreferences', marketing: marketing, performance: performance }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending message to background script: ", chrome.runtime.lastError.message);
        appendMessage('assistant', 'Error saving preferences. Please try again.');
      } else if (response && response.success) {
        appendMessage('assistant', 'Cookie preferences saved!');
      } else {
        appendMessage('assistant', 'Failed to save preferences to the backend. They are saved locally.');
        console.error('Backend save failed:', response ? response.error : 'No response');
      }
    });
  }
});

// Reset chat on popup close (Chrome extension popup closes automatically)
window.addEventListener('unload', resetChat);

    const acceptAllRadio = document.querySelector("input[value='acceptAll']");
    const rejectAllRadio = document.querySelector("input[value='rejectAll']");
    const onlyMarketingRadio = document.querySelector("input[value='onlyMarketing']");
    const onlyPerformanceRadio = document.querySelector("input[value='onlyPerformance']");

    chrome.storage.local.get(['marketing', 'performance'], (preferences) => {
      if (preferences.marketing === undefined || preferences.performance === undefined) {
        // Default to reject all if nothing is stored
        rejectAllRadio.checked = true;
        return;
      }
      if (preferences.marketing && preferences.performance) {
        acceptAllRadio.checked = true;
      } else if (!preferences.marketing && !preferences.performance) {
        rejectAllRadio.checked = true;
      } else if (preferences.marketing && !preferences.performance) {
        onlyMarketingRadio.checked = true;
      } else if (!preferences.marketing && preferences.performance) {
        onlyPerformanceRadio.checked = true;
      }
    });
  

  // Function to save cookie preferences from the UI
  function savePreferences() {
    const selectedOptionInput = document.querySelector("input[name='cookieSetting']:checked");
    if (!selectedOptionInput) {
        alert("Please select a cookie preference.");
        return;
    }
    const selectedOption = selectedOptionInput.value;
    
    let marketing = false, performance = false;
  
    if (selectedOption === "acceptAll") {
      marketing = true;
      performance = true;
    } else if (selectedOption === "onlyMarketing") {
      marketing = true;
      performance = false;
    } else if (selectedOption === "onlyPerformance") {
      marketing = false;
      performance = true;
    } // 'rejectAll' is the default (false, false)
  
    // Save preferences in local storage
    chrome.storage.local.set({ marketing, performance }, () => {
      console.log('Cookie preferences saved locally:', { marketing, performance });
    });
  
    // Send preferences to background script for backend syncing
    const cookiePreferences = { allow_marketing: marketing, allow_performance: performance };
    chrome.runtime.sendMessage({ action: 'saveCookiePreferences', preferences: cookiePreferences }, (response) => {
      if (response && response.success) {
        alert('Cookie Preferences saved successfully!');
      } else {
        alert('Error saving cookie preferences. Please try again.');
        console.error('Error saving cookie preferences:', response ? response.error : 'No response');
      }
    });
  }

// Reset chat on popup close (Chrome extension popup closes automatically)
window.addEventListener('unload', resetChat);