"use client";

import { useEffect, useState } from "react";
import { useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { formatEther, type Address } from "viem";
import { publicClient } from "@/lib/client";
import SendForm from "./SendForm";

function WalletDetails({ wallet }: { wallet: ConnectedWallet }) {
  const address = wallet.address as Address;
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let active = true;
    let inFlight = false;

    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      setLoading(true);
      setError("");
      try {
        const value = await publicClient.getBalance({ address });
        if (active) setBalance(value);
      } catch {
        if (active) setError("Não foi possível consultar o saldo na Sepolia. Tente atualizar novamente.");
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [address, refreshVersion]);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus("Endereço copiado!");
    } catch {
      setCopyStatus("Não foi possível copiar. Selecione o endereço abaixo e copie manualmente.");
    }
  }

  const exactBalance = balance === null ? null : formatEther(balance);
  const [whole, fraction] = (exactBalance ?? "").split(".");
  const displayBalance = exactBalance === null
    ? "—"
    : balance !== BigInt(0) && balance! < BigInt("1000000000000")
      ? "< 0,000001"
      : `${whole}${fraction ? `,${fraction.slice(0, 6).replace(/0+$/, "") || "0"}` : ""}`;

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-2xl bg-indigo-50 p-5">
        <p className="text-sm text-indigo-700">Saldo em Sepolia</p>
        <p title={exactBalance === null ? undefined : `${exactBalance} ETH`} className="mt-2 break-all text-3xl font-semibold tracking-tight text-indigo-950">
          {displayBalance} <span className="text-lg font-medium">ETH</span>
        </p>
        <button type="button" disabled={loading} onClick={() => setRefreshVersion((value) => value + 1)} className="mt-3 rounded-lg px-2 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50">
          {loading ? "Atualizando..." : "Atualizar saldo"}
        </button>
        <p className="mt-2 text-xs text-indigo-700">Atualização automática a cada 15 segundos.</p>
      </div>
      <SendForm wallet={wallet} onSent={() => setRefreshVersion((value) => value + 1)} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Endereço da carteira</h2>
          <button type="button" onClick={copyAddress} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-indigo-600">Copiar endereço</button>
        </div>
        <p className="mt-3 font-mono text-lg">{address.slice(0, 6)}...{address.slice(-4)}</p>
        <p className="mt-2 break-all font-mono text-xs leading-5 text-zinc-500">{address}</p>
        <p role="status" className="mt-2 text-sm text-zinc-600">{copyStatus}</p>
        <a href={`https://sepolia.etherscan.io/address/${address}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-indigo-700 underline underline-offset-4">Ver carteira no Etherscan ↗</a>
      </div>
    </div>
  );
}

export default function Wallet() {
  const { wallets, ready } = useWallets();
  const wallet = wallets.find((item) => item.walletClientType === "privy");

  if (!ready) return <p role="status" className="mt-6 text-zinc-600">Carregando carteira...</p>;
  if (!wallet) return <p role="status" className="mt-6 text-zinc-600">Aguardando a criação da sua carteira. Conclua a configuração no modal da Privy, se solicitado.</p>;

  return <WalletDetails key={wallet.address} wallet={wallet} />;
}

