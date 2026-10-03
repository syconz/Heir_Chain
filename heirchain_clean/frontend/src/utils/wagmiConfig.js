import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygonAmoy } from "wagmi/chains";
import { isAddress } from "viem";

export const SUPPORTED_CHAIN = polygonAmoy;
export const CHAIN_ID = polygonAmoy.id;

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

export const CONTRACTS_CONFIGURED = Object.values(ADDRESSES).every((address) => isAddress(address));
export const CONFIGURATION_ERROR = import.meta.env.VITE_DEMO_MODE !== "true"
  && Object.values(ADDRESSES).some(Boolean)
  && !CONTRACTS_CONFIGURED;
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true" || !CONTRACTS_CONFIGURED;
