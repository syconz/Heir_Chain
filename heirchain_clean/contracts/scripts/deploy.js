const hre = require("hardhat");

const DEMO_MODE = process.env.DEMO === "true";

const INACTIVITY_THRESHOLD = DEMO_MODE ? 180 : 7_776_000;   // 3min demo / 90 days prod
const DISPUTE_WINDOW       = DEMO_MODE ? 300 : 2_592_000;   // 5min demo / 30 days prod

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\nDeploying HeirChain in ${DEMO_MODE ? "DEMO" : "PRODUCTION"} mode`);
  console.log(`Network:              ${hre.network.name}`);
  console.log(`Deployer:             ${deployer.address}`);
  console.log(`Inactivity threshold: ${INACTIVITY_THRESHOLD}s`);
  console.log(`Dispute window:       ${DISPUTE_WINDOW}s\n`);

  const WillRegistry = await hre.ethers.getContractFactory("WillRegistry");
  const willRegistry = await WillRegistry.deploy(INACTIVITY_THRESHOLD, DISPUTE_WINDOW);
  await willRegistry.waitForDeployment();
  const willRegistryAddr = await willRegistry.getAddress();
  console.log("✓ WillRegistry:    ", willRegistryAddr);

  const TriggerVerifier = await hre.ethers.getContractFactory("TriggerVerifier");
  const triggerVerifier = await TriggerVerifier.deploy(willRegistryAddr);
  await triggerVerifier.waitForDeployment();
  const triggerVerifierAddr = await triggerVerifier.getAddress();
  console.log("✓ TriggerVerifier: ", triggerVerifierAddr);

  const AssetDistributor = await hre.ethers.getContractFactory("AssetDistributor");
  const assetDistributor = await AssetDistributor.deploy(willRegistryAddr);
  await assetDistributor.waitForDeployment();
  const assetDistributorAddr = await assetDistributor.getAddress();
  console.log("✓ AssetDistributor:", assetDistributorAddr);

  await willRegistry.setContracts(triggerVerifierAddr, assetDistributorAddr);
  console.log("✓ Contracts wired\n");

  console.log("─── Copy these into frontend/.env ────────────────────────");
  console.log(`VITE_DEMO_MODE=false`);
  console.log(`VITE_CHAIN_ID=80002`);
  console.log(`VITE_WILL_REGISTRY=${willRegistryAddr}`);
  console.log(`VITE_TRIGGER_VERIFIER=${triggerVerifierAddr}`);
  console.log(`VITE_ASSET_DISTRIBUTOR=${assetDistributorAddr}`);
  console.log("───────────────────────────────────────────────────────────\n");

  if (DEMO_MODE) {
    console.log("Demo mode active:");
    console.log("  Inactivity fires after: 3 minutes");
    console.log("  Dispute window clears:  5 minutes");
    console.log("  If Chainlink is slow → call manualTriggerForDemo() from deployer wallet");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
