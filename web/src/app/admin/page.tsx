"use client";

import { useState } from "react";
import { isAddress, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { rwaTokenFactoryAbi } from "@/abi/rwaTokenFactoryAbi";
import { FactoryGuard } from "@/components/FactoryGuard";
import { AddressLink, Field, Notice, TxStatus } from "@/components/ui";
import { useTx } from "@/lib/hooks";

function IssuerCheck({ factory, address }: { factory: Address; address: Address }) {
  const { data } = useReadContract({ address: factory, abi: rwaTokenFactoryAbi, functionName: "isIssuer", args: [address] });
  if (data === undefined) return null;
  return <span className="badge">{data ? "Approved issuer" : "Not an issuer"}</span>;
}

function AdminPanel({ factory }: { factory: Address }) {
  const { address } = useAccount();
  const { data: owner } = useReadContract({ address: factory, abi: rwaTokenFactoryAbi, functionName: "owner" });
  const { data: pendingOwner } = useReadContract({ address: factory, abi: rwaTokenFactoryAbi, functionName: "pendingOwner" });
  const { data: count } = useReadContract({ address: factory, abi: rwaTokenFactoryAbi, functionName: "tokenCount" });

  const [issuer, setIssuer] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const issuerTx = useTx();
  const ownerTx = useTx();
  const acceptTx = useTx();

  const isOwner = !!address && !!owner && address.toLowerCase() === owner.toLowerCase();
  const isPending = !!address && !!pendingOwner && address.toLowerCase() === pendingOwner.toLowerCase();
  const valid = isAddress(issuer);

  return (
    <div className="space-y-6">
      <div className="card space-y-2 text-sm">
        <div>
          <span className="muted">Factory: </span>
          <AddressLink address={factory} />
        </div>
        <div>
          <span className="muted">Owner: </span>
          {owner ? <AddressLink address={owner} /> : "…"}
        </div>
        <div>
          <span className="muted">Tokens created: </span>
          {count?.toString() ?? "…"}
        </div>
      </div>

      {isPending && (
        <div className="card">
          <p className="text-sm">You have been nominated as the new owner of this factory.</p>
          <button
            className="btn mt-3"
            disabled={acceptTx.pending}
            onClick={() => acceptTx.send({ address: factory, abi: rwaTokenFactoryAbi, functionName: "acceptOwnership" })}
          >
            Accept ownership
          </button>
          <TxStatus {...acceptTx} successText="You now own the factory." />
        </div>
      )}

      {!isOwner ? (
        <Notice>Connect the factory owner wallet to approve issuers.</Notice>
      ) : (
        <>
          <div className="card space-y-3">
            <h2 className="font-semibold">Approve or revoke an issuer</h2>
            <p className="muted text-sm">
              Approved issuers can create tokens. Revoking an issuer does not affect tokens they already created.
            </p>
            <Field label="Issuer wallet address">
              <input className="input mono" value={issuer} onChange={(e) => setIssuer(e.target.value.trim())} placeholder="0x…" />
            </Field>
            {valid && <IssuerCheck factory={factory} address={issuer as Address} />}
            <div className="flex gap-2">
              <button
                className="btn"
                disabled={!valid || issuerTx.pending}
                onClick={() =>
                  issuerTx.send({ address: factory, abi: rwaTokenFactoryAbi, functionName: "setIssuer", args: [issuer, true] })
                }
              >
                Approve
              </button>
              <button
                className="btn btn-secondary"
                disabled={!valid || issuerTx.pending}
                onClick={() =>
                  issuerTx.send({ address: factory, abi: rwaTokenFactoryAbi, functionName: "setIssuer", args: [issuer, false] })
                }
              >
                Revoke
              </button>
            </div>
            <TxStatus {...issuerTx} successText="Issuer updated." />
          </div>

          <div className="card space-y-3">
            <h2 className="font-semibold">Transfer factory ownership</h2>
            <p className="muted text-sm">
              Two-step transfer: the new owner must accept on this page. Use a Safe multisig on mainnet.
            </p>
            <Field label="New owner">
              <input className="input mono" value={newOwner} onChange={(e) => setNewOwner(e.target.value.trim())} placeholder="0x…" />
            </Field>
            <button
              className="btn btn-secondary"
              disabled={!isAddress(newOwner) || ownerTx.pending}
              onClick={() =>
                ownerTx.send({ address: factory, abi: rwaTokenFactoryAbi, functionName: "transferOwnership", args: [newOwner] })
              }
            >
              Nominate new owner
            </button>
            <TxStatus {...ownerTx} successText="Nomination sent. The new owner must accept." />
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Platform admin</h1>
      <FactoryGuard>{(factory) => <AdminPanel factory={factory} />}</FactoryGuard>
    </div>
  );
}
