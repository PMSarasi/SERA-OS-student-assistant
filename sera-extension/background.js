// extension/background.js - COMPLETE FIXED VERSION

console.log('🎯 SERA OS Extension Background Service Worker Loaded');

// Track active content scripts
const activeContentScripts = new Set();

// Listen for content script ready messages
chrome.runtime.onMessage.addListener((message, sender) => {
  console.log('📨 Background received:', message.type, 'from tab:', sender.tab?.id);
  
  if (message.type === 'CONTENT_SCRIPT_READY' && sender.tab?.id) {
    console.log(`✅ Content script ready for tab ${sender.tab.id}`);
    activeContentScripts.add(sender.tab.id);
  }
  
  if (message.type === 'PONG' && sender.tab?.id) {
    activeContentScripts.add(sender.tab.id);
  }
  
  // Handle other messages
  if (message.type === 'SCRAPE_PAGE' || message.type === 'SYNC_TO_BACKEND' || 
      message.type === 'CHECK_CONTENT_SCRIPT' || message.type === 'GET_CURRENT_TAB') {
    // These are handled separately
    return;
  }
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  activeContentScripts.delete(tabId);
});

// Backend URL - PRODUCTION
const BACKEND_URL = 'https://sera-backend-185683041424.us-central1.run.app';

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('🚀 SERA OS Extension Installed');
  
  // Initialize storage
  chrome.storage.local.set({
    extensionVersion: '1.0.0',
    installedAt: new Date().toISOString(),
    backendUrl: BACKEND_URL,
    settings: {
      autoScrape: false,
      showFloatingButton: true,
      syncOnScrape: false
    }
  });
  
  // Create context menu
  createContextMenus();
});

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'scrapePage',
      title: '📚 Save to SERA OS',
      contexts: ['page']
    });
    
    chrome.contextMenus.create({
      id: 'openDashboard',
      title: '📊 Open SERA OS Dashboard',
      contexts: ['page']
    });
    
    console.log('✅ Context menus created');
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'scrapePage') {
    handleScrapePage(tab.id);
  } else if (info.menuItemId === 'openDashboard') {
    chrome.tabs.create({ 
      url: 'https://sera-frontend-185683041424.us-central1.run.app/dashboard' 
    });
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received:', message.type);
  
  // Handle async responses
  const handleMessage = async () => {
    try {
      switch (message.type) {
        case 'SCRAPE_PAGE':
          return await handleScrapePage(message.tabId || sender.tab?.id);
          
        case 'SYNC_TO_BACKEND':
          return await handleSyncToBackend(message.data);
          
        case 'GET_CURRENT_TAB':
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          return { tabId: tabs[0]?.id || null };
          
        case 'CHECK_CONTENT_SCRIPT':
          const tabId = message.tabId || sender.tab?.id;
          if (!tabId) return { hasContentScript: false };
          
          // Check cache first
          if (activeContentScripts.has(tabId)) {
            return { hasContentScript: true, tabId };
          }
          
          // Try to ping the content script
          try {
            await chrome.tabs.sendMessage(tabId, { type: 'PING' });
            activeContentScripts.add(tabId);
            return { hasContentScript: true, tabId };
          } catch (error) {
            return { hasContentScript: false, tabId, error: error.message };
          }
          
        case 'CONTENT_SCRIPT_READY':
          if (sender.tab?.id) {
            activeContentScripts.add(sender.tab.id);
          }
          return { success: true };
          
        case 'PING':
          return { type: 'PONG', timestamp: new Date().toISOString() };
          
        default:
          return { success: false, error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('Message handler error:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Execute and send response
  handleMessage().then(sendResponse);
  
  // Return true to indicate async response
  return true;
});

// Function to scrape current page
async function handleScrapePage(tabId) {
  console.log(`🔄 Scraping page with tabId: ${tabId}`);
  
  if (!tabId) {
    return { success: false, error: 'No tab ID provided' };
  }
  
  try {
    // Execute script in the tab to extract content
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: extractPageContent
    });
    
    console.log('📄 Scraped content successfully');
    
    // Store the scraped data
    await chrome.storage.local.set({
      lastScrapedData: result.result,
      lastScraped: new Date().toISOString()
    });
    
    // Update count
    const stored = await chrome.storage.local.get(['scrapedPages']);
    const newCount = (stored.scrapedPages || 0) + 1;
    await chrome.storage.local.set({ scrapedPages: newCount });
    
    return { success: true, data: result.result };
    
  } catch (error) {
    console.error('❌ Scraping error:', error);
    return { success: false, error: error.message };
  }
}

// Function to sync data to backend
async function handleSyncToBackend(data) {
  try {
    // Get user token from storage
    const stored = await chrome.storage.local.get(['authToken']);
    const token = stored.authToken;
    
    if (!token) {
      return { 
        success: false, 
        error: 'Not authenticated. Please login to SERA OS first.' 
      };
    }
    
    console.log('🔄 Syncing to backend:', BACKEND_URL);
    
    const response = await fetch(`${BACKEND_URL}/api/extension/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...data,
        syncedAt: new Date().toISOString(),
        source: 'chrome_extension'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Sync successful');
    
    // Update last sync time
    await chrome.storage.local.set({
      lastSync: new Date().toISOString(),
      lastSyncResult: 'success'
    });
    
    return { success: true, data: result };
    
  } catch (error) {
    console.error('❌ Sync error:', error);
    
    await chrome.storage.local.set({
      lastSync: new Date().toISOString(),
      lastSyncResult: 'failed',
      lastError: error.message
    });
    
    return { success: false, error: error.message };
  }
}

// Function to be injected into pages for content extraction
function extractPageContent() {
  const pageData = {
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString(),
    platform: 'general',
    content: {}
  };
  
  // Detect platform
  const url = window.location.href;
  if (url.includes('canvas') || url.includes('instructure.com')) {
    pageData.platform = 'canvas';
    pageData.content = extractCanvasContent();
  } else if (url.includes('moodle')) {
    pageData.platform = 'moodle';
    pageData.content = extractMoodleContent();
  } else if (url.includes('youtube.com/watch')) {
    pageData.platform = 'youtube';
    pageData.content = extractYouTubeContent();
  } else {
    pageData.platform = 'general';
    pageData.content = extractGeneralContent();
  }
  
  return pageData;
}

function extractCanvasContent() {
  return {
    courseTitle: document.querySelector('.ic-app-header__main-navigation h1')?.textContent?.trim() || 
                document.querySelector('h1')?.textContent?.trim(),
    assignments: Array.from(document.querySelectorAll('.assignment')).map(assign => ({
      title: assign.querySelector('.title')?.textContent?.trim(),
      dueDate: assign.querySelector('.due_date_display')?.textContent?.trim(),
      points: assign.querySelector('.points_possible')?.textContent?.trim()
    })).filter(a => a.title),
    modules: Array.from(document.querySelectorAll('.context_module')).map(module => ({
      title: module.querySelector('.name')?.textContent?.trim(),
      items: Array.from(module.querySelectorAll('.ig-row')).map(item => ({
        title: item.querySelector('.ig-title')?.textContent?.trim(),
        type: item.querySelector('.ig-type')?.textContent?.trim()
      }))
    }))
  };
}

function extractMoodleContent() {
  return {
    courseTitle: document.querySelector('.page-header-headings h1')?.textContent?.trim(),
    sections: Array.from(document.querySelectorAll('.section')).map(section => ({
      title: section.querySelector('.sectionname')?.textContent?.trim(),
      activities: Array.from(section.querySelectorAll('.activity')).map(activity => ({
        title: activity.querySelector('.instancename')?.textContent?.trim(),
        type: activity.className.match(/modtype_(\w+)/)?.[1]
      }))
    }))
  };
}

function extractYouTubeContent() {
  return {
    videoTitle: document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim(),
    channelName: document.querySelector('#owner #channel-name a')?.textContent?.trim(),
    description: document.querySelector('#description')?.textContent?.trim()?.substring(0, 500)
  };
}

function extractGeneralContent() {
  return {
    headings: Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 10).map(h => ({
      tag: h.tagName,
      text: h.textContent?.trim()
    })),
    mainText: document.body.innerText?.substring(0, 5000)
  };
}