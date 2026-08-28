import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { ASSET_DISTRIBUTOR_ABI, ERC20_ABI, ERC721_ABI } from "../abis";
import { ADDRESSES, DEMO_MODE } from "../utils/wagmiConfig";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

const DIST_ADDR = ADDRESSES.assetDistributor;

// ── Distribute assets after dispute window ─────────────────────────────────
export function useDistribute() {
  const { writeContractAsync, isPending } = useWriteContract();
  const [hash, setHash] = useState(null);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const distribute = async (willOwner) => {
    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 1500));
      toast.success("Demo: assets distributed to heirs!");
      return true;
    }
    try {
      const h = await writeContractAsync({
        address: DIST_ADDR,
        abi: ASSET_DISTRIBUTOR_ABI,
        functionName: "distribute",
        args: [willOwner],
      });
      setHash(h);
      toast.loading("Distributing assets…", { id: "distribute" });
      return h;
    } catch (e) {
      toast.error(e.shortMessage || "Distribution failed");
      return null;
    }
  };

  useEffect(() => {
    if (isSuccess) toast.success("Assets distributed successfully!", { id: "distribute" });
  }, [isSuccess]);

  return { distribute, isPending: isPending || isConfirming, isSuccess };
}

// ── Approve ERC-20 spend ───────────────────────────────────────────────────
export function useApproveERC20() {
  const { writeContractAsync, isPending } = useWriteContract();
  const [hash, setHash] = useState(null);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = async (tokenAddress, amount) => {
    if (DEMO_MODE) { toast.success("Demo: ERC-20 approved!"); return true; }
    try {
      const h = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [DIST_ADDR, amount],
      });
      setHash(h);
      toast.loading("Approving token spend…", { id: "approveERC20" });
      return h;
    } catch (e) {
      toast.error(e.shortMessage || "Approval failed");
      return null;
    }
  };

  useEffect(() => {
    if (isSuccess) toast.success("Token approved!", { id: "approveERC20" });
  }, [isSuccess]);

  return { approve, isPending: isPending || isConfirming, isSuccess };
}

// ── Approve ERC-721 transfer ───────────────────────────────────────────────
export function useApproveERC721() {
  const { writeContractAsync, isPending } = useWriteContract();
  const [hash, setHash] = useState(null);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = async (tokenAddress, tokenId) => {
    if (DEMO_MODE) { toast.success("Demo: NFT approved!"); return true; }
    try {
      const h = await writeContractAsync({
        address: tokenAddress,
        abi: ERC721_ABI,
        functionName: "approve",
        args: [DIST_ADDR, tokenId],
      });
      setHash(h);
      toast.loading("Approving NFT transfer…", { id: "approveNFT" });
      return h;
    } catch (e) {
      toast.error(e.shortMessage || "NFT approval failed");
      return null;
    }
  };

  useEffect(() => {
    if (isSuccess) toast.success("NFT approved!", { id: "approveNFT" });
  }, [isSuccess]);

  return { approve, isPending: isPending || isConfirming, isSuccess };
}

// ── Read ERC-20 allowance ──────────────────────────────────────────────────
export function useERC20Allowance(tokenAddress, ownerAddress) {
  const { data } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [ownerAddress, DIST_ADDR],
    enabled: !!tokenAddress && !!ownerAddress && !DEMO_MODE,
  });
  return data || 0n;
}
