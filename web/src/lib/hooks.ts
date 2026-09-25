"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { BaseError, ContractFunctionRevertedError, type Abi } from "viem";
import { FACTORY_ADDRESSES } from "./config";

export function useFactoryAddress() {
  const chainId = useChainId();
  return { chainId, factory: FACTORY_ADDRESSES[chainId] };
}

/** Human readable message from a viem/wagmi error, including custom Solidity errors. */
export function errorMessage(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      const a = revert.data?.args?.map(String) ?? [];
      const friendly: Record<string, string> = {
        NotAllowed: `${a[0]} is not on the allowlist.`,
        AccountFrozen: `${a[0]} is frozen.`,
        CapExceeded: "This would exceed the token's maximum supply.",
        EnforcedPause: "Transfers are paused for this token.",
        SymbolTaken: `The symbol "${a[0]}" is already used by another token.`,
        NotIssuer: "This wallet is not an approved issuer.",
        EmptyNameOrSymbol: "Name and symbol are required.",
        InvalidDecimals: "Decimals must be between 0 and 18.",
        InvalidDocument: "Document name and URI are required.",
        LengthMismatch: "Addresses and amounts must have the same length.",
        ERC20InsufficientBalance: "The wallet doesn't hold enough tokens.",
        AccessControlUnauthorizedAccount: "Your wallet doesn't have permission to do this.",
        OwnableUnauthorizedAccount: "Only the factory owner can do this.",
      };
      if (name && friendly[name]) return friendly[name];
      if (name) return a.length ? `${name}(${a.join(", ")})` : name;
    }
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : String(err);
}

type WriteArgs = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

/** Sends a transaction, waits for the receipt and exposes a simple status. */
export function useTx(onSuccess?: () => void) {
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();
  const { address: account } = useAccount();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string>();
  const [hash, setHash] = useState<`0x${string}`>();

  const send = useCallback(
    async (req: WriteArgs) => {
      setStatus("pending");
      setError(undefined);
      try {
        // Simulate first so a revert shows its decoded reason (e.g. "NotAllowed(0x…)") before the wallet opens.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await client!.simulateContract({ ...(req as any), account });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = await writeContractAsync(req as any);
        setHash(h);
        const receipt = await client!.waitForTransactionReceipt({ hash: h });
        if (receipt.status !== "success") throw new Error("Transaction reverted");
        setStatus("success");
        onSuccess?.();
        return receipt;
      } catch (e) {
        setStatus("error");
        setError(errorMessage(e));
      }
    },
    [writeContractAsync, client, account, onSuccess],
  );

  return { send, status, error, hash, pending: status === "pending" };
}
