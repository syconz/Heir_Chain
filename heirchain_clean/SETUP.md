# HeirChain — Full Setup Guide (Live Mode)

Follow these steps to go from demo mode → fully functional on Polygon Amoy testnet.

---

## Step 1 — Get test POL (Amoy testnet tokens)

You need POL to pay gas fees on Amoy.

1. Open https://faucet.polygon.technology
2. Connect your wallet, select "Polygon Amoy"
3. Request tokens — you'll get 0.5 POL (enough for many transactions)

---

## Step 2 — Deploy contracts

```bash
cd heirchain_clean/contracts
cp .env.example .env
```

Open `.env` and fill in:
```
PRIVATE_KEY=your_metamask_private_key_here_no_0x_prefix
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

To get your private key from MetaMask:
- MetaMask → 3 dots → Account Details → Export Private Key
- Remove the "0x" prefix before pasting

Then deploy:
```bash
npm install
npm run deploy:demo
```

You'll see output like:
```
✓ WillRegistry:     0xAbc123...
✓ TriggerVerifier:  0xDef456...
✓ AssetDistributor: 0x789Ghi...

─── Copy these into frontend/.env ────
VITE_DEMO_MODE=false
VITE_CHAIN_ID=80002
VITE_WILL_REGISTRY=0xAbc123...
VITE_TRIGGER_VERIFIER=0xDef456...
VITE_ASSET_DISTRIBUTOR=0x789Ghi...
```

---

## Step 3 — Configure frontend

```bash
cd ../frontend
cp .env.example .env
```

Open `.env` and paste the addresses from Step 2:
```
VITE_DEMO_MODE=false
VITE_CHAIN_ID=80002
VITE_WILL_REGISTRY=0xAbc123...
VITE_TRIGGER_VERIFIER=0xDef456...
VITE_ASSET_DISTRIBUTOR=0x789Ghi...
VITE_WALLETCONNECT_PROJECT_ID=your_id_from_cloud.walletconnect.com
```

---

## Step 4 — Run the app

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## Step 5 — Create your first real will

1. Connect MetaMask (switch to Polygon Amoy)
2. Go to Create Will
3. Pick Deadman Switch trigger (3min inactivity for demo)
4. Add beneficiary address + share %
5. Add a test ERC-20 token address + amount
6. Click Approve & Deploy
7. Confirm 2 transactions in MetaMask:
   - First: ERC-20 approve()
   - Second: createWill()
8. Go to Dashboard — your will appears automatically

---

## Demo flow on stage

1. Dashboard → don't check in → wait 3 minutes
2. Will triggers automatically via Chainlink Automation
   (or click "Demo: Trigger Will" if Chainlink is slow)
3. Dispute window counts down live (5 minutes)
4. Switch to heir wallet → Heir Portal → paste owner address → Claim
5. Assets transfer — verify on https://amoy.polygonscan.com

---

## Faucets & tools

| Tool | URL |
|---|---|
| Polygon Amoy faucet | https://faucet.polygon.technology |
| Amoy block explorer | https://amoy.polygonscan.com |
| WalletConnect project | https://cloud.walletconnect.com |
| Chainlink Automation | https://automation.chain.link |
