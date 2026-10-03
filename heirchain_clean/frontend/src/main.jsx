import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { Toaster } from "react-hot-toast";
import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";
import App from "./App";
import { config } from "./utils/wagmiConfig";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#22c55e",
            accentColorForeground: "black",
            borderRadius: "medium",
            fontStack: "system",
          })}
        >
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: "#1a1a1a", color: "#f3f4f6", border: "1px solid #2a2a2a", fontFamily: "JetBrains Mono, monospace", fontSize: "13px" },
              success: { iconTheme: { primary: "#22c55e", secondary: "#0a0a0a" } },
              error:   { iconTheme: { primary: "#ef4444", secondary: "#0a0a0a" } },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
