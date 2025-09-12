import { API_BASE } from "./config";

export async function fetchLLMs() {
  try {
    const response = await fetch(`${API_BASE}/LLMs`);
    if (!response.ok) throw new Error("Failed to fetch domains");
    return await response.json(); // Expecting ["example.com", "test.com"]
  } catch (error) {
    console.error("Error fetching domains:", error);
    return [];
  }
}
