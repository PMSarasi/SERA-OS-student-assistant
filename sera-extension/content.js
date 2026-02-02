// extension/content.js - COMPLETELY FIXED VERSION WITH ERROR HANDLING

console.log('🎯 SERA OS Content Script Loaded on:', window.location.href);

// ======== ERROR HANDLING FOR OTHER EXTENSIONS ========
// Prevent other scripts from trying to connect before we're ready
window.addEventListener('message', (event) => {
  // Filter out messages that might be trying to connect to our extension
  if (event.data && event.data.type === 'EXTENSION_CONNECT') {
    event.stopImmediatePropagation();
  }
});

// Also handle the common error gracefully
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('Could not establish connection')) {
    // Silently ignore this common extension connection error
    event.preventDefault();
    return false;
  }
});

// ======== SIMPLIFIED EXTENSION READY CHECK ========
function checkExtensionReady() {
  return new Promise((resolve) => {
    if (chrome.runtime?.id) {
      resolve(true);
      return;
    }
    
    // Try 5 times with 200ms delay
    let attempts = 0;
    const check = () => {
      attempts++;
      if (chrome.runtime?.id) {
        resolve(true);
        return;
      }
      if (attempts >= 5) {
        resolve(false);
        return;
      }
      setTimeout(check, 200);
    };
    setTimeout(check, 200);
  });
}

// ======== MAIN FUNCTIONS ========

// CRITICAL FIX: BETTER PAGE DETECTION
function detectPageType() {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();
  const hostname = window.location.hostname.toLowerCase();
  
  console.log('🔍 Page detection:', { url, hostname, title });
  
  // Check for Canvas
  if (hostname.includes('instructure.com') || 
      hostname.includes('canvas') ||
      url.includes('instructure.com') ||
      document.querySelector('[class*="canvas"]') ||
      document.querySelector('[id*="canvas"]') ||
      title.includes('canvas')) {
    console.log('🎯 Detected: Canvas');
    return 'canvas';
  }
  
  // Check for Moodle
  if (hostname.includes('moodle') ||
      url.includes('moodle') ||
      document.querySelector('[class*="moodle"]') ||
      document.querySelector('[id*="moodle"]') ||
      title.includes('moodle')) {
    console.log('🎯 Detected: Moodle');
    return 'moodle';
  }
  
  // Check for YouTube
  if (hostname.includes('youtube.com') && url.includes('/watch')) {
    console.log('🎯 Detected: YouTube');
    return 'youtube';
  }
  
  // Check for PDF
  if (url.endsWith('.pdf') || 
      document.querySelector('embed[type="application/pdf"]') ||
      document.querySelector('iframe[src*=".pdf"]')) {
    console.log('🎯 Detected: PDF');
    return 'pdf';
  }
  
  // Check for Google Docs
  if (hostname.includes('docs.google.com') || 
      document.querySelector('[class*="docs"]')) {
    console.log('🎯 Detected: Google Docs');
    return 'docs';
  }
  
  console.log('🎯 Detected: General Web Page');
  return 'general';
}

function extractCanvasContent() {
  const content = {
    platform: 'Canvas',
    courseTitle: document.querySelector('.ic-app-header__main-navigation h1')?.textContent?.trim() || 
                document.querySelector('h1')?.textContent?.trim() ||
                document.title,
    assignments: [],
    modules: [],
    announcements: [],
    grades: []
  };
  
  // Extract assignments
  document.querySelectorAll('.assignment, .ig-row.assignment').forEach(element => {
    const title = element.querySelector('.title, .ig-title')?.textContent?.trim();
    if (title) {
      content.assignments.push({
        title,
        dueDate: element.querySelector('.due_date_display')?.textContent?.trim(),
        points: element.querySelector('.points_possible')?.textContent?.trim()
      });
    }
  });
  
  // Extract modules
  document.querySelectorAll('.context_module').forEach(module => {
    const moduleTitle = module.querySelector('.name')?.textContent?.trim();
    if (moduleTitle) {
      content.modules.push({
        title: moduleTitle,
        items: Array.from(module.querySelectorAll('.ig-row')).map(item => ({
          title: item.querySelector('.ig-title')?.textContent?.trim(),
          type: item.querySelector('.ig-type')?.textContent?.trim()
        }))
      });
    }
  });
  
  return content;
}

function extractMoodleContent() {
  const content = {
    platform: 'Moodle',
    courseTitle: document.querySelector('.page-header-headings h1')?.textContent?.trim() ||
                document.title,
    sections: []
  };
  
  document.querySelectorAll('.section').forEach(section => {
    const sectionTitle = section.querySelector('.sectionname')?.textContent?.trim();
    if (sectionTitle) {
      content.sections.push({
        title: sectionTitle,
        activities: Array.from(section.querySelectorAll('.activity')).map(activity => ({
          title: activity.querySelector('.instancename')?.textContent?.trim(),
          type: activity.className.match(/modtype_(\w+)/)?.[1] || 'Activity'
        }))
      });
    }
  });
  
  return content;
}

function extractYouTubeContent() {
  return {
    platform: 'YouTube',
    videoTitle: document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() ||
               document.title.replace(' - YouTube', ''),
    channelName: document.querySelector('#owner #channel-name a')?.textContent?.trim(),
    description: document.querySelector('#description')?.textContent?.trim()?.substring(0, 300)
  };
}

function extractGeneralContent() {
  // Try to extract main content
  const mainSelectors = ['main', 'article', '#content', '.content'];
  let mainContent = '';
  
  for (const selector of mainSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      mainContent = element.innerText;
      break;
    }
  }
  
  if (!mainContent) {
    mainContent = document.body.innerText.substring(0, 3000);
  }
  
  return {
    platform: 'Web',
    pageTitle: document.title,
    headings: Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 5).map(h => ({
      tag: h.tagName,
      text: h.textContent?.trim()
    })),
    mainText: mainContent.substring(0, 2000)
  };
}

function extractPageContent() {
  const pageType = detectPageType();
  const data = {
    url: window.location.href,
    title: document.title,
    type: pageType,
    timestamp: new Date().toISOString(),
    content: {}
  };
  
  switch (pageType) {
    case 'canvas':
      data.content = extractCanvasContent();
      break;
    case 'moodle':
      data.content = extractMoodleContent();
      break;
    case 'youtube':
      data.content = extractYouTubeContent();
      break;
    case 'general':
      data.content = extractGeneralContent();
      break;
    default:
      data.content = { message: 'Page type not specifically supported' };
  }
  
  return data;
}

// ======== MAIN INITIALIZATION ========
(async function initContentScript() {
  console.log('🔧 Starting SERA OS content script initialization...');
  
  // Check if extension is ready
  const isReady = await checkExtensionReady();
  
  if (!isReady) {
    console.error('❌ Extension not ready');
    return;
  }
  
  console.log('✅ Extension runtime available');
  
  // Set global flag
  window._SERA_EXTENSION_LOADED = true;
  window._SERA_EXTENSION_VERSION = '1.0.2'; // Updated version
  
  // Register with background script
  try {
    await chrome.runtime.sendMessage({ 
      type: 'CONTENT_SCRIPT_READY',
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
    console.log('✅ Content script registered with background');
  } catch (error) {
    console.log('⚠️ Initial registration failed (might recover):', error.message);
  }
  
  // Initialize all other functions
  initializeContentScript();
})();

function initializeContentScript() {
  console.log('🚀 Initializing content script functions...');
  
  // ======== AUTO TOKEN SYNC FROM FRONTEND ========
  function syncTokenFromFrontend() {
    if (window.location.href.includes('sera-frontend-185683041424.us-central1.run.app')) {
      console.log('🔑 Detected SERA OS frontend, syncing token...');
      
      try {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (token) {
          console.log('✅ Found token in frontend localStorage');
          
          chrome.storage.local.set({ 
            authToken: token,
            user: user ? JSON.parse(user) : null,
            lastTokenSync: new Date().toISOString()
          }, () => {
            console.log('✅ Token synced to extension storage');
            
            try {
              chrome.runtime.sendMessage({ 
                type: 'TOKEN_UPDATED',
                token: token 
              });
            } catch (e) {
              console.log('Could not notify background:', e.message);
            }
          });
        } else {
          console.log('❌ No token found in frontend localStorage');
          chrome.storage.local.remove(['authToken', 'user'], () => {
            console.log('🗑️ Cleared token from extension storage');
          });
        }
      } catch (error) {
        console.log('Token sync error:', error);
      }
    }
  }
  
  // Run token sync on page load
  syncTokenFromFrontend();
  
  // Listen for localStorage changes
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    if (key === 'token' || key === 'user') {
      setTimeout(syncTokenFromFrontend, 100);
    }
  };
  
  const originalRemoveItem = localStorage.removeItem;
  localStorage.removeItem = function(key) {
    originalRemoveItem.apply(this, arguments);
    if (key === 'token' || key === 'user') {
      setTimeout(syncTokenFromFrontend, 100);
    }
  };
  
  // Listen for messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Content script received:', message.type);
    
    switch (message.type) {
      case 'EXTRACT_CONTENT':
        sendResponse({ success: true, content: extractPageContent() });
        break;
      
      case 'CHECK_PAGE_TYPE':
        sendResponse({ pageType: detectPageType() });
        break;
      
      case 'GET_LOCALSTORAGE':
        try {
          const token = localStorage.getItem('token');
          const user = localStorage.getItem('user');
          sendResponse({ token, user: user ? JSON.parse(user) : null });
        } catch (error) {
          sendResponse({ token: null, error: error.message });
        }
        break;
      
      case 'GET_PAGE_DATA':
        sendResponse({ 
          success: true, 
          data: extractPageContent(),
          pageType: detectPageType()
        });
        break;
      
      case 'PING':
        sendResponse({ type: 'PONG' });
        break;
        
      case 'GET_TOKEN':
        try {
          const token = localStorage.getItem('token');
          const user = localStorage.getItem('user');
          sendResponse({ 
            token, 
            user: user ? JSON.parse(user) : null,
            source: 'content_script' 
          });
        } catch (error) {
          sendResponse({ token: null, error: error.message });
        }
        break;
        
      default:
        sendResponse({ error: 'Unknown message type' });
    }
    
    return true;
  });
  
  // Add SERA OS button to detected LMS pages
  function injectSERAButton() {
    try {
      const pageType = detectPageType();
      if (pageType === 'canvas' || pageType === 'moodle' || pageType === 'youtube') {
        // Remove existing button
        const existingButton = document.getElementById('sera-os-button');
        if (existingButton) existingButton.remove();
        
        const button = document.createElement('button');
        button.id = 'sera-os-button';
        button.innerHTML = '📚 Save to SERA OS';
        button.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #3b82f6;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          border: none;
          font-weight: bold;
          cursor: pointer;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
        `;
        
        button.onmouseenter = () => {
          button.style.background = '#2563eb';
          button.style.transform = 'translateY(-2px)';
        };
        
        button.onmouseleave = () => {
          button.style.background = '#3b82f6';
          button.style.transform = 'translateY(0)';
        };
        
        button.onclick = async () => {
          const originalText = button.innerHTML;
          button.innerHTML = '⏳ Saving...';
          button.disabled = true;
          
          try {
            const pageData = extractPageContent();
            
            chrome.runtime.sendMessage({ 
              type: 'SCRAPE_PAGE'
            }, (scrapeResponse) => {
              if (scrapeResponse?.success) {
                button.innerHTML = '✅ Saved!';
                button.style.background = '#10b981';
                
                setTimeout(() => {
                  button.innerHTML = originalText;
                  button.style.background = '#3b82f6';
                  button.disabled = false;
                }, 2000);
              } else {
                button.innerHTML = '❌ Failed';
                button.style.background = '#ef4444';
                setTimeout(() => {
                  button.innerHTML = originalText;
                  button.style.background = '#3b82f6';
                  button.disabled = false;
                }, 2000);
              }
            });
            
          } catch (error) {
            console.error('Save error:', error);
            button.innerHTML = '❌ Error';
            button.style.background = '#ef4444';
            setTimeout(() => {
              button.innerHTML = originalText;
              button.style.background = '#3b82f6';
              button.disabled = false;
            }, 2000);
          }
        };
        
        document.body.appendChild(button);
      }
    } catch (error) {
      console.log('Error injecting button:', error);
    }
  }
  
  // Inject button after delay
  setTimeout(injectSERAButton, 2000);
  
  // Watch for DOM changes (for SPAs)
  const observer = new MutationObserver(() => {
    injectSERAButton();
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  console.log('✅ Content script fully initialized');
}