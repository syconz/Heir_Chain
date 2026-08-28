import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygonAmoy } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "HeirChain",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo_project_id",
  chains: [polygonAmoy],
  ssr: false,
});

export const ADDRESSES = {
  willRegistry:     import.meta.env.VITE_WILL_REGISTRY     || "",
  triggerVerifier:  import.meta.env.VITE_TRIGGER_VERIFIER  || "",
  assetDistributor: import.meta.env.VITE_ASSET_DISTRIBUTOR || "",
};

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true" || !import.meta.env.VITE_WILL_REGISTRY;
export const CHAIN_ID  = 80002;
