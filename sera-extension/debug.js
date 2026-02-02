// extension/debug.js - Simple content script test
console.log('🔧 SERA OS Debug Script Loaded');

// Test if we're loaded
window._SERA_DEBUG = true;

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Debug received:', message.type);
  
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG', debug: true });
    return true;
  }
  
  if (message.type === 'GET_PAGE_INFO') {
    sendResponse({
      url: window.location.href,
      title: document.title,
      hostname: window.location.hostname,
      hasCanvas: window.location.href.includes('canvas'),
      hasMoodle: window.location.href.includes('moodle'),
      timestamp: new Date().toISOString()
    });
    return true;
  }
  
  return false;
});

// Signal we're ready
setTimeout(() => {
  try {
    chrome.runtime.sendMessage({ 
      type: 'DEBUG_SCRIPT_READY',
      url: window.location.href 
    });
  } catch (e) {
    console.log('Debug script cannot send message:', e.message);
  }
}, 1000);