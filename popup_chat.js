let chatHistory = [];
const chatHistoryDiv = document.getElementById('chatHistory');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

// Session context is reset when popup is closed
function resetChat() {
  chatHistory = [];
  chatHistoryDiv.innerHTML = '';
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
  msgDiv.className = `chat-message ${sender}`;
  const bubble = document.createElement('div');
  bubble.className = `bubble ${sender}`;
  bubble.innerHTML = markdownToHtml(text);
  msgDiv.appendChild(bubble);
  chatHistoryDiv.appendChild(msgDiv);
  chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
}

function getGreetingAndStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['totalClicks'], (data) => {
      const count = data.totalClicks || 0;
      let greeting = `Hi! I am Agent Papaya. \n I've clicked **${count} cookie banner${count === 1 ? '' : 's'}** for you so far. \nHow can I help with your cookie preferences today?`;
      resolve(greeting);
    });
  });
}

// Helper function to get the base domain from a URL
function getBaseDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    const domainParts = hostname.split('.');
    const knownTLDs = [
      'co.uk', 'org.uk', 'gov.uk', 'ac.uk',
      'com.au', 'net.au', 'org.au',
      'co.in', 'net.in', 'org.in',
    ];
    for (let tld of knownTLDs) {
      if (hostname.endsWith(tld)) {
        return domainParts.slice(-3).join('.');
      }
    }
    return domainParts.slice(-2).join('.');
  } catch (e) {
    console.error('Error parsing URL for base domain:', e);
    return null;
  }
}

// MCP Action Handlers
async function getCurrentSiteClick() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0 || !tabs[0].url) {
        resolve('Could not determine the current website.');
        return;
      }
      const currentDomain = getBaseDomain(tabs[0].url);
      if (!currentDomain) {
        resolve('Could not determine the domain of the current website.');
        return;
      }
      chrome.storage.local.get(['uniqueSites'], (data) => {
        const siteInfo = data.uniqueSites && data.uniqueSites[currentDomain];
        if (siteInfo && siteInfo !== true) {
          resolve(`On ${currentDomain}, the button clicked was: "${siteInfo}".`);
        } else if (siteInfo === true) {
          resolve(`On ${currentDomain}, a cookie banner was handled, but no specific button text was recorded.`);
        } else {
          resolve(`No cookie banner interaction has been recorded for ${currentDomain}.`);
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
      const currentDomain = getBaseDomain(tabs[0].url);
      if (!currentDomain) {
        resolve('Could not determine the domain of the current website to report.');
        return;
      }
      chrome.runtime.sendMessage({ action: 'flushData', domain: currentDomain }, () => {
        resolve(`Reported a wrong button for ${currentDomain}. The stored button data for this site has been cleared. Hopefully, I'll do better next time!`);
      });
    });
  });
}

async function changeCookiePreferences(marketing, performance) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ marketing, performance }, () => {
      // Assuming saveBackendCookiePreferences is available or adapted from popup2.js
      // For simplicity, this example omits the direct backend call from chat.
      // You might want to message background.js to handle backend sync.
      let prefText = 'unknown';
      if (marketing && performance) prefText = 'Accept All';
      else if (!marketing && !performance) prefText = 'Reject All';
      else if (marketing && !performance) prefText = 'Only Marketing';
      else if (!marketing && performance) prefText = 'Only Performance';
      resolve(`Cookie preferences updated to: ${prefText}. Marketing: ${marketing}, Performance: ${performance}.`);
    });
  });
}

async function changeGPCPreference(gpcEnabled) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ gpcEnabled }, () => {
      chrome.runtime.sendMessage({ action: 'toggleGPC', enabled: gpcEnabled });
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
    const domainToSearch = getBaseDomain(`http://${domainQuery}`); // Normalize for lookup
    if (!domainToSearch) {
        resolve(`Could not parse the domain: ${domainQuery}`);
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


async function handleUserInput(userInput) {
  appendMessage('user', userInput);
  const lowerInput = userInput.toLowerCase();
  let mcpActionPromise = null;
  let isMCP = true; // Flag to indicate if it's an MCP action or general chat

  // MCP Intent Parsing (Simple Keyword Based)
  if (lowerInput.includes('current website') && (lowerInput.includes('clicked') || lowerInput.includes('what happened'))) {
    mcpActionPromise = getCurrentSiteClick();
  } else if (lowerInput.includes('report wrong button') || lowerInput.includes('mistake on this site')) {
    mcpActionPromise = reportWrongButtonClick();
  } else if (lowerInput.includes('change my cookie preference') || lowerInput.includes('set cookie to')) {
    if (lowerInput.includes('accept all')) mcpActionPromise = changeCookiePreferences(true, true);
    else if (lowerInput.includes('reject all')) mcpActionPromise = changeCookiePreferences(false, false);
    else if (lowerInput.includes('only marketing')) mcpActionPromise = changeCookiePreferences(true, false);
    else if (lowerInput.includes('only performance')) mcpActionPromise = changeCookiePreferences(false, true);
    else { appendMessage('agent', 'What cookie preference would you like? (Accept All, Reject All, Only Marketing, Only Performance)'); isMCP = false; }
  } else if (lowerInput.includes('change gpc') || lowerInput.includes('toggle gpc')) {
    if (lowerInput.includes('enable') || lowerInput.includes('on')) mcpActionPromise = changeGPCPreference(true);
    else if (lowerInput.includes('disable') || lowerInput.includes('off')) mcpActionPromise = changeGPCPreference(false);
    else { appendMessage('agent', 'Do you want to enable or disable GPC?'); isMCP = false; }
  } else if (lowerInput.includes('all sites') && (lowerInput.includes('clicked') || lowerInput.includes('summary'))) {
    mcpActionPromise = getAllSitesClicks();
  } else if (lowerInput.includes('what was clicked on') || lowerInput.includes('details for site')) {
    const siteMatch = userInput.match(/(?:on|for|site)\s+([\w\.-]+)/i);
    if (siteMatch && siteMatch[1]) {
      mcpActionPromise = getSiteClick(siteMatch[1]);
    } else {
      appendMessage('agent', 'Which site are you asking about?');
      isMCP = false;
    }
  } else {
    isMCP = false; // Not an MCP action, proceed to general Gemini Nano query
  }

  if (isMCP && mcpActionPromise) {
    appendMessage('agent', 'One moment...');
    mcpActionPromise.then(result => {
      const agentBubble = chatHistoryDiv.lastChild.querySelector('.bubble.agent');
      agentBubble.innerHTML = markdownToHtml(result);
      chatHistory.push({ role: 'user', content: userInput });
      chatHistory.push({ role: 'agent', content: result });
    }).catch(error => {
      const agentBubble = chatHistoryDiv.lastChild.querySelector('.bubble.agent');
      agentBubble.innerHTML = markdownToHtml('Sorry, I encountered an error trying to do that.');
      console.error('MCP Action Error:', error);
      chatHistory.push({ role: 'user', content: userInput });
      chatHistory.push({ role: 'agent', content: 'Sorry, I encountered an error.' });
    });
  } else if (!isMCP) {
    // General query to Gemini Nano, include standard context
    chrome.storage.local.get(['marketing', 'performance', 'totalClicks', 'gpcEnabled'], (data) => {
      const prefs = data || {};
      const contextMsg = `User preferences:\n- Marketing: ${prefs.marketing === true ? 'Allowed' : 'Not allowed'}\n- Performance: ${prefs.performance === true ? 'Allowed' : 'Not allowed'}\nGlobal Privacy Control Signal: ${prefs.gpcEnabled === true ? 'Enabled' : 'Not enabled'}\nBanners clicked: ${prefs.totalClicks || 0}\n`;
      
      appendMessage('agent', 'Let me think...');
      chrome.runtime.sendMessage({ type: 'usePromptAgent', prompt: userInput, history: contextMsg }, (response) => {
        const agentBubble = chatHistoryDiv.lastChild.querySelector('.bubble.agent');
        if (response && response.success) {
          agentBubble.innerHTML = markdownToHtml(response.result);
        } else {
          agentBubble.textContent = 'Sorry, I could not process that.';
        }
        chatHistory.push({ role: 'user', content: userInput });
        chatHistory.push({ role: 'agent', content: response && response.success ? response.result : 'Sorry, I could not process that.' });
      });
    });
  }
  chatInput.value = ''; // Clear input after processing
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const userInput = chatInput.value.trim();
  if (!userInput) return;
  handleUserInput(userInput);
  chatInput.value = '';
});

// Greet user on popup open
getGreetingAndStats().then(greeting => {
  appendMessage('agent', greeting);
  chatHistory.push({role: 'agent', content: greeting});
});

// Reset chat on popup close (Chrome extension popup closes automatically)
window.addEventListener('unload', resetChat);