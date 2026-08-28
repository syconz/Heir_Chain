import { useState } from "react";
import { useAccount } from "wagmi";
import { useWillStatus, useGuardians, useCastGuardianVote, useGuardianVoteStatus } from "../hooks/useWillRegistry";
import { Card, SectionHeader, StatusBadge, InfoRow, Spinner, EmptyState } from "../components/ui";
import { shortAddr, timeAgo, TRIGGER_MODES } from "../utils/helpers";
import { DEMO_MODE } from "../utils/wagmiConfig";

export default function GuardianVote() {
  const { address, isConnected } = useAccount();
  const [willOwner, setWillOwner]   = useState("");
  const [lookupAddr, setLookupAddr] = useState("");

  const { data: will, isLoading } = useWillStatus(lookupAddr || undefined);
  const { data: guardians }       = useGuardians(lookupAddr || undefined);
  const { hasVoted, voteCount }   = useGuardianVoteStatus(lookupAddr, address);
  const { castVote, isPending }   = useCastGuardianVote();

  const handleLookup = (e) => {
    e.preventDefault();
    setLookupAddr(willOwner.trim());
  };

  const isGuardian = guardians?.some(g => g.toLowerCase() === address?.toLowerCase());

  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <SectionHeader
        title="Guardian Vote"
        subtitle="Cast your confirmation vote for a will owner's death trigger."
      />

      {/* Lookup form */}
      <Card className="mb-6">
        <h2 className="text-base font-medium text-gray-300 mb-4">Look up a will owner</h2>
        <form onSubmit={handleLookup} className="flex gap-2">
          <input
            value={willOwner}
            onChange={e => setWillOwner(e.target.value)}
            placeholder="0x… will owner address"
            className="input flex-1 font-mono text-sm"
          />
          <button type="submit" className="btn-primary shrink-0">Look up</button>
        </form>
        {DEMO_MODE && (
          <button
            className="text-xs text-gray-600 hover:text-gray-400 mt-2"
            onClick={() => { setWillOwner("0xDemoOwner000000000000000000000000000001"); setLookupAddr("0xDemoOwner000000000000000000000000000001"); }}
          >
            Use demo address
          </button>
        )}
      </Card>

      {/* Results */}
      {isLoading && <div className="flex justify-center py-10"><Spinner size="lg" /></div>}

      {lookupAddr && !isLoading && !will?.exists && (
        <EmptyState icon="🔍" title="No will found" description="No will exists for this address." />
      )}

      {lookupAddr && will?.exists && (
        <div className="flex flex-col gap-4">
          <Card>
            <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">Will Details</p>
            <InfoRow label="Owner"        value={shortAddr(lookupAddr)} mono />
            <InfoRow label="Status"       value={<StatusBadge {...will} />} />
            <InfoRow label="Trigger mode" value={TRIGGER_MODES[will.triggerMode]} />
            <InfoRow label="Last check-in" value={timeAgo(will.lastCheckInAt)} />
          </Card>

          {will.triggerMode !== 1 && (
            <div className="glass border-l-2 border-amber-600 p-4">
              <p className="text-amber-400 text-sm">This will uses {TRIGGER_MODES[will.triggerMode]}, not Guardian Multi-sig.</p>
              <p className="text-gray-500 text-sm mt-1">Guardian voting is only available for guardian-mode wills.</p>
            </div>
          )}

          {will.triggerMode === 1 && (
            <Card>
              <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">Vote Status</p>
              <InfoRow label="Votes received" value={`${Number(voteCount)} of ${will.requiredGuardians} required`} />
              <InfoRow label="Your vote"       value={hasVoted ? "✓ Cast" : "Pending"} />

              {will.triggered ? (
                <div className="mt-4 p-3 bg-brand-900/30 border border-brand-800 rounded-lg text-center">
                  <p className="text-brand-400 text-sm font-medium">✓ Will has been triggered</p>
                  <p className="text-gray-500 text-xs mt-0.5">Dispute window is now active.</p>
                </div>
              ) : !isConnected && !DEMO_MODE ? (
                <p className="text-gray-600 text-sm mt-4">Connect your wallet to vote.</p>
              ) : !isGuardian && !DEMO_MODE ? (
                <div className="mt-4 p-3 bg-dark-700 rounded-lg">
                  <p className="text-gray-500 text-sm">Your address is not registered as a guardian for this will.</p>
                </div>
              ) : hasVoted ? (
                <div className="mt-4 p-3 bg-brand-900/30 border border-brand-800 rounded-lg">
                  <p className="text-brand-400 text-sm">✓ You have already cast your vote.</p>
                </div>
              ) : (
                <div className="mt-5">
                  <p className="text-gray-400 text-sm mb-4">
                    By voting, you confirm that the will owner has passed away. This action is irreversible.
                  </p>
                  <button
                    className="btn-primary w-full"
                    onClick={() => castVote(lookupAddr)}
                    disabled={isPending}
                  >
                    {isPending
                      ? <span className="flex items-center justify-center gap-2"><Spinner /> Submitting…</span>
                      : "✓ Confirm Death & Cast Vote"}
                  </button>
                </div>
              )}
            </Card>
          )}

          {guardians?.length > 0 && (
            <Card>
              <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">
                Registered Guardians ({guardians.length})
              </p>
              {guardians.map((g, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-dark-600 last:border-0">
                  <span className="font-mono text-sm text-gray-300">{shortAddr(g)}</span>
                  {g.toLowerCase() === address?.toLowerCase() && (
                    <span className="text-xs text-brand-400">You</span>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
