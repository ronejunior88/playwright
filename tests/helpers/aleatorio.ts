import { randomBytes } from 'node:crypto';

export interface OpcoesGeradorSufixos {
  agora?: number;
  semente?: string;
}

export type GeradorSufixos = () => string;

function sementeInicial(semente: string): string {
  return Buffer.from(semente, 'utf8').toString('hex');
}

function sufixoAleatorio(): string {
  return randomBytes(4).toString('hex');
}

export function gerarTextoHexadecimal(tamanhoEmBytes: number): string {
  return randomBytes(tamanhoEmBytes).toString('hex');
}

export function criarGeradorSufixos(
  opcoes: OpcoesGeradorSufixos = {},
): GeradorSufixos {
  const agora = opcoes.agora ?? (opcoes.semente ? 0 : Date.now());
  const semente = opcoes.semente
    ? sementeInicial(opcoes.semente)
    : sufixoAleatorio();
  let contador = 0;

  return () => {
    contador += 1;
    return `${agora.toString(36)}-${contador.toString(36)}-${semente}`;
  };
}

const gerarSufixoPadrao = criarGeradorSufixos();

export function gerarSufixo(): string {
  return gerarSufixoPadrao();
}
