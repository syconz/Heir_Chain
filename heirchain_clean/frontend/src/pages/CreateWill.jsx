import { useState } from "react";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { useCreateWill } from "../hooks/useWillRegistry";
import { useRegisterMonitoring } from "../hooks/useTriggerVerifier";
import { useApproveERC20, useApproveERC721 } from "../hooks/useAssetDistributor";
import { Card, SectionHeader, Spinner } from "../components/ui";
import { DEMO_MODE } from "../utils/wagmiConfig";
import toast from "react-hot-toast";

const STEPS = ["Trigger", "Beneficiaries", "Linked Wallets", "Assets", "Review & Deploy"];

const EMPTY_BENEFICIARY = { wallet: "", sharePercent: "" };
const EMPTY_ASSET       = { assetType: "0", tokenAddress: "", tokenIdOrAmount: "", nftBeneficiary: "", sourceWallet: "primary" };
const EMPTY_LINKED      = { address: "", label: "", approved: false };

const shortAddr = (a = "") => a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

export default function CreateWill() {
  const { address } = useAccount();
  const navigate    = useNavigate();
  const [step, setStep] = useState(0);

  const [triggerMode, setTriggerMode]     = useState("0");
  const [guardians, setGuardians]         = useState([""]);
  const [requiredGuardians, setRequired]  = useState("1");
  const [beneficiaries, setBeneficiaries] = useState([{ ...EMPTY_BENEFICIARY }]);
  const [assets, setAssets]               = useState([{ ...EMPTY_ASSET }]);
  const [linkedWallets, setLinkedWallets] = useState([]);
  const [ipfsCID, setIpfsCID]             = useState("");
  const [approving, setApproving]         = useState(false);
  const [done, setDone]                   = useState(false);

  const { createWill, isPending: creating, isSuccess } = useCreateWill();
  const { register }              = useRegisterMonitoring();
  const { approve: approveERC20 } = useApproveERC20();
  const { approve: approveNFT }   = useApproveERC721();

  // ── Field helpers ─────────────────────────────────────────────────────────
  const totalShares = beneficiaries.reduce((s, b) => s + (Number(b.sharePercent) || 0), 0);

  const updateBeneficiary = (i, f, v) => { const n = [...beneficiaries]; n[i] = { ...n[i], [f]: v }; setBeneficiaries(n); };
  const addBeneficiary    = () => beneficiaries.length < 10 && setBeneficiaries([...beneficiaries, { ...EMPTY_BENEFICIARY }]);
  const removeBeneficiary = (i) => setBeneficiaries(beneficiaries.filter((_, x) => x !== i));

  const updateAsset = (i, f, v) => { const n = [...assets]; n[i] = { ...n[i], [f]: v }; setAssets(n); };
  const addAsset    = () => assets.length < 20 && setAssets([...assets, { ...EMPTY_ASSET }]);
  const removeAsset = (i) => setAssets(assets.filter((_, x) => x !== i));

  const updateGuardian = (i, v) => { const n = [...guardians]; n[i] = v; setGuardians(n); };

  const updateLinked = (i, f, v) => { const n = [...linkedWallets]; n[i] = { ...n[i], [f]: v }; setLinkedWallets(n); };
  const addLinked    = () => setLinkedWallets([...linkedWallets, { ...EMPTY_LINKED }]);
  const removeLinked = (i) => setLinkedWallets(linkedWallets.filter((_, x) => x !== i));
  const markApproved = (i) => {
    updateLinked(i, "approved", true);
    toast.success("Marked as approved. Remember to actually call approve() from that wallet.");
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const canNext = () => {
    if (step === 0) return triggerMode === "1"
      ? guardians.every(g => g.trim()) && Number(requiredGuardians) > 0
      : true;
    if (step === 1) return totalShares === 100 && beneficiaries.every(b => b.wallet.trim() && b.sharePercent);
    if (step === 2) return true; // linked wallets — always optional
    if (step === 3) return assets.every(a =>
      a.tokenAddress.trim() && a.tokenIdOrAmount &&
      (a.assetType === "0" || a.nftBeneficiary.trim())
    );
    return true;
  };

  // ── Deploy ────────────────────────────────────────────────────────────────
  const handleDeploy = async () => {
    setApproving(true);
    try {
      for (const asset of assets.filter(a => a.sourceWallet === "primary")) {
        if (asset.assetType === "0") await approveERC20(asset.tokenAddress, ethers.parseEther(asset.tokenIdOrAmount));
        else await approveNFT(asset.tokenAddress, BigInt(asset.tokenIdOrAmount));
      }

      const result = await createWill([
        Number(triggerMode),
        BigInt(triggerMode === "1" ? requiredGuardians : 0),
        triggerMode === "1" ? guardians.filter(g => g.trim()) : [],
        beneficiaries.map(b => ({ wallet: b.wallet, sharePercent: BigInt(b.sharePercent) })),
        assets.map(a => ({
          assetType:       Number(a.assetType),
          tokenAddress:    a.tokenAddress,
          tokenIdOrAmount: a.assetType === "0" ? ethers.parseEther(a.tokenIdOrAmount) : BigInt(a.tokenIdOrAmount),
          nftBeneficiary:  a.assetType === "1" ? a.nftBeneficiary : ethers.ZeroAddress,
        })),
        ipfsCID,
      ]);

      if (result) {
        if (triggerMode === "0" && address) await register(address);
        setDone(true);
      }
    } finally {
      setApproving(false);
    }
  };

  // ── Success ───────────────────────────────────────────────────────────────
  if (done || isSuccess) {
    const pendingWallets = linkedWallets.filter(w => w.address.trim() && !w.approved);
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <Card className="text-center flex flex-col items-center gap-5 py-12">
          <span className="text-5xl">✅</span>
          <div>
            <h2 className="text-2xl font-semibold text-gray-100">Will Created</h2>
            <p className="text-gray-500 text-sm mt-2">Your on-chain will is live on Polygon Amoy.</p>
            {pendingWallets.length > 0 && (
              <div className="mt-4 text-left glass p-4">
                <p className="text-amber-400 text-sm font-medium mb-2">⚠ Action needed — linked wallet approvals:</p>
                {pendingWallets.map((w, i) => (
                  <p key={i} className="text-gray-500 text-xs">• Switch to {w.label || shortAddr(w.address)} → call approve() for each token</p>
                ))}
              </div>
            )}
          </div>
          <button className="btn-primary px-8" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <SectionHeader title="Create Your Will" subtitle="All fields stored on-chain. No personal data required." />

      {/* Step indicator */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
              i < step   ? "bg-brand-500 text-black" :
              i === step ? "bg-dark-600 border-2 border-brand-500 text-brand-400" :
                           "bg-dark-700 text-gray-600"
            }`}>{i < step ? "✓" : i + 1}</div>
            <span className={`text-xs hidden sm:block truncate ${i === step ? "text-gray-200" : "text-gray-600"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-dark-600 mx-1 shrink-0 w-4" />}
          </div>
        ))}
      </div>

      {/* ── Step 0: Trigger ── */}
      {step === 0 && (
        <Card>
          <h2 className="section-title">Choose trigger mechanism</h2>
          <div className="flex flex-col gap-3 mb-6">
            {[
              { val: "0", title: "Deadman Switch", desc: "Check in periodically. Chainlink Automation fires if you miss the window." },
              { val: "1", title: "Guardian Multi-sig", desc: "Trusted family/friends vote to confirm death (M-of-N)." },
            ].map(({ val, title, desc }) => (
              <label key={val} className={`glass p-4 cursor-pointer flex gap-4 items-start transition-colors ${triggerMode === val ? "border-brand-500" : ""}`}>
                <input type="radio" name="trigger" value={val} checked={triggerMode === val}
                  onChange={e => setTriggerMode(e.target.value)} className="mt-1 accent-brand-500" />
                <div>
                  <p className="text-gray-200 font-medium">{title}</p>
                  <p className="text-gray-500 text-sm mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
            <div className="glass p-4 opacity-50 cursor-not-allowed flex gap-4 items-start">
              <input type="radio" disabled className="mt-1" />
              <div>
                <p className="text-gray-400 font-medium">Oracle Verification <span className="text-xs text-gray-600">(V2)</span></p>
                <p className="text-gray-600 text-sm mt-0.5">Chainlink Functions queries a death registry — available in V2.</p>
              </div>
            </div>
          </div>
          {triggerMode === "1" && (
            <div className="flex flex-col gap-4 pt-4 border-t border-dark-600">
              <div>
                <label className="label">Required approvals (M-of-N)</label>
                <input type="number" min="1" max={guardians.length} value={requiredGuardians}
                  onChange={e => setRequired(e.target.value)} className="input w-28" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="label">Guardian addresses</label>
                {guardians.map((g, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={g} onChange={e => updateGuardian(i, e.target.value)}
                      placeholder="0x…" className="input font-mono text-sm" />
                    {guardians.length > 1 && (
                      <button onClick={() => setGuardians(guardians.filter((_, x) => x !== i))}
                        className="text-gray-600 hover:text-red-400 px-2">✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setGuardians([...guardians, ""])}
                  className="text-brand-500 text-sm hover:text-brand-400 text-left">+ Add guardian</button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Step 1: Beneficiaries ── */}
      {step === 1 && (
        <Card>
          <h2 className="section-title">Add beneficiaries</h2>
          <p className="text-gray-500 text-sm mb-5">Shares must add up to 100%. Max 10 beneficiaries.</p>
          <div className="flex flex-col gap-3">
            {beneficiaries.map((b, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={b.wallet} onChange={e => updateBeneficiary(i, "wallet", e.target.value)}
                  placeholder="0x… wallet address" className="input flex-1 font-mono text-sm" />
                <input type="number" min="1" max="100" value={b.sharePercent}
                  onChange={e => updateBeneficiary(i, "sharePercent", e.target.value)}
                  placeholder="%" className="input w-20 text-center" />
                {beneficiaries.length > 1 && (
                  <button onClick={() => removeBeneficiary(i)} className="text-gray-600 hover:text-red-400 px-1">✕</button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <button onClick={addBeneficiary} className="text-brand-500 text-sm hover:text-brand-400">+ Add beneficiary</button>
            <span className={`text-sm font-medium ${totalShares === 100 ? "text-brand-400" : "text-red-400"}`}>Total: {totalShares}%</span>
          </div>
        </Card>
      )}

      {/* ── Step 3: Assets ── */}
      {step === 3 && (
        <Card>
          <h2 className="section-title">Add assets</h2>
          <p className="text-gray-500 text-sm mb-5">ERC-20 split by share %. NFTs go to one heir. Pick which wallet holds each asset.</p>
          <div className="flex flex-col gap-5">
            {assets.map((a, i) => (
              <div key={i} className="glass p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm font-medium">Asset {i + 1}</span>
                  {assets.length > 1 && <button onClick={() => removeAsset(i)} className="text-gray-600 hover:text-red-400 text-sm">Remove</button>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Asset type</label>
                    <select value={a.assetType} onChange={e => updateAsset(i, "assetType", e.target.value)} className="input">
                      <option value="0">ERC-20 Token</option>
                      <option value="1">ERC-721 NFT</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Source wallet</label>
                    <select value={a.sourceWallet} onChange={e => updateAsset(i, "sourceWallet", e.target.value)} className="input">
                      <option value="primary">Primary (connected)</option>
                      {linkedWallets.map((w, wi) => (
                        <option key={wi} value={`linked_${wi}`}>{w.label || shortAddr(w.address) || `Linked ${wi + 1}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Token contract address</label>
                  <input value={a.tokenAddress} onChange={e => updateAsset(i, "tokenAddress", e.target.value)}
                    placeholder="0x…" className="input font-mono text-sm" />
                </div>
                <div>
                  <label className="label">{a.assetType === "0" ? "Amount (e.g. 100)" : "Token ID"}</label>
                  <input value={a.tokenIdOrAmount} onChange={e => updateAsset(i, "tokenIdOrAmount", e.target.value)}
                    placeholder={a.assetType === "0" ? "100" : "42"} className="input" />
                </div>
                {a.assetType === "1" && (
                  <div>
                    <label className="label">NFT goes to (explicit beneficiary)</label>
                    <input value={a.nftBeneficiary} onChange={e => updateAsset(i, "nftBeneficiary", e.target.value)}
                      placeholder="0x…" className="input font-mono text-sm" />
                  </div>
                )}
                {a.sourceWallet !== "primary" && (
                  <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-800/50 rounded-lg p-3">
                    <span className="text-amber-400 text-xs mt-0.5">⚠</span>
                    <p className="text-amber-400 text-xs">From a linked wallet — switch to it and call approve() before distribution.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button onClick={addAsset} className="mt-4 text-brand-500 text-sm hover:text-brand-400">+ Add asset</button>
          <div className="mt-5 pt-4 border-t border-dark-600">
            <label className="label">IPFS message CID (optional)</label>
            <input value={ipfsCID} onChange={e => setIpfsCID(e.target.value)}
              placeholder="QmXxx… — encrypted personal message for your heirs"
              className="input font-mono text-sm" />
          </div>
        </Card>
      )}

      {/* ── Step 2: Linked Wallets ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="section-title">Link additional wallets</h2>
            <p className="text-gray-500 text-sm mb-2">Crypto spread across multiple wallets? Cover them all under one will.</p>
            <div className="glass border-l-2 border-brand-600 p-4 mb-6">
              <p className="text-brand-400 text-sm font-medium mb-2">How it works</p>
              <ol className="text-gray-500 text-sm space-y-1 list-decimal list-inside">
                <li>Add each wallet address with a label</li>
                <li>Switch MetaMask to that wallet</li>
                <li>Call <code className="text-gray-400">approve(assetDistributorAddress, amount)</code> for each token</li>
                <li>On distribution, one transaction pulls from all wallets</li>
              </ol>
            </div>

            {linkedWallets.length === 0 && (
              <p className="text-center text-gray-600 text-sm py-4">No linked wallets. Click below to add one — or skip this step.</p>
            )}

            <div className="flex flex-col gap-4">
              {linkedWallets.map((w, i) => (
                <div key={i} className="glass p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm font-medium">Wallet {i + 1}</span>
                    <button onClick={() => removeLinked(i)} className="text-gray-600 hover:text-red-400 text-sm">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Wallet address</label>
                      <input value={w.address} onChange={e => updateLinked(i, "address", e.target.value)}
                        placeholder="0x…" className="input font-mono text-sm" />
                    </div>
                    <div>
                      <label className="label">Label</label>
                      <input value={w.label} onChange={e => updateLinked(i, "label", e.target.value)}
                        placeholder="e.g. Ledger, MetaMask 2" className="input text-sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className={`text-sm ${w.approved ? "text-brand-400" : "text-gray-600"}`}>
                      {w.approved ? "✓ Approved" : "Approval pending"}
                    </span>
                    <button
                      onClick={() => !w.approved && markApproved(i)}
                      disabled={w.approved}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        w.approved ? "border-brand-800 text-brand-600 cursor-default" : "border-amber-700 text-amber-400 hover:bg-amber-900/30"
                      }`}
                    >
                      {w.approved ? "✓ Done" : "Mark as approved"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addLinked} className="mt-4 text-brand-500 text-sm hover:text-brand-400">+ Add linked wallet</button>
          </Card>

          {linkedWallets.filter(w => w.address.trim()).length > 0 && (
            <div className="glass border border-amber-800/50 p-4">
              <p className="text-amber-400 text-sm font-medium mb-2">Approval checklist</p>
              {linkedWallets.filter(w => w.address.trim()).map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1">
                  <span className={w.approved ? "text-brand-400" : "text-gray-600"}>{w.approved ? "✓" : "○"}</span>
                  <span className={w.approved ? "text-gray-300" : "text-gray-600"}>{w.label || shortAddr(w.address)}</span>
                </div>
              ))}
              <p className="text-gray-600 text-xs mt-2">Distribution will silently skip any wallet that hasn't approved.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Review & Deploy ── */}
      {step === 4 && (
        <Card>
          <h2 className="section-title">Review & Deploy</h2>
          <div className="flex flex-col gap-3 mb-6">
            <div className="glass p-4 flex flex-col gap-1">
              <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">Trigger</span>
              <span className="text-gray-200">{triggerMode === "0" ? "Deadman Switch" : `Guardian Multi-sig (${requiredGuardians}-of-${guardians.length})`}</span>
            </div>
            <div className="glass p-4 flex flex-col gap-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">Beneficiaries</span>
              {beneficiaries.map((b, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="font-mono text-gray-400">{shortAddr(b.wallet)}</span>
                  <span className="text-brand-400">{b.sharePercent}%</span>
                </div>
              ))}
            </div>
            <div className="glass p-4 flex flex-col gap-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">Assets ({assets.length})</span>
              {assets.map((a, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-400">{a.assetType === "0" ? "ERC-20" : "NFT"}: {shortAddr(a.tokenAddress)}</span>
                  <span className={a.sourceWallet === "primary" ? "text-gray-600 text-xs" : "text-amber-400 text-xs"}>
                    {a.sourceWallet === "primary" ? "Primary" : "Linked"}
                  </span>
                </div>
              ))}
            </div>
            {linkedWallets.filter(w => w.address.trim()).length > 0 && (
              <div className="glass p-4 flex flex-col gap-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">Linked wallets</span>
                {linkedWallets.filter(w => w.address.trim()).map((w, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="font-mono text-gray-400">{shortAddr(w.address)}</span>
                    <span className={w.approved ? "text-brand-400" : "text-amber-400"}>{w.approved ? "✓ Approved" : "⚠ Not approved"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass border-l-2 border-amber-600 p-4 mb-6">
            <p className="text-amber-400 text-sm font-medium">Before deploying:</p>
            <ul className="text-gray-500 text-sm mt-1 list-disc list-inside space-y-1">
              <li>Approves AssetDistributor on primary wallet tokens</li>
              <li>Creates your will on-chain — non-upgradeable</li>
              {linkedWallets.filter(w => w.address && !w.approved).length > 0 && (
                <li className="text-amber-400">{linkedWallets.filter(w => w.address && !w.approved).length} linked wallet(s) still need manual approval</li>
              )}
            </ul>
          </div>

          <button className="btn-primary w-full py-3 text-base" onClick={handleDeploy} disabled={approving || creating}>
            {(approving || creating)
              ? <span className="flex items-center justify-center gap-2"><Spinner /> Deploying…</span>
              : "🚀 Approve & Deploy Will"}
          </button>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-4">
        <button className="btn-secondary" onClick={() => setStep(s => s - 1)} disabled={step === 0}>← Back</button>
        {step < STEPS.length - 1 && (
          <button className="btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>Next →</button>
        )}
      </div>
    </div>
  );
}
