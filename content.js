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

function getExternalBanner(doc) {
  /**
   * This function scans the webpage DOM for potential cookie banners
   * based on certain keywords in classes, IDs, or aria-labels.
   */
  const keywords = [
    'cookie', 'cc-banner', 'tarteaucitron', 'iubenda', 'osano', 'consent', 
    'gdpr', 'onetrust', 'wp-notification', 'privacy', 'cookiebot',
    'cookieconsent', 'cookiebanner', 'cookie-policy', 'cookie-settings',
    'cookie-preferences', 'cookie-decline',
    'cookie-configuration', 'cookie-choices', 'cmp', 'cm',
  ];

  const divs = doc.querySelectorAll('div'); // Get all <div> elements in the DOM
  let topmostDiv = null;

  divs.forEach(div => {
    const classes = Array.from(div.classList || []); // Get the class list as an array
    const id = div.id || ''; // Get the id of the element
    const ariaLabel = div.getAttribute('aria-label') || ''; // Get the aria-label attribute

    // ✅ Get **all** attributes as a dictionary
    const attributes = Array.from(div.attributes).reduce((acc, attr) => {
      acc.push(attr.name.toLowerCase(), attr.value.toLowerCase());
      return acc;
    }, []);

    // Combine classes, id, and aria-label, and more for keyword matching
    const attributesToCheck = [...classes, id, ariaLabel, ...attributes];

    //console.log('Checking div with attrs:', attributesToCheck);

    // Check if any of the attributes contain the keywords
    const matchesKeyword = attributesToCheck.some(attr => 
      keywords.some(keyword => attr.toLowerCase().includes(keyword))
    );

    const textOfBanner = div.innerHTML
    const cookieCount = (textOfBanner.match(/cookie/gi) || []).length;
    //const matchesText = (cookieCount > 2);
    const matchesText = false;
    

    if (matchesKeyword || matchesText) {
      //console.log('Found a div with cookie banner:', div);

      // Check if this div is the topmost one based on length and parent depth
      if (
        div.innerHTML.length > 50 && // Ensure the div has some content
        (topmostDiv === null || div.compareDocumentPosition(topmostDiv) & Node.DOCUMENT_POSITION_CONTAINED_BY)
      ) {
        console.log('Accepted cookie banner div');
        topmostDiv = div;
      }
    }
  });

  if (topmostDiv) {
    console.log('Topmost cookie banner div found:', topmostDiv);
  } else {
    console.log('No cookie banner div found.');
  }

  return topmostDiv;
}

function getInternalBanner(doc) {
  /**
   * This function scans the webpage DOM for internal cookie preference modals.
   * It identifies modals containing keywords like "cookies," "marketing," or "performance."
   */
  const keywords = ['cookies', 'marketing', 'performance'];
  const divs = doc.querySelectorAll('div'); // Get all <div> elements
  let topMostDiv = null;

  divs.forEach(div => {
      const textContent = div.innerText.toLowerCase();
      const keywordCount = keywords.reduce((count, keyword) => count + (textContent.match(new RegExp(keyword, "gi")) || []).length, 0);

      // Ensure it's large enough to be an actual settings modal
      if (keywordCount > 5 && textContent.length > 300) {
          console.log("Potential internal banner detected:", div);

          // Prioritize the highest div in the DOM hierarchy
          if (!topMostDiv || div.compareDocumentPosition(topMostDiv) & Node.DOCUMENT_POSITION_CONTAINED_BY) {
              topMostDiv = div;
          }
      }
  });

  if (topMostDiv) {
      console.log("✅ Internal banner found:", topMostDiv);
  } else {
      console.log("❌ No internal banner found.");
  }

  return topMostDiv;
}

function isBannerHidden(banner) {
  if (!banner) return true; // If there's no banner, assume it's gone

  const computedStyle = window.getComputedStyle(banner);

  // Check CSS-based hiding
  if (
      computedStyle.display === "none" ||
      computedStyle.visibility === "hidden" ||
      computedStyle.opacity === "0"
  ) {
      return true;
  }

  // Check ARIA attributes
  if (banner.hasAttribute("aria-hidden") && banner.getAttribute("aria-hidden") === "true") {
      return true;
  }

  // Check if moved off-screen (some banners use left: -9999px)
  const rect = banner.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0 || rect.left < -1000 || rect.top < -1000) {
      return true;
  }

  return false; // Banner is still visible
}



function takeOutText(htmlElement) {
  /**
   * Cleans the input HTML element by:
   * - Removing non-functional content (e.g., plain text and SVGs).
   * - Preserving functional elements like `<button>` and `<a>`.
   */
  
  // Create a deep clone of the element to avoid modifying the original DOM
  const clonedElement = htmlElement.cloneNode(true);

  // Define the tags to preserve and the tags to process
  const tagsToPreserve = ['button', 'a'];
  const tagsToRemoveText = ['p', 'th', 'tr', 'td'];
  const tagsToRemoveEntirely = ['svg'];

  // Remove entire elements like <svg>
  tagsToRemoveEntirely.forEach((tag) => {
    const elements = clonedElement.querySelectorAll(tag);
    elements.forEach((element) => element.remove());
  });

  // Iterate through the tags that need processing
  tagsToRemoveText.forEach((tag) => {
    const elements = clonedElement.querySelectorAll(tag);

    elements.forEach((element) => {
      // Find nested functional elements (like buttons and links)
      const nestedFunctionalElements = element.querySelectorAll(tagsToPreserve.join(','));

      nestedFunctionalElements.forEach((nestedElement) => {
        // Move preserved elements outside their parent
        console.log('Preserving and moving nested functional element:', nestedElement);
        element.parentNode.insertBefore(nestedElement, element);
      });

      // Remove the text inside the element
      element.textContent = ''; // Remove any text nodes within the element
    });
  });

  // Remove all irrelevant text nodes directly under the root element
  Array.from(clonedElement.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
      node.remove(); // Remove stray text nodes
    }
  });

  // Return the cleaned HTML as a string
  return clonedElement.innerHTML;
}


function makeGeminiPrompt(cleanedBanner) {

  // Define the descriptions for each button type
  const buttonToPrompt = {
    'manage_my_preferences': 'open up a modal or display that allows the user to set more granular preferences and cookie settings',
    'reject_all': 'reject all cookies or accept only necessary/essential cookies on the site, and opt-out of tracking and data sharing',
    'accept_all': 'accept or allow all cookies and consent to tracking on the website',
  };

  // Construct the prompt
  let prompt = `Here is a cookie banner on a website:\n${cleanedBanner}\nWhich HTML element corresponds to the following types:\n`;
  for (const [buttonType, description] of Object.entries(buttonToPrompt)) {
    prompt += `${buttonType}: allows the user to ${description}\n`;
  }
  prompt += "If there is no element that seems to correspond to the type (accept_all, reject_all, manage_my_preferences), please leave it out.\n";
  prompt += "Please return the output in JSON format with the following keys: 'text', 'id', 'class'.\n";
  prompt += "text refers to the text contained within the button, id refers to the HMTL ID of the element, and class refers to the css class\n";
  prompt += "For example:\n";
  prompt += `{
    'accept_all': {'text': 'Accept all cookies', 'id': 'onetrust-accept-btn-handler', 'class': 'None'},
    'reject_all': {'text': 'Necessary cookies only', 'id': 'onetrust-reject-all-handler', 'class': 'None'},
    'manage_my_preferences': {'text': 'Customize settings', 'id': 'onetrust-pc-btn-handler', 'class': 'None'}
  }`;
  prompt += "\n Make sure to only report buttons in the given HTML code, and to return the full id and CSS classes, while only returning the text within the HTML element. \n Double check your work. Millions of people will perish if you make mistakes."

  return prompt;

}

// extract json 
function extractJsonContent(inputString) {
  const match = inputString.match(/```json([\s\S]*?)```/);
  if (match && match[1]) {
    return match[1].trim(); // Trim to remove leading/trailing whitespace
  }
  return null; // Return null if no match is found
}


// Parse gemini response
function parseGeminiNanoResponse(responseString) {
  try {

    newResponseString = extractJsonContent(responseString);

    // Replace single quotes with double quotes to make it valid JSON
    const normalizedString = newResponseString
      .replace(/'/g, '"') // Replace all single quotes with double quotes

    // Parse the normalized string into a JSON object
    const parsedResponse = JSON.parse(normalizedString);

    console.log("Parsed response as JSON:", parsedResponse);
    return parsedResponse;
  } catch (error) {
    console.error("Failed to parse Gemini Nano response:", error);
    return null;
  }
}




function useGeminiDetection() {
  return new Promise((resolve, reject) => {
    let cookieBanner = getExternalBanner(document);
    if (cookieBanner) {
      const cleanedBanner = takeOutText(cookieBanner);
      console.log('Cleaned Banner here: ', cleanedBanner)
      const promptToGemini = makeGeminiPrompt(cleanedBanner);
      console.log('Cookie banner detected, prompt is here:', promptToGemini);

      promptGeminiNano(promptToGemini)
        .then((promptResult) => {
          console.log("Prompt result:", promptResult);
          const parsedResponse = parseGeminiNanoResponse(promptResult);
          if (parsedResponse) {
            console.log("Parsed response:", parsedResponse);
            resolve(parsedResponse); // Resolve with the parsed buttons
          } else {
            reject(new Error("Failed to parse Gemini Nano response"));
          }
        })
        .catch((error) => {
          console.error("Failed to process prompt with Gemini Nano:", error);
          reject(error);
        });
    } else {
      console.log('No cookie banner detected.');
      reject(new Error("No cookie banner detected"));
    }
  });
}

class CookieBannerAgent {
  constructor() {
      this.state = "DETECTING_EXTERNAL";
      this.externalBanner = null;
      this.internalBanner = null;
      this.attempts = 0;
      this.maxAttempts = 2;
      this.userPreferences = { marketing: false, performance: false };
      this.buttonData = null;
  }

  async run() {
      await this.loadUserPreferences();
      await this.loadButtonData();

      while (this.state !== "DONE") {
          switch (this.state) {
              case "DETECTING_EXTERNAL":
                  console.log("🔍 Detecting external banner...");
                  this.externalBanner = getExternalBanner(document);
                  await this.delay(1000);
                  if (this.externalBanner) {
                      console.log("✅ External banner found.");
                      this.state = "EXECUTING_EXTERNAL";
                  } else {
                      console.log("❌ No external banner detected. Exiting.");
                      this.state = "DONE";
                  }
                  break;

              case "EXECUTING_EXTERNAL":
                  console.log("⚡ Handling external banner...");
                  
                  if (this.buttonData) {
                      console.log("✅ Using pre-stored button data.");
                      await this.executeAction(this.buttonData.external_buttons, "external");
                  } else {
                      console.log("🔍 No pre-stored data, using Gemini Nano...");
                      const cleanedBanner = takeOutText(this.externalBanner);
                      const prompt = makeGeminiPrompt(cleanedBanner);

                      try {
                          const response = await promptGeminiNano(prompt);
                          const parsedResponse = parseGeminiNanoResponse(response);

                          if (parsedResponse) {
                              console.log("✅ Gemini Nano actions received:", parsedResponse);
                              await this.executeAction(parsedResponse, "external");
                          } else {
                              console.log("⚠️ Failed to parse response.");
                              this.state = "RETRYING";
                          }
                      } catch (error) {
                          console.error("❌ Error in execution:", error);
                          this.state = "RETRYING";
                      }
                  }
                  break;

              case "DETECTING_INTERNAL":
                  console.log("🔍 Waiting for internal modal to appear...");
                  this.internalBanner = getInternalBanner(document);
                  await this.delay(1000);
                  if (this.internalBanner) {
                      console.log("✅ Internal banner found.");
                      this.state = "INTERNAL_EXECUTING";
                  } else {
                      console.log("❌ No internal banner detected. Exiting.");
                      this.state = "DONE";
                  }
                  break;

              case "INTERNAL_EXECUTING":
                  console.log("⚡ Handling internal banner...");
                  const cleanedInternalBanner = takeOutText(this.internalBanner);
                  const internalPrompt = makeGeminiPrompt(cleanedInternalBanner);

                  if(this.buttonData){
                      console.log("✅ Using pre-stored internal button data.");
                      let internal_buttons_data = {};
                      for (let button of this.buttonData.internal_buttons) {
                        internal_buttons_data[button.option_name] = button;
                      }
                      await this.executeAction(internal_buttons_data, "internal");
                  } else {

                    try {
                        const response = await promptGeminiNano(internalPrompt);
                        const parsedResponse = parseGeminiNanoResponse(response);

                        if (parsedResponse) {
                            console.log("✅ Internal modal actions received:", parsedResponse);
                            await this.executeAction(parsedResponse, "internal");
                            this.state = "VERIFYING";
                        } else {
                            console.log("⚠️ Failed to parse internal response.");
                            this.state = "RETRYING";
                        }
                    } catch (error) {
                        console.error("❌ Error in internal execution:", error);
                        this.state = "RETRYING";
                    }
                  }
                  break;

              case "VERIFYING":
                  console.log("🔄 Verifying if the banner is gone...");
                  await this.verifyBannerRemoval();
                  break;

              case "RETRYING":
                  this.attempts++;
                  if (this.attempts >= this.maxAttempts) {
                      console.log("🚫 Max attempts reached. Giving up.");
                      this.state = "DONE";
                      break;
                  }

                  console.log(`♻️ Retrying... Attempt ${this.attempts}`);
                  this.state = "DETECTING_EXTERNAL";
                  break;
          }
      }
  }

  async executeAction(parsedResponse, bannerType) {
      let actionType = (this.userPreferences.marketing && this.userPreferences.performance) ? "accept_all" : "reject_all";
      console.log(`🔧 Using action type: ${actionType}`);
      console.log("On Parsed response:", parsedResponse);
      if (bannerType === "external") {
          if (parsedResponse[actionType]) {
              console.log(`🛑 Clicking ${actionType} on external banner...`);
              await findAndClickButton(parsedResponse[actionType]);
              await this.delay(1000);
              this.state = "VERIFYING";
          } else if (parsedResponse.manage_my_preferences) {
              console.log("⚙️ Clicking manage_my_preferences...");
              await findAndClickButton(parsedResponse.manage_my_preferences);
              await this.delay(2000);
              this.state = "DETECTING_INTERNAL";
          } else {
              console.log("✅ Clicking accept_all (fallback)...");
              await findAndClickButton(parsedResponse.accept_all);
              await this.delay(1000);
              this.state = "VERIFYING";
          }
      } else if (bannerType === "internal") {
          if (parsedResponse.reject_all) {
              console.log("🛑 Clicking reject_all on internal modal...");
              await findAndClickButton(parsedResponse.reject_all);
              await this.delay(1000);
          }
          if (parsedResponse.confirm_my_preferences) {
              console.log("✔️ Confirming preferences...");
              await findAndClickButton(parsedResponse.confirm_my_preferences);
          } else {
              console.log("✅ Clicking accept_all on internal modal (fallback)...");
              await findAndClickButton(parsedResponse.accept_all);
          }
      }
  }

  async waitForInternalBanner() {
    return new Promise((resolve) => {
        let observer = new MutationObserver((mutations, obs) => {
            this.internalBanner = getInternalBanner(document);
            if (this.internalBanner) {
                console.log("✅ Internal modal detected.");
                this.state = "INTERNAL_EXECUTING";
                obs.disconnect();
                resolve();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Fallback: If modal doesn't appear within 5 seconds, assume failure
        setTimeout(() => {
            if (!this.internalBanner) {
                console.log("❌ Internal modal did not appear.");
                this.state = "VERIFYING";
                observer.disconnect();
                resolve();
            }
        }, 5000);
    });
  }

  async verifyBannerRemoval() {
    return new Promise((resolve) => {
        setTimeout(() => {
            const externalBanner = getExternalBanner(document);
            const internalBanner = getInternalBanner(document);

            if (!externalBanner || isBannerHidden(externalBanner)) {
                console.log("✅ External banner successfully removed or hidden.");
                if (!internalBanner || isBannerHidden(internalBanner)) {
                    console.log("✅ Internal banner successfully removed or hidden.");
                    this.state = "DONE";
                } else {
                    console.log("❌ Internal banner still present. Retrying...");
                    this.state = "RETRYING";
                }
            } else {
                console.log("❌ External banner still present. Retrying...");
                this.state = "RETRYING";
            }
            resolve();
        }, 2000);
    });
  }


  async loadUserPreferences() {
      return new Promise((resolve) => {
          chrome.storage.local.get(['marketing', 'performance'], (preferences) => {
              if (chrome.runtime.lastError) {
                  console.error('Error fetching user preferences:', chrome.runtime.lastError.message);
              } else {
                  console.log('User preferences received:', preferences);
                  this.userPreferences = {
                      marketing: preferences.marketing || false,
                      performance: preferences.performance || false
                  };
              }
              resolve();
          });
      });
  }

  async loadButtonData() {
      return new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'getButtonData', domain: domain }, (response) => {
              if (chrome.runtime.lastError) {
                  console.error('Error fetching button data:', chrome.runtime.lastError.message);
              } else {
                  console.log('Button data received:', response);
                  this.buttonData = response;
              }
              resolve();
          });
      });
  }

  async delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
  }
}


// Instantiate and run the agent
window.addEventListener("load", () => {
  const agent = new CookieBannerAgent();
  agent.run();
});

function findAndClickButton(buttonDetails) {
  let button;

  // Try to find the button by ID
  if (buttonDetails.id) {
      button = document.getElementById(buttonDetails.id);
      if (button) return highlightAndClick(button);
  }

  // Try to find the button by Text
  if (buttonDetails.text) {
      const xpath = `//*[contains(text(), "${buttonDetails.text}")]`;
      button = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (button) return highlightAndClick(button);
  }

  // Try to find the button by Class
  if (buttonDetails.class) {
      const classXpath = `//*[${buttonDetails.class.split(' ').map(cls => `contains(@class, '${cls}')`).join(' and ')}]`;
      button = document.evaluate(classXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (button) return highlightAndClick(button);
  }

  console.log('❌ Button not found by any selector:', buttonDetails);
  return false;
}

function highlightAndClick(button) {
  console.log(`✨ Highlighting and clicking button:`, button);

  // Add highlight class
  button.classList.add('papaya-highlight');

  // Click the button after a short delay (to let users see the highlight)
  setTimeout(() => {
      button.click();
      console.log("✅ Button clicked:", button);
      chrome.runtime.sendMessage({ action: 'bannerClicked' });
      
      // Remove the highlight after clicking
      setTimeout(() => button.classList.remove('papaya-highlight'), 1000);
  }, 500); // 500ms delay to show highlight before clicking

  return true;
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
