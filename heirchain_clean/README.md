# ⛓ HeirChain — On-chain Digital Wills

> Decentralized asset inheritance on Polygon Mumbai. Your crypto, secured for your heirs.
> Built for HackNova 3.0 — Web3 & Blockchain Track.

---

## What it does

HeirChain lets crypto holders create on-chain wills that automatically distribute ERC-20 tokens and NFTs to named beneficiaries when a verified death trigger fires — no lawyers, no probate, no lost keys.

**Three-step flow:** Register → Trigger → Distribute

---

## Architecture

```
WillRegistry.sol       — stores will, beneficiaries, assets
TriggerVerifier.sol    — Chainlink Automation (deadman) + oracle stub
AssetDistributor.sol   — executes ERC-20/ERC-721 transfers to heirs
```

All contracts are **non-upgradeable**. No proxy, no admin key risk.

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
cp .env.example .env      # fill in PRIVATE_KEY + MUMBAI_RPC_URL
npm install
npm run compile
npm run test

# Deploy to Mumbai in DEMO mode (3min inactivity, 5min dispute window)
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

1. Connect MetaMask (Polygon Mumbai)
2. Create will — set 2 beneficiaries (60/40), add ERC-20 + NFT asset, choose Deadman trigger
3. Approve ERC-20 spend + NFT transfer
4. Wait 3 minutes without checking in (or click "Demo: Trigger Will")
5. Watch dispute window countdown (5 minutes)
6. Switch to heir wallet → Heir Portal → Distribute Assets
7. PolygonScan confirms token transfers

> **If Chainlink Automation is slow on Mumbai:** Call `manualTriggerForDemo()` from the deployer wallet — same outcome, no scrambling on stage.

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

---

## Tech stack

| Layer | Technology |
|---|---|
| Smart contracts | Solidity 0.8.19, Hardhat, OpenZeppelin |
| Blockchain | Polygon Mumbai |
| Oracle | Chainlink Automation |
| Frontend | React, wagmi v2, RainbowKit, Vite |
| Styling | TailwindCSS |

---

## Team

Team Team Team — HackNova 3.0
