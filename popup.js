let sites = [];
let globalEnabled = true;

async function load() {
  const data = await chrome.storage.sync.get(["sites", "globalEnabled"]);
  sites = data.sites || [];
  globalEnabled = data.globalEnabled !== false;
  render();
}

async function save() {
  await chrome.storage.sync.set({ sites, globalEnabled });
  chrome.runtime.sendMessage({ type: "REBUILD_RULES" });
  updateCounts();
}

function render() {
  const list = document.getElementById("siteList");
  const masterToggle = document.getElementById("masterToggle");
  const statusBadge = document.getElementById("statusBadge");

  masterToggle.checked = globalEnabled;
  statusBadge.textContent = globalEnabled ? "ACTIVE" : "PAUSED";
  statusBadge.className = "status-badge " + (globalEnabled ? "active" : "paused");

  if (sites.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">◎</div>
        <div>No sites blocked.</div>
        <div style="margin-top:4px;color:#333">Add a domain below.</div>
      </div>`;
    updateCounts();
    return;
  }

  list.innerHTML = "";
  sites.forEach((site, i) => {
    const row = document.createElement("div");
    row.className = "site-row" + ((!site.enabled || !globalEnabled) ? " disabled" : "");

    const isYoutube = site.domain.includes("youtube");
    const tag = isYoutube
      ? `<span class="youtube-tag">⚠ partial</span>`
      : "";

    row.innerHTML = `
      <label class="toggle">
        <input type="checkbox" ${site.enabled ? "checked" : ""} data-index="${i}" class="site-toggle" />
        <span class="toggle-track"></span>
      </label>
      <span class="site-domain">${site.domain}</span>
      ${tag}
      <button class="delete-btn" data-index="${i}" title="Remove">✕</button>
    `;

    list.appendChild(row);
  });

  // Bind toggles
  list.querySelectorAll(".site-toggle").forEach(cb => {
    cb.addEventListener("change", async e => {
      const idx = parseInt(e.target.dataset.index);
      sites[idx].enabled = e.target.checked;
      await save();
      render();
    });
  });

  // Bind delete buttons
  list.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      const idx = parseInt(e.target.dataset.index);
      sites.splice(idx, 1);
      await save();
      render();
    });
  });

  updateCounts();
}

function updateCounts() {
  const active = globalEnabled ? sites.filter(s => s.enabled).length : 0;
  const total = sites.length;
  document.getElementById("ruleCount").textContent = `${total} rule${total !== 1 ? "s" : ""}`;
  document.getElementById("activeCount").textContent =
    active > 0 ? `${active} blocking` : "none active";
}

function cleanDomain(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

// Master toggle
document.getElementById("masterToggle").addEventListener("change", async e => {
  globalEnabled = e.target.checked;
  await save();
  render();
});

// Add site
async function addSite() {
  const input = document.getElementById("addInput");
  const raw = input.value.trim();
  if (!raw) return;

  const domain = cleanDomain(raw);
  if (!domain || !domain.includes(".")) {
    input.style.borderColor = "var(--red)";
    setTimeout(() => input.style.borderColor = "", 800);
    return;
  }

  if (sites.some(s => s.domain === domain)) {
    input.select();
    return;
  }

  sites.push({ domain, enabled: true });
  input.value = "";
  await save();
  render();

  // Scroll to bottom
  const list = document.getElementById("siteList");
  list.scrollTop = list.scrollHeight;
}

document.getElementById("addBtn").addEventListener("click", addSite);
document.getElementById("addInput").addEventListener("keydown", e => {
  if (e.key === "Enter") addSite();
});

load();
