// ============================
// ⚙️ CONFIGURATION
// ============================
const LOG_API_URL = "https://api.llmgregmacquarie.lol/opensearch/logs";
const LOG_SEND_INTERVAL_MINUTES = 5;  // send logs every 5 minutes
const LOG_THRESHOLD = 200;            // send immediately after 200 logs
const MAX_EVENTS = 1000;              // store up to 1000 locally
const resourceTypes = ["main_frame", "sub_frame", "xmlhttprequest", "websocket", "webtransport", "ping"];
const filterFor = (domain) => `||${domain}^`;

// ============================
// 🔑 CLIENT IDENTIFIER (per install)
// ============================
async function getClientId() {
    const { clientId } = await chrome.storage.local.get("clientId");
    if (clientId) return clientId;

    const newId = crypto.randomUUID();
    await chrome.storage.local.set({ clientId: newId });
    console.log("🔑 Generated new client ID:", newId);
    return newId;
}

// ============================
// 📡 FETCH LLM DOMAINS
// ============================
async function fetchLLMs() {
    const resp = await fetch("http://api.llmgregmacquarie.lol/llms");
    return await resp.json();
}

// ============================
// 💾 STORAGE HELPERS
// ============================
async function getEvents() {
    const { events = [] } = await chrome.storage.local.get("events");
    return Array.isArray(events) ? events : [];
}

// Append new log entry
async function appendEvent(ev) {
    const clientId = await getClientId();
    const events = await getEvents();

    // Include clientId in every log
    const record = { clientId, ...ev };
    events.push(record);

    // Limit to MAX_EVENTS
    if (events.length > MAX_EVENTS) {
        events.splice(0, events.length - MAX_EVENTS);
    }

    await chrome.storage.local.set({ events });

    // Trigger immediate send if threshold reached
    if (events.length >= LOG_THRESHOLD) {
        console.log(`🚀 Threshold reached (${events.length} logs), sending now...`);
        await sendAndClearLogs();
    }
}

// Send and clear logs
async function sendAndClearLogs() {
    const events = await getEvents();
    if (!events.length) return;

    try {
        const response = await fetch(LOG_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify(events),
        });

        if (response.ok) {
            console.log(`✅ Sent ${events.length} logs to API`);
            await chrome.storage.local.set({ events: [] });
        } else {
            console.warn("❌ Failed to send logs:", response.status);
        }
    } catch (err) {
        console.error("❌ Error sending logs:", err);
    }
}

// ============================
// 🧩 RULE BUILDING
// ============================
function buildRule(id, domain, policy) {
    const baseRule = {
        id,
        priority: 1,
        condition: { urlFilter: filterFor(domain), resourceTypes },
    };

    if (policy === "block") {
        baseRule.action = { type: "block" };
    } else if (policy === "warn") {
        baseRule.action = { type: "redirect", redirect: { extensionPath: "/warning.html" } };
    } else {
        baseRule.action = { type: "allow" };
    }

    return baseRule;
}

// ============================
// 🔐 LOAD POLICIES AND APPLY RULES
// ============================
async function loadPoliciesAndApply() {
    try {
        // 1. Fetch domains from API
        const apiResponse = await fetchLLMs(); // [{_id, domain}, ...]
        const apiDomains = apiResponse.map(item => item.domain);

        // 2. Start with base allow rules
        const baseRules = apiDomains.map((domain, i) => ({
            id: i + 1,
            priority: 1,
            action: { type: "allow" },
            condition: { urlFilter: filterFor(domain), resourceTypes },
        }));

        // 3. Load local policy overrides
        const resp = await fetch(chrome.runtime.getURL("policies.json"));
        const localPolicies = await resp.json();

        // 4. Merge overrides
        for (const { id, domain, policy } of localPolicies) {
            const idx = baseRules.findIndex(r => r.condition.urlFilter === filterFor(domain));
            if (idx !== -1) {
                baseRules[idx] = buildRule(id, domain, policy);
            } else {
                baseRules.push(buildRule(id, domain, policy));
            }
        }

        // 5. Push new rules
        const existing = await chrome.declarativeNetRequest.getDynamicRules();
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existing.map(r => r.id),
            addRules: baseRules,
        });

        console.log("✅ Policies applied:", baseRules);

        const policies = baseRules.map(r => ({
            id: r.id,
            domain: r.condition.urlFilter.replace(/\|\|/, "").replace(/\^/, ""),
            policy: r.action.type === "block"
                ? "block"
                : r.action.type === "redirect"
                ? "warn"
                : "allow",
        }));

        await chrome.storage.local.set({ policies });
    } catch (err) {
        console.error("❌ Error loading policies:", err);
    }
}

// ============================
// 📋 EVENT LOGGING
// ============================
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (e) => {
    const record = {
        "@timestamp": new Date().toISOString(),
        event: { action: "policy.enforced" },
        rule: { id: e.rule?.ruleId ?? null, source: "dynamic" },
        http: { request: { method: e.request?.method || null, referrer: e.request?.initiator || null } },
        url: e.request?.url || null,
        chrome: { tabId: e.request?.tabId ?? null },
    };

    console.log("🧾 Log:", record);
    await appendEvent(record);

    // Store last blocked URL for warning page
    if (e.rule?.action?.type === "redirect") {
        await chrome.storage.local.set({ lastBlockedUrl: e.request.url });
    }
});

// ============================
// 📬 MESSAGE HANDLERS
// ============================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "GET_POLICIES") {
        chrome.storage.local.get("policies", ({ policies = [] }) => {
            sendResponse({ policies });
        });
        return true; // Keep async channel open
    }
});

// ============================
// ⚡ INITIALIZATION
// ============================
chrome.runtime.onInstalled.addListener(loadPoliciesAndApply);
chrome.runtime.onStartup.addListener(loadPoliciesAndApply);
chrome.action.onClicked.addListener(loadPoliciesAndApply);

// ============================
// ⏱️ PERIODIC LOG SENDING
// ============================
setInterval(sendAndClearLogs, LOG_SEND_INTERVAL_MINUTES * 60 * 1000);

// Try flushing before extension unload
chrome.runtime.onSuspend.addListener(sendAndClearLogs);
