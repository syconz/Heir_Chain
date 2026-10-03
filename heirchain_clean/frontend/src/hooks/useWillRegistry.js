import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { WILL_REGISTRY_ABI } from "../abis";
import { ADDRESSES, CONTRACTS_CONFIGURED, DEMO_MODE } from "../utils/wagmiConfig";
import { DEMO_WILL_STATUS, DEMO_BENEFICIARIES, DEMO_ASSETS, DEMO_GUARDIANS, getErrorMessage } from "../utils/helpers";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

const ADDR = ADDRESSES.willRegistry;

// ── Module-level demo store ────────────────────────────────────────────────
let _demoWill = { ...DEMO_WILL_STATUS };
const _demoSubscribers = new Set();
let _demoGuardianVotes = {};
const _demoGuardianSubscribers = new Set();

function updateDemoWill(updates) {
  _demoWill = { ..._demoWill, ...updates };
  _demoSubscribers.forEach(fn => fn({ ..._demoWill }));
}

function demoOwnerKey(ownerAddress) {
  return ownerAddress?.toLowerCase() || "demo-owner";
}

function getDemoGuardianVotes(ownerAddress) {
  const key = demoOwnerKey(ownerAddress);
  return _demoGuardianVotes[key] || { count: 0, voters: {} };
}

function updateDemoGuardianVote(ownerAddress, guardianAddress) {
  const key = demoOwnerKey(ownerAddress);
  const current = getDemoGuardianVotes(ownerAddress);
  const availableGuardian = DEMO_GUARDIANS.find(
    (guardian) => !current.voters[guardian.toLowerCase()]
  );
  const voter = (guardianAddress || availableGuardian || `demo-guardian-${current.count}`).toLowerCase();

  if (current.voters[voter]) return false;

  const next = {
    count: current.count + 1,
    voters: { ...current.voters, [voter]: true },
  };
  _demoGuardianVotes = { ..._demoGuardianVotes, [key]: next };
  _demoGuardianSubscribers.forEach(({ ownerKey: subscriberKey, listener }) => {
    if (subscriberKey === key) listener({ ...next, voters: { ...next.voters } });
  });
  updateDemoWill({
    triggered: next.count >= 2,
    disputeEndsAt: next.count >= 2 ? Math.floor(Date.now() / 1000) + 300 : 0,
  });
  return true;
}

function resetDemoGuardianVotes() {
  _demoGuardianVotes = {};
  _demoGuardianSubscribers.forEach(({ ownerKey: subscriberKey, listener }) => {
    listener({ ...getDemoGuardianVotes(subscriberKey), voters: {} });
  });
}

export function triggerDemoWill() {
  updateDemoWill({
    triggered:    true,
    disputeEndsAt: Math.floor(Date.now() / 1000) + 300,
  });
}

export function markDemoDistributed() {
  updateDemoWill({ distributed: true });
}

function useDemoWill() {
  const [state, setState] = useState({ ..._demoWill });
  useEffect(() => {
    _demoSubscribers.add(setState);
    return () => _demoSubscribers.delete(setState);
  }, []);
  return state;
}

function useDemoGuardianVotes(ownerAddress) {
  const [state, setState] = useState(() => getDemoGuardianVotes(ownerAddress));

  useEffect(() => {
    const ownerKey = demoOwnerKey(ownerAddress);
    const subscription = { ownerKey, listener: (next) => setState(next) };
    _demoGuardianSubscribers.add(subscription);
    setState(getDemoGuardianVotes(ownerAddress));
    return () => _demoGuardianSubscribers.delete(subscription);
  }, [ownerAddress]);

  return state;
}

// ── Read: will status ──────────────────────────────────────────────────────
export function useWillStatus(ownerAddress, options = {}) {
  const demoData = useDemoWill();
  const demoGuardianVotes = useDemoGuardianVotes(ownerAddress);

  const { data, isLoading, refetch } = useReadContract({
    address: ADDR,
    abi:     WILL_REGISTRY_ABI,
    functionName: "getWillStatus",
    args:    [ownerAddress],
    enabled: !!ownerAddress && !!ADDR && !DEMO_MODE,
    query: { refetchInterval: 10_000 },
  });

  // `getWillStatus` intentionally has a compact return shape. Read the public
  // struct getter separately so guardian-mode UIs can show the M-of-N value
  // without changing the deployed V1 function signature.
  const { data: rawWill, isLoading: isConfigLoading } = useReadContract({
    address: ADDR,
    abi: WILL_REGISTRY_ABI,
    functionName: "wills",
    args: [ownerAddress],
    enabled: !!ownerAddress && !!ADDR && !DEMO_MODE,
    query: { refetchInterval: 10_000 },
  });

  if (DEMO_MODE) {
    if (!options.demoGuardian) return { data: demoData, isLoading: false, refetch: () => {} };
    return {
      data: {
        ...demoData,
        triggerMode: 1,
        requiredGuardians: 2n,
        triggered: demoGuardianVotes.count >= 2,
        disputeEndsAt: demoGuardianVotes.count >= 2 ? demoData.disputeEndsAt : 0,
      },
      isLoading: false,
      refetch: () => {},
    };
  }

  const parsed = data ? {
    exists:         data[0],
    triggered:      data[1],
    distributed:    data[2],
    lastCheckInAt:  data[3],
    disputeEndsAt:  data[4],
    triggerMode:    Number(data[5]),
    requiredGuardians: rawWill?.[3] ?? 0n,
    ipfsMessageCID: data[6],
  } : null;

  return { data: parsed, isLoading: isLoading || isConfigLoading, refetch };
}

// ── Read: beneficiaries ────────────────────────────────────────────────────
export function useBeneficiaries(ownerAddress) {
  const { data, isLoading, refetch } = useReadContract({
    address: ADDR,
    abi:     WILL_REGISTRY_ABI,
    functionName: "getBeneficiaries",
    args:    [ownerAddress],
    enabled: !!ownerAddress && !!ADDR && !DEMO_MODE,
  });
  if (DEMO_MODE) return { data: DEMO_BENEFICIARIES, isLoading: false, refetch: () => {} };
  return { data: data || [], isLoading, refetch };
}

// ── Read: assets ───────────────────────────────────────────────────────────
export function useAssets(ownerAddress) {
  const { data, isLoading, refetch } = useReadContract({
    address: ADDR,
    abi:     WILL_REGISTRY_ABI,
    functionName: "getAssets",
    args:    [ownerAddress],
    enabled: !!ownerAddress && !!ADDR && !DEMO_MODE,
  });
  if (DEMO_MODE) return { data: DEMO_ASSETS, isLoading: false, refetch: () => {} };
  return { data: data || [], isLoading, refetch };
}

// ── Read: guardians ────────────────────────────────────────────────────────
export function useGuardians(ownerAddress) {
  const { data, isLoading } = useReadContract({
    address: ADDR,
    abi:     WILL_REGISTRY_ABI,
    functionName: "getGuardians",
    args:    [ownerAddress],
    enabled: !!ownerAddress && !!ADDR && !DEMO_MODE,
  });
  if (DEMO_MODE) return { data: DEMO_GUARDIANS, isLoading: false };
  return { data: data || [], isLoading };
}

// ── Read: thresholds ───────────────────────────────────────────────────────
export function useThresholds() {
  const { data: inactivity } = useReadContract({
    address: ADDR, abi: WILL_REGISTRY_ABI,
    functionName: "inactivityThreshold",
    enabled: !!ADDR && !DEMO_MODE,
  });
  const { data: dispute } = useReadContract({
    address: ADDR, abi: WILL_REGISTRY_ABI,
    functionName: "disputeWindow",
    enabled: !!ADDR && !DEMO_MODE,
  });
  return {
    inactivityThreshold: DEMO_MODE ? 180n : (inactivity || 0n),
    disputeWindow:       DEMO_MODE ? 300n : (dispute    || 0n),
  };
}

// ── Read: guardian vote status ─────────────────────────────────────────────
export function useGuardianVoteStatus(willOwner, guardianAddress) {
  const demoVotes = useDemoGuardianVotes(willOwner);
  const { data: voted } = useReadContract({
    address: ADDR, abi: WILL_REGISTRY_ABI,
    functionName: "guardianVoted",
    args: [willOwner, guardianAddress],
    enabled: !!willOwner && !!guardianAddress && !!ADDR && !DEMO_MODE,
  });
  const { data: count } = useReadContract({
    address: ADDR, abi: WILL_REGISTRY_ABI,
    functionName: "guardianVoteCount",
    args: [willOwner],
    enabled: !!willOwner && !!ADDR && !DEMO_MODE,
  });
  if (DEMO_MODE) {
    const demoGuardian = (guardianAddress || DEMO_GUARDIANS[0]).toLowerCase();
    return {
      hasVoted: Boolean(demoVotes.voters[demoGuardian]),
      voteCount: BigInt(demoVotes.count),
    };
  }
  return { hasVoted: voted || false, voteCount: count || 0n };
}

async function waitForReceipt(publicClient, hash) {
  if (!publicClient) throw new Error("Blockchain connection is not ready");
  await publicClient.waitForTransactionReceipt({ hash });
}

// ── Write: checkIn ─────────────────────────────────────────────────────────
export function useCheckIn(onSuccess) {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const [hash, setHash] = useState(null);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const checkIn = async () => {
    if (DEMO_MODE) {
      updateDemoWill({ lastCheckInAt: Math.floor(Date.now() / 1000) });
      toast.success("Checked in! Timer reset.");
      return true;
    }
    try {
      const h = await writeContractAsync({
        address: ADDR,
        abi: WILL_REGISTRY_ABI,
        functionName: "checkIn",
      });
      setHash(h);
      toast.loading("Confirming check-in…", { id: "checkin" });
      await waitForReceipt(publicClient, h);
      return true;
    } catch (e) {
      toast.error(getErrorMessage(e, "Check-in failed"), { id: "checkin" });
      return false;
    }
  };

  useEffect(() => {
    if (isSuccess) {
      toast.success("Checked in successfully!", { id: "checkin" });
      if (onSuccess) onSuccess();
    }
  }, [isSuccess, onSuccess]);

  return { checkIn, isPending: isPending || isConfirming };
}

// ── Write: revokeWill ──────────────────────────────────────────────────────
export function useRevokeWill(onSuccess) {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const [hash, setHash] = useState(null);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const revokeWill = async () => {
    if (DEMO_MODE) {
      resetDemoGuardianVotes();
      updateDemoWill({ exists: false });
      toast.success("Demo: will revoked!");
      return true;
    }
    try {
      const h = await writeContractAsync({
        address: ADDR,
        abi: WILL_REGISTRY_ABI,
        functionName: "revokeWill",
      });
      setHash(h);
      toast.loading("Revoking will…", { id: "revoke" });
      await waitForReceipt(publicClient, h);
      return true;
    } catch (e) {
      toast.error(getErrorMessage(e, "Revoke failed"), { id: "revoke" });
      return false;
    }
  };

  useEffect(() => {
    if (isSuccess) {
      toast.success("Will revoked.", { id: "revoke" });
      if (onSuccess) onSuccess();
    }
  }, [isSuccess, onSuccess]);

  return { revokeWill, isPending: isPending || isConfirming };
}

// ── Write: castGuardianVote ────────────────────────────────────────────────
export function useCastGuardianVote(onSuccess) {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const [hash, setHash] = useState(null);
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const castVote = async (willOwner, guardianAddress) => {
    if (DEMO_MODE) {
      const updated = updateDemoGuardianVote(willOwner, guardianAddress);
      if (updated) toast.success("Demo: guardian vote cast!");
      else toast.error("This guardian has already voted");
      return updated;
    }
    try {
      const h = await writeContractAsync({
        address: ADDR,
        abi: WILL_REGISTRY_ABI,
        functionName: "castGuardianVote",
        args: [willOwner],
      });
      setHash(h);
      toast.loading("Submitting vote…", { id: "vote" });
      await waitForReceipt(publicClient, h);
      return true;
    } catch (e) {
      toast.error(getErrorMessage(e, "Vote failed"), { id: "vote" });
      return false;
    }
  };

  useEffect(() => {
    if (isSuccess) {
      toast.success("Vote submitted!", { id: "vote" });
      if (onSuccess) onSuccess();
    }
  }, [isSuccess, onSuccess]);

  return { castVote, isPending };
}

// ── Write: createWill ──────────────────────────────────────────────────────
export function useCreateWill() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const [hash, setHash] = useState(null);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createWill = async (args) => {
    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 1500));
      resetDemoGuardianVotes();
      updateDemoWill({
        exists:        true,
        triggered:     false,
        distributed:   false,
        lastCheckInAt: Math.floor(Date.now() / 1000),
        disputeEndsAt: 0,
        triggerMode:   Number(args[0]),
        requiredGuardians: BigInt(args[1] || 0),
        ipfsMessageCID: args[5] || "",
      });
      toast.success("Demo: will created!");
      return true;
    }
    try {
      const h = await writeContractAsync({
        address: ADDR,
        abi: WILL_REGISTRY_ABI,
        functionName: "createWill",
        args,
      });
      setHash(h);
      toast.loading("Creating will on-chain…", { id: "create" });
      await waitForReceipt(publicClient, h);
      return h;
    } catch (e) {
      toast.error(getErrorMessage(e, "Failed to create will"), { id: "create" });
      return null;
    }
  };

  useEffect(() => {
    if (isSuccess) toast.success("Will created successfully!", { id: "create" });
  }, [isSuccess]);

  return { createWill, isPending: isPending || isConfirming, isSuccess };
}

// Address validation helper for contract configuration
export function isRegistryConfigured() {
  return CONTRACTS_CONFIGURED;
}
