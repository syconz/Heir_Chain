import { useState } from "react";
import { useAccount } from "wagmi";
import { useSearchParams } from "react-router-dom";
import { useWillStatus, useBeneficiaries, useAssets } from "../hooks/useWillRegistry";
import { useDistribute } from "../hooks/useAssetDistributor";
import { Card, SectionHeader, StatusBadge, CountdownTimer, InfoRow, Spinner, EmptyState, Badge } from "../components/ui";
import { shortAddr, timeAgo, ASSET_TYPES } from "../utils/helpers";
import { DEMO_MODE } from "../utils/wagmiConfig";
import { ethers } from "ethers";
import toast from "react-hot-toast";

export default function HeirPortal() {
  const { address, isConnected } = useAccount();
  const [searchParams] = useSearchParams();

  // Pre-fill from shareable URL: /heir?owner=0x...
  const ownerFromUrl = searchParams.get("owner") || "";
  const [willOwner, setWillOwner]     = useState(ownerFromUrl);
  const [lookupAddr, setLookupAddr]   = useState(ownerFromUrl);
  const [distributed, setDistributed] = useState(false);

  const { data: will, isLoading, refetch } = useWillStatus(lookupAddr || undefined);
  const { data: beneficiaries } = useBeneficiaries(lookupAddr || undefined);
  const { data: assets }        = useAssets(lookupAddr || undefined);
  const { distribute, isPending, isSuccess } = useDistribute();

  const handleLookup = (e) => {
    e.preventDefault();
    setLookupAddr(willOwner.trim());
    setDistributed(false);
  };

  const disputeCleared = will?.disputeEndsAt > 0n &&
    (DEMO_MODE ? true : BigInt(Math.floor(Date.now() / 1000)) >= will.disputeEndsAt);

  const myShare = beneficiaries?.find(
    b => b.wallet.toLowerCase() === address?.toLowerCase()
  );

  const handleClaim = async () => {
    const result = await distribute(lookupAddr);
    if (result) { setDistributed(true); refetch(); }
  };

  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <SectionHeader
        title="Heir Portal"
        subtitle="Claim your inheritance after the dispute window clears."
      />

      {/* Lookup */}
      <Card className="mb-6">
        <h2 className="text-base font-medium text-gray-300 mb-4">Look up a will</h2>
        <form onSubmit={handleLookup} className="flex gap-2">
          <input
            value={willOwner}
            onChange={e => setWillOwner(e.target.value)}
            placeholder="0x… will owner address"
            className="input flex-1 font-mono text-sm"
          />
          <button type="submit" className="btn-primary shrink-0">Look up</button>
        </form>
        <div className="flex items-center gap-3 mt-2">
          {lookupAddr && (
            <button
              className="text-xs text-gray-600 hover:text-gray-400"
              onClick={() => { setWillOwner(""); setLookupAddr(""); setDistributed(false); }}
            >
              ✕ Clear
            </button>
          )}
          {DEMO_MODE && (
            <button
              className="text-xs text-gray-600 hover:text-gray-400"
              onClick={() => {
                const d = "0xDemoOwner000000000000000000000000000001";
                setWillOwner(d); setLookupAddr(d);
              }}
            >
              Use demo address
            </button>
          )}
        </div>
      </Card>

      {isLoading && <div className="flex justify-center py-10"><Spinner size="lg" /></div>}

      {lookupAddr && !isLoading && !will?.exists && (
        <EmptyState icon="🔍" title="No will found" description="No will exists for this address." />
      )}

      {lookupAddr && will?.exists && (
        <div className="flex flex-col gap-4">

          {/* Will status */}
          <Card>
            <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">Will Status</p>
            <InfoRow label="Owner"        value={shortAddr(lookupAddr)} mono />
            <InfoRow label="Status"       value={<StatusBadge {...will} />} />
            <InfoRow label="Last check-in" value={timeAgo(will.lastCheckInAt)} />
          </Card>

          {/* Not triggered */}
          {!will.triggered && (
            <div className="glass border-l-2 border-dark-500 p-4">
              <p className="text-gray-400 text-sm font-medium">Will not yet triggered</p>
              <p className="text-gray-600 text-sm mt-1">
                Assets can only be claimed after the will is triggered and the dispute window clears.
              </p>
            </div>
          )}

          {/* Triggered — dispute window active */}
          {will.triggered && !will.distributed && !disputeCleared && (
            <Card>
              <p className="text-amber-400 font-medium mb-2">⚠ Dispute window active</p>
              <p className="text-gray-500 text-sm mb-4">
                Assets will be claimable once the dispute window clears. If you believe this trigger was malicious, contact the will owner's family.
              </p>
              {will.disputeEndsAt > 0n && (
                <CountdownTimer
                  targetTs={will.disputeEndsAt}
                  label="Time until claimable"
                  onExpire={refetch}
                />
              )}
            </Card>
          )}

          {/* Ready to claim */}
          {will.triggered && !will.distributed && disputeCleared && (
            <Card>
              <p className="text-brand-400 font-medium mb-1">✓ Ready to distribute</p>
              <p className="text-gray-500 text-sm mb-5">
                The dispute window has cleared. Assets can now be distributed to all beneficiaries.
              </p>

              {myShare && (
                <div className="glass p-3 mb-5 flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Your share</span>
                  <span className="text-brand-400 font-semibold text-lg">{Number(myShare.sharePercent)}%</span>
                </div>
              )}

              {(distributed || isSuccess) ? (
                <div className="p-4 bg-brand-900/30 border border-brand-800 rounded-lg text-center">
                  <p className="text-brand-400 font-medium">✅ Distribution complete</p>
                  <p className="text-gray-500 text-sm mt-1">Assets transferred to all beneficiaries.</p>
                </div>
              ) : (
                <button
                  className="btn-primary w-full py-3"
                  onClick={handleClaim}
                  disabled={isPending}
                >
                  {isPending
                    ? <span className="flex items-center justify-center gap-2"><Spinner /> Distributing assets…</span>
                    : "🪙 Distribute Assets to All Heirs"}
                </button>
              )}
            </Card>
          )}

          {/* Already distributed */}
          {will.distributed && (
            <Card className="text-center py-8">
              <p className="text-2xl mb-3">✅</p>
              <p className="text-gray-200 font-medium">Assets already distributed</p>
              <p className="text-gray-500 text-sm mt-1">All assets were transferred to the beneficiaries.</p>
            </Card>
          )}

          {/* Asset list */}
          {assets?.length > 0 && (
            <Card>
              <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">
                Assets in Will ({assets.length})
              </p>
              {assets.map((a, i) => (
                <div key={i} className="flex items-start justify-between py-3 border-b border-dark-600 last:border-0 gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Badge color={a.assetType === 0 ? "green" : "blue"}>
                      {ASSET_TYPES[a.assetType]}
                    </Badge>
                    <span className="font-mono text-xs text-gray-500 mt-1">{shortAddr(a.tokenAddress)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-300">
                      {a.assetType === 0
                        ? `${ethers.formatEther(a.tokenIdOrAmount || 0n)} tokens`
                        : `Token ID #${a.tokenIdOrAmount?.toString()}`}
                    </span>
                    {a.assetType === 1 && (
                      <p className="text-xs text-gray-600 mt-0.5">→ {shortAddr(a.nftBeneficiary)}</p>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Beneficiaries */}
          {beneficiaries?.length > 0 && (
            <Card>
              <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">
                Beneficiaries ({beneficiaries.length})
              </p>
              {beneficiaries.map((b, i) => (
                <div key={i} className="flex justify-between items-center py-2.5 border-b border-dark-600 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-300">{shortAddr(b.wallet)}</span>
                    {b.wallet.toLowerCase() === address?.toLowerCase() && (
                      <Badge color="green">You</Badge>
                    )}
                  </div>
                  <span className="text-brand-400 font-medium">{Number(b.sharePercent)}%</span>
                </div>
              ))}
            </Card>
          )}

          {/* IPFS message */}
          {will.ipfsMessageCID && (will.triggered || DEMO_MODE) && (
            <Card>
              <p className="text-sm text-gray-500 mb-3 font-medium uppercase tracking-wider">Personal Message</p>
              <p className="text-gray-400 text-sm mb-3">
                The will owner left an encrypted message for their heirs on IPFS.
              </p>
              <div className="flex items-center gap-2 glass p-3">
                <span className="font-mono text-xs text-gray-400 break-all">{will.ipfsMessageCID}</span>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Decrypt with your wallet signature via the owner's dApp to read the message.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
