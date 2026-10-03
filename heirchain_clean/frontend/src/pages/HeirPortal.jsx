import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useChainId } from "wagmi";
import { useSearchParams } from "react-router-dom";
import { isAddress } from "viem";
import { useWillStatus, useBeneficiaries, useAssets } from "../hooks/useWillRegistry";
import { useDistribute } from "../hooks/useAssetDistributor";
import { Card, SectionHeader, StatusBadge, CountdownTimer, InfoRow, Spinner, EmptyState, Badge } from "../components/ui";
import { shortAddr, timeAgo, formatTokenAmount, ASSET_TYPES } from "../utils/helpers";
import { CHAIN_ID, DEMO_MODE } from "../utils/wagmiConfig";
import { ERC20_ABI } from "../abis";
import toast from "react-hot-toast";

export default function HeirPortal() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [searchParams] = useSearchParams();

  // Pre-fill from shareable URL: /heir?owner=0x...
  const ownerFromUrl = searchParams.get("owner") || "";
  const [willOwner, setWillOwner]     = useState(ownerFromUrl);
  const [lookupAddr, setLookupAddr]   = useState(isAddress(ownerFromUrl) ? ownerFromUrl : "");
  const [distributed, setDistributed] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState({});

  const { data: will, isLoading, refetch } = useWillStatus(lookupAddr || undefined);
  const { data: beneficiaries } = useBeneficiaries(lookupAddr || undefined);
  const { data: assets }        = useAssets(lookupAddr || undefined);
  const { distribute, isPending, isSuccess } = useDistribute();
  const networkReady = DEMO_MODE || chainId === CHAIN_ID;

  useEffect(() => {
    if (DEMO_MODE || !assets?.length || !publicClient) return;

    const loadTokenDecimals = async () => {
      const erc20Assets = assets.filter((asset) => asset.assetType === 0);
      const entries = await Promise.all(erc20Assets.map(async (asset) => {
        try {
          const decimals = await publicClient.readContract({
            address: asset.tokenAddress,
            abi: ERC20_ABI,
            functionName: "decimals",
          });
          return [asset.tokenAddress.toLowerCase(), decimals];
        } catch {
          return [asset.tokenAddress.toLowerCase(), 18];
        }
      }));
      setTokenDecimals(Object.fromEntries(entries));
    };

    loadTokenDecimals();
  }, [assets, publicClient]);

  const handleLookup = (e) => {
    e.preventDefault();
    const addr = willOwner.trim();
    if (!addr) {
      setAddressError("Address is required");
      return;
    }
    if (!isAddress(addr)) {
      setAddressError("Invalid address format");
      return;
    }
    setAddressError("");
    setLookupAddr(addr);
    setDistributed(false);
  };

  const disputeCleared = will?.disputeEndsAt > 0n &&
    (DEMO_MODE ? true : BigInt(Math.floor(Date.now() / 1000)) >= will.disputeEndsAt);

  const myShare = beneficiaries?.find(
    b => b.wallet.toLowerCase() === address?.toLowerCase()
  );

  const handleClaim = async () => {
    if (!DEMO_MODE && !isConnected) {
      toast.error("Connect a wallet to distribute the inheritance");
      return;
    }
    if (!networkReady) {
      toast.error("Switch your wallet to Polygon Amoy before distributing");
      return;
    }
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
        <form onSubmit={handleLookup} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={willOwner}
              onChange={e => { setWillOwner(e.target.value); setAddressError(""); }}
              placeholder="0x… will owner address"
              className={`input flex-1 font-mono text-sm ${addressError ? "border-red-500" : ""}`}
            />
            <button type="submit" className="btn-primary shrink-0">Look up</button>
          </div>
          {addressError && <p className="text-xs text-red-400">{addressError}</p>}
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
                <>
                  {!DEMO_MODE && !isConnected && (
                    <p className="text-amber-400 text-sm mb-3">Connect any wallet to submit the distribution transaction.</p>
                  )}
                  {!networkReady && (
                    <p className="text-amber-400 text-sm mb-3">Switch to Polygon Amoy before distributing.</p>
                  )}
                  <button
                    className="btn-primary w-full py-3"
                    onClick={handleClaim}
                    disabled={isPending || (!DEMO_MODE && (!isConnected || !networkReady))}
                  >
                    {isPending
                      ? <span className="flex items-center justify-center gap-2"><Spinner /> Distributing assets…</span>
                      : "🪙 Distribute Assets to All Heirs"}
                  </button>
                </>
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
                        ? `${formatTokenAmount(a.tokenIdOrAmount, tokenDecimals[a.tokenAddress.toLowerCase()] ?? 18)} tokens`
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
