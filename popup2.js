document.addEventListener('DOMContentLoaded', function() {
  // Switch between tabs when sidebar items are clicked
  document.getElementById('dashboardLink').addEventListener('click', function() {
    showTab('dashboard');
  });

  document.getElementById('cookiePreferencesLink').addEventListener('click', function() {
    showTab('cookiePreferences');
  });

  document.getElementById('paybackLink').addEventListener('click', function() {
    showTab('payback');
  });

  document.getElementById('gpcLink').addEventListener('click', function() {
    showTab('gpc');
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
      document.getElementById('marketing').checked = preferences.marketing || false;
      document.getElementById('performance').checked = preferences.performance || false;
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
  // Save preferences to storage
  function savePreferences() {
    const marketing = document.getElementById('marketing').checked;
    const performance = document.getElementById('performance').checked;

    chrome.storage.local.set({ marketing, performance }, () => {
      //alert('Cookie preferences saved locally successfully!');
      console.log('Cookie preferences saved locally successfully!');
    });

    const cookiePreferences = {
      allow_marketing: marketing,
      allow_performance: performance
    };

  // Call the backend function to save preferences
  saveBackendCookiePreferences(cookiePreferences)
      .then(() => {
          alert('Cookie Preferences saved successfully');
      })
      .catch((error) => {
          alert('Error saving preferences to the server: ' + error.message);
          console.error('Error saving preferences to the server:', error);
      });


  }
  
  function updateDashboard() {
    chrome.storage.local.get(['totalClicks', 'uniqueSites'], (data) => {
      const { totalClicks, uniqueSites } = data;
      const uniqueSitesCount = Object.keys(uniqueSites).length;
  
      document.getElementById('totalClicks').textContent = `${totalClicks} Cookie Banners on`;
      document.getElementById('uniqueSites').textContent = `${uniqueSitesCount} Unique Websites`;
    });
  }

  updateDashboard();
  
});
