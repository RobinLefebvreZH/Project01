"use client";

import { useReadContract } from "wagmi";
import { rwaTokenFactoryAbi } from "@/abi/rwaTokenFactoryAbi";
import { FactoryGuard } from "@/components/FactoryGuard";
import { TokenCard, TokenList as Rows } from "@/components/TokenCard";
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
    <Rows>
      {[...tokens].reverse().map((t) => (
        <TokenCard key={t} address={t} />
      ))}
    </Rows>
  );
}

export default function Home() {
  return (
    <div>
      <p className="lead mb-[22px]">
        Permissioned ERC-20 tokens backed by real-world assets.{" "}
        <span className="q">
          Only allowlisted wallets can hold or transfer them, and each token carries its asset details and legal
          documents on-chain.
        </span>
      </p>
      <p className="muted mb-16 text-[11px] tracking-[0.06em]">Real estate · private credit · commodities · art</p>
      <h2 className="mb-5">tokens</h2>
      <FactoryGuard>{(factory) => <TokenList factory={factory} />}</FactoryGuard>
    </div>
  );
}
