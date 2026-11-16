const API = window.PHARMA_API;
const $ = (id) => document.getElementById(id);
function el(tag, props, ...children) {
const e = document.createElement(tag);
for (const [k, v] of Object.entries(props || {})) {
if (k === "class") e.className = v;
else if (k === "text") e.textContent = v;
else e.setAttribute(k, v);
}
for (const c of children) if (c) e.append(c);
return e;
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const when = (iso) => (iso ? new Date(iso).toLocaleString() : "");
async function api(path, options) {
let res;
try {
res = await fetch(API + path, options);
} catch (e) {
throw new Error("Cannot reach the backend at " + API + ". Is app.py running?");
}
let data;
try {
data = await res.json();
} catch (e) {
data = { ok: false, error: "Unexpected response from the server" };
}
return { status: res.status, data };
}
const postJson = (path, body) =>
api(path, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(body),
});
function message(container, ok, text) {
container.replaceChildren(el("div", { class: "msg " + (ok ? "ok" : "err"), text }));
}
// ---------- connection status ----------
async function checkStatus() {
const pill = $("status");
try {
const { data } = await api("/health");
const up = data.ok && data.connected;
pill.textContent = up ? "Connected to blockchain" : "Blockchain offline";
pill.className = up ? "on" : "off";
} catch (e) {
pill.textContent = "Backend offline";
pill.className = "off";
}
}
// ---------- tabs ----------
function showTab(name) {
document
.querySelectorAll(".tabs button")
.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
document.querySelectorAll(".panel").forEach((p) => {
p.hidden = p.id !== "tab-" + name;
});
}
document
.querySelectorAll(".tabs button")
.forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
// ---------- verify ----------
function banner(cls, title, text) {
return el("div", { class: "banner " + cls }, el("h2", { text: title }), el("p", { text }));
}
function renderVerdict(out, batchId, data) {
out.replaceChildren();
if (data.verdict === "NOT_FOUND") {
out.append(
banner(
"v-notfound",
"NOT FOUND",
"This batch ID is not on the ledger. Genuine medicine is always registered at the factory, " +
"so treat this pack as possibly counterfeit.",
),
);
return;
}
if (!data.ok) {
out.append(el("p", { class: "error", text: data.error || "Something went wrong" }));
return;
}
if (data.verdict === "GENUINE") {
out.append(
banner(
"v-genuine",
"GENUINE",
"Registered on the blockchain with an unbroken custody trail and no alerts.",
),
);
} else {
out.append(
banner(
"v-compromised",
"COMPROMISED - do not use",
"The monitoring system flagged this batch (a temperature breach or suspected " +
"counterfeit packaging). Do not dispense it.",
),
);
}
const b = data.batch;
const details = el("dl", {});
[
["Drug", b.drug_name],
["Batch ID", b.batch_id],
["Status", b.status],
["Current holder", cap(b.current_holder_role)],
["Registered", when(data.registered_time)],
].forEach(([k, v]) => {
details.append(el("dt", { text: k }), el("dd", { text: v }));
});
out.append(el("div", { class: "card" }, el("h3", { text: "Batch details" }), details));
const timeline = el("ul", { class: "timeline" });
data.history.forEach((row) => {
const title = row.from_role
? cap(row.from_role) + " \u2192 " + cap(row.to_role)
: "Registered by " + cap(row.to_role);
timeline.append(
el(
"li",
{},
el("strong", { text: title }),
el("small", { text: row.location + " \u00b7 " + when(row.time) }),
),
);
});
out.append(el("div", { class: "card" }, el("h3", { text: "Custody trail" }), timeline));
const temp = el(
"div",
{ class: "card" },
el("h3", { text: "Cold-chain records anchored on-chain" }),
);
if (data.temp_logs.length === 0)
temp.append(el("p", { class: "muted", text: "No temperature records yet." }));
data.temp_logs.forEach((row, i) => {
temp.append(
el("p", {
class: "hash",
text: "#" + (i + 1) + " " + row.data_hash.slice(0, 26) + "... " + when(row.time),
}),
);
});
out.append(temp);
const qrCard = el(
"div",
{ class: "card" },
el("h3", { text: "QR code for this batch" }),
el("img", {
class: "qr",
src: "/qr/" + encodeURIComponent(batchId) + ".png",
alt: "QR code",
width: "160",
height: "160",
}),
);
out.append(qrCard);
}
async function verify(batchId) {
batchId = (batchId || "").trim();
if (!batchId) return;
const out = $("verify-result");
out.replaceChildren(el("p", { class: "muted", text: "Checking the ledger..." }));
try {
const { data } = await api("/verify/" + encodeURIComponent(batchId));
renderVerdict(out, batchId, data);
} catch (e) {
out.replaceChildren(el("p", { class: "error", text: e.message }));
}
}
$("verify-form").addEventListener("submit", (e) => {
e.preventDefault();
verify($("batch-input").value);
});
// ---------- QR scanner ----------
let scanner = null;
async function stopScan() {
if (!scanner) return;
try {
await scanner.stop();
scanner.clear();
} catch (e) {
/* already stopped */
}
scanner = null;
$("reader").hidden = true;
}
function onScanned(text) {
let id = text.trim();
try {
id = new URL(text).searchParams.get("batch") || id;
} catch (e) {
/* plain ID, not a URL */
}
$("batch-input").value = id;
verify(id);
}
$("scan-btn").addEventListener("click", async () => {
const note = $("scan-msg");
note.textContent = "";
if (scanner) {
await stopScan();
return;
}
if (typeof Html5Qrcode === "undefined") {
note.textContent =
"The scanner library did not load (internet needed). Type the batch ID instead.";
return;
}
$("reader").hidden = false;
scanner = new Html5Qrcode("reader");
try {
await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 220 }, (text) => {
stopScan().then(() => onScanned(text));
});
note.textContent = "Point the camera at the QR code. Click Scan QR again to cancel.";
} catch (e) {
note.textContent = "Could not open the camera: " + e;
scanner = null;
$("reader").hidden = true;
}
});
// ---------- manage ----------
$("register-form").addEventListener("submit", async (e) => {
e.preventDefault();
const out = $("register-result");
try {
const id = $("reg-id").value.trim();
const { data } = await postJson("/register-batch", {
batch_id: id,
drug_name: $("reg-drug").value,
location: $("reg-loc").value,
});
if (!data.ok) {
message(out, false, data.error);
return;
}
message(out, true, "Batch " + id + " registered on the blockchain.");
out.append(
el("img", {
class: "qr",
src: "/qr/" + encodeURIComponent(id) + ".png",
alt: "QR code",
width: "160",
height: "160",
}),
el("p", {
class: "muted",
text: "Print this QR code and stick it on the pack (Ctrl+P).",
}),
);
} catch (err) {
message(out, false, err.message);
}
});
$("transfer-form").addEventListener("submit", async (e) => {
e.preventDefault();
const out = $("transfer-result");
try {
const { data } = await postJson("/transfer-custody", {
batch_id: $("tr-id").value.trim(),
new_holder: $("tr-to").value,
location: $("tr-loc").value,
});
message(
out,
data.ok,
data.ok ? "Custody moved to " + cap(data.new_holder) + "." : data.error,
);
} catch (err) {
message(out, false, err.message);
}
});
$("breach-form").addEventListener("submit", async (e) => {
e.preventDefault();
const out = $("breach-result");
try {
const { data } = await postJson("/report-anomaly", {
batch_id: $("br-id").value.trim(),
reason: "Demo: simulated temperature breach",
});
if (!data.ok) {
message(out, false, data.error);
return;
}
message(
out,
true,
data.flagged
? "Batch flagged as COMPROMISED on the blockchain."
: "Batch was already compromised.",
);
} catch (err) {
message(out, false, err.message);
}
});
// ---------- photo check ----------
$("ph-file").addEventListener("change", () => {
const f = $("ph-file").files[0];
const img = $("ph-preview");
if (f) {
img.src = URL.createObjectURL(f);
img.hidden = false;
} else {
img.hidden = true;
}
});
$("photo-form").addEventListener("submit", async (e) => {
e.preventDefault();
const out = $("photo-result");
out.replaceChildren(el("p", { class: "muted", text: "Analysing the photo..." }));
try {
const form = new FormData();
form.append("batch_id", $("ph-id").value.trim());
form.append("image", $("ph-file").files[0]);
const { data } = await api("/verify-image", { method: "POST", body: form });
if (!data.ok) {
message(out, false, data.error);
return;
}
const r = data.result;
const pct = Math.round((r.confidence || 0) * 100);
const fake = (r.label || r.prediction) === "counterfeit";
message(
out,
!fake,
"Model says: " +
(r.label || r.prediction).toUpperCase() +
" (" +
pct +
"% confident). " +
(data.flagged
? "Batch flagged on the blockchain."
: fake
? "Batch was already flagged or confidence was below the threshold."
: "No action taken."),
);
} catch (err) {
message(out, false, err.message);
}
});
// ---------- start ----------
checkStatus();
setInterval(checkStatus, 10000);
const startBatch = new URLSearchParams(location.search).get("batch");
if (startBatch) {
$("batch-input").value = startBatch;
verify(startBatch);
}
