const SEED_SCHEMA = {
  id: "promo-summer-sale",
  title: "Летняя распродажа",
  components: [
    { id: "c1", type: "banner", props: { title: "Летняя распродажа", subtitle: "Скидки до 50% — только 3 дня", tone: "coral" } },
    { id: "c2", type: "heading", props: { text: "Хиты продаж" } },
    {
      id: "c3",
      type: "carousel-v2",
      props: {
        items: [
          { label: "Кроссовки", price: "3 990 ₽" },
          { label: "Куртка", price: "7 490 ₽" },
          { label: "Рюкзак", price: "2 290 ₽" },
        ],
      },
    },
    { id: "c4", type: "button", props: { text: "Смотреть всё", style: "primary" } },
  ],
  fallback: [
    { id: "f1", type: "banner", props: { title: "Летняя распродажа", subtitle: "Скидки до 50% — только 3 дня", tone: "coral" } },
    { id: "f2", type: "text", props: { text: "Смотрите новинки и скидки в приложении." } },
    { id: "f3", type: "button", props: { text: "Смотреть всё", style: "primary" } },
  ],
};

const SIMULATOR_TIMEOUT_MS = 5000;

const schemaInput = document.getElementById("schema-input");
const schemaError = document.getElementById("schema-error");
const simulatorGrid = document.getElementById("simulator-grid");
const simulatorStatus = document.getElementById("simulator-status");
const gateReport = document.getElementById("gate-report");
const publishResult = document.getElementById("publish-result");
const screensList = document.getElementById("screens-list");

const runSimulatorBtn = document.getElementById("run-simulator");
const checkGateBtn = document.getElementById("check-gate");
const publishBtn = document.getElementById("publish");

schemaInput.value = JSON.stringify(SEED_SCHEMA, null, 2);

let manifest = null;
let simulatorRunToken = 0; // invalidates in-flight listeners/timeouts from a previous run

function parseSchema() {
  try {
    const schema = JSON.parse(schemaInput.value);
    schemaError.textContent = "";
    return schema;
  } catch (e) {
    schemaError.textContent = `Invalid JSON: ${e.message}`;
    return null;
  }
}

function setButtonsEnabled(enabled) {
  runSimulatorBtn.disabled = !enabled;
  checkGateBtn.disabled = !enabled;
  publishBtn.disabled = !enabled;
}

async function loadManifest() {
  try {
    const res = await fetch("/api/manifest");
    if (!res.ok) throw new Error(`server responded ${res.status}`);
    manifest = await res.json();
    if (!manifest.profiles || manifest.profiles.length === 0) {
      throw new Error("manifest has no device profiles");
    }
    simulatorStatus.textContent = "";
    setButtonsEnabled(true);
  } catch (e) {
    simulatorStatus.textContent = `Could not load device manifest: ${e.message}. Reload the page to retry.`;
    setButtonsEnabled(false);
  }
}

async function refreshScreensList() {
  try {
    const res = await fetch("/api/screens");
    if (!res.ok) throw new Error(`server responded ${res.status}`);
    const screens = await res.json();
    screensList.innerHTML = "";
    if (screens.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No screens published yet.";
      screensList.appendChild(li);
      return;
    }
    screens.forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${s.title || s.id}</span><span>v${s.version}</span>`;
      screensList.appendChild(li);
    });
  } catch (e) {
    screensList.innerHTML = `<li>Could not load published screens: ${e.message}</li>`;
  }
}

function runSimulator() {
  const schema = parseSchema();
  if (!schema) return;
  if (!manifest) {
    simulatorStatus.textContent = "Device manifest isn't loaded yet — try again in a moment.";
    return;
  }

  simulatorRunToken += 1;
  const runToken = simulatorRunToken;

  simulatorStatus.textContent = "";
  simulatorGrid.innerHTML = "";
  runSimulatorBtn.disabled = true;
  runSimulatorBtn.textContent = "Running…";

  let pending = manifest.profiles.length;
  const done = () => {
    pending -= 1;
    if (pending <= 0 && runToken === simulatorRunToken) {
      runSimulatorBtn.disabled = false;
      runSimulatorBtn.textContent = "Run simulator";
    }
  };

  manifest.profiles.forEach((profile) => {
    const supportedTypes = manifest.capabilities[profile.sdkVersion] || [];

    const card = document.createElement("div");
    card.className = "device-card";

    const header = document.createElement("div");
    header.className = "device-card-header";
    const label = document.createElement("span");
    label.textContent = `${profile.label} · ${profile.userSharePercent}%`;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "running…";
    header.appendChild(label);
    header.appendChild(badge);
    card.appendChild(header);

    const iframe = document.createElement("iframe");
    card.appendChild(iframe);
    simulatorGrid.appendChild(card);

    let settled = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timeoutId);
    };

    const settle = (fn) => {
      if (settled || runToken !== simulatorRunToken) return;
      settled = true;
      cleanup();
      fn();
      done();
    };

    const onMessage = (event) => {
      const data = event.data || {};
      if (data.type === "frame-ready" && event.source === iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          { type: "render", schema, supportedTypes, profileId: profile.id },
          "*"
        );
        return;
      }
      if (data.type === "render-result" && data.profileId === profile.id) {
        settle(() => {
          if (data.result.useFallback) {
            badge.textContent = `fallback (missing: ${data.result.missingTypes.join(", ")})`;
            badge.classList.add("fallback");
          } else {
            badge.textContent = "rendered ok";
            badge.classList.add("ok");
          }
        });
      }
    };

    const timeoutId = setTimeout(() => {
      settle(() => {
        badge.textContent = "no response — reload and retry";
        badge.classList.add("fallback");
      });
    }, SIMULATOR_TIMEOUT_MS);

    iframe.addEventListener("error", () => {
      settle(() => {
        badge.textContent = "failed to load simulator frame";
        badge.classList.add("fallback");
      });
    });

    window.addEventListener("message", onMessage);
    iframe.src = "/shared/simulate-frame.html";
  });
}

async function checkGate() {
  const schema = parseSchema();
  if (!schema) return;

  checkGateBtn.disabled = true;
  try {
    const res = await fetch("/api/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schema),
    });
    if (!res.ok) throw new Error(`server responded ${res.status}`);
    const report = await res.json();

    const riskClass = report.riskPercent >= 25 ? "high" : "low";
    const rows = report.byProfile
      .map(
        (p) => `
        <tr>
          <td>${p.label}</td>
          <td>${p.userSharePercent}%</td>
          <td>${p.affected ? `⚠ fallback (${p.missingTypes.join(", ")})` : "✓ ok"}</td>
        </tr>`
      )
      .join("");

    gateReport.innerHTML = `
      <div class="risk-headline ${riskClass}">${report.riskPercent}% of active sessions would see a fallback</div>
      <table>
        <thead><tr><th>Profile</th><th>Share</th><th>Result</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (e) {
    gateReport.innerHTML = `<div class="error">Gate check failed: ${e.message}</div>`;
  } finally {
    checkGateBtn.disabled = false;
  }
}

async function publishScreen() {
  const schema = parseSchema();
  if (!schema) return;

  publishBtn.disabled = true;
  try {
    const res = await fetch("/api/screens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schema),
    });
    const published = await res.json();

    if (!res.ok) {
      publishResult.innerHTML = `<span class="error">Publish failed: ${published.error}</span>`;
      return;
    }
    publishResult.textContent = `Published "${published.title}" as v${published.version}.`;
    refreshScreensList();
  } catch (e) {
    publishResult.innerHTML = `<span class="error">Publish failed: ${e.message}</span>`;
  } finally {
    publishBtn.disabled = false;
  }
}

setButtonsEnabled(false);
runSimulatorBtn.addEventListener("click", runSimulator);
checkGateBtn.addEventListener("click", checkGate);
publishBtn.addEventListener("click", publishScreen);

loadManifest().then(refreshScreensList);
