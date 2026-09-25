"use client";

import { useReadContract } from "wagmi";
import { rwaTokenFactoryAbi } from "@/abi/rwaTokenFactoryAbi";
import { FactoryGuard } from "@/components/FactoryGuard";
import { TokenCard } from "@/components/TokenCard";
import { Notice } from "@/components/ui";
import type { Address } from "viem";

function TokenList({ factory }: { factory: Address }) {
  const { data: tokens, isLoading, error } = useReadContract({
    address: factory,
    abi: rwaTokenFactoryAbi,
    functionName: "allTokens",
  });

  if (isLoading) return <Notice>Loading tokens…</Notice>;
  if (error) return <Notice>Could not read the factory: {error.message.split("\n")[0]}</Notice>;
  if (!tokens?.length) return <Notice>No tokens yet. Approved issuers can create one on the Issuer page.</Notice>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...tokens].reverse().map((t) => (
        <TokenCard key={t} address={t} />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tokenized real-world assets</h1>
        <p className="muted mt-1 max-w-2xl">
          Permissioned ERC-20 tokens issued through the factory. Only allowlisted wallets can hold or transfer them,
          and each token carries its asset details and legal documents on-chain.
        </p>
      </div>
      <FactoryGuard>{(factory) => <TokenList factory={factory} />}</FactoryGuard>
    </div>
  );
}
