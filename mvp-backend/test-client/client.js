import { renderScreen } from "/shared/renderer.js";

// Stand-in for what a real Client SDK stores locally on-device: its own
// version and the manifest of components it supports. In a real client this
// ships baked into the app build; here it's the profile picked from the
// dropdown, sourced from the same synthetic manifest the dashboard uses.
const SCREEN_ID = "promo-summer-sale";

let manifest = null;

const select = document.getElementById("profile-select");
const diagnostics = document.getElementById("diagnostics");
const screenRoot = document.getElementById("screen-root");

async function loadManifest() {
  const res = await fetch("/api/manifest");
  manifest = await res.json();
  select.innerHTML = "";
  manifest.profiles.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.label} (${p.userSharePercent}% of users)`;
    select.appendChild(opt);
  });
}

async function renderCurrent() {
  const profile = manifest.profiles.find((p) => p.id === select.value);
  const supportedTypes = manifest.capabilities[profile.sdkVersion] || [];

  const res = await fetch(`/api/screens/${SCREEN_ID}/latest`);
  if (!res.ok) {
    screenRoot.innerHTML = '<p class="empty">No published screen yet — publish one from the dashboard first.</p>';
    diagnostics.textContent = "";
    return;
  }
  const schema = await res.json();

  // The fallback decision happens entirely locally, from data already on the
  // device (the schema + its bundled fallback, and this SDK's own capability
  // list) — no extra round trip to decide.
  const result = renderScreen(screenRoot, schema, supportedTypes);

  diagnostics.textContent = result.useFallback
    ? `⚠ Fallback rendered locally — SDK ${profile.sdkVersion} doesn't support: ${result.missingTypes.join(", ")}`
    : `✓ Rendered live on SDK ${profile.sdkVersion} — all components supported`;
}

select.addEventListener("change", renderCurrent);
document.getElementById("refresh").addEventListener("click", renderCurrent);

loadManifest().then(renderCurrent);
