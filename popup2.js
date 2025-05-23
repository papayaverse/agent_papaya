document.addEventListener('DOMContentLoaded', function() {

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

  document.getElementById('dashboardLink').addEventListener('click', function () {
    showTab('dashboard');
  });
  
  // Set "Dashboard" as default tab on load
    showTab('dashboard');
  
    document.getElementById('cookiePreferencesLink').addEventListener('click', function() {
      showTab('cookiePreferences');
    });
  
    document.getElementById('gpcLink').addEventListener('click', function() {
      showTab('gpc');
    });
  
    document.getElementById('updatesLink').addEventListener('click', function() {
      showTab('updates');
    });
  
    document.getElementById('changeCookiePreferences').addEventListener('click', function() {
      showTab('cookiePreferences');
    });
  
    document.getElementById('reportIssue').addEventListener('click', function() {
      //alert("Reported issue with Cookie Banner!"); // Placeholder
      flushCookieBannerDataForWebsite();
    });

    function flushCookieBannerDataForWebsite() {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length === 0) return;
        let currentDomain = getBaseDomain(new URL(tabs[0].url));
        alert('We are really sorry! AI makes mistakes sometimes. Flushing cookie banner button data for ' + currentDomain);
        chrome.runtime.sendMessage({ action: 'flushData', domain: currentDomain });
      });
    }


  const sitesList = document.getElementById('clickedSitesList');
  const toggleButton = document.getElementById('toggleSitesButton');

  toggleButton.addEventListener('click', function () {
    if (sitesList.style.display === 'none') {
      sitesList.style.display = 'block';
      toggleButton.innerHTML = "Hide Sites ▲";
    } else {
      sitesList.style.display = 'none';
      toggleButton.innerHTML = "Show Sites ▼";
    }
  });

  function showTab(tabId) {
    // Hide all tab contents
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.style.display = 'none');

    // Show the selected tab
    document.getElementById(tabId).style.display = 'block';

    // Update active state in the sidebar
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => item.style.backgroundColor = '');
    document.getElementById(tabId + 'Link').style.backgroundColor = '#444';
  }

  // Load preferences
  loadPreferences();

  // Save preferences
  document.getElementById('savePreferences').addEventListener('click', savePreferences);

  // Load preferences from storage
  function loadPreferences() {
    chrome.storage.local.get(['marketing', 'performance'], (preferences) => {
      if (preferences.marketing && preferences.performance) {
        document.querySelector("input[value='acceptAll']").checked = true;
      } else if (!preferences.marketing && !preferences.performance) {
        document.querySelector("input[value='rejectAll']").checked = true;
      } else if (preferences.marketing && !preferences.performance) {
        document.querySelector("input[value='onlyMarketing']").checked = true;
      } else if (!preferences.marketing && preferences.performance) {
        document.querySelector("input[value='onlyPerformance']").checked = true;
      }
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
  // new save prefs
  function savePreferences() {
    const selectedOption = document.querySelector("input[name='cookieSetting']:checked").value;
    
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
    }
  
    // Save preferences in local storage
    chrome.storage.local.set({ marketing, performance }, () => {
      console.log('Cookie preferences saved:', { marketing, performance });
    });
  
    // Save preferences to backend
    const cookiePreferences = { allow_marketing: marketing, allow_performance: performance };
    saveBackendCookiePreferences(cookiePreferences)
      .then(() => {
        alert('Cookie Preferences saved successfully');
      })
      .catch((error) => {
        alert('Error saving preferences to the server: ' + error.message);
        console.error('Error saving preferences:', error);
      });
  }
  
  function updateDashboard() {
    chrome.storage.local.get(['totalClicks', 'uniqueSites'], (data) => {
      const { totalClicks, uniqueSites } = data;
      const uniqueSitesCount = Object.keys(uniqueSites).length;
      const clickedSites = Object.keys(uniqueSites || {});
  
      document.getElementById('totalClicks').textContent = `${totalClicks} Cookie Banners on`;
      document.getElementById('uniqueSites').textContent = `${uniqueSitesCount} Unique Websites`;

        // Populate the list of unique sites
      if (clickedSites.length === 0) {
        sitesList.innerHTML = '<p>No cookie banners clicked yet.</p>';
      } else {
        let listHTML = '<ul>';
        clickedSites.forEach(site => {
          listHTML += `<li>${site} ` 
          if (uniqueSites[site] != true) {
            listHTML += `: "${uniqueSites[site]}" was clicked`
          }
          listHTML += `</li>`;
        });
        listHTML += '</ul>';
        sitesList.innerHTML = listHTML;
      }
    });
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) return;
      const currentDomain = new URL(tabs[0].url).hostname;

      chrome.storage.local.get(['totalClicks', 'uniqueSites'], (data) => {
          const { totalClicks = 0, uniqueSites = {} } = data;
          const uniqueSitesCount = Object.keys(uniqueSites).length;
          const clickedSites = Object.keys(uniqueSites);

          // Update Total Clicks and Unique Sites
          document.getElementById('totalClicks').textContent = `${totalClicks} Cookie Banners on`;
          document.getElementById('uniqueSites').textContent = `${uniqueSitesCount} Unique Websites`;

          // Update "Current Website" section
          if (uniqueSites[currentDomain] && uniqueSites[currentDomain] !== true) {
              document.getElementById('currentSiteInfo').textContent = 
                  `Cookie banner button clicked: "${uniqueSites[currentDomain]}"`;
          } else {
              document.getElementById('currentSiteInfo').textContent = 
                  `No button clicked`;
          }

          // Populate the list of clicked sites
          const sitesList = document.getElementById('clickedSitesList');
          if (clickedSites.length === 0) {
              sitesList.innerHTML = '<p>No cookie banners clicked yet.</p>';
          } else {
              let listHTML = '<ul>';
              clickedSites.forEach(site => {
                  listHTML += `<li>${site} `;
                  if (uniqueSites[site] !== true) {
                      listHTML += `: "${uniqueSites[site]}" was clicked`;
                  }
                  listHTML += `</li>`;
              });
              listHTML += '</ul>';
              sitesList.innerHTML = listHTML;
          }
      });
  });
  }

  updateDashboard();

  const gpcToggle = document.getElementById('gpcToggle');
  const gpcStatus = document.getElementById('gpcStatus');

  // Load saved GPC preference
  chrome.storage.local.get(['gpcEnabled'], (data) => {
      const isEnabled = data.gpcEnabled;
      gpcToggle.checked = isEnabled;
      gpcStatus.textContent = isEnabled ? "Global Privacy Control is ON" : "Global Privacy Control is OFF";
    });

    // Update GPC preference when toggle is switched
    gpcToggle.addEventListener('change', function() {
        const isEnabled = gpcToggle.checked;
        chrome.storage.local.set({ gpcEnabled: isEnabled }, () => {
            console.log(`GPC preference updated: ${isEnabled}`);
            gpcStatus.textContent = isEnabled ? "GPC is ON" : "GPC is OFF";

            // Notify the background script to update GPC settings
            chrome.runtime.sendMessage({ action: 'toggleGPC', enabled: isEnabled });
        });
    });


  
});
