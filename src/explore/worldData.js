// Ported from the extension's portal-data.js. Pure logic + browser-API calls,
// no DOM coupling — routed through storage.js so it also degrades gracefully
// (returns safe defaults / no-ops) outside the extension popup.
import { getExtAPI, isExtensionContext, storageGet, storageSet, storageRemove } from '../storage.js';

const extAPI = getExtAPI();

// Get active tab URL and generate portal data
export async function getActiveTabPortalData() {
  if (!isExtensionContext) return null;
  try {
    const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return null;

    const tab = tabs[0];
    const url = new URL(tab.url);

    return {
      domain: url.hostname,
      title: tab.title,
      url: tab.url,
      favicon: tab.favIconUrl,
      tabId: tab.id
    };
  } catch (error) {
    console.error('Error getting tab data:', error);
    return null;
  }
}

// Navigate the active tab to a new URL
export async function navigateActiveTab(url) {
  if (!isExtensionContext) return false;
  try {
    const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return false;

    await extAPI.tabs.update(tabs[0].id, { url });
    return true;
  } catch (error) {
    console.error('Error navigating tab:', error);
    return false;
  }
}

// Navigate the active tab to a new URL and wait for it to load
export async function navigateActiveTabAndWait(url) {
  if (!isExtensionContext) return false;
  try {
    const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return false;

    const tabId = tabs[0].id;

    const loadPromise = new Promise((resolve) => {
      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          extAPI.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      extAPI.tabs.onUpdated.addListener(listener);

      setTimeout(() => {
        extAPI.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 10000);
    });

    await extAPI.tabs.update(tabId, { url });
    await loadPromise;
    await new Promise(resolve => setTimeout(resolve, 500));

    return true;
  } catch (error) {
    console.error('Error navigating tab:', error);
    return false;
  }
}

// Custom portal destinations (frxst.io owner mode)
export async function getCustomPortalDestinations() {
  return storageGet('customPortalDestinations', []);
}

export async function saveCustomPortalDestinations(destinations) {
  await storageSet('customPortalDestinations', destinations);
  return true;
}

export async function addCustomPortalDestination(destination) {
  const destinations = await getCustomPortalDestinations();
  destinations.push(destination);
  await saveCustomPortalDestinations(destinations);
  return destinations;
}

export async function removeCustomPortalDestination(index) {
  const destinations = await getCustomPortalDestinations();
  destinations.splice(index, 1);
  await saveCustomPortalDestinations(destinations);
  return destinations;
}

// Detect if a domain is likely an e-commerce site
function isEcommerceSite(domain) {
  const ecommerceIndicators = [
    'amazon', 'ebay', 'etsy', 'walmart', 'target', 'bestbuy', 'apple',
    'nike', 'adidas', 'shop', 'store', 'market', 'cart', 'buy'
  ];
  return ecommerceIndicators.some(indicator => domain.includes(indicator));
}

// Detect site category
function getSiteCategory(domain) {
  if (isEcommerceSite(domain)) return 'merchant';

  const socialSites = ['twitter', 'facebook', 'instagram', 'tiktok', 'linkedin', 'reddit', 'pinterest'];
  if (socialSites.some(site => domain.includes(site))) return 'social';

  const entertainmentSites = ['youtube', 'netflix', 'hulu', 'twitch', 'spotify'];
  if (entertainmentSites.some(site => domain.includes(site))) return 'entertainment';

  const newsSites = ['news', 'cnn', 'bbc', 'nytimes', 'wsj', 'reuters'];
  if (newsSites.some(site => domain.includes(site))) return 'news';

  return 'default';
}

// Define what each website generates in the world. Kept byte-for-byte
// faithful to the original, including the `merchant` blocks — Merchant is
// ported at reduced scope (placeholder "check back later" modal, no item
// catalog rendering), so this data still carries the greeting/name but the
// `items` list is simply unused by the UI for now.
export function getWorldConfiguration(domain) {
  const category = getSiteCategory(domain);

  const configs = {
    'www.google.com': {
      type: 'portal_hub',
      name: 'Search Portal',
      description: 'Gateway to the web',
      color: 0xffffff,
      emissive: 0xcccccc,
      portalDestinations: [
        { name: 'Apple', url: 'https://www.apple.com', icon: '🍎', description: 'Visit the merchant' },
        { name: 'YouTube', url: 'https://www.youtube.com', icon: '📺', description: 'Video dimension' },
        { name: 'frxst.io', url: 'https://frxst.io', icon: '❄️', description: 'Enter the Paradigm' }
      ],
      collectibles: [],
      generateCollectibles: true
    },

    'frxst.io': {
      type: 'owner_world',
      name: 'Paradigm Nexus',
      description: 'Your personal cyberspace',
      color: 0xb0dff4,
      emissive: 0xb0dff4,
      portalDestinations: [],
      hasCustomPortal: true,
      collectibles: [],
      generateCollectibles: true,
      environment: {
        snowflakes: true,
        hexPillars: [
          { position: [-25, 0, -25], height: 8 },
          { position: [25, 0, -25], height: 6 },
          { position: [-25, 0, 25], height: 7 },
          { position: [25, 0, 25], height: 9 }
        ],
        blizzard: true
      }
    },

    'www.youtube.com': {
      type: 'collectible_world',
      name: 'YouTube Realm',
      description: 'Video dimension',
      color: 0xff0000,
      emissive: 0xff0000,
      portalDestinations: [],
      collectibles: [],
      generateCollectibles: true
    },

    'www.apple.com': {
      type: 'merchant_world',
      name: 'Apple Store',
      description: 'Technology marketplace',
      color: 0xa6a6a6,
      emissive: 0xffffff,
      portalDestinations: [],
      collectibles: [],
      generateCollectibles: true,
      merchant: {
        position: [0, 0, 15],
        name: 'Apple Merchant',
        greeting: 'Welcome to the Digital Marketplace. Enhance your exploration.',
        items: []
      }
    },

    'default': {
      type: 'basic_world',
      name: 'Web Space',
      description: 'Explore the digital realm',
      color: 0x9370db,
      emissive: 0x9370db,
      portalDestinations: [],
      collectibles: [],
      generateCollectibles: true
    }
  };

  if (configs[domain]) {
    return configs[domain];
  }

  const baseConfig = { ...configs['default'] };

  if (category === 'merchant') {
    baseConfig.type = 'merchant_world';
    baseConfig.merchant = {
      position: [0, 0, 15],
      name: 'Digital Merchant',
      greeting: 'Browse our collection of enhancements.',
      items: []
    };
  }

  return baseConfig;
}

// Owner mode (frxst.io authoring UI)
export async function checkOwnerStatus(domain) {
  if (domain !== 'frxst.io' && domain !== 'www.frxst.io') return false;
  return storageGet('ownerAuthenticated', false);
}

export async function verifyOwnerPassphrase(passphrase) {
  const SECRET_PASSPHRASE = 'paradigm-nexus-2026';
  if (passphrase === SECRET_PASSPHRASE) {
    await storageSet('ownerAuthenticated', true);
    return true;
  }
  return false;
}

export async function clearOwnerAuth() {
  await storageRemove('ownerAuthenticated');
}

// Editor preferences (color/blizzard/grid) — the DOM code in the old
// cyberworld-scene.js that read/wrote these directly is gone, so this small
// pair of functions is the new home for that get/set.
const DEFAULT_EDITOR_PREFS = { color: '#b0dff4', blizzardEnabled: true, gridEnabled: true };

export async function getEditorPreferences() {
  return storageGet('editorPreferences', DEFAULT_EDITOR_PREFS);
}

export async function saveEditorPreferences(prefs) {
  await storageSet('editorPreferences', prefs);
  return true;
}
