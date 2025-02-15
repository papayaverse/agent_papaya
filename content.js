//load gemini nano

function makeGeminiNano(){
  chrome.runtime.sendMessage({ type: "makeGeminiNano" }, (response) => {
    if (response.success) {
      console.log(response.message);
      console.log("Gemini Nano session detected successfully:");

    } else {
      console.error("Error detecting Gemini Nano:", response.error);
    }
  });
}

// prompt Gemini Nano
function promptGeminiNano(promptText) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "usePrompt", prompt: promptText }, (response) => {
      if (response && response.success) {
        console.log("Prompt response received:", response.result);
        resolve(response.result); // Resolve with the result
      } else {
        console.error("Error using prompt:", response?.error || "Unknown error");
        reject(new Error(response?.error || "Failed to get a valid response"));
      }
    });
  });
}


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


// Function to handle cookie banners
function handleCookieBanner(buttons, preferences) {
  //injectMonster();
  const { marketing, performance } = preferences;

  let actionType = 'reject_all'; // Default to reject_all if no preference for domain
  if (marketing === true && performance === true) {
    actionType = 'accept_all';
  }

  if (!buttons) {
    console.log('Using gemini for:', domain);
    setTimeout(() => {
      useGeminiDetection().then((fetchedButtons) => {
        if (fetchedButtons) {
          console.log('Fetched buttons:', fetchedButtons);
          let newButtons = {'external_buttons' : fetchedButtons};
          clickBanner(newButtons);
        } else {
          console.log("something went wrong with fetchedButtons")
        }
      });
    }, "3000");
  } else {
    console.log('Using precomputed data for:', domain);
    setTimeout(() => {
      clickBanner(buttons);
    }, "1000");
  }

  // Function to handle accept all path
  function handleAcceptAll(buttons) {
    if (buttons.external_buttons && buttons.external_buttons.accept_all) {
      const acceptAllClicked = findAndClickButton(buttons.external_buttons.accept_all);
      if (acceptAllClicked) return;
    }

    if (buttons.external_buttons && buttons.external_buttons.manage_my_preferences) {
      const manageMyPreferencesClicked = findAndClickButton(buttons.external_buttons.manage_my_preferences);
      if (manageMyPreferencesClicked) {
        // Wait for internal buttons to appear
        setTimeout(() => {
          if (buttons.internal_buttons) {
            buttons.internal_buttons.forEach(button => {
              if (button.option_name === 'accept_all') {
                const acceptAllClicked = findAndClickButton(button);
                  // Click confirm my preferences after accept all
                setTimeout(() => {
                  buttons.internal_buttons.forEach(button => {
                    if (button.option_name === 'confirm_my_preferences') {
                      findAndClickButton(button);
                    }
                  });
                }, 2000);
              }
            });
          }
        }, 2000); // Adjust delay as needed for your pages
        return;
      }
    }
  }

  // Function to handle reject all path
  function handleRejectAll(buttons) {
    if (buttons.external_buttons && buttons.external_buttons.reject_all) {
      const rejectAllClicked = findAndClickButton(buttons.external_buttons.reject_all);
      if (rejectAllClicked) return;
    }

    if (buttons.external_buttons && buttons.external_buttons.manage_my_preferences) {
      const manageMyPreferencesClicked = findAndClickButton(buttons.external_buttons.manage_my_preferences);
      if (manageMyPreferencesClicked) {
        // Wait for internal buttons to appear
        setTimeout(() => {
          if (buttons.internal_buttons) {
            buttons.internal_buttons.forEach(button => {
              if (button.option_name === 'reject_all') {
              const rejectAllClicked = findAndClickButton(button);
                // Click confirm my preferences after reject all
                setTimeout(() => {
                  buttons.internal_buttons.forEach(button => {
                    if (button.option_name === 'confirm_my_preferences') {
                      findAndClickButton(button);
                    }
                  });
                }, 2000);
              }
            });
          }
        }, 2000); // Adjust delay as needed for your pages
        return;
      }
    }
  }
  function clickBanner(buttons){
    updateIconToActive();
    // Notify background script that a banner was clicked
    chrome.runtime.sendMessage({ action: 'bannerClicked' });
    if (actionType === 'accept_all') {
      handleAcceptAll(buttons);
    } else {
      handleRejectAll(buttons);
    }
    setTimeout(() => {
      updateIconToDefault(); // Revert back to the default icon after a short delay
    }, 3000);  // Adjust delay as needed for your pages
  }
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
//collectData();

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
