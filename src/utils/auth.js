/**
 * Classroom Command Hub - Authentication Module
 * Handles OAuth2 token retrieval and revocation via chrome.identity.
 */

export async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!token) {
        return reject(new Error("No OAuth token returned."));
      }
      resolve(token);
    });
  });
}

export async function removeCachedAuthToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => {
      resolve();
    });
  });
}
