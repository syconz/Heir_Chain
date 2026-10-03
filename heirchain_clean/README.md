# ⛓ HeirChain — On-chain Digital Wills

> Decentralized asset inheritance on Polygon Amoy. Your crypto, secured for your heirs.
> Built for HackNova 3.0 — Web3 & Blockchain Track.

---

## What it does

HeirChain lets crypto holders create on-chain wills that programmatically distribute ERC-20 tokens and NFTs to named beneficiaries after a verified trigger and dispute window — no lawyers, no probate, no lost keys.

**Three-step flow:** Register → Trigger → Distribute

---

## Architecture

```
WillRegistry.sol       — stores will, beneficiaries, assets
TriggerVerifier.sol    — Chainlink Automation (deadman) + oracle stub
AssetDistributor.sol   — executes ERC-20/ERC-721 transfers to heirs
```

All contracts are **non-upgradeable**. There is no proxy upgrade path, while the documented owner controls (pause, initial wiring, and V1 demo/oracle operations) remain explicit and auditable.

### Immutability Rationale & V2 Migration Strategy

1. **Why Non-Upgradeable:** For an inheritance protocol, users must trust that rules governing their funds cannot be modified unilaterally after will creation. No admin key can alter distribution logic or redirect beneficiary shares.
2. **V2 Migration Path:**
   - **For Will Owners:** Active will owners can call `revokeWill()` on V1 at any time (as long as it has not been distributed) and redeploy their will on the V2 registry.
   - **No Stuck Funds:** Because HeirChain V1 holds approvals rather than custodying assets in an escrow pool, migrating to V2 requires only revoking approval from V1 `AssetDistributor` and approving V2 `AssetDistributor`. No contract fund drain or token lockup occurs.

---

## V1 Scope (locked)

| Feature | Status |
|---|---|
| ERC-20 + ERC-721 distribution | ✅ Full |
| Deadman Switch (Chainlink Automation) | ✅ Full |
| Guardian Multi-sig (M-of-N) | ✅ Full |
| Oracle / Chainlink Functions | 🔶 Stub (ORACLE_ROLE) |
| ETH escrow | ❌ V2 |
| Vesting | ❌ V2 |

---

## Quickstart

### 1. Contracts

```bash
cd contracts
cp .env.example .env      # fill in PRIVATE_KEY + AMOY_RPC_URL
npm install
npm run compile
npm run test

# Deploy to Amoy in DEMO mode (3min inactivity, 5min dispute window)
npm run deploy:demo
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env      # paste contract addresses from deploy output
npm install
npm run dev               # → http://localhost:5173
```

Set `VITE_DEMO_MODE=true` to run without a deployed contract.

---

## Demo flow (on stage)

1. Connect MetaMask (Polygon Amoy)
2. Create will — set 2 beneficiaries (60/40), add ERC-20 + NFT asset, choose Deadman trigger
3. Approve ERC-20 spend + NFT transfer
4. Wait 3 minutes without checking in (or click "Demo: Trigger Will")
5. Watch dispute window countdown (5 minutes)
6. Switch to heir wallet → Heir Portal → Distribute Assets
7. PolygonScan confirms token transfers

> **If Chainlink Automation is slow on Amoy:** Call `manualTriggerForDemo()` from the deployer wallet — same outcome, no scrambling on stage.

---

## Security checklist

- [x] `ReentrancyGuard` on `AssetDistributor.distribute()`
- [x] `Pausable` on `WillRegistry` and `AssetDistributor`
- [x] `sum(sharePercent) == 100` enforced at will creation
- [x] All addresses validated `!= address(0)`
- [x] Beneficiaries capped at 10, assets at 20
- [x] Guardian double-vote blocked
- [x] `nftBeneficiary != 0` required for ERC-721
- [x] Non-upgradeable, no proxies

> V1 is non-custodial: the owner keeps assets in their wallet and approves `AssetDistributor` to transfer them later. A will is only operational while those approvals and balances remain available.

---

## Tech stack

| Layer | Technology |
|---|---|
| Smart contracts | Solidity 0.8.20, Hardhat, OpenZeppelin |
| Blockchain | Polygon Amoy |
| Oracle | Chainlink Automation |
| Frontend | React, wagmi v2, RainbowKit, Vite |
| Styling | TailwindCSS |

---

## Team

Team Team Team — HackNova 3.0
