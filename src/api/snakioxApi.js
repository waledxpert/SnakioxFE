const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Snakiox backend request failed");
  }

  return payload;
}

export function getRegistrationMessage(wallet) {
  return request(`/auth/message/${wallet}`);
}

export function registerWallet(wallet, signature) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ wallet, signature })
  });
}

export function getGameStatus(wallet) {
  return request(`/game/status/${wallet}`);
}

export function startGame(wallet) {
  return request("/game/start", {
    method: "POST",
    body: JSON.stringify({ wallet })
  });
}

export function completeGame(result) {
  return request("/game/complete", {
    method: "POST",
    body: JSON.stringify(result)
  });
}

export function getLockedResult(wallet) {
  return request(`/game/result/${wallet}`);
}

export function getLockedResults(wallet) {
  return request(`/game/results/${wallet}`);
}

export function saveReplay(wallet, sessionId, replayURI) {
  return request("/replay/save", {
    method: "POST",
    body: JSON.stringify({ wallet, sessionId, replayURI })
  });
}

export function recordMint(wallet, sessionId, tokenId, txHash) {
  return request("/game/mint-record", {
    method: "POST",
    body: JSON.stringify({ wallet, sessionId, tokenId, txHash })
  });
}

export function getInviteRedeemMessage(wallet, code) {
  return request(`/invite/redeem/message/${wallet}/${code}`);
}

export function redeemInvite(wallet, code, signature) {
  return request("/invite/redeem", {
    method: "POST",
    body: JSON.stringify({ wallet, code, signature })
  });
}

export function getInviteAdminMessage(wallet) {
  return request(`/invite/admin/message/${wallet}`);
}

export function generateInviteCodes(wallet, signature, count) {
  return request("/invite/admin/generate", {
    method: "POST",
    body: JSON.stringify({ wallet, signature, count })
  });
}

export function listInviteCodes(wallet, signature) {
  return request("/invite/admin/list", {
    method: "POST",
    body: JSON.stringify({ wallet, signature })
  });
}

export function clearInviteCodes(wallet, signature) {
  return request("/invite/admin/clear", {
    method: "POST",
    body: JSON.stringify({ wallet, signature })
  });
}

export function readInviteSettings(wallet, signature) {
  return request("/invite/admin/settings/read", {
    method: "POST",
    body: JSON.stringify({ wallet, signature })
  });
}

export function updateInviteSettings(wallet, signature, inviteRequired) {
  return request("/invite/admin/settings", {
    method: "POST",
    body: JSON.stringify({ wallet, signature, inviteRequired })
  });
}

export function listAllowlist(wallet, signature) {
  return request("/invite/admin/allowlist/list", {
    method: "POST",
    body: JSON.stringify({ wallet, signature })
  });
}

export function addAllowlistWallets(wallet, signature, wallets) {
  return request("/invite/admin/allowlist/add", {
    method: "POST",
    body: JSON.stringify({ wallet, signature, wallets })
  });
}

export function removeAllowlistWallet(wallet, signature, targetWallet) {
  return request("/invite/admin/allowlist/remove", {
    method: "POST",
    body: JSON.stringify({ wallet, signature, targetWallet })
  });
}

export function clearAllowlist(wallet, signature) {
  return request("/invite/admin/allowlist/clear", {
    method: "POST",
    body: JSON.stringify({ wallet, signature })
  });
}

export { API_BASE_URL };
