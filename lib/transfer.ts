import { getAddress, isAddress, parseEther, zeroAddress, type Address } from "viem";

export function validateTransfer(to: string, amount: string, from: string) {
  const destination = to.trim();
  if (!isAddress(destination)) throw new Error("Endereço inválido. Confira o formato e o checksum.");
  const address = getAddress(destination);
  if (address === zeroAddress) throw new Error("Não é permitido enviar para o endereço zero.");
  if (address.toLowerCase() === from.toLowerCase()) throw new Error("Você não pode enviar para sua própria carteira.");
  const normalized = amount.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,18})?$/.test(normalized)) {
    throw new Error("Informe um valor maior que zero, com até 18 casas decimais.");
  }
  const value = parseEther(normalized);
  if (value <= BigInt(0)) throw new Error("Informe um valor maior que zero.");
  return { to: address as Address, value };
}

export function validateBalance(value: bigint, balance: bigint, fee: bigint) {
  if (value > balance) throw new Error("Saldo insuficiente para esse valor.");
  if (value + fee > balance) throw new Error("Saldo insuficiente para o valor e a taxa de rede (gas). Envie um valor menor.");
}
