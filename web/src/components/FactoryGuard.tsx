"use client";

import type { ReactNode } from "react";
import type { Address } from "viem";
import { useFactoryAddress } from "@/lib/hooks";
import { Notice } from "./ui";

/** Renders children only when a factory is configured for the connected chain. */
export function FactoryGuard({ children }: { children: (factory: Address) => ReactNode }) {
  const { factory, chainId } = useFactoryAddress();
  if (!factory) {
    return (
      <Notice>
        No factory is configured for chain {chainId}. Deploy it with the Foundry script and set{" "}
        <code>NEXT_PUBLIC_FACTORY_ADDRESS_*</code> in <code>web/.env.local</code>, or switch network.
      </Notice>
    );
  }
  return <>{children(factory)}</>;
}
