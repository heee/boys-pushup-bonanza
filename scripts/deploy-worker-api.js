import fs from "node:fs/promises";

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !accountId) throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required");

const scriptName = process.argv[2] || "boys-pushup-bonanza-worker";
const databaseId = process.argv[3];
if (!databaseId) throw new Error("D1 database ID is required");
const root = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`;
const auth = { Authorization: `Bearer ${token}` };

const settingsResponse = await fetch(`${root}/settings`, { headers: auth });
const settingsPayload = await settingsResponse.json();
if (!settingsResponse.ok || !settingsPayload.success) throw new Error(JSON.stringify(settingsPayload.errors || settingsPayload));

const retainedBindingNames = new Set(["ALLOWED_ORIGIN", "APP_KEY", "GEOAPIFY_API_KEY"]);
const inherited = (settingsPayload.result.bindings || [])
  .filter((binding) => retainedBindingNames.has(binding.name))
  .map((binding) => ({ name: binding.name, type: "inherit" }));
const metadata = {
  main_module: "index.js",
  compatibility_date: "2026-08-05",
  bindings: [...inherited, { name: "DB", type: "d1", id: databaseId }],
  annotations: { "workers/message": "Migrate app storage from public Git JSON to D1" },
};
const source = await fs.readFile("worker/index.js", "utf8");
const form = new FormData();
form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
form.append("index.js", new Blob([source], { type: "application/javascript+module" }), "index.js");
const uploadResponse = await fetch(`${root}?bindings_inherit=strict`, { method: "PUT", headers: auth, body: form });
const uploadPayload = await uploadResponse.json();
if (!uploadResponse.ok || !uploadPayload.success) throw new Error(JSON.stringify(uploadPayload.errors || uploadPayload));
console.log(JSON.stringify({ scriptName, databaseId, inheritedBindings: inherited.map((binding) => binding.name), deployed: true }, null, 2));
