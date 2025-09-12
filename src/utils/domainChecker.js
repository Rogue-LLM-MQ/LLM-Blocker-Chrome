export function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function isDomainAllowed(domain) {
  // THE FOLLOWING WOULD BE IN A REAL ENVIRONMENT
  /*const allowedDomains = chrome.storage.managed.get(["domains"], (result) => {
  if (chrome.runtime.lastError) {
    console.error("Error accessing managed storage:", chrome.runtime.lastError);
  } else {
    console.log("Managed domains:", result.domains);
    // Example: check if current site is in the list
  }
  });*/

  // TESTING
  const allowedDomains = {
    "domains": ["openai.com", "anthropic.com", "perplexity.ai", "chatgpt.com"]
  }
  return allowedDomains.domains.includes(domain);
}
