import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { WILL_REGISTRY_ABI } from "../abis";
import { ADDRESSES, DEMO_MODE } from "../utils/wagmiConfig";
import { DEMO_WILL_STATUS, DEMO_BENEFICIARIES, DEMO_ASSETS, DEMO_GUARDIANS } from "../utils/helpers";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

const ADDR = ADDRESSES.willRegistry;

// ── Module-level demo store ────────────────────────────────────────────────
let _demoWill = { ...DEMO_WILL_STATUS };
const _demoSubscribers = new Set();

function updateDemoWill(updates) {
  _demoWill = { ..._demoWill, ...updates };
  _demoSubscribers.forEach(fn => fn({ ..._demoWill }));
}

export function triggerDemoWill() {
  updateDemoWill({
    triggered:    true,
    disputeEndsAt: Math.floor(Date.now() / 1000) + 300,
  });
}

function useDemoWill() {
  const [state, setState] = useState({ ..._demoWill });
  useEffect(() => {
    _demoSubscribers.add(setState);
    return () => _demoSubscribers.delete(setState);
  }, []);
  return state;
}

// ── Read: will status ──────────────────────────────────────────────────────
export function useWillStatus(ownerAddress) {
  const demoData = useDemoWill();

  const { data, isLoading, refetch } = useReadContract({
    address: ADDR,
    abi:     WILL_REGISTRY_ABI,
    functionName: "getWillStatus",
    args:    [ownerAddress],
    enabled: !!ownerAddress && !!ADDR && !DEMO_MODE,
    watch:   true,
  });

  if (DEMO_MODE) return { data: demoData, isLoading: false, refetch: () => {} };

  const parsed = data ? {
    exists:         data[0],
    triggered:      data[1],
    distributed:    data[2],
    lastCheckInAt:  data[3],
    disputeEndsAt:  data[4],
    triggerMode:    Number(data[5]),
    ipfsMessageCID: data[6],
  } : null;

  return { data: parsed, isLoading, refetch };
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
  return { hasVoted: voted || false, voteCount: count || 0n };
}

// ── Write: checkIn ─────────────────────────────────────────────────────────
export function useCheckIn(onSuccess) {
  const { writeContractAsync, isPending } = useWriteContract();
  const [hash, setHash] = useState(null);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const checkIn = async () => {
    if (DEMO_MODE) {
      updateDemoWill({ lastCheckInAt: Math.floor(Date.now() / 1000) });
      toast.success("Checked in! Timer reset.");
      return;
    }
    try {
      const h = await writeContractAsync({
        address: ADDR,
        abi: WILL_REGISTRY_ABI,
        functionName: "checkIn",
      });
      setHash(h);
      toast.loading("Confirming check-in…", { id: "checkin" });
    } catch (e) {
      toast.error(e.shortMessage || "Check-in failed");
    }
  };

  useEffect(() => {
    if (isSuccess) {
      toast.success("Checked in successfully!", { id: "checkin" });
      if (onSuccess) onSuccess();
    }
  }, [isSuccess]);

  return { checkIn, isPending: isPending || isConfirming };
}

// ── Write: revokeWill ──────────────────────────────────────────────────────
export function useRevokeWill(onSuccess) {
  const { writeContractAsync, isPending } = useWriteContract();
  const [hash, setHash] = useState(null);
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const revokeWill = async () => {
    if (DEMO_MODE) {
      updateDemoWill({ exists: false });
      toast.success("Demo: will revoked!");
      return;
    }
    try {
      const h = await writeContractAsync({
        address: ADDR,
        abi: WILL_REGISTRY_ABI,
        functionName: "revokeWill",
      });
      setHash(h);
      toast.loading("Revoking will…", { id: "revoke" });
    } catch (e) {
      toast.error(e.shortMessage || "Revoke failed");
    }
  };

  useEffect(() => {
    if (isSuccess) {
      toast.success("Will revoked.", { id: "revoke" });
      if (onSuccess) onSuccess();
    }
  }, [isSuccess]);

  return { revokeWill, isPending };
}

// ── Write: castGuardianVote ────────────────────────────────────────────────
export function useCastGuardianVote(onSuccess) {
  const { writeContractAsync, isPending } = useWriteContract();
  const [hash, setHash] = useState(null);
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const castVote = async (willOwner) => {
    if (DEMO_MODE) { toast.success("Demo: vote cast!"); return; }
    try {
      const h = await writeContractAsync({
        address: ADDR,
        abi: WILL_REGISTRY_ABI,
        functionName: "castGuardianVote",
        args: [willOwner],
      });
      setHash(h);
      toast.loading("Submitting vote…", { id: "vote" });
    } catch (e) {
      toast.error(e.shortMessage || "Vote failed");
    }
  };

  useEffect(() => {
    if (isSuccess) {
      toast.success("Vote submitted!", { id: "vote" });
      if (onSuccess) onSuccess();
    }
  }, [isSuccess]);

  return { castVote, isPending };
}

// ── Write: createWill ──────────────────────────────────────────────────────
export function useCreateWill() {
  const { writeContractAsync, isPending } = useWriteContract();
  const [hash, setHash] = useState(null);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createWill = async (args) => {
    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 1500));
      updateDemoWill({
        exists:        true,
        triggered:     false,
        distributed:   false,
        lastCheckInAt: Math.floor(Date.now() / 1000),
        disputeEndsAt: 0,
        triggerMode:   Number(args[0]),
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
      return h;
    } catch (e) {
      toast.error(e.shortMessage || "Failed to create will");
      return null;
    }
  };

  useEffect(() => {
    if (isSuccess) toast.success("Will created successfully!", { id: "create" });
  }, [isSuccess]);

  return { createWill, isPending: isPending || isConfirming, isSuccess };
}
