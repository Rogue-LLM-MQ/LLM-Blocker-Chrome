import { useState, useEffect } from "react";

export default function EventDashboard() {
  const [events, setEvents] = useState([]);

  // Get events from chrome.storage.local
  async function getEvents() {
    const { events = [] } = await chrome.storage.local.get("events");
    return Array.isArray(events) ? events : [];
  }

  // Refresh state from storage
  async function refresh() {
    const evs = await getEvents();
    setEvents(evs);
  }

  // Download events as NDJSON
  function downloadNDJSON(lines) {
    const blob = new Blob(lines.map(l => JSON.stringify(l) + "\n"), { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `rogue-llm-events-${ts}.ndjson`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Refresh once on mount
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="p-4 text-center">
      <h1 className="text-lg font-bold">Events logged:</h1>
      <p className="text-blue-500 mt-2">{events.length}</p>

      <div className="mt-4 space-x-2">
        <button
          className="px-4 py-2 bg-green-500 text-white rounded"
          onClick={() => downloadNDJSON(events)}
        >
          Download NDJSON
        </button>
        <button
          className="px-4 py-2 bg-red-500 text-white rounded"
          onClick={async () => {
            await chrome.storage.local.set({ events: [] });
            await refresh();
          }}
        >
          Clear Events
        </button>
      </div>
    </div>
  );
}
