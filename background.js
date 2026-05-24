// Default sites to block on first install
const DEFAULT_SITES = [
  { domain: "tiktok.com", enabled: true },
  { domain: "reddit.com", enabled: true },
  { domain: "cnbc.com", enabled: true },
  { domain: "news.ycombinator.com", enabled: true },
  { domain: "facebook.com", enabled: true },
  { domain: "instagram.com", enabled: true },
  { domain: "x.com", enabled: true },
  { domain: "twitter.com", enabled: true },
  { domain: "techcrunch.com", enabled: true },
  { domain: "youtube.com", enabled: false }  // off by default — user's call
];

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(["sites", "globalEnabled"]);
  if (!stored.sites) {
    await chrome.storage.sync.set({ sites: DEFAULT_SITES, globalEnabled: true });
  }
  await rebuildRules();
});

chrome.runtime.onStartup.addListener(async () => {
  await rebuildRules();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "REBUILD_RULES") {
    rebuildRules().then(() => sendResponse({ ok: true }));
    return true; // keep channel open for async
  }
});

async function rebuildRules() {
  const { sites = [], globalEnabled = true } = await chrome.storage.sync.get(["sites", "globalEnabled"]);

  // Remove all existing dynamic rules
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  const newRules = [];

  if (globalEnabled) {
    sites.forEach((site, index) => {
      if (!site.enabled) return;

      const domain = site.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

      newRules.push({
        id: index + 1,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: `||${domain}^`,
          resourceTypes: ["main_frame", "sub_frame"]
        }
      });
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: newRules
  });
}
