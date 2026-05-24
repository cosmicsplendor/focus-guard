let sites = [];
let globalEnabled = true;
let confirmingIndex = null; // which site is awaiting name confirmation

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
    const isConfirming = confirmingIndex === i;
    const isBlocked = site.enabled && !isConfirming;
    const row = document.createElement("div");
    row.className = "site-row" + ((!site.enabled || !globalEnabled) ? " disabled" : "");

    const isYoutube = site.domain.includes("youtube");
    const tag = isYoutube ? `<span class="youtube-tag">⚠ partial</span>` : "";

    if (isConfirming) {
      // Inline confirmation UI — replace the row contents
      row.className = "site-row confirming";
      row.innerHTML = `
        <div class="confirm-block">
          <div class="confirm-prompt">type <strong>${site.domain}</strong> to unblock</div>
          <div class="confirm-input-row">
            <input
              type="text"
              class="confirm-input"
              id="confirmInput_${i}"
              placeholder="${site.domain}"
              autocomplete="off"
              spellcheck="false"
            />
            <button class="cancel-btn" data-index="${i}">✕</button>
          </div>
        </div>
      `;
    } else {
      row.innerHTML = `
        <label class="toggle">
          <input type="checkbox" ${site.enabled ? "checked" : ""} data-index="${i}" class="site-toggle" />
          <span class="toggle-track"></span>
        </label>
        <span class="site-domain">${site.domain}</span>
        ${tag}
        <button class="delete-btn" data-index="${i}" title="Remove">✕</button>
      `;
    }

    list.appendChild(row);
  });

  // Bind regular toggles
  list.querySelectorAll(".site-toggle").forEach(cb => {
    cb.addEventListener("change", async e => {
      const idx = parseInt(e.target.dataset.index);
      const currentlyBlocked = sites[idx].enabled; // was on, now turning off — no friction needed

      if (!currentlyBlocked) {
        // blocking — no friction, instant
        sites[idx].enabled = false;
        confirmingIndex = null;
        await save();
        render();
      } else {
        // Trying to unblock — require confirmation
        e.target.checked = false; // revert visual
        confirmingIndex = idx;
        render();
        // Focus the input after render
        const inp = document.getElementById(`confirmInput_${idx}`);
        if (inp) inp.focus();
      }
    });
  });

  // Bind confirm inputs
  list.querySelectorAll(".confirm-input").forEach(inp => {
    const idx = parseInt(inp.id.replace("confirmInput_", ""));

    inp.addEventListener("input", e => {
      const typed = e.target.value.trim().toLowerCase();
      const expected = sites[idx].domain.toLowerCase();
      if (typed === expected) {
        inp.classList.add("match");
      } else {
        inp.classList.remove("match");
      }
    });

    inp.addEventListener("keydown", async e => {
      if (e.key === "Enter") {
        const typed = inp.value.trim().toLowerCase();
        const expected = sites[idx].domain.toLowerCase();
        if (typed === expected) {
          sites[idx].enabled = true;
          confirmingIndex = null;
          await save();
          render();
        } else {
          inp.classList.add("shake");
          setTimeout(() => inp.classList.remove("shake"), 400);
        }
      }
      if (e.key === "Escape") {
        confirmingIndex = null;
        render();
      }
    });
  });

  // Cancel buttons (inside confirm row)
  list.querySelectorAll(".cancel-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      confirmingIndex = null;
      render();
    });
  });

  // Delete buttons (normal rows)
  list.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      const idx = parseInt(e.target.dataset.index);
      sites.splice(idx, 1);
      confirmingIndex = null;
      await save();
      render();
    });
  });

  updateCounts();

  // Focus confirm input if one is open
  if (confirmingIndex !== null) {
    const inp = document.getElementById(`confirmInput_${confirmingIndex}`);
    if (inp) inp.focus();
  }
}

function updateCounts() {
  const active = globalEnabled ? sites.filter(s => s.enabled).length : 0;
  const total = sites.length;
  document.getElementById("ruleCount").textContent = `${total} rule${total !== 1 ? "s" : ""}`;
  document.getElementById("activeCount").textContent =
    active > 0 ? `${active} blocking` : "none active";
}

function cleanDomain(raw) {
  return raw.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

// Master toggle — also require typing to re-enable if pausing
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

  const list = document.getElementById("siteList");
  list.scrollTop = list.scrollHeight;
}

document.getElementById("addBtn").addEventListener("click", addSite);
document.getElementById("addInput").addEventListener("keydown", e => {
  if (e.key === "Enter") addSite();
});

load();
