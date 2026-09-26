"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { hexToString, isAddress, keccak256, parseUnits, stringToHex, type Address, type Hex } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { rwaTokenAbi } from "@/abi/rwaTokenAbi";
import { formatAmount, formatValuation, useTokenSummary } from "@/components/TokenCard";
import { AddressLink, Field, Notice, TxStatus } from "@/components/ui";
import { ipfsToHttp } from "@/lib/config";
import { useTx } from "@/lib/hooks";

const AGENT_ROLE = keccak256(stringToHex("AGENT_ROLE"));
const ZERO_BYTES32 = ("0x" + "00".repeat(32)) as Hex;
const ADMIN_ROLE = ZERO_BYTES32; // DEFAULT_ADMIN_ROLE

function docName(b: Hex) {
  try {
    return hexToString(b, { size: 32 }).replace(/\0+$/, "");
  } catch {
    return b;
  }
}

// ---------------------------------------------------------------- overview

function Overview({ token, t }: { token: Address; t: ReturnType<typeof useTokenSummary> }) {
  const info = t.assetInfo;
  const updated = info?.valuationTimestamp ? new Date(Number(info.valuationTimestamp) * 1000).toLocaleDateString() : "—";
  return (
    <section>
      <h2 className="mb-9">
        {(info?.assetType || "asset").toLowerCase()} · {t.symbol ?? "…"}
        {t.paused && <span className="badge badge-alert ml-3">transfers paused</span>}
      </h2>
      <h1 className="lead">
        {t.name ?? "…"}
        {info?.description && <span className="q"> — {info.description}</span>}
      </h1>
      <p className="muted mt-3 text-[11px]">
        <AddressLink address={token} />
      </p>
      <dl className="mt-12 grid gap-x-12 sm:grid-cols-2">
        <Row k="Total supply" v={formatAmount(t.totalSupply, t.decimals)} />
        <Row k="Maximum supply" v={t.cap === 0n ? "No cap" : formatAmount(t.cap, t.decimals)} />
        <Row k="Valuation" v={formatValuation(info?.valuation, info?.valuationCurrency)} />
        <Row k="Valuation date" v={updated} />
        <Row k="Jurisdiction" v={info?.jurisdiction || "—"} />
        <Row k="Legal entity" v={info?.legalEntity || "—"} />
        <Row k="Decimals" v={String(t.decimals)} />
        <Row
          k="Metadata"
          v={
            info?.metadataURI ? (
              <a href={ipfsToHttp(info.metadataURI)} target="_blank" rel="noreferrer">
                open
              </a>
            ) : (
              "—"
            )
          }
        />
      </dl>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2" style={{ borderColor: "var(--line)" }}>
      <dt className="muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- documents

function useDocuments(token: Address) {
  const { data: names, refetch } = useReadContract({ address: token, abi: rwaTokenAbi, functionName: "getAllDocuments" });
  const { data: docs, refetch: refetchDocs } = useReadContracts({
    contracts: (names ?? []).map((n) => ({ address: token, abi: rwaTokenAbi, functionName: "getDocument", args: [n] }) as const),
    query: { enabled: !!names?.length },
  });
  const list = (names ?? []).map((n, i) => {
    const r = docs?.[i]?.result as readonly [string, Hex, bigint] | undefined;
    return { key: n, name: docName(n), uri: r?.[0], hash: r?.[1], timestamp: r?.[2] };
  });
  return { list, refetch: () => refetch().then(() => refetchDocs()) };
}

function Documents({ docs }: { docs: ReturnType<typeof useDocuments>["list"] }) {
  return (
    <div className="card space-y-3">
      <h2>Legal documents</h2>
      {!docs.length && <p className="muted">No documents attached yet.</p>}
      <ul className="space-y-3">
        {docs.map((d) => (
          <li key={d.key} >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{d.name}</span>
              {d.uri && (
                <a href={ipfsToHttp(d.uri)} target="_blank" rel="noreferrer">
                  View document
                </a>
              )}
            </div>
            <div className="muted mono text-[11px]">keccak256: {d.hash}</div>
            {d.timestamp ? (
              <div className="muted text-[11px]">Updated {new Date(Number(d.timestamp) * 1000).toLocaleString()}</div>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="muted text-[11px]">
        To check a document is authentic, compute the keccak256 hash of the file you downloaded and compare it with the hash
        above.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- holder view

function MyPosition({ token, t }: { token: Address; t: ReturnType<typeof useTokenSummary> }) {
  const { address } = useAccount();
  const c = { address: token, abi: rwaTokenAbi } as const;
  const { data, refetch } = useReadContracts({
    contracts: address
      ? [
          { ...c, functionName: "balanceOf", args: [address] },
          { ...c, functionName: "isAllowed", args: [address] },
          { ...c, functionName: "isFrozen", args: [address] },
        ]
      : [],
    query: { enabled: !!address },
  });
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const tx = useTx(() => {
    refetch();
    t.refetch();
  });
  if (!address) return null;
  const balance = data?.[0]?.result as bigint | undefined;
  const allowed = data?.[1]?.result as boolean | undefined;
  const frozen = data?.[2]?.result as boolean | undefined;

  return (
    <div className="card space-y-3">
      <h2>Your position</h2>
      <div className="flex flex-wrap gap-2">
        <span>
          Balance: <strong>{formatAmount(balance, t.decimals)}</strong> {t.symbol}
        </span>
        <span className="badge">{allowed ? "Allowlisted" : "Not allowlisted"}</span>
        {frozen && <span className="badge badge-alert">Frozen</span>}
      </div>
      {!!balance && balance > 0n && (
        <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto] sm:items-end">
          <Field label="Send to">
            <input className="input mono" value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" />
          </Field>
          <Field label="Amount">
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <button
            className="btn"
            disabled={!isAddress(to) || !amount || tx.pending}
            onClick={() => tx.send({ ...c, functionName: "transfer", args: [to, parseUnits(amount, t.decimals)] })}
          >
            Transfer
          </button>
        </div>
      )}
      <TxStatus {...tx} successText="Transfer complete." />
    </div>
  );
}

// ---------------------------------------------------------------- agent tools

function InvestorTools({ token, onChange }: { token: Address; onChange: () => void }) {
  const c = { address: token, abi: rwaTokenAbi } as const;
  const [addr, setAddr] = useState("");
  const [bulk, setBulk] = useState("");
  const valid = isAddress(addr);
  const { data, refetch } = useReadContracts({
    contracts: valid
      ? [
          { ...c, functionName: "isAllowed", args: [addr as Address] },
          { ...c, functionName: "isFrozen", args: [addr as Address] },
        ]
      : [],
    query: { enabled: valid },
  });
  const tx = useTx(() => {
    refetch();
    onChange();
  });
  const bulkList = bulk.split(/[\s,;]+/).filter(Boolean);
  const bulkValid = bulkList.length > 0 && bulkList.every((a) => isAddress(a));

  return (
    <div className="card space-y-3">
      <h3>Investors</h3>
      <Field label="Wallet address">
        <input className="input mono" value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="0x…" />
      </Field>
      {valid && data && (
        <div className="flex gap-2">
          <span className="badge">{data[0]?.result ? "Allowlisted" : "Not allowlisted"}</span>
          <span className="badge">{data[1]?.result ? "Frozen" : "Not frozen"}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={!valid || tx.pending} onClick={() => tx.send({ ...c, functionName: "setAllowed", args: [addr, true] })}>
          Allowlist
        </button>
        <button className="btn btn-secondary" disabled={!valid || tx.pending} onClick={() => tx.send({ ...c, functionName: "setAllowed", args: [addr, false] })}>
          Remove
        </button>
        <button className="btn btn-secondary" disabled={!valid || tx.pending} onClick={() => tx.send({ ...c, functionName: "setFrozen", args: [addr, true] })}>
          Freeze
        </button>
        <button className="btn btn-secondary" disabled={!valid || tx.pending} onClick={() => tx.send({ ...c, functionName: "setFrozen", args: [addr, false] })}>
          Unfreeze
        </button>
      </div>
      <Field label="Bulk allowlist" hint="Paste addresses separated by commas, spaces or new lines.">
        <textarea className="input mono" rows={3} value={bulk} onChange={(e) => setBulk(e.target.value)} />
      </Field>
      <button
        className="btn btn-secondary"
        disabled={!bulkValid || tx.pending}
        onClick={() => tx.send({ ...c, functionName: "batchSetAllowed", args: [bulkList, true] })}
      >
        Allowlist {bulkList.length || ""} addresses
      </button>
      <TxStatus {...tx} successText="Investor status updated." />
    </div>
  );
}

function SupplyTools({ token, decimals, onChange }: { token: Address; decimals: number; onChange: () => void }) {
  const c = { address: token, abi: rwaTokenAbi } as const;
  const [addr, setAddr] = useState("");
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fAmount, setFAmount] = useState("");
  const tx = useTx(onChange);
  const ftx = useTx(onChange);
  const ok = isAddress(addr) && !!amount;
  const amt = () => parseUnits(amount, decimals);

  return (
    <div className="card space-y-3">
      <h3>Supply</h3>
      <p className="muted">Mint to allowlisted investors on subscription. Burn from a holder on redemption.</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
        <Field label="Investor">
          <input className="input mono" value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="0x…" />
        </Field>
        <Field label="Amount">
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <button className="btn" disabled={!ok || tx.pending} onClick={() => tx.send({ ...c, functionName: "mint", args: [addr, amt()] })}>
          Mint
        </button>
        <button className="btn btn-secondary" disabled={!ok || tx.pending} onClick={() => tx.send({ ...c, functionName: "burn", args: [addr, amt()] })}>
          Burn
        </button>
      </div>
      <TxStatus {...tx} successText="Supply updated." />

      <h4 className="pt-3">Forced transfer</h4>
      <p className="muted">
        Moves tokens without the holder&apos;s signature, e.g. for lost keys or a court order. Works even if the wallet is
        frozen. The receiver must be allowlisted.
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
        <Field label="From">
          <input className="input mono" value={from} onChange={(e) => setFrom(e.target.value.trim())} placeholder="0x…" />
        </Field>
        <Field label="To">
          <input className="input mono" value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" />
        </Field>
        <Field label="Amount">
          <input className="input" inputMode="decimal" value={fAmount} onChange={(e) => setFAmount(e.target.value)} />
        </Field>
      </div>
      <button
        className="btn btn-danger"
        disabled={!isAddress(from) || !isAddress(to) || !fAmount || ftx.pending}
        onClick={() => ftx.send({ ...c, functionName: "forcedTransfer", args: [from, to, parseUnits(fAmount, decimals)] })}
      >
        Force transfer
      </button>
      <TxStatus {...ftx} successText="Tokens moved." />
    </div>
  );
}

function AssetTools({
  token,
  paused,
  currency,
  onChange,
}: {
  token: Address;
  paused?: boolean;
  currency?: string;
  onChange: () => void;
}) {
  const c = { address: token, abi: rwaTokenAbi } as const;
  const [valuation, setValuation] = useState("");
  const [cur, setCur] = useState(currency ?? "CHF");
  const pauseTx = useTx(onChange);
  const valTx = useTx(onChange);

  return (
    <div className="card space-y-3">
      <h3>Asset & transfers</h3>
      <div className="grid gap-2 sm:grid-cols-[1fr_90px_auto] sm:items-end">
        <Field label="New valuation">
          <input className="input" inputMode="decimal" value={valuation} onChange={(e) => setValuation(e.target.value)} />
        </Field>
        <Field label="Currency">
          <input className="input" maxLength={3} value={cur} onChange={(e) => setCur(e.target.value.toUpperCase())} />
        </Field>
        <button
          className="btn"
          disabled={!valuation || valTx.pending}
          onClick={() => valTx.send({ ...c, functionName: "updateValuation", args: [parseUnits(valuation, 2), cur] })}
        >
          Update valuation
        </button>
      </div>
      <TxStatus {...valTx} successText="Valuation updated." />

      <div className="flex items-center justify-between gap-2 pt-2">
        <p>
          Transfers are currently <strong>{paused ? "paused" : "active"}</strong>.
        </p>
        <button
          className={paused ? "btn" : "btn btn-danger"}
          disabled={pauseTx.pending}
          onClick={() => pauseTx.send({ ...c, functionName: paused ? "unpause" : "pause" })}
        >
          {paused ? "Resume transfers" : "Pause all transfers"}
        </button>
      </div>
      <TxStatus {...pauseTx} successText="Updated." />
    </div>
  );
}

function DocumentTools({
  token,
  docs,
  onChange,
}: {
  token: Address;
  docs: ReturnType<typeof useDocuments>["list"];
  onChange: () => void;
}) {
  const c = { address: token, abi: rwaTokenAbi } as const;
  const [name, setName] = useState("");
  const [uri, setUri] = useState("");
  const [hash, setHash] = useState<Hex>();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const tx = useTx(onChange);
  const nameOk = name.length > 0 && new TextEncoder().encode(name).length <= 32;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(undefined);
    const bytes = new Uint8Array(await file.arrayBuffer());
    setHash(keccak256(bytes));
    if (!name) setName(file.name.replace(/\.[^.]+$/, "").slice(0, 32));
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/ipfs", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setUri(json.uri);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card space-y-3">
      <h3>Documents</h3>
      <p className="muted">
        Choose a file to upload it to IPFS. Its keccak256 hash is computed in your browser and stored on-chain.
      </p>
      <input type="file" onChange={(e) => onFile(e.target.files?.[0])} />
      {uploading && <p className="muted">Uploading to IPFS…</p>}
      {uploadError && <p  style={{ color: "var(--alert)" }}>{uploadError}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Document name" hint="Max 32 characters, e.g. prospectus, land-registry, audit-2026.">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="URI">
          <input className="input mono" value={uri} onChange={(e) => setUri(e.target.value.trim())} placeholder="ipfs://…" />
        </Field>
      </div>
      {hash && <p className="muted mono text-[11px]">keccak256: {hash}</p>}
      <button
        className="btn"
        disabled={!nameOk || !uri || tx.pending || uploading}
        onClick={() =>
          tx.send({
            ...c,
            functionName: "setDocument",
            args: [stringToHex(name, { size: 32 }), uri, hash ?? ZERO_BYTES32],
          })
        }
      >
        Save document on-chain
      </button>
      {docs.length > 0 && (
        <ul className="space-y-1 pt-2">
          {docs.map((d) => (
            <li key={d.key} className="flex items-center justify-between gap-2">
              <span>{d.name}</span>
              <button
                className="btn btn-secondary"
                disabled={tx.pending}
                onClick={() => tx.send({ ...c, functionName: "removeDocument", args: [d.key] })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <TxStatus {...tx} successText="Documents updated." />
    </div>
  );
}

function RoleTools({ token }: { token: Address }) {
  const c = { address: token, abi: rwaTokenAbi } as const;
  const [addr, setAddr] = useState("");
  const tx = useTx();
  const valid = isAddress(addr);
  return (
    <div className="card space-y-3">
      <h3>Agents</h3>
      <p className="muted">
        Agents can manage investors, supply, documents and pausing. Only the token admin (you) can add or remove them.
      </p>
      <Field label="Agent wallet">
        <input className="input mono" value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="0x…" />
      </Field>
      <div className="flex gap-2">
        <button className="btn" disabled={!valid || tx.pending} onClick={() => tx.send({ ...c, functionName: "grantRole", args: [AGENT_ROLE, addr] })}>
          Add agent
        </button>
        <button className="btn btn-secondary" disabled={!valid || tx.pending} onClick={() => tx.send({ ...c, functionName: "revokeRole", args: [AGENT_ROLE, addr] })}>
          Remove agent
        </button>
      </div>
      <TxStatus {...tx} successText="Roles updated." />
    </div>
  );
}

// ---------------------------------------------------------------- page

export default function TokenPage() {
  const params = useParams<{ address: string }>();
  const raw = params.address;
  const { address: account } = useAccount();
  const valid = isAddress(raw);
  const token = raw as Address;

  const t = useTokenSummary(token);
  const docs = useDocuments(token);
  const { data: roles } = useReadContracts({
    contracts: account
      ? [
          { address: token, abi: rwaTokenAbi, functionName: "hasRole", args: [AGENT_ROLE, account] },
          { address: token, abi: rwaTokenAbi, functionName: "hasRole", args: [ADMIN_ROLE, account] },
        ]
      : [],
    query: { enabled: valid && !!account },
  });
  const isAgent = roles?.[0]?.result === true;
  const isAdmin = roles?.[1]?.result === true;

  if (!valid) return <Notice>Invalid token address.</Notice>;
  if (!t.isLoading && t.name === undefined) return <Notice>No RWA token found at this address on the current network.</Notice>;

  const refresh = () => {
    t.refetch();
  };

  return (
    <div className="space-y-16">
      <Overview token={token} t={t} />
      <div className="grid gap-x-12 gap-y-4 lg:grid-cols-2">
        <Documents docs={docs.list} />
        <MyPosition token={token} t={t} />
      </div>

      {isAgent && (
        <section>
          <h2 className="mb-6">manage token</h2>
          <div className="grid gap-x-12 gap-y-4 lg:grid-cols-2">
            <InvestorTools token={token} onChange={refresh} />
            <SupplyTools token={token} decimals={t.decimals} onChange={refresh} />
            <AssetTools token={token} paused={t.paused} currency={t.assetInfo?.valuationCurrency} onChange={refresh} />
            <DocumentTools token={token} docs={docs.list} onChange={docs.refetch} />
            {isAdmin && <RoleTools token={token} />}
          </div>
        </section>
      )}
    </div>
  );
}
