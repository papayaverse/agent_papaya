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

async function handleUserInput(userInput) {
  appendMessage('user', userInput);
  // Fetch preferences and stats for context
  chrome.storage.local.get(['marketing', 'performance', 'totalClicks'], (data) => {
    const prefs = data || {};
    const contextMsg = `Here's some data about your user \n User preferences:\n- Marketing: ${prefs.marketing === true ? 'Allowed' : 'Not allowed'}\n- Performance: ${prefs.performance === true ? 'Allowed' : 'Not allowed'}\nBanners clicked: ${prefs.totalClicks || 0}\n if both marketing and performance are allowed, the preference is "Accept all" but if both are disallowed it is "Reject all"`;
    // Add context to chat history for Gemini Nano;
    appendMessage('agent', 'Let me think...');
    chrome.runtime.sendMessage({ type: 'usePromptAgent', prompt: userInput, history: contextMsg }, (response) => {
      chatHistoryDiv.lastChild.querySelector('.bubble.agent').textContent = response && response.success ? response.result : 'Sorry, I could not process that.';
      chatHistory.push({ role: 'user', content: userInput });
      chatHistory.push({ role: 'agent', content: response && response.success ? response.result : 'Sorry, I could not process that.' });
    });
  });
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