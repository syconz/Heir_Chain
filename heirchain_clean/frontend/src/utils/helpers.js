// ─────────────── Demo will data ───────────────
export const DEMO_WILL_STATUS = {
  exists:         true,
  triggered:      false,
  distributed:    false,
  lastCheckInAt:  Math.floor(Date.now() / 1000) - 5 * 24 * 3600,
  disputeEndsAt:  0,
  triggerMode:    0,
  requiredGuardians: 0n,
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

// ─────────────── Helpers ───────────────
export function formatTokenAmount(amount, decimals = 18) {
  try {
    const precision = Number(decimals);
    if (!Number.isInteger(precision) || precision < 0 || precision > 77) return "—";
    const value = BigInt(amount ?? 0);
    if (value < 0n) return "—";
    const divisor = 10n ** BigInt(precision);
    const whole = value / divisor;
    const fraction = (value % divisor).toString().padStart(precision, "0").replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch {
    return "—";
  }
}

export const TRIGGER_MODES = ["Deadman Switch", "Guardian Multi-sig", "Oracle (V2)"];
export const ASSET_TYPES   = ["ERC-20 Token", "ERC-721 NFT"];

export function shortAddr(addr = "") {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatTimestamp(ts) {
  if (!ts || ts === 0n) return "—";
  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp)) return "—";
  return new Date(timestamp * 1000).toLocaleString();
}

export function secondsUntil(ts) {
  if (!ts || ts === 0 || ts === 0n) return null;
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(ts) - now;
  if (!Number.isFinite(diff) || diff <= 0) return null;
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
  if (!Number.isFinite(diff)) return "—";
  if (diff < 0) {
    const until = Math.abs(diff);
    if (until < 60) return `in ${until}s`;
    if (until < 3600) return `in ${Math.floor(until / 60)}m`;
    if (until < 86400) return `in ${Math.floor(until / 3600)}h`;
    return `in ${Math.floor(until / 86400)}d`;
  }
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Convert wallet/library errors into a message safe to show in the UI. */
export function getErrorMessage(error, fallback = "Something went wrong") {
  if (!error) return fallback;
  if (error.name === "UserRejectedRequestError" || error.code === 4001) {
    return "Transaction cancelled in your wallet";
  }
  return error.shortMessage || error.reason || error.message || fallback;
}
