"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Wallet from "./components/Wallet";

export default function Home() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setError("");
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setError("Não foi possível sair. Tente novamente.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans text-zinc-900">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-5 py-5 sm:px-8">
        <span className="font-semibold">Minha Carteira</span>
        {ready && authenticated && (
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-50"
          >
            {loggingOut ? "Saindo..." : "Sair"}
          </button>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center p-5 sm:p-8">
        <section className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Sepolia · Rede de teste
          </span>

          {!ready ? (
            <p role="status" className="mt-6 text-zinc-600">
              Carregando autenticação...
            </p>
          ) : authenticated ? (
            <>
              <h1 className="mt-6 text-2xl font-semibold tracking-tight">Minha carteira</h1>
              <p className="mt-3 break-all text-zinc-600">
                {user?.email?.address ?? "Login realizado com sucesso."}
              </p>
              <Wallet key={user?.id} />
              <p className="mt-5 text-sm leading-6 text-zinc-500">
                Use Sair no cabeçalho para entrar com outra conta.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight">Sua carteira Web3</h1>
              <p className="mt-3 leading-7 text-zinc-600">
                Entre com seu e-mail para acessar sua carteira Ethereum na rede de teste Sepolia.
              </p>
              <button
                type="button"
                onClick={() => login()}
                className="mt-7 w-full rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
              >
                Entrar com e-mail
              </button>
            </>
          )}

          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
          <p className="mt-7 border-t border-zinc-100 pt-4 text-xs leading-5 text-zinc-500">
            O ETH da Sepolia é usado apenas para testes e não tem valor real.
          </p>
        </section>
      </main>
    </div>
  );
}

