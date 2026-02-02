// extension/popup/popup.js - COMPLETE FIXED VERSION WITH DEBUG BUTTON

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎯 SERA OS Popup Loaded');
  
  // Production URLs
  const BACKEND_URL = 'https://sera-backend-185683041424.us-central1.run.app';
  const FRONTEND_URL = 'https://sera-frontend-185683041424.us-central1.run.app';
  
  // Elements
  const statusEl = document.getElementById('status');
  const statusIndicator = statusEl.querySelector('.status-indicator');
  const statusText = statusEl.querySelector('span');
  const scrapeBtn = document.getElementById('scrapeBtn');
  const syncBtn = document.getElementById('syncBtn');
  const aiAnalyzeBtn = document.getElementById('aiAnalyzeBtn');
  const pageInfoEl = document.getElementById('pageInfo');
  const scrapedCountEl = document.getElementById('scrapedCount');
  const quickNoteBtn = document.getElementById('quickNote');
  const createTaskBtn = document.getElementById('createTask');
  const viewDashboardBtn = document.getElementById('viewDashboard');
  const settingsBtn = document.getElementById('settingsBtn');
  
  // Initialize
  await initializePopup();
  
  // Event Listeners
  scrapeBtn.addEventListener('click', handleScrape);
  syncBtn.addEventListener('click', handleSync);
  aiAnalyzeBtn.addEventListener('click', handleAIAnalysis);
  quickNoteBtn.addEventListener('click', handleQuickNote);
  createTaskBtn.addEventListener('click', handleCreateTask);
  viewDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: `${FRONTEND_URL}/dashboard` });
  });
  
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (confirm('Logout from SERA OS?')) {
        chrome.storage.local.remove(['authToken', 'user'], () => {
          statusText.textContent = 'Connected (Please login)';
          syncBtn.disabled = true;
          aiAnalyzeBtn.disabled = true;
          alert('Logged out successfully');
        });
      }
    });
  }
  
  // ========== DEBUG BUTTON FUNCTIONALITY ==========
  // First add debug button to HTML
  const debugHtml = `
    <div style="margin: 10px 0; padding: 8px; background: #f0f9ff; border-radius: 6px; border: 1px solid #bae6fd;">
      <button id="debugBtn" style="width:100%; padding:6px; background:#0ea5e9; color:white; border:none; border-radius:4px; font-size:12px;">
        🧪 Debug Extension
      </button>
      <div id="testResults" style="font-size:11px; margin-top:5px; color:#0369a1;"></div>
    </div>
  `;
  
  // Insert debug section before footer
  const footer = document.querySelector('.footer');
  if (footer) {
    footer.insertAdjacentHTML('beforebegin', debugHtml);
  }
  
  // Add debug button functionality
  document.getElementById('debugBtn')?.addEventListener('click', handleDebug);
  
  async function handleDebug() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        document.getElementById('testResults').textContent = 'No active tab found';
        return;
      }
      
      document.getElementById('testResults').textContent = 'Running tests...';
      
      // Test 1: Check if content script is loaded
      let hasContentScript = false;
      let contentScriptError = '';
      try {
        await chrome.tabs.sendMessage(tabs[0].id, { type: 'PING' });
        hasContentScript = true;
      } catch (error) {
        contentScriptError = error.message;
        console.log('Content script not loaded:', error.message);
        
        // Try to inject manually
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          });
          console.log('✅ Injected content script manually');
          hasContentScript = true;
        } catch (injectError) {
          console.log('Injection failed:', injectError.message);
        }
      }
      
      // Test 2: Check token
      const tokenData = await new Promise((resolve) => {
        chrome.storage.local.get(['authToken', 'user'], resolve);
      });
      
      // Test 3: Check backend
      let backendOk = false;
      let backendError = '';
      try {
        const backendResponse = await fetch(`${BACKEND_URL}/health`);
        backendOk = backendResponse.ok;
        if (!backendOk) {
          backendError = `HTTP ${backendResponse.status}`;
        }
      } catch (error) {
        backendError = error.message;
      }
      
      // Test 4: Check page type
      let pageType = 'unknown';
      try {
        if (hasContentScript) {
          const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'CHECK_PAGE_TYPE' });
          pageType = response?.pageType || 'unknown';
        }
      } catch (error) {
        console.log('Could not get page type:', error);
      }
      
      // Show results
      const results = `
✅ Page: ${tabs[0].url.substring(0, 40)}...
✅ Type: ${pageType}
✅ Content Script: ${hasContentScript ? '✅ LOADED' : '❌ MISSING'} ${contentScriptError ? `(${contentScriptError})` : ''}
✅ Token: ${tokenData.authToken ? '✅ PRESENT' : '❌ MISSING'}
✅ Backend: ${backendOk ? '✅ ONLINE' : '❌ OFFLINE'} ${backendError ? `(${backendError})` : ''}
      `.trim();
      
      document.getElementById('testResults').textContent = results;
      
      // Also show in alert for mobile
      const alertMessage = `
🔍 SERA OS DEBUG REPORT

✅ Page: ${tabs[0].url.substring(0, 50)}...
✅ Page Type: ${pageType}
✅ Content Script: ${hasContentScript ? 'LOADED ✅' : 'MISSING ❌'}
✅ Token: ${tokenData.authToken ? 'PRESENT ✅' : 'MISSING ❌'}
✅ Backend: ${backendOk ? 'ONLINE ✅' : 'OFFLINE ❌'}

🔧 FIXES NEEDED:
${!hasContentScript ? '• Reload the page and try again\n• Or go to: chrome://extensions and reload SERA OS extension\n' : ''}
${!tokenData.authToken ? '• Login to SERA OS frontend first\n• Or open frontend in a new tab\n' : ''}
${!backendOk ? '• Check backend is running\n• Visit: ${BACKEND_URL}/health\n' : ''}

💡 TIPS:
1. Try scraping Wikipedia or a simple page first
2. Make sure you're logged into SERA OS frontend
3. Clear extension storage if stuck
      `.trim();
      
      alert(alertMessage);
      
    } catch (error) {
      console.error('Debug error:', error);
      document.getElementById('testResults').textContent = `Debug error: ${error.message}`;
      alert(`Debug error: ${error.message}`);
    }
  }
  
  // ========== NEW: AUTO-TOKEN RETRIEVAL ==========
  async function checkAndGetTokenFromFrontend() {
    return new Promise((resolve) => {
      console.log('🔍 Checking for authentication token...');
      
      // First check if we already have a token in extension storage
      chrome.storage.local.get(['authToken', 'user'], (result) => {
        if (result.authToken) {
          console.log('✅ Token found in extension storage');
          updateStatusForLoggedInUser(result.user);
          resolve(true);
          return;
        }
        
        console.log('❌ No token in extension storage, checking frontend...');
        
        // Try to get token from current tab if it's the frontend
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs[0]) {
            console.log('❌ No active tab found');
            resolve(false);
            return;
          }
          
          const tab = tabs[0];
          const isFrontend = tab.url.includes('sera-frontend-185683041424.us-central1.run.app');
          
          if (isFrontend) {
            console.log('🎯 Frontend detected, trying to get token...');
            
            // Ask content script to get token from localStorage
            chrome.tabs.sendMessage(tab.id, { type: 'GET_TOKEN' }, (response) => {
              if (chrome.runtime.lastError) {
                console.log('Content script not available:', chrome.runtime.lastError.message);
                resolve(false);
                return;
              }
              
              if (response?.token) {
                console.log('✅ Token retrieved from frontend:', response.token.substring(0, 20) + '...');
                
                // Save to extension storage
                chrome.storage.local.set({ 
                  authToken: response.token,
                  user: response.user,
                  lastTokenSync: new Date().toISOString()
                }, () => {
                  console.log('✅ Token saved to extension storage');
                  updateStatusForLoggedInUser(response.user);
                  resolve(true);
                });
              } else {
                console.log('❌ No token in frontend localStorage');
                resolve(false);
              }
            });
          } else {
            console.log('⚠️ Not on frontend page, user needs to login');
            resolve(false);
          }
        });
      });
    });
  }
  
  function updateStatusForLoggedInUser(user) {
    if (user) {
      try {
        const userObj = typeof user === 'string' ? JSON.parse(user) : user;
        statusText.textContent = `Connected as ${userObj.email || userObj.name || 'User'}`;
      } catch (e) {
        statusText.textContent = 'Connected to SERA OS';
      }
    } else {
      statusText.textContent = 'Connected to SERA OS';
    }
    syncBtn.disabled = false;
    aiAnalyzeBtn.disabled = false;
  }
  
  // ========== NEW: CONTENT SCRIPT INJECTION ==========
  async function ensureContentScriptLoaded(tabId) {
    try {
      // First try to ping the content script
      const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      console.log('✅ Content script already loaded');
      return true;
    } catch (error) {
      console.log('Content script not responding, trying to inject...');
      
      // Try to inject content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        console.log('✅ Content script injected successfully');
        
        // Wait a moment for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 300));
        return true;
      } catch (injectError) {
        console.log('Failed to inject content script:', injectError.message);
        return false;
      }
    }
  }
  
  // ========== MAIN FUNCTIONS ==========
  
  async function initializePopup() {
    await checkBackendConnection();
    await checkAndGetTokenFromFrontend();
    await loadStats();
    await updatePageInfo();
  }
  
  async function checkBackendConnection() {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      statusEl.classList.add('connected');
      statusIndicator.style.background = '#10b981';
      statusText.textContent = 'Connected to SERA OS';
      
      // Check token after connection
      chrome.storage.local.get(['authToken', 'user'], (result) => {
        if (!result.authToken) {
          statusText.textContent = 'Connected (Please login)';
        } else {
          updateStatusForLoggedInUser(result.user);
        }
      });
      
    } catch (error) {
      console.log('Backend connection error:', error);
      statusEl.classList.add('error');
      statusIndicator.style.background = '#ef4444';
      statusText.textContent = 'Backend not connected';
      syncBtn.disabled = true;
      aiAnalyzeBtn.disabled = true;
      scrapeBtn.disabled = true;
      pageInfoEl.innerHTML = '<strong>Error:</strong> Backend offline';
    }
  }
  
  async function updatePageInfo() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) return;
      
      const tab = tabs[0];
      
      // ✅ NEW: Ensure content script is loaded
      const isContentScriptLoaded = await ensureContentScriptLoaded(tab.id);
      
      if (!isContentScriptLoaded) {
        pageInfoEl.innerHTML = `
          <strong>General Web Page</strong><br>
          ${tab.url?.substring(0, 50) || 'Unknown page'}${tab.url?.length > 50 ? '...' : ''}<br>
          <small>⚠️ Content script injection failed (try reloading page)</small>
        `;
        scrapeBtn.disabled = true;
        return;
      }
      
      scrapeBtn.disabled = false;
      
      // Try to get page type from content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { 
          type: 'CHECK_PAGE_TYPE' 
        });
        
        if (response?.pageType) {
          let pageTypeText = '';
          switch (response.pageType) {
            case 'canvas': pageTypeText = 'Canvas LMS'; break;
            case 'moodle': pageTypeText = 'Moodle'; break;
            case 'youtube': pageTypeText = 'YouTube Video'; break;
            case 'pdf': pageTypeText = 'PDF Document'; break;
            case 'docs': pageTypeText = 'Google Docs'; break;
            default: pageTypeText = 'General Web Page';
          }
          
          pageInfoEl.innerHTML = `
            <strong>${pageTypeText}</strong><br>
            ${tab.url.substring(0, 50)}${tab.url.length > 50 ? '...' : ''}
          `;
        } else {
          pageInfoEl.innerHTML = `
            <strong>General Web Page</strong><br>
            ${tab.url.substring(0, 50)}${tab.url.length > 50 ? '...' : ''}<br>
            <small>⚠️ Could not detect page type</small>
          `;
        }
      } catch (contentScriptError) {
        console.log('Content script not responding:', contentScriptError);
        pageInfoEl.innerHTML = `
          <strong>General Web Page</strong><br>
          ${tab.url.substring(0, 50)}${tab.url.length > 50 ? '...' : ''}<br>
          <small>⚠️ Could not detect page type</small>
        `;
      }
      
    } catch (error) {
      console.log('Update page info error:', error);
      pageInfoEl.innerHTML = '<strong>Error:</strong> Could not get page info';
      scrapeBtn.disabled = true;
    }
  }
  
  async function loadStats() {
    chrome.storage.local.get(['scrapedPages', 'lastSync', 'authToken'], (result) => {
      const count = result.scrapedPages || 0;
      scrapedCountEl.textContent = count;
      
      // Enable/disable buttons based on auth
      const hasToken = !!result.authToken;
      syncBtn.disabled = !hasToken;
      aiAnalyzeBtn.disabled = !hasToken;
    });
  }
  
  // ========== FIXED: IMPROVED SCRAPE FUNCTION ==========
  async function handleScrape() {
    scrapeBtn.innerHTML = '<span class="icon">⏳</span> Scraping...';
    scrapeBtn.disabled = true;
    statusText.textContent = 'Scraping page...';
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tabs[0]?.id) {
        throw new Error('No active tab found');
      }
      
      // First ensure content script is loaded
      const isLoaded = await ensureContentScriptLoaded(tabs[0].id);
      if (!isLoaded) {
        throw new Error('Content script not loaded. Please refresh the page.');
      }
      
      // Give content script time to initialize if we just injected it
      console.log('⏱️ Waiting for content script to initialize...');
      await new Promise(resolve => setTimeout(resolve, 500));

      chrome.runtime.sendMessage({ 
        type: 'SCRAPE_PAGE',
        tabId: tabs[0].id
      }, (response) => {
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
        }
        
        if (response?.success) {
          // Store scraped data properly
          chrome.storage.local.set({ 
            lastScrapedData: response.data,
            lastScraped: new Date().toISOString()
          }, () => {
            // Update stats
            chrome.storage.local.get(['scrapedPages'], (current) => {
              const newCount = (current.scrapedPages || 0) + 1;
              chrome.storage.local.set({ 
                scrapedPages: newCount
              }, () => {
                scrapedCountEl.textContent = newCount;
                statusText.textContent = 'Page scraped successfully!';
                statusIndicator.style.background = '#10b981';
                
                // Enable sync button if we have token
                chrome.storage.local.get(['authToken'], (authResult) => {
                  if (authResult.authToken) {
                    syncBtn.disabled = false;
                  }
                });
                
                pageInfoEl.innerHTML += '<br><small>✅ Ready to sync</small>';
              });
            });
          });
        } else {
          throw new Error(response?.error || 'Scraping failed');
        }
      });
      
    } catch (error) {
      console.error('Scrape error:', error);
      statusText.textContent = `Error: ${error.message}`;
      statusIndicator.style.background = '#ef4444';
      alert(`Scraping failed: ${error.message}\n\nTry: 1. Refresh the page\n2. Ensure content script is loaded`);
    } finally {
      scrapeBtn.innerHTML = '<span class="icon">📄</span> Scrape Current Page';
      scrapeBtn.disabled = false;
    }
  }
  
  // ========== FIXED: SYNC FUNCTION WITH BETTER FEEDBACK ==========
  async function handleSync() {
    syncBtn.innerHTML = '<span class="icon">⏳</span> Syncing...';
    syncBtn.disabled = true;
    statusText.textContent = 'Syncing to SERA OS...';
    
    try {
      const storedData = await new Promise((resolve) => {
        chrome.storage.local.get(['lastScrapedData', 'authToken', 'user'], resolve);
      });
      
      if (!storedData.lastScrapedData) {
        throw new Error('Please scrape a page first. Click "Scrape Current Page" before syncing.');
      }
      
      if (!storedData.authToken) {
        // Try to auto-get token before showing error
        const gotToken = await checkAndGetTokenFromFrontend();
        if (!gotToken) {
          alert('Please login to SERA OS first. Opening login page...');
          chrome.tabs.create({ url: `${FRONTEND_URL}/login` });
          throw new Error('Not logged in');
        }
        // Token was just retrieved, update storedData
        const updatedData = await new Promise((resolve) => {
          chrome.storage.local.get(['lastScrapedData', 'authToken'], resolve);
        });
        Object.assign(storedData, updatedData);
      }
      
      chrome.runtime.sendMessage({
        type: 'SYNC_TO_BACKEND',
        data: storedData.lastScrapedData
      }, (response) => {
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
        }
        
        if (response?.success) {
          statusText.textContent = 'Synced to dashboard!';
          statusIndicator.style.background = '#10b981';
          
          chrome.storage.local.set({
            lastSync: new Date().toISOString()
          });
          
          // Clear scraped data after successful sync
          chrome.storage.local.remove(['lastScrapedData'], () => {
            console.log('✅ Cleared scraped data after sync');
          });
          
          // Open dashboard after delay
          setTimeout(() => {
            chrome.tabs.create({ url: `${FRONTEND_URL}/dashboard` });
          }, 1000);
        } else {
          throw new Error(response?.error || 'Sync failed');
        }
      });
      
    } catch (error) {
      console.error('Sync error:', error);
      statusText.textContent = `Error: ${error.message}`;
      statusIndicator.style.background = '#ef4444';
      if (!error.message.includes('Not logged in')) {
        alert(`Sync failed: ${error.message}\n\nMake sure:\n1. You've scraped a page first\n2. You're logged into SERA OS\n3. Backend is running`);
      }
    } finally {
      syncBtn.innerHTML = '<span class="icon">🔄</span> Sync to Dashboard';
      syncBtn.disabled = false;
    }
  }
  
  // ========== FIXED: AI ANALYSIS FUNCTION WITH BETTER DEBUGGING ==========
  async function handleAIAnalysis() {
    aiAnalyzeBtn.innerHTML = '<span class="icon">⏳</span> Analyzing...';
    statusText.textContent = 'AI analyzing...';
    
    try {
      const storedData = await new Promise((resolve) => {
        chrome.storage.local.get(['lastScrapedData', 'authToken'], resolve);
      });
      
      if (!storedData.lastScrapedData) {
        if (confirm('No scraped data found. Would you like to scrape the current page first?')) {
          await handleScrape();
          return;
        }
        throw new Error('Please scrape a page first. Click "Scrape Current Page" before AI analysis.');
      }
      
      if (!storedData.authToken) {
        // Try to auto-get token before showing error
        const gotToken = await checkAndGetTokenFromFrontend();
        if (!gotToken) {
          throw new Error('Please login to SERA OS first. Open the frontend and login, or scrape a page from the frontend.');
        }
        const updatedData = await new Promise((resolve) => {
          chrome.storage.local.get(['lastScrapedData', 'authToken'], resolve);
        });
        Object.assign(storedData, updatedData);
      }
      
      // Prepare text for AI analysis
      let textToAnalyze = '';
      if (storedData.lastScrapedData.content) {
        if (typeof storedData.lastScrapedData.content === 'string') {
          textToAnalyze = storedData.lastScrapedData.content;
        } else {
          textToAnalyze = JSON.stringify(storedData.lastScrapedData.content, null, 2);
        }
      } else {
        textToAnalyze = JSON.stringify(storedData.lastScrapedData, null, 2);
      }
      
      // Limit text length
      textToAnalyze = textToAnalyze.substring(0, 3000);
      
      // ✅ ADDED: Debug logging
      console.log('📤 Sending to AI:', {
        textLength: textToAnalyze.length,
        first100: textToAnalyze.substring(0, 100),
        hasToken: !!storedData.authToken
      });
      
      const response = await fetch(`${BACKEND_URL}/api/ai/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storedData.authToken}`
        },
        body: JSON.stringify({
          text: textToAnalyze,
          maxLength: 300
        })
      });
      
      // ✅ ADDED: Response logging
      console.log('📥 AI Response status:', response.status, response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ AI Response error text:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      // ✅ ADDED: Result logging
      console.log('🤖 AI Result:', data);
      
      if (data.success && data.summary) {
        alert(`📊 AI Summary:\n\n${data.summary}\n\n✅ Summary copied to clipboard!`);
        
        try {
          await navigator.clipboard.writeText(data.summary);
        } catch (clipboardError) {
          console.log('Clipboard error:', clipboardError);
        }
        
        statusText.textContent = 'AI analysis complete!';
        statusIndicator.style.background = '#10b981';
      } else {
        console.log('❌ AI returned success but no summary:', data);
        throw new Error(data.message || 'AI analysis returned no summary');
      }
      
    } catch (error) {
      console.error('AI analysis error:', error);
      statusText.textContent = 'AI analysis failed';
      statusIndicator.style.background = '#ef4444';
      alert(`AI analysis failed: ${error.message}\n\nCheck console for details.`);
    } finally {
      aiAnalyzeBtn.innerHTML = '<span class="icon">🤖</span> AI Analysis';
    }
  }
  
  function handleQuickNote() {
    const note = prompt('Enter quick note:');
    if (note) {
      chrome.storage.local.get(['quickNotes'], (result) => {
        const notes = result.quickNotes || [];
        notes.push({
          text: note,
          timestamp: new Date().toISOString(),
          url: window.location.href
        });
        chrome.storage.local.set({ quickNotes: notes });
        alert('Note saved locally!');
        statusText.textContent = 'Note saved';
        statusIndicator.style.background = '#10b981';
      });
    }
  }
  
  function handleCreateTask() {
    const title = prompt('Task title:');
    if (title) {
      const dueDate = prompt('Due date (YYYY-MM-DD):', 
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      
      chrome.storage.local.get(['pendingTasks'], (result) => {
        const tasks = result.pendingTasks || [];
        tasks.push({
          title,
          dueDate: dueDate || null,
          createdAt: new Date().toISOString(),
          url: window.location.href,
          status: 'pending'
        });
        chrome.storage.local.set({ pendingTasks: tasks });
        alert('Task saved locally! Will sync when you click "Sync to Dashboard".');
        statusText.textContent = 'Task saved locally';
        statusIndicator.style.background = '#10b981';
      });
    }
  }
});