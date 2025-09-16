// Helper to wrap chrome.storage.local.get in a promise
function getLastBlockedUrl() {
  return new Promise(resolve => {
    chrome.storage.local.get("lastBlockedUrl", result => resolve(result.lastBlockedUrl));
  });
}

// Truncate long URLs
function truncateUrl(url, maxLength = 80) {
  if (!url) return "Unknown URL";
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength / 2) + '…' + url.slice(-maxLength / 2);
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const lastBlockedUrl = await getLastBlockedUrl();
    const displayUrl = truncateUrl(lastBlockedUrl);

    document.getElementById("u").textContent = displayUrl;

    const btn = document.getElementById("copyBtn");
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(lastBlockedUrl).then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy URL", 1500);
      });
    });

  } catch (e) {
    console.error("Failed to read lastBlockedUrl:", e);
    document.getElementById("u").textContent = "Unknown URL";
  }
});
