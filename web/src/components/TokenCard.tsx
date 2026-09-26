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

/** One token as a row: name and symbol on the left, key figures on the right. */
export function TokenCard({ address }: { address: Address }) {
  const t = useTokenSummary(address);
  return (
    <li className="border-t" style={{ borderColor: "var(--line)" }}>
      <Link
        href={`/token/${address}`}
        className="grid grid-cols-1 gap-x-6 gap-y-1 py-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_120px] sm:items-baseline"
        style={{ borderBottom: 0 }}
      >
        <span>
          <span style={{ color: "var(--ink)" }}>{t.name ?? "…"}</span>
          <span className="muted ml-2">{t.symbol}</span>
        </span>
        <span style={{ color: "var(--mid)" }}>
          {t.assetInfo?.assetType || "Asset"}
          {t.assetInfo?.jurisdiction ? ` · ${t.assetInfo.jurisdiction}` : ""}
        </span>
        <span style={{ color: "var(--mid)" }}>
          {formatValuation(t.assetInfo?.valuation, t.assetInfo?.valuationCurrency)}
        </span>
        <span className="muted sm:text-right">
          {t.paused ? (
            <span className="badge badge-alert">paused</span>
          ) : (
            <>supply {formatAmount(t.totalSupply, t.decimals)}</>
          )}
        </span>
      </Link>
    </li>
  );
}

export function TokenList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="border-b" style={{ borderColor: "var(--line)" }}>
      {children}
    </ul>
  );
}
