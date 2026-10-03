import { Outlet, NavLink, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { CHAIN_ID, CONFIGURATION_ERROR, DEMO_MODE } from "../../utils/wagmiConfig";

const NAV = [
  { to: "/",          label: "Home",      exact: true },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/create",    label: "Create Will" },
  { to: "/guardian",  label: "Guardian" },
  { to: "/heir",      label: "Heir Portal" },
];

function NetworkNotice() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (DEMO_MODE || !isConnected || chainId === CHAIN_ID) return null;

  return (
    <div className="bg-amber-950/60 border-b border-amber-800 px-4 py-3">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
        <p className="text-amber-300">
          <strong>Wrong network.</strong> Switch to Polygon Amoy before signing HeirChain transactions.
        </p>
        {switchChain && (
          <button
            className="btn-secondary !border-amber-700 !text-amber-200 !py-1.5 !px-3 text-xs shrink-0"
            onClick={() => switchChain({ chainId: CHAIN_ID })}
            disabled={isPending}
          >
            {isPending ? "Switching…" : "Switch network"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="border-b border-dark-600 bg-dark-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 shrink-0">
            <span className="text-brand-500 text-xl font-semibold tracking-tight">⛓ HeirChain</span>
          </NavLink>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAV.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm transition-colors duration-150 ${
                    isActive
                      ? "bg-dark-700 text-brand-400"
                      : "text-gray-400 hover:text-gray-100 hover:bg-dark-700"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            {DEMO_MODE && (
              <span className="hidden sm:inline text-xs bg-amber-900/50 text-amber-400 border border-amber-800 px-2 py-1 rounded-md">
                DEMO MODE
              </span>
            )}
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="avatar"
            />
          </div>
        </div>
      </header>

      <NetworkNotice />

      {CONFIGURATION_ERROR && (
        <div className="bg-red-950/60 border-b border-red-800 px-4 py-3">
          <div className="max-w-6xl mx-auto text-sm text-red-300">
            Contract configuration is incomplete or invalid. Set all three Polygon Amoy contract addresses in `frontend/.env` before using live mode.
          </div>
        </div>
      )}

      {/* Page */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-600 py-6 text-center text-xs text-gray-600">
        HeirChain · Polygon Amoy · Non-upgradeable V1 · HackNova 3.0
      </footer>
    </div>
  );
}
