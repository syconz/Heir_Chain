import { useState } from "react";
import { useAccount, usePublicClient, useChainId } from "wagmi";
import { useNavigate } from "react-router-dom";
import { parseUnits } from "viem";
import { ERC20_ABI } from "../abis";
import { useCreateWill } from "../hooks/useWillRegistry";
import { useRegisterMonitoring } from "../hooks/useTriggerVerifier";
import { useApproveERC20, useApproveERC721 } from "../hooks/useAssetDistributor";
import { Card, SectionHeader, Spinner } from "../components/ui";
import { CHAIN_ID, DEMO_MODE } from "../utils/wagmiConfig";
import { getErrorMessage } from "../utils/helpers";
import { validateAddress, validateSharePercent, totalSharesValid, validateGuardian, validateBeneficiary, validateAsset, hasDuplicateAddresses, addressesOverlap } from "../utils/validation";
import toast from "react-hot-toast";

const STEPS = ["Trigger", "Beneficiaries", "Assets", "Review & Deploy"];

const EMPTY_BENEFICIARY = { wallet: "", sharePercent: "" };
const EMPTY_ASSET       = { assetType: "0", tokenAddress: "", tokenIdOrAmount: "", nftBeneficiary: "" };

const shortAddr = (a = "") => a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

export default function CreateWill() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const navigate    = useNavigate();
  const [step, setStep] = useState(0);

  const [triggerMode, setTriggerMode]     = useState("0");
  const [guardians, setGuardians]         = useState([""]);
  const [requiredGuardians, setRequired]  = useState("1");
  const [beneficiaries, setBeneficiaries] = useState([{ ...EMPTY_BENEFICIARY }]);
  const [assets, setAssets]               = useState([]);
  const [ipfsCID, setIpfsCID]             = useState("");
  const [approving, setApproving]         = useState(false);
  const [done, setDone]                   = useState(false);
  const [monitoringWarning, setMonitoringWarning] = useState("");

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


  // ── Validation ────────────────────────────────────────────────────────────
  const canNext = () => {
    if (step === 0) {
      if (triggerMode === "1") {
        if (guardians.some(g => validateGuardian(g) !== null)) return false;
        const required = Number(requiredGuardians);
        if (!required || required > guardians.length) return false;
        if (hasDuplicateAddresses(guardians)) return false;
      }
      return true;
    }
    if (step === 1) {
      if (!totalSharesValid(beneficiaries)) return false;
      if (hasDuplicateAddresses(beneficiaries.map(b => b.wallet))) return false;
      if (addressesOverlap(guardians, beneficiaries.map(b => b.wallet))) return false;
      return beneficiaries.every(b => validateBeneficiary(b) === null);
    }
    if (step === 2) return assets.every(a => validateAsset(a) === null);
    return true;
  };

  // ── Deploy ────────────────────────────────────────────────────────────────
  const handleDeploy = async () => {
    if (!DEMO_MODE && (!isConnected || !address)) {
      toast.error("Connect the will owner's wallet before deploying");
      return;
    }
    if (!DEMO_MODE && chainId !== CHAIN_ID) {
      toast.error("Switch your wallet to Polygon Amoy before deploying");
      return;
    }

    setApproving(true);
    setMonitoringWarning("");
    try {
      if (!DEMO_MODE && !publicClient) {
        throw new Error("Blockchain connection is not ready. Refresh and reconnect your wallet.");
      }

      const decimalsByToken = new Map();
      const assetAmounts = await Promise.all(assets.map(async (asset) => {
        if (asset.assetType === "1") return BigInt(asset.tokenIdOrAmount);
        const key = asset.tokenAddress.toLowerCase();
        let decimals = decimalsByToken.get(key);
        if (decimals === undefined) {
          decimals = DEMO_MODE
            ? 18
            : await publicClient.readContract({
                address: asset.tokenAddress,
                abi: ERC20_ABI,
                functionName: "decimals",
              });
          decimals = Number(decimals);
          decimalsByToken.set(key, decimals);
        }
        return parseUnits(asset.tokenIdOrAmount, decimals);
      }));

      // Approvals are per token contract. If a user adds the same ERC-20
      // twice, approve the aggregate or the later approve() would overwrite
      // the allowance needed by the earlier entry.
      const erc20Totals = new Map();
      for (const [index, asset] of assets.entries()) {
        if (asset.assetType !== "0") continue;
        const key = asset.tokenAddress.toLowerCase();
        const current = erc20Totals.get(key);
        erc20Totals.set(key, {
          address: asset.tokenAddress,
          amount: (current?.amount || 0n) + assetAmounts[index],
        });
      }

      for (const { address: tokenAddress, amount } of erc20Totals.values()) {
        const approved = await approveERC20(tokenAddress, amount);
        if (!approved) throw new Error(`ERC-20 approval failed for ${shortAddr(tokenAddress)}`);
      }

      for (const [index, asset] of assets.entries()) {
        if (asset.assetType !== "1") continue;
        const approved = await approveNFT(asset.tokenAddress, assetAmounts[index]);
        if (!approved) throw new Error(`NFT approval failed for ${shortAddr(asset.tokenAddress)}`);
      }

      const result = await createWill([
        Number(triggerMode),
        BigInt(triggerMode === "1" ? requiredGuardians : 0),
        triggerMode === "1" ? guardians.filter(g => g.trim()) : [],
        beneficiaries.map(b => ({ wallet: b.wallet, sharePercent: BigInt(b.sharePercent) })),
        assets.map((a, index) => ({
          assetType:       Number(a.assetType),
          tokenAddress:    a.tokenAddress,
          tokenIdOrAmount: assetAmounts[index],
          nftBeneficiary:  a.assetType === "1" ? a.nftBeneficiary : "0x0000000000000000000000000000000000000000",
        })),
        ipfsCID,
      ]);

      if (result) {
        if (triggerMode === "0" && address) {
          const monitoringResult = await register(address);
          if (!monitoringResult) {
            setMonitoringWarning("Your will was created, but deadman monitoring could not be registered. Retry monitoring registration before relying on the inactivity trigger.");
          }
        }
        setDone(true);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not deploy the will"));
    } finally {
      setApproving(false);
    }
  };

  // ── Success ───────────────────────────────────────────────────────────────
  if (done || isSuccess) {
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <Card className="text-center flex flex-col items-center gap-5 py-12">
          <span className="text-5xl">✅</span>
          <div>
            <h2 className="text-2xl font-semibold text-gray-100">Will Created</h2>
            <p className="text-gray-500 text-sm mt-2">
              {DEMO_MODE ? "Your demo will is ready locally." : "Your on-chain will is live on Polygon Amoy."}
            </p>
            {monitoringWarning && (
              <div className="glass border-l-2 border-amber-500 text-left p-4 mt-4">
                <p className="text-amber-400 text-sm font-medium">Monitoring needs attention</p>
                <p className="text-gray-500 text-xs mt-1">{monitoringWarning}</p>
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
                {Number(requiredGuardians) > guardians.length && (
                  <p className="text-xs text-red-400 mt-1">Cannot exceed {guardians.length} guardian{guardians.length > 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="label">Guardian addresses</label>
                {guardians.map((g, i) => {
                  const err = g.trim() ? validateGuardian(g) : null;
                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex gap-2">
                        <input value={g} onChange={e => updateGuardian(i, e.target.value)}
                          placeholder="0x…" className={`input font-mono text-sm ${err ? "border-red-500" : ""}`} />
                        {guardians.length > 1 && (
                          <button onClick={() => setGuardians(guardians.filter((_, x) => x !== i))}
                            className="text-gray-600 hover:text-red-400 px-2">✕</button>
                        )}
                      </div>
                      {err && <p className="text-xs text-red-400">{err}</p>}
                    </div>
                  );
                })}
                <button onClick={() => setGuardians([...guardians, ""])}
                  className="text-brand-500 text-sm hover:text-brand-400 text-left">+ Add guardian</button>
                {hasDuplicateAddresses(guardians) && (
                  <p className="text-xs text-red-400">Guardian addresses must be unique.</p>
                )}
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
            {beneficiaries.map((b, i) => {
              const addrErr = b.wallet.trim() ? validateAddress(b.wallet) : null;
              const shareErr = b.sharePercent ? validateSharePercent(b.sharePercent) : null;
              return (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex gap-2 items-center">
                    <input value={b.wallet} onChange={e => updateBeneficiary(i, "wallet", e.target.value)}
                      placeholder="0x… wallet address" className={`input flex-1 font-mono text-sm ${addrErr ? "border-red-500" : ""}`} />
                    <input type="number" min="1" max="100" value={b.sharePercent}
                      onChange={e => updateBeneficiary(i, "sharePercent", e.target.value)}
                      placeholder="%" className={`input w-20 text-center ${shareErr ? "border-red-500" : ""}`} />
                    {beneficiaries.length > 1 && (
                      <button onClick={() => removeBeneficiary(i)} className="text-gray-600 hover:text-red-400 px-1">✕</button>
                    )}
                  </div>
                  {(addrErr || shareErr) && (
                    <p className="text-xs text-red-400">{addrErr || shareErr}</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-4">
            <button onClick={addBeneficiary} className="text-brand-500 text-sm hover:text-brand-400">+ Add beneficiary</button>
            <span className={`text-sm font-medium ${totalShares === 100 ? "text-brand-400" : "text-red-400"}`}>Total: {totalShares}%</span>
          </div>
          {hasDuplicateAddresses(beneficiaries.map(b => b.wallet)) && (
            <p className="text-xs text-red-400 mt-2">Beneficiary addresses must be unique.</p>
          )}
          {addressesOverlap(guardians, beneficiaries.map(b => b.wallet)) && (
            <p className="text-xs text-red-400 mt-1">A guardian cannot also be a beneficiary.</p>
          )}
        </Card>
      )}

      {/* ── Step 2: Assets ── */}
      {step === 2 && (
        <Card>
          <h2 className="section-title">Add assets</h2>
          <p className="text-gray-500 text-sm mb-5">ERC-20 assets split by share percentage. NFTs go to one explicit heir. Assets must be held by the connected wallet.</p>
          {assets.length === 0 && (
            <div className="glass border-l-2 border-amber-500 p-4 mb-5">
              <p className="text-amber-400 text-sm font-medium">No assets added yet</p>
              <p className="text-gray-500 text-xs mt-1">You can create an empty will, but it will not distribute anything until it is revoked and recreated with assets.</p>
            </div>
          )}
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
                    <div className="input flex items-center text-gray-400">Connected wallet</div>
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
              </div>
            ))}
          </div>
          <button onClick={addAsset} disabled={assets.length >= 20} className="mt-4 text-brand-500 text-sm hover:text-brand-400 disabled:text-gray-600 disabled:cursor-not-allowed">+ Add asset</button>
          <div className="mt-5 pt-4 border-t border-dark-600">
            <label className="label">IPFS message CID (optional)</label>
            <input value={ipfsCID} onChange={e => setIpfsCID(e.target.value)}
              placeholder="QmXxx… — encrypted personal message for your heirs"
              className="input font-mono text-sm" />
          </div>
        </Card>
      )}

      {/* ── Step 3: Review & Deploy ── */}
      {step === 3 && (
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
              {assets.length === 0 && <span className="text-gray-600 text-sm">No assets selected</span>}
              {assets.map((a, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-400">{a.assetType === "0" ? "ERC-20" : "NFT"}: {shortAddr(a.tokenAddress)}</span>
                  <span className="text-gray-600 text-xs">Connected wallet</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass border-l-2 border-amber-600 p-4 mb-6">
            <p className="text-amber-400 text-sm font-medium">Before deploying:</p>
            <ul className="text-gray-500 text-sm mt-1 list-disc list-inside space-y-1">
              <li>Approves AssetDistributor on primary wallet tokens</li>
              <li>Creates your will on-chain — non-upgradeable</li>
              {assets.length === 0 && <li className="text-amber-400">No assets will be distributed by this will</li>}
            </ul>
          </div>

          {!DEMO_MODE && !isConnected && (
            <p className="text-red-400 text-sm mb-3">Connect the wallet that owns the assets before deploying.</p>
          )}
          {!DEMO_MODE && isConnected && chainId !== CHAIN_ID && (
            <p className="text-amber-400 text-sm mb-3">Switch to Polygon Amoy before deploying.</p>
          )}
          <button className="btn-primary w-full py-3 text-base" onClick={handleDeploy} disabled={approving || creating || (!DEMO_MODE && (!isConnected || chainId !== CHAIN_ID))}>
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
