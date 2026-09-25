"use client";

import Link from "next/link";
import { formatUnits, type Address } from "viem";
import { useReadContracts } from "wagmi";
import { rwaTokenAbi } from "@/abi/rwaTokenAbi";

export function useTokenSummary(address: Address) {
  const c = { address, abi: rwaTokenAbi } as const;
  const { data, refetch, isLoading } = useReadContracts({
    contracts: [
      { ...c, functionName: "name" },
      { ...c, functionName: "symbol" },
      { ...c, functionName: "decimals" },
      { ...c, functionName: "totalSupply" },
      { ...c, functionName: "cap" },
      { ...c, functionName: "paused" },
      { ...c, functionName: "assetInfo" },
    ],
  });
  return {
    isLoading,
    refetch,
    name: data?.[0].result,
    symbol: data?.[1].result,
    decimals: data?.[2].result ?? 18,
    totalSupply: data?.[3].result,
    cap: data?.[4].result,
    paused: data?.[5].result,
    assetInfo: data?.[6].result,
  };
}

export function formatAmount(value: bigint | undefined, decimals: number) {
  if (value === undefined) return "…";
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function formatValuation(value: bigint | undefined, currency: string | undefined) {
  if (value === undefined) return "…";
  const major = Number(value) / 100;
  return `${major.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency ?? ""}`.trim();
}

export function TokenCard({ address }: { address: Address }) {
  const t = useTokenSummary(address);
  return (
    <Link href={`/token/${address}`} className="card block transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{t.name ?? "…"}</div>
          <div className="muted text-sm">{t.symbol}</div>
        </div>
        <span className="badge">{t.assetInfo?.assetType || "Asset"}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <dt className="muted">Supply</dt>
        <dd className="text-right">{formatAmount(t.totalSupply, t.decimals)}</dd>
        <dt className="muted">Valuation</dt>
        <dd className="text-right">{formatValuation(t.assetInfo?.valuation, t.assetInfo?.valuationCurrency)}</dd>
        <dt className="muted">Jurisdiction</dt>
        <dd className="text-right">{t.assetInfo?.jurisdiction || "—"}</dd>
      </dl>
      {t.paused && <p className="mt-3 text-xs" style={{ color: "#c0392b" }}>Transfers paused</p>}
    </Link>
  );
}
