"use client";

import Link from "next/link";
import { useState } from "react";
import { parseEventLogs, parseUnits, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { rwaTokenFactoryAbi } from "@/abi/rwaTokenFactoryAbi";
import { FactoryGuard } from "@/components/FactoryGuard";
import { TokenCard, TokenList } from "@/components/TokenCard";
import { Field, Notice, TxStatus } from "@/components/ui";
import { useTx } from "@/lib/hooks";

const ASSET_TYPES = [
  "Real estate",
  "Private credit",
  "Treasury / bonds",
  "Equity",
  "Commodity",
  "Art & collectibles",
  "Infrastructure",
  "Carbon credits",
  "Other",
];

const empty = {
  name: "",
  symbol: "",
  decimals: "18",
  cap: "",
  assetType: "Real estate",
  jurisdiction: "CH",
  description: "",
  legalEntity: "",
  valuation: "",
  valuationCurrency: "CHF",
  metadataURI: "",
};

function CreateTokenForm({ factory, onCreated }: { factory: Address; onCreated: () => void }) {
  const [f, setF] = useState(empty);
  const [created, setCreated] = useState<Address>();
  const [formError, setFormError] = useState<string>();
  const tx = useTx();
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    setCreated(undefined);
    let decimals: number, cap: bigint, valuation: bigint;
    try {
      decimals = Number(f.decimals);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error("Decimals must be 0–18.");
      cap = f.cap ? parseUnits(f.cap, decimals) : 0n;
      valuation = f.valuation ? parseUnits(f.valuation, 2) : 0n; // stored in cents
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid number.");
      return;
    }

    const receipt = await tx.send({
      address: factory,
      abi: rwaTokenFactoryAbi,
      functionName: "createToken",
      args: [
        {
          name: f.name.trim(),
          symbol: f.symbol.trim().toUpperCase(),
          decimals,
          cap,
          assetInfo: {
            assetType: f.assetType,
            jurisdiction: f.jurisdiction.trim(),
            description: f.description.trim(),
            legalEntity: f.legalEntity.trim(),
            valuation,
            valuationCurrency: f.valuationCurrency.trim().toUpperCase(),
            valuationTimestamp: 0n,
            metadataURI: f.metadataURI.trim(),
          },
        },
      ],
    });
    if (receipt) {
      const [log] = parseEventLogs({ abi: rwaTokenFactoryAbi, eventName: "TokenCreated", logs: receipt.logs });
      if (log) setCreated(log.args.token);
      setF(empty);
      onCreated();
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2>Create a token</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Token name">
          <input className="input" required value={f.name} onChange={set("name")} placeholder="Zurich Office Building" />
        </Field>
        <Field label="Symbol" hint="Must be unique across the factory.">
          <input className="input" required maxLength={11} value={f.symbol} onChange={set("symbol")} placeholder="ZOB" />
        </Field>
        <Field label="Decimals" hint="18 is standard. Use 0 for indivisible shares.">
          <input className="input" type="number" min={0} max={18} value={f.decimals} onChange={set("decimals")} />
        </Field>
        <Field label="Maximum supply" hint="Leave empty for no cap.">
          <input className="input" inputMode="decimal" value={f.cap} onChange={set("cap")} placeholder="1000000" />
        </Field>
      </div>

      <h3 className="pt-2">Underlying asset</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Asset type">
          <select className="input" value={f.assetType} onChange={set("assetType")}>
            {ASSET_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Jurisdiction" hint="ISO country code, e.g. CH, LU, US-DE.">
          <input className="input" value={f.jurisdiction} onChange={set("jurisdiction")} />
        </Field>
        <Field label="Legal entity / SPV">
          <input className="input" value={f.legalEntity} onChange={set("legalEntity")} placeholder="ZOB Property AG" />
        </Field>
        <div className="grid grid-cols-[1fr_90px] gap-2">
          <Field label="Valuation">
            <input className="input" inputMode="decimal" value={f.valuation} onChange={set("valuation")} placeholder="25000000" />
          </Field>
          <Field label="Currency">
            <input className="input" maxLength={3} value={f.valuationCurrency} onChange={set("valuationCurrency")} />
          </Field>
        </div>
      </div>
      <Field label="Description">
        <textarea className="input" rows={2} value={f.description} onChange={set("description")} />
      </Field>
      <Field label="Metadata URI (optional)" hint="Link to a JSON file with extra details, e.g. ipfs://…">
        <input className="input mono" value={f.metadataURI} onChange={set("metadataURI")} />
      </Field>

      <button className="btn" type="submit" disabled={tx.pending}>
        {tx.pending ? "Creating…" : "Create token"}
      </button>
      {formError && <p  style={{ color: "var(--alert)" }}>{formError}</p>}
      <TxStatus {...tx} successText="Token created." />
      {created && (
        <p>
          <Link href={`/token/${created}`} >
            Open the new token
          </Link>{" "}
          to allowlist investors, mint and attach documents.
        </p>
      )}
    </form>
  );
}

function IssuerPanel({ factory }: { factory: Address }) {
  const { address } = useAccount();
  const { data: isIssuer } = useReadContract({
    address: factory,
    abi: rwaTokenFactoryAbi,
    functionName: "isIssuer",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: mine, refetch } = useReadContract({
    address: factory,
    abi: rwaTokenFactoryAbi,
    functionName: "tokensOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  if (!address) return <Notice>Connect your wallet to create and manage tokens.</Notice>;

  return (
    <div className="space-y-16">
      {isIssuer === false ? (
        <Notice>
          The connected wallet <span className="mono">{address}</span> is not an approved issuer. Ask the platform admin
          to approve it on the Admin page, or switch to an issuer wallet.
        </Notice>
      ) : (
        <CreateTokenForm factory={factory} onCreated={() => refetch()} />
      )}
      <section className="space-y-3">
        <h2>your tokens</h2>
        {mine?.length ? (
          <TokenList>
            {[...mine].reverse().map((t) => (
              <TokenCard key={t} address={t} />
            ))}
          </TokenList>
        ) : (
          <p className="muted">You haven&apos;t created any tokens yet.</p>
        )}
      </section>
    </div>
  );
}

export default function IssuerPage() {
  return (
    <div>
      <h2 className="mb-9">issuer</h2>
      <FactoryGuard>{(factory) => <IssuerPanel factory={factory} />}</FactoryGuard>
    </div>
  );
}
