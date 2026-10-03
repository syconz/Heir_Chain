import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { TRIGGER_VERIFIER_ABI } from "../abis";
import { ADDRESSES, DEMO_MODE } from "../utils/wagmiConfig";
import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { getErrorMessage } from "../utils/helpers";
import toast from "react-hot-toast";

const ADDR = ADDRESSES.triggerVerifier;

// Import the demo store updater
import { triggerDemoWill } from "./useWillRegistry";

export function useRegisterMonitoring() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const [hash, setHash] = useState(null);
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const register = async (willOwner) => {
    if (DEMO_MODE) return true;
    try {
      const h = await writeContractAsync({
        address: ADDR,
        abi: TRIGGER_VERIFIER_ABI,
        functionName: "registerForMonitoring",
        args: [willOwner],
      });
      setHash(h);
      if (!publicClient) throw new Error("Blockchain connection is not ready");
      await publicClient.waitForTransactionReceipt({ hash: h });
      return h;
    } catch (e) {
      toast.error(getErrorMessage(e, "Monitoring registration failed"), { id: "monitor" });
      return null;
    }
  };

  return { register, isPending, isSuccess };
}

export function useManualTrigger() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const [hash, setHash] = useState(null);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const manualTrigger = async (willOwner) => {
    if (DEMO_MODE) {
      triggerDemoWill();
      toast.success("Will triggered! Dispute window started.");
      return true;
    }
    try {
      const h = await writeContractAsync({
        address: ADDR,
        abi: TRIGGER_VERIFIER_ABI,
        functionName: "manualTriggerForDemo",
        args: [willOwner],
      });
      setHash(h);
      toast.loading("Triggering will…", { id: "trigger" });
      if (!publicClient) throw new Error("Blockchain connection is not ready");
      await publicClient.waitForTransactionReceipt({ hash: h });
      return h;
    } catch (e) {
      toast.error(getErrorMessage(e, "Trigger failed"), { id: "trigger" });
      return null;
    }
  };

  useEffect(() => {
    if (isSuccess) toast.success("Will triggered!", { id: "trigger" });
  }, [isSuccess]);

  return { manualTrigger, isPending: isPending || isConfirming };
}
