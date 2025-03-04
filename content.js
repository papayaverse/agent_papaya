// functions to change icon

function updateIconToActive() {
  console.log('Active Icon set');
  chrome.runtime.sendMessage({ action: 'updateIcon', icon: 'active' });
}

function updateIconToDefault() {
  console.log('Default Icon set');
  chrome.runtime.sendMessage({ action: 'updateIcon', icon: 'default' });
}

// Function to inject the monster (PNG) into the DOM
function injectMonster() {
      // Create an image element for the monster (PNG)
      console.log("Injecting monster");
      const monsterImg = document.createElement('img');
      // Use a relative path to the PNG within your extension
      monsterImg.src = chrome.runtime.getURL('cookie_monster_logo_nobg.png'); // Path to your PNG file
      // Set styles for the monster image
      monsterImg.style.position = 'fixed';
      monsterImg.style.zIndex = '10000000000'; // Ensure it's on top of other elements
      monsterImg.style.height = '200px';  // Adjust height as needed
      monsterImg.style.width = '200px';   // Adjust width as needed
      monsterImg.style.top = '50%';        // Center the monster vertically
      monsterImg.style.left = '0px';    // Start the monster off-screen on the left
      monsterImg.style.transform = 'translateY(-50%)';  // Vertically center the monster

      // Inject the monster (PNG) into the DOM
      document.body.appendChild(monsterImg);

      // Animate the monster to move towards the cookie banner's position
      setTimeout(() => {
        monsterImg.style.transition = 'transform 4s linear';  // Set up the transition
        monsterImg.style.transform = 'translate(100vw, -50%)'; // Move horizontally across the screen
      }, 5); // Add delay for effect

      // After animation ends, remove both the banner and the monster
      setTimeout(() => {
          monsterImg.remove();    // Remove monster
      }, 2500);  // Adjust timing to match the animation duration
}

function getBaseDomain(url) {
  const hostname = url.hostname;
  const domainParts = hostname.split('.');
  
  // Known common TLDs that consist of multiple parts
  const knownTLDs = [
    'co.uk', 'org.uk', 'gov.uk', 'ac.uk',
    'com.au', 'net.au', 'org.au',
    'co.in', 'net.in', 'org.in',
    // Add more if needed
  ];

  // Check if the hostname ends with one of the known TLDs
  for (let tld of knownTLDs) {
    if (hostname.endsWith(tld)) {
      return domainParts.slice(-3).join('.'); // Take the last 3 parts (subdomain + domain + TLD)
    }
  }

  // If not, assume the last 2 parts are the domain (like example.com or example.co.uk)
  return domainParts.slice(-2).join('.');
}

const domain = getBaseDomain(window.location);


// Request user preferences and button data from the background script
//chrome.runtime.sendMessage({ action: 'getUserPreferences', domain: domain }, userPreferences => {
chrome.storage.local.get(['marketing', 'performance'], (userPreferences) => {
  if (chrome.runtime.lastError) {
    console.error('Error fetching user preferences:', chrome.runtime.lastError.message);
  } else {
    console.log('User preferences received from local storage :', userPreferences);
    chrome.runtime.sendMessage({ action: 'getButtonData', domain: domain }, buttonData => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching button data:', chrome.runtime.lastError.message);
      } else {
        console.log('Button data received from background script:', buttonData);
        //handleCookieBanner(buttonData, userPreferences);
      }
    });
  }
});

// Function to collect data from the webpage
function collectData() {
  const data = {
    url: window.location.href,
    website: window.location.hostname,
    title: document.title,
    browseDate: new Date().toISOString().split('T')[0],
    // Add any other data you need to collect
  };

  // Send the data to the background script
  chrome.runtime.sendMessage({ action: 'collectData', data: data });
  console.log('Data collected:', data);
}

// Call the function to check preferences and collect data

const style = document.createElement('style');
style.innerHTML = `
    @keyframes papaya-flash {
        0% { border: 15px solid #ff7d10; box-shadow: 0 0 20px 5px #ff7d10; }
        50% { border: 15px solid transparent; box-shadow: 0 0 10px 3px #ff7d10; }
        100% { border: 15px solid #ff7d10; box-shadow: 0 0 20px 5px #ff7d10; }
    }

    .papaya-highlight {
        animation: papaya-flash 1s infinite alternate;
        transition: border 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
    }
`;
document.head.appendChild(style);