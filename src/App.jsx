import { useEffect, useState } from "react";
import { extractDomain, isDomainAllowed } from "./utils/domainChecker"; 
import { fetchLLMs } from "./utils/api";

export default function App() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function checkDomain() {
      // Get current tab URL
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]?.url) {
          const domain = extractDomain(tabs[0].url);
          if (!domain) {
            setUrl("Invalid URL");
            return;
          }

          setUrl(domain);

          // Fetch LLMs from your API
          const llmDomains = await fetchLLMs();
          console.log(llmDomains)
          
          if (llmDomains.some(d => d.domain === domain)) {
            if (isDomainAllowed(domain)) {
              setStatus("✅ LLM, allowed");
            } else {
              setStatus("❌ LLM, not allowed");
            }
          } else {
            setStatus("ℹ️ Not an LLM domain");
          }
        }
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
