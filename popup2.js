document.addEventListener('DOMContentLoaded', function() {

  



  // Switch between tabs when sidebar items are clicked
  document.getElementById('dashboardLink').addEventListener('click', function() {
    showTab('dashboard');
  });

  document.getElementById('cookiePreferencesLink').addEventListener('click', function() {
    showTab('cookiePreferences');
  });

  document.getElementById('paybackLink').addEventListener('click', function() {
    //showTab('payback');
  });

  document.getElementById('gpcLink').addEventListener('click', function() {
    showTab('gpc');
  });

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

  // Initialize the first tab as active
  showTab('dashboard');

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
          listHTML += `<li>${site} : ${uniqueSites[site]}</li>`;
        });
        listHTML += '</ul>';
        sitesList.innerHTML = listHTML;
      }
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
