/**
 * Classroom Command Hub - Gmail API Client
 */

import { getAuthToken } from "../utils/auth.js";

const BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch(endpoint, token) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gmail API error [${response.status}]: ${errorBody}`);
  }

  return response.json();
}

/**
 * List message IDs matching a specific search query.
 * Restricts to messages on or after 2026-10-26.
 */
export async function listClassroomMessages(maxResults = 15) {
  const token = await getAuthToken();
  const query = encodeURIComponent("from:classroom.google.com after:2026/10/25");
  const data = await gmailFetch(`/messages?q=${query}&maxResults=${maxResults}`, token);
  return data.messages || [];
}

/**
 * Fetch full message details by message ID.
 */
export async function getMessageDetails(messageId) {
  const token = await getAuthToken();
  const data = await gmailFetch(`/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, token);
  
  const headers = data.payload?.headers || [];
  const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "No Subject";
  const from = headers.find((h) => h.name.toLowerCase() === "from")?.value || "Unknown Sender";
  const date = headers.find((h) => h.name.toLowerCase() === "date")?.value || "";

  return {
    id: data.id,
    snippet: data.snippet || "",
    subject,
    from,
    date
  };
}
