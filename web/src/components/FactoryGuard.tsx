"use client";

import type { ReactNode } from "react";
import type { Address } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { chains, FACTORY_ADDRESSES } from "@/lib/config";
import { useFactoryAddress } from "@/lib/hooks";
import { Notice } from "./ui";

/** Renders children only when a factory is configured for the connected chain. */
export function FactoryGuard({ children }: { children: (factory: Address) => ReactNode }) {
  const { factory, chainId } = useFactoryAddress();
  const { chain, isConnected } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();
  const target = chains.find((c) => FACTORY_ADDRESSES[c.id]);

  if (!factory) {
    const current = chain?.name ?? `chain ${chainId}`;
    return (
      <Notice>
        {target ? (
          <>
            <p>
              Your wallet is on <strong>{current}</strong>, but the platform runs on <strong>{target.name}</strong>.
            </p>
            {isConnected && (
              <button className="btn mt-3" disabled={isPending} onClick={() => switchChain({ chainId: target.id })}>
                {isPending ? "Switching…" : `Switch to ${target.name}`}
              </button>
            )}
            {error && (
              <p className="mt-2 text-[11px]">
                Your wallet refused to switch. In Rabby, turn on test networks in Settings first, then try again.
              </p>
            )}
          </>
        ) : (
          <>
            No factory is configured. Deploy it with the Foundry script and set <code>NEXT_PUBLIC_FACTORY_ADDRESS_*</code>{" "}
            in <code>web/.env.local</code>.
          </>
        )}
      </Notice>
    );
  }
  return <>{children(factory)}</>;
}
