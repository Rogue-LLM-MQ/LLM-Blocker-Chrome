// Fetch LLMs from local API
async function fetchLLMs() {
    const resp = await fetch("http://localhost:3000/llms");
    return await resp.json();
}

// Constants
const MAX_EVENTS = 1000;
const resourceTypes = ["main_frame", "sub_frame", "xmlhttprequest", "websocket", "webtransport", "ping"];
const filterFor = (domain) => `||${domain}^`;

// Storage helpers
async function getEvents() {
    const { events = [] } = await chrome.storage.local.get("events");
    return Array.isArray(events) ? events : [];
}

async function appendEvent(ev) {
    const events = await getEvents();
    events.push(ev);
    if (events.length > MAX_EVENTS) {
        events.splice(0, events.length - MAX_EVENTS);
    }
    await chrome.storage.local.set({ events });
}

// Build a declarativeNetRequest rule
function buildRule(id, domain, policy) {
    const baseRule = {
        id,
        priority: 1,
        condition: { urlFilter: filterFor(domain), resourceTypes }
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

// Load policies from API + local overrides and apply them
async function loadPoliciesAndApply() {
    // 1. Fetch API domains
    const apiResponse = await fetchLLMs(); // [{_id, domain}, ...]
    const apiDomains = apiResponse.map(item => item.domain);

    // 2. Start by allowing API domains
    const baseRules = apiDomains.map((domain, i) => ({
        id: i + 1,
        priority: 1,
        action: { type: "allow" },
        condition: { urlFilter: filterFor(domain), resourceTypes }
    }));

    // 3. Load local overrides
    const resp = await fetch(chrome.runtime.getURL("policies.json"));
    const localPolicies = await resp.json();

    // 4. Apply local overrides
    for (const { id, domain, policy } of localPolicies) {
        const idx = baseRules.findIndex(r => r.condition.urlFilter === filterFor(domain));
        if (idx !== -1) {
            baseRules[idx] = buildRule(id, domain, policy);
        } else {
            baseRules.push(buildRule(id, domain, policy));
        }
    }

    // 5. Push rules to Chrome
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existing.map(r => r.id),
        addRules: baseRules
    });

    console.log("Base Rules:", baseRules);

    const policies = baseRules.map(r => ({
        id: r.id,
        domain: r.condition.urlFilter.replace(/\|\|/, "").replace(/\^/, ""),
        policy: r.action.type === "block" ? "block" : r.action.type === "redirect" ? "warn" : "allow",
        provider: r.provider || null
    }));

    await chrome.storage.local.set({ policies });
}

// Log every enforced policy
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (e) => {
    const record = {
        "@timestamp": new Date().toISOString(),
        event: { action: "policy.enforced" },
        rule: { id: e.rule?.ruleId ?? null, source: "dynamic" },
        http: { request: { method: e.request?.method || null, referrer: e.request?.initiator || null } },
        url: e.request?.url || null,
        chrome: { tabId: e.request?.tabId ?? null }
    };

    console.log(JSON.stringify(record));
    await appendEvent(record);

    // Store last blocked/warned URL for warning page
    if (e.rule?.action?.type === "redirect") {
        await chrome.storage.local.set({ lastBlockedUrl: e.request.url });
    }
});

// Respond to messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "GET_POLICIES") {
        chrome.storage.local.get("policies", ({ policies = [] }) => {
            sendResponse({ policies });
        });
        return true; // Keep channel open for async
    }
});

// Apply policies on install/startup and on toolbar click
chrome.runtime.onInstalled.addListener(loadPoliciesAndApply);
chrome.runtime.onStartup.addListener(loadPoliciesAndApply);
chrome.action.onClicked.addListener(loadPoliciesAndApply);
