// ─────────────── Demo will data ───────────────
export const DEMO_WILL_STATUS = {
  exists:         true,
  triggered:      false,
  distributed:    false,
  lastCheckInAt:  Math.floor(Date.now() / 1000) - 5 * 24 * 3600,
  disputeEndsAt:  0,
  triggerMode:    0,
  ipfsMessageCID: "QmXexampleCIDHeirChainDemoMessage123",
};

export const DEMO_BENEFICIARIES = [
  { wallet: "0xAbc1230000000000000000000000000000000001", sharePercent: 60n },
  { wallet: "0xDef4560000000000000000000000000000000002", sharePercent: 40n },
];

export const DEMO_ASSETS = [
  { assetType: 0, tokenAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", tokenIdOrAmount: "500000000000000000000", nftBeneficiary: "0x0000000000000000000000000000000000000000" },
  { assetType: 1, tokenAddress: "0xNFT00000000000000000000000000000000001AA", tokenIdOrAmount: "42", nftBeneficiary: "0xAbc1230000000000000000000000000000000001" },
];

export const DEMO_GUARDIANS = [
  "0xGuardian10000000000000000000000000000001",
  "0xGuardian20000000000000000000000000000002",
];

export const DEMO_STATS = {
  totalWills: 1284,
  protectedValue: "$4.7M+",
  distributions: 37,
};

// ─────────────── Helpers ───────────────
export const TRIGGER_MODES = ["Deadman Switch", "Guardian Multi-sig", "Oracle (V2)"];
export const ASSET_TYPES   = ["ERC-20 Token", "ERC-721 NFT"];

export function shortAddr(addr = "") {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatTimestamp(ts) {
  if (!ts || ts === 0n) return "—";
  return new Date(Number(ts) * 1000).toLocaleString();
}

export function secondsUntil(ts) {
  if (!ts || ts === 0 || ts === 0n) return null;
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(ts) - now;
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function timeAgo(ts) {
  if (!ts) return "—";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(ts);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
