import { Link } from "react-router-dom";
import { Card } from "../components/ui";
import { DEMO_MODE } from "../utils/wagmiConfig";

export default function Home() {
  return (
    <div className="flex flex-col gap-16 animate-fade-in">

      {/* Hero */}
      <section className="text-center py-16 flex flex-col items-center gap-6">
        <div className="inline-flex items-center gap-2 bg-brand-900/30 border border-brand-800 text-brand-400 text-xs px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse-slow" />
          {DEMO_MODE ? "Demo environment — no real transactions" : "Live on Polygon Amoy Testnet"}
        </div>

        <h1 className="text-5xl font-semibold text-gray-100 leading-tight max-w-2xl">
          Your crypto,{" "}
          <span className="text-brand-400">secured</span>{" "}
          for your heirs
        </h1>

        <p className="text-gray-400 text-lg max-w-xl leading-relaxed">
          HeirChain lets you create an on-chain will that programmatically distributes
          your digital assets after a verified trigger and dispute period.
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/create" className="btn-primary text-base px-8 py-3">
            Create Your Will
          </Link>
          <Link to="/dashboard" className="btn-secondary text-base px-8 py-3">
            View Dashboard
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Supported assets", value: "ERC-20 + NFTs" },
          { label: "Trigger modes",    value: "Deadman + M-of-N" },
          { label: "Network",          value: "Polygon Amoy" },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card text-center">
            <span className="text-xl font-semibold text-brand-400">{value}</span>
            <span className="text-sm text-gray-500">{label}</span>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-xl font-semibold text-gray-100 mb-6 text-center">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              step: "01",
              title: "Register",
              desc: "Create an on-chain will. Set your beneficiaries, their percentage splits, and which assets to include.",
            },
            {
              step: "02",
              title: "Trigger",
              desc: "Choose how your will activates — inactivity timer, guardian vote, or oracle verification.",
            },
            {
              step: "03",
              title: "Distribute",
              desc: "After the configured dispute window, any heir can execute the distribution to all beneficiaries.",
            },
          ].map(({ step, title, desc }) => (
            <Card key={step} className="flex flex-col gap-3">
              <span className="text-brand-500 font-mono text-sm">{step}</span>
              <h3 className="text-gray-100 font-semibold text-lg">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Trigger modes */}
      <section>
        <h2 className="text-xl font-semibold text-gray-100 mb-6 text-center">Trigger mechanisms</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: "⏱",
              title: "Deadman Switch",
              tag: "V1 — Full",
              tagColor: "green",
              desc: "You check in periodically. If you miss the window, Chainlink Automation fires the trigger.",
            },
            {
              icon: "🗳",
              title: "Guardian Multi-sig",
              tag: "V1 — Full",
              tagColor: "green",
              desc: "Trusted family members cast votes. When M-of-N confirm, the will activates automatically.",
            },
            {
              icon: "🔮",
              title: "Oracle Verification",
              tag: "V2 — Coming",
              tagColor: "gray",
              desc: "Chainlink Functions queries a death registry API. Forward-compatible with India's DigiLocker.",
            },
          ].map(({ icon, title, tag, tagColor, desc }) => (
            <Card key={title} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{icon}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  tagColor === "green"
                    ? "bg-brand-900/50 text-brand-400 border border-brand-800"
                    : "bg-dark-600 text-gray-500"
                }`}>{tag}</span>
              </div>
              <h3 className="text-gray-100 font-medium">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Security note */}
      <section className="glass p-6 border-l-2 border-brand-600">
        <h3 className="text-gray-200 font-medium mb-2">Security model</h3>
        <p className="text-gray-500 text-sm leading-relaxed">
           HeirChain is intentionally <span className="text-gray-300">non-upgradeable</span>, so deployed distribution rules cannot be replaced through a proxy.
           Guardian multi-sig reduces single-point-of-failure on death verification, while the dispute window prevents an immediate transfer after a trigger.
           V1 still has explicit owner controls for pausing and demo/oracle operations, and the oracle path is planned for V2.
        </p>
      </section>

    </div>
  );
}
