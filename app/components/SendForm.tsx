"use client";

import { useRef, useState, type FormEvent } from "react";
import { useSendTransaction, type ConnectedWallet } from "@privy-io/react-auth";
import { formatEther, type Address, type Hash } from "viem";
import { sepolia } from "viem/chains";
import { publicClient } from "@/lib/client";
import { validateBalance, validateTransfer } from "@/lib/transfer";

type Phase = "edit" | "preparing" | "review" | "signing" | "confirming" | "pending" | "success" | "failed";
type Review = { to: Address; value: bigint; fee: bigint };
const primary = "w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-50";
const secondary = "rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50";

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha ao enviar. Tente novamente.";
  if (/reject|denied|cancel|recus/i.test(message)) return "Transação recusada ou cancelada. Nenhum novo envio foi confirmado.";
  if (/insufficient funds/i.test(message)) return "Saldo insuficiente para o valor e a taxa de rede.";
  if (/fetch|network|timeout|HTTP request/i.test(message)) return "Não foi possível consultar a rede Sepolia. Tente novamente.";
  return message.length > 240 ? "Não foi possível enviar a transação. Confira o saldo e tente novamente." : message;
}

export default function SendForm({ wallet, onSent }: { wallet: ConnectedWallet; onSent: () => void }) {
  const { sendTransaction } = useSendTransaction();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("edit");
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");
  const [hash, setHash] = useState<Hash | null>(null);
  const busy = useRef(false);
  const working = ["preparing", "signing", "confirming"].includes(phase);

  async function prepareTransfer(destination: string, quantity: string): Promise<Review> {
    const transfer = validateTransfer(destination, quantity, wallet.address);
    // Read the current balance; the displayed balance may be up to 15 seconds old.
    const balance = await publicClient.getBalance({ address: wallet.address as Address });
    validateBalance(transfer.value, balance, BigInt(0));
    const [gas, fees] = await Promise.all([
      publicClient.estimateGas({ account: wallet.address as Address, to: transfer.to, value: transfer.value }),
      publicClient.estimateFeesPerGas(),
    ]);
    const fee = gas * fees.maxFeePerGas * BigInt(120) / BigInt(100);
    validateBalance(transfer.value, balance, fee);
    return { ...transfer, fee };
  }

  async function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setError("");
    setPhase("preparing");
    try {
      setReview(await prepareTransfer(to, amount));
      setPhase("review");
    } catch (error) {
      setError(friendlyError(error));
      setPhase("edit");
    } finally {
      busy.current = false;
    }
  }

  async function waitForConfirmation(transactionHash: Hash) {
    setPhase("confirming");
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: transactionHash,
        timeout: 120_000,
        onReplaced: ({ transactionReceipt }) => setHash(transactionReceipt.transactionHash),
      });
      setHash(receipt.transactionHash);
      onSent();
      // A cancelled replacement can have a successful receipt without sending the requested ETH.
      const transaction = await publicClient.getTransaction({ hash: receipt.transactionHash });
      if (receipt.status !== "success" || !review || transaction.to?.toLowerCase() !== review.to.toLowerCase() || transaction.value !== review.value) {
        setError("A transferência não foi concluída: ela foi revertida, cancelada ou substituída. Confira os detalhes no Etherscan.");
        setPhase("failed");
        return;
      }
      setPhase("success");
      setTo("");
      setAmount("");
    } catch {
      setPhase("pending");
      setError("A transação já foi transmitida, mas ainda não conseguimos verificar sua confirmação. Consulte o Etherscan ou verifique novamente antes de fazer outro envio.");
    }
  }

  async function handleConfirm() {
    if (!review || busy.current) return;
    busy.current = true;
    setError("");
    setPhase("signing");
    let submitted = false;
    try {
      if (wallet.chainId !== `eip155:${sepolia.id}`) await wallet.switchChain(sepolia.id);
      const provider = await wallet.getEthereumProvider();
      const chainId = await provider.request({ method: "eth_chainId" });
      if (Number(chainId) !== sepolia.id) throw new Error("Selecione a rede Sepolia para enviar.");
      const updated = await prepareTransfer(review.to, formatEther(review.value));
      if (updated.fee > review.fee) {
        setReview(updated);
        setPhase("review");
        setError("A estimativa da taxa aumentou. Confira o novo valor e confirme novamente.");
        return;
      }
      const result = await sendTransaction(
        { to: review.to, value: review.value, chainId: sepolia.id },
        { address: wallet.address },
      );
      submitted = true;
      setHash(result.hash);
      await waitForConfirmation(result.hash);
    } catch (error) {
      setError(submitted ? "Transação transmitida. Verifique a confirmação no Etherscan antes de enviar novamente." : friendlyError(error));
      setPhase(submitted ? "pending" : "review");
    } finally {
      busy.current = false;
    }
  }

  async function checkConfirmation() {
    if (!hash || busy.current) return;
    busy.current = true;
    setError("");
    try { await waitForConfirmation(hash); }
    finally { busy.current = false; }
  }

  function reset() {
    setPhase("edit");
    setReview(null);
    setHash(null);
    setError("");
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className={primary}>Enviar ETH</button>;

  return (
    <section className="space-y-4 border-t border-zinc-200 pt-5" aria-labelledby="send-heading">
      <h2 id="send-heading" className="text-lg font-semibold">Enviar ETH</h2>
      {(phase === "edit" || phase === "preparing") && (
        <form onSubmit={handleReview} className="space-y-4">
          <div>
            <label htmlFor="recipient" className="text-sm font-medium">Endereço de destino</label>
            <input id="recipient" value={to} onChange={(event) => setTo(event.target.value)} placeholder="0x..." autoComplete="off" spellCheck={false} disabled={working} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm focus:outline-indigo-600" />
          </div>
          <div>
            <label htmlFor="amount" className="text-sm font-medium">Quantidade em ETH</label>
            <input id="amount" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,001" inputMode="decimal" autoComplete="off" disabled={working} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm focus:outline-indigo-600" />
          </div>
          <p className="text-xs leading-5 text-zinc-500">Reserve parte do saldo para a taxa de rede. Apenas ETH de teste na Sepolia.</p>
          <button type="submit" disabled={working} className={primary}>{phase === "preparing" ? "Calculando taxa..." : "Revisar envio"}</button>
          <button type="button" disabled={working} onClick={() => { reset(); setOpen(false); }} className={secondary}>Cancelar</button>
        </form>
      )}
      {review && ["review", "signing", "confirming", "pending"].includes(phase) && (
        <div className="space-y-4">
          <dl className="space-y-3 rounded-xl bg-zinc-50 p-4 text-sm">
            <div><dt className="text-zinc-500">Destino</dt><dd className="mt-1 break-all font-mono">{review.to.slice(0, 6)}...{review.to.slice(-4)}<span className="mt-1 block text-xs">{review.to}</span></dd></div>
            <div><dt className="text-zinc-500">Valor</dt><dd className="break-all font-semibold">{formatEther(review.value)} ETH</dd></div>
            <div><dt className="text-zinc-500">Reserva estimada para gas</dt><dd className="break-all">{formatEther(review.fee)} ETH</dd></div>
            <div><dt className="text-zinc-500">Rede</dt><dd>Sepolia</dd></div>
          </dl>
          <p className="text-xs leading-5 text-zinc-500">Confira o destino. Transações não têm estorno. A taxa final será apresentada pela Privy e pode variar.</p>
          {phase === "review" && <><button type="button" onClick={handleConfirm} className={primary}>Confirmar envio</button><button type="button" onClick={() => { setError(""); setPhase("edit"); }} className={secondary}>Voltar e editar</button></>}
          {phase === "signing" && <p role="status" className="text-sm text-indigo-700">Preparando envio. Confirme a transação no modal da Privy.</p>}
          {phase === "confirming" && <p role="status" className="text-sm text-indigo-700">Transação enviada. Aguardando confirmação na Sepolia...</p>}
          {phase === "pending" && <button type="button" onClick={checkConfirmation} className={secondary}>Verificar confirmação</button>}
        </div>
      )}
      {phase === "success" && <p role="status" className="text-sm font-medium text-green-700">Transferência confirmada! Atualizando seu saldo.</p>}
      {error && <p role="alert" className="text-sm leading-6 text-red-700">{error}</p>}
      {hash && <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-indigo-700 underline underline-offset-4">Ver transação no Etherscan ↗</a>}
      {(phase === "success" || phase === "failed") && <button type="button" onClick={reset} className={primary}>Novo envio</button>}
    </section>
  );
}
