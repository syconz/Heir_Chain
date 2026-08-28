import { useAccount } from "wagmi";
import { Link } from "react-router-dom";
import { useWillStatus, useBeneficiaries, useAssets, useGuardians, useCheckIn, useRevokeWill, useThresholds } from "../hooks/useWillRegistry";
import { useManualTrigger } from "../hooks/useTriggerVerifier";
import { Card, StatusBadge, CountdownTimer, InfoRow, SectionHeader, Spinner, EmptyState, Modal } from "../components/ui";
import { shortAddr, formatTimestamp, timeAgo, TRIGGER_MODES, ASSET_TYPES } from "../utils/helpers";
import { DEMO_MODE } from "../utils/wagmiConfig";
import { ethers } from "ethers";
import { useState } from "react";
import toast from "react-hot-toast";

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const { data: will, isLoading, refetch } = useWillStatus(address);
  const { data: beneficiaries }   = useBeneficiaries(address);
  const { data: assets }          = useAssets(address);
  const { data: guardians }       = useGuardians(address);
  const { inactivityThreshold, disputeWindow } = useThresholds();

  const { checkIn,    isPending: checkingIn   } = useCheckIn(refetch);
  const { revokeWill, isPending: revoking     } = useRevokeWill(refetch);
  const { manualTrigger, isPending: triggering } = useManualTrigger();

  if (!isConnected && !DEMO_MODE) {
    return (
      <EmptyState
        icon="🔗"
        title="Connect your wallet"
        description="Connect MetaMask or any Web3 wallet to view your will."
      />
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!will?.exists) {
    return (
      <EmptyState
        icon="📋"
        title="No will found"
        description="You haven't created a will yet. Set up your on-chain inheritance in minutes."
        action={<Link to="/create" className="btn-primary">Create Your Will</Link>}
      />
    );
  }

  const checkInDeadline = will.lastCheckInAt
    ? Number(will.lastCheckInAt) + Number(inactivityThreshold)
    : null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <SectionHeader
        title="My Will"
        subtitle={DEMO_MODE ? "Demo mode — no real transactions" : `Owner: ${shortAddr(address)}`}
      />

      {/* Status banner */}
      {will.triggered && !will.distributed && (
        <div className="glass border-l-2 border-amber-500 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-amber-400 font-medium">⚠ Will Triggered</p>
            <p className="text-gray-500 text-sm">Assets will distribute after the dispute window clears.</p>
          </div>
          {will.disputeEndsAt > 0n && (
            <CountdownTimer
              targetTs={will.disputeEndsAt}
              label="Dispute window"
              onExpire={refetch}
            />
          )}
        </div>
      )}

      {will.distributed && (
        <div className="glass border-l-2 border-blue-500 p-4">
          <p className="text-blue-400 font-medium">✓ Assets Distributed</p>
          <p className="text-gray-500 text-sm">All assets have been transferred to your beneficiaries.</p>
        </div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">Overview</p>
          <InfoRow label="Status"       value={<StatusBadge {...will} />} />
          <InfoRow label="Trigger mode" value={TRIGGER_MODES[will.triggerMode]} />
          <InfoRow label="Last check-in" value={timeAgo(will.lastCheckInAt)} />
          <InfoRow label="IPFS message" value={will.ipfsMessageCID ? shortAddr(will.ipfsMessageCID) : "—"} mono />
        </Card>

        <Card>
          <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">Thresholds</p>
          <InfoRow label="Inactivity period" value={`${Number(inactivityThreshold)}s (${Math.round(Number(inactivityThreshold) / 60)}min)`} />
          <InfoRow label="Dispute window"    value={`${Number(disputeWindow)}s (${Math.round(Number(disputeWindow) / 60)}min)`} />
          {checkInDeadline && !will.triggered && (
            <div className="mt-4 pt-4 border-t border-dark-600">
              <CountdownTimer
                targetTs={checkInDeadline}
                label="Check-in deadline"
                onExpire={refetch}
              />
            </div>
          )}
        </Card>
      </div>

      {/* Beneficiaries */}
      <Card>
        <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">
          Beneficiaries ({beneficiaries?.length || 0})
        </p>
        {beneficiaries?.length > 0 ? (
          <div className="flex flex-col divide-y divide-dark-600">
            {beneficiaries.map((b, i) => (
              <div key={i} className="flex justify-between items-center py-3">
                <span className="font-mono text-sm text-gray-300">{shortAddr(b.wallet)}</span>
                <span className="text-brand-400 font-medium">{Number(b.sharePercent)}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No beneficiaries listed.</p>
        )}
      </Card>

      {/* Assets */}
      <Card>
        <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">
          Assets ({assets?.length || 0})
        </p>
        {assets?.length > 0 ? (
          <div className="flex flex-col divide-y divide-dark-600">
            {assets.map((a, i) => (
              <div key={i} className="flex justify-between items-center py-3 gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-500">{ASSET_TYPES[a.assetType]}</span>
                  <span className="font-mono text-sm text-gray-300">{shortAddr(a.tokenAddress)}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-300">
                    {a.assetType === 0
                      ? `${ethers.formatEther(a.tokenIdOrAmount || 0n)} tokens`
                      : `Token ID #${a.tokenIdOrAmount?.toString()}`}
                  </span>
                  {a.assetType === 1 && a.nftBeneficiary && (
                    <p className="text-xs text-gray-600 mt-0.5">→ {shortAddr(a.nftBeneficiary)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No assets listed.</p>
        )}
      </Card>

      {/* Guardians */}
      {will.triggerMode === 1 && (
        <Card>
          <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">
            Guardians ({guardians?.length || 0})
          </p>
          {guardians?.map((g, i) => (
            <div key={i} className="py-2.5 border-b border-dark-600 last:border-0">
              <span className="font-mono text-sm text-gray-300">{shortAddr(g)}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Linked wallets health check */}
      <Card>
        <p className="text-sm text-gray-500 mb-1 font-medium uppercase tracking-wider">Multi-wallet Coverage</p>
        <p className="text-xs text-gray-600 mb-4">Assets from other wallets require pre-approval. Switch to each wallet and call approve() on each token.</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between py-2.5 border-b border-dark-600">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-brand-500" />
              <div>
                <p className="text-sm text-gray-300">Primary wallet</p>
                <p className="font-mono text-xs text-gray-600">{shortAddr(address)}</p>
              </div>
            </div>
            <span className="text-brand-400 text-xs font-medium">✓ Active</span>
          </div>
          {DEMO_MODE && (
            <>
              <div className="flex items-center justify-between py-2.5 border-b border-dark-600">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-brand-500" />
                  <div>
                    <p className="text-sm text-gray-300">Ledger (demo)</p>
                    <p className="font-mono text-xs text-gray-600">0xLedg…0001</p>
                  </div>
                </div>
                <span className="text-brand-400 text-xs font-medium">✓ Approved</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <div>
                    <p className="text-sm text-gray-300">MetaMask 2 (demo)</p>
                    <p className="font-mono text-xs text-gray-600">0xMeta…0002</p>
                  </div>
                </div>
                <span className="text-amber-400 text-xs font-medium">⚠ Approval needed</span>
              </div>
            </>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-dark-600 flex items-center justify-between">
          <p className="text-xs text-gray-600">Add more wallets when creating or re-creating your will.</p>
          {!will.triggered && (
            <Link to="/create" className="text-xs text-brand-500 hover:text-brand-400">+ Add wallet →</Link>
          )}
        </div>
      </Card>

      {/* Share your will */}
      <Card>
        <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">Share With Heirs</p>
        <p className="text-gray-500 text-sm mb-4">
          Send this link to your heirs. They paste it in a browser and the Heir Portal pre-loads your will automatically.
        </p>
        <div className="flex gap-2">
          <div className="input flex-1 text-xs font-mono text-gray-500 truncate py-2.5 cursor-default select-all">
            {window.location.origin}/heir?owner={address || "0x…"}
          </div>
          <button
            className="btn-secondary shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/heir?owner=${address}`);
              toast.success("Heir link copied to clipboard!");
            }}
          >
            📋 Copy
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Heirs don't need a wallet to view — only to trigger the distribution claim.
        </p>
      </Card>

      {/* Actions */}
      {!will.triggered && (
        <Card>
          <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">Actions</p>
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-primary"
              onClick={checkIn}
              disabled={checkingIn}
            >
              {checkingIn ? <><Spinner /> Checking in…</> : "✓ Check In"}
            </button>

            {DEMO_MODE && (
              <button
                className="btn-secondary"
                onClick={() => manualTrigger(address)}
                disabled={triggering}
              >
                {triggering ? <><Spinner /> Triggering…</> : "⚡ Demo: Trigger Will"}
              </button>
            )}

            <button
              className="btn-danger"
              onClick={() => setConfirmRevoke(true)}
            >
              Revoke Will
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Check in regularly to reset the inactivity timer and prevent accidental triggers.
          </p>
          <p className="text-xs text-gray-600 mt-1">
            To edit your will (beneficiaries, assets), revoke it first then create a new one — contracts are non-upgradeable by design.
          </p>
        </Card>
      )}

      {/* Revoke confirm modal */}
      <Modal open={confirmRevoke} onClose={() => setConfirmRevoke(false)} title="Revoke your will?">
        <p className="text-gray-400 text-sm mb-6">
          This permanently deletes your will from the blockchain. Your assets will no longer be protected. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            className="btn-danger flex-1"
            onClick={async () => { await revokeWill(); setConfirmRevoke(false); }}
            disabled={revoking}
          >
            {revoking ? <Spinner /> : "Yes, revoke"}
          </button>
          <button className="btn-secondary flex-1" onClick={() => setConfirmRevoke(false)}>
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
