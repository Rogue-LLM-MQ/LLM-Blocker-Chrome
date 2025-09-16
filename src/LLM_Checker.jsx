import { useEffect, useState } from "react";

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export default function LLM_Checker() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function checkDomain() {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tabUrl = tabs[0]?.url;
        if (!tabUrl) return;

        const domain = extractDomain(tabUrl);
        setUrl(domain || "Invalid URL");
        if (!domain) return;

        chrome.runtime.sendMessage({ type: "GET_POLICIES" }, ({ policies }) => {
            console.log(policies)
            const policyEntry = policies.find(p => p.domain === domain);
            console.log("Policy entry",policyEntry)
            if (!policyEntry) {
            setStatus("ℹ️ Not an LLM domain");
            } else {
            if (policyEntry.policy === "allow") setStatus("✅ LLM, allowed");
            else if (policyEntry.policy === "warn") setStatus("⚠️ LLM, warn");
            else if (policyEntry.policy === "block") setStatus("❌ LLM, blocked");
            }
        });
        });
    }

    checkDomain();
    }, []);

  return (
    <div className="p-4 text-center">
      <h1 className="text-lg font-bold">You are on:</h1>
      <p className="text-blue-500 mt-2">{url || "Loading..."}</p>
      <p className="mt-4">{status}</p>
    </div>
  );
}
