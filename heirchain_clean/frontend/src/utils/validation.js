import { isAddress } from "viem";

/** Returns an error message if the address is invalid, or null if valid. */
export function validateAddress(address) {
  if (!address || !address.trim()) return "Address is required";
  if (!isAddress(address)) return "Invalid address format";
  return null;
}

/** Returns an error message if the share is invalid, or null if valid. */
export function validateSharePercent(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Share is required";
  if (!/^\d+$/.test(text)) return "Share must be a whole number";
  const n = Number(text);
  if (!Number.isSafeInteger(n)) return "Share is too large";
  if (n <= 0) return "Share must be greater than 0";
  if (n > 100) return "Share cannot exceed 100%";
  return null;
}

/** Returns true when all shares sum to exactly 100. */
export function totalSharesValid(beneficiaries) {
  const total = beneficiaries.reduce((s, b) => s + (Number(b.sharePercent) || 0), 0);
  return total === 100;
}

/** Returns null if valid, or an error string. */
export function validateBeneficiary(b) {
  return validateAddress(b.wallet) || validateSharePercent(b.sharePercent);
}

/** Returns null if valid, or an error string. */
export function validateGuardian(address) {
  return validateAddress(address);
}

/** Returns null if valid, or an error string. */
export function validateAsset(asset) {
  const tokenAddress = String(asset.tokenAddress ?? "").trim();
  const value = String(asset.tokenIdOrAmount ?? "").trim();

  if (!tokenAddress) return "Token address is required";
  if (!isAddress(tokenAddress)) return "Invalid token address";
  if (!value) return "Amount or token ID is required";

  if (Number(asset.assetType) === 1) {
    const err = validateAddress(asset.nftBeneficiary);
    if (err) return err;
    if (!/^\d+$/.test(value)) return "Token ID must be a whole number";
    if (BigInt(value) <= 0n) return "Token ID must be greater than 0";
  } else {
    if (!/^\d+(\.\d+)?$/.test(value)) return "Amount must be a positive number";
    if (BigInt(value.replace(".", "")) === 0n) return "Amount must be greater than 0";
  }
  return null;
}

export function hasDuplicateAddresses(addresses = []) {
  const normalized = addresses
    .filter(Boolean)
    .map((address) => address.trim().toLowerCase());
  return new Set(normalized).size !== normalized.length;
}

export function addressesOverlap(first = [], second = []) {
  const other = new Set(second.filter(Boolean).map((address) => address.trim().toLowerCase()));
  return first.filter(Boolean).some((address) => other.has(address.trim().toLowerCase()));
}
