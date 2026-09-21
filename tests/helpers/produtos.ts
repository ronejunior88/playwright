import { expect, type APIRequestContext } from '@playwright/test';
import { criarUsuarioTeste, type UsuarioCriado } from './usuarios';

export interface DadosProduto {
  nome: string;
  preco: number;
  descricao: string;
  quantidade: number;
}

export interface ProdutoApi extends DadosProduto {
  _id: string;
}

export interface ProdutoCriado extends DadosProduto {
  id: string;
}

export interface ListaProdutos {
  quantidade: number;
  produtos: ProdutoApi[];
}

export interface MensagemResposta {
  message?: string;
  _id?: string;
}

export interface ErroValidacaoProduto {
  nome?: string;
  preco?: string;
  descricao?: string;
  quantidade?: string;
  id?: string;
  message?: string;
}

export interface CasoPayloadInvalido {
  rotulo: string;
  montar: () => Record<string, unknown>;
  corpoEsperado: Record<string, string>;
}

function gerarSufixo(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function gerarNomeProdutoUnico(prefixo: string): string {
  return `${prefixo} ${gerarSufixo()}`;
}

export function gerarPrecoUnico(): number {
  return Math.floor(Math.random() * 100000) + 1;
}

export function gerarQuantidadeUnica(): number {
  return Math.floor(Math.random() * 100);
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

export const MENSAGEM_TOKEN_INVALIDO =
  'Token de acesso ausente, inválido, expirado ou usuário do token não existe mais';

export const MENSAGEM_ROTA_ADMIN =
  'Rota exclusiva para administradores';

export const CASOS_PAYLOAD_INVALIDO: CasoPayloadInvalido[] = [
  {
    rotulo: 'payload vazio',
    montar: () => ({}),
    corpoEsperado: {
      nome: 'nome é obrigatório',
      preco: 'preco é obrigatório',
      descricao: 'descricao é obrigatório',
      quantidade: 'quantidade é obrigatório',
    },
  },
  {
    rotulo: 'nome ausente',
    montar: () => ({
      preco: 250,
      descricao: 'Descrição sem nome',
      quantidade: 2,
    }),
    corpoEsperado: { nome: 'nome é obrigatório' },
  },
  {
    rotulo: 'preco ausente',
    montar: () => ({
      nome: gerarNomeProdutoUnico('Produto Sem Preço'),
      descricao: 'Descrição sem preço',
      quantidade: 2,
    }),
    corpoEsperado: { preco: 'preco é obrigatório' },
  },
  {
    rotulo: 'descricao ausente',
    montar: () => ({
      nome: gerarNomeProdutoUnico('Produto Sem Descrição'),
      preco: 250,
      quantidade: 2,
    }),
    corpoEsperado: { descricao: 'descricao é obrigatório' },
  },
  {
    rotulo: 'quantidade ausente',
    montar: () => ({
      nome: gerarNomeProdutoUnico('Produto Sem Quantidade'),
      preco: 250,
      descricao: 'Descrição sem quantidade',
    }),
    corpoEsperado: { quantidade: 'quantidade é obrigatório' },
  },
  {
    rotulo: 'nome vazio',
    montar: () => ({
      nome: '',
      preco: 250,
      descricao: 'Descrição com nome vazio',
      quantidade: 2,
    }),
    corpoEsperado: { nome: 'nome não pode ficar em branco' },
  },
  {
    rotulo: 'descricao vazia',
    montar: () => ({
      nome: gerarNomeProdutoUnico('Produto Descrição Vazia'),
      preco: 250,
      descricao: '',
      quantidade: 2,
    }),
    corpoEsperado: { descricao: 'descricao não pode ficar em branco' },
  },
  {
    rotulo: 'preco negativo',
    montar: () => ({
      nome: gerarNomeProdutoUnico('Produto Preço Negativo'),
      preco: -1,
      descricao: 'Descrição preço negativo',
      quantidade: 2,
    }),
    corpoEsperado: { preco: 'preco deve ser um número positivo' },
  },
  {
    rotulo: 'preco zero',
    montar: () => ({
      nome: gerarNomeProdutoUnico('Produto Preço Zero'),
      preco: 0,
      descricao: 'Descrição preço zero',
      quantidade: 2,
    }),
    corpoEsperado: { preco: 'preco deve ser um número positivo' },
  },
  {
    rotulo: 'preco não numérico',
    montar: () => ({
      nome: gerarNomeProdutoUnico('Produto Preço Texto'),
      preco: 'abc',
      descricao: 'Descrição preço texto',
      quantidade: 2,
    }),
    corpoEsperado: { preco: 'preco deve ser um número' },
  },
  {
    rotulo: 'quantidade negativa',
    montar: () => ({
      nome: gerarNomeProdutoUnico('Produto Quantidade Negativa'),
      preco: 250,
      descricao: 'Descrição quantidade negativa',
      quantidade: -1,
    }),
    corpoEsperado: { quantidade: 'quantidade deve ser maior ou igual a 0' },
  },
  {
    rotulo: 'quantidade não numérica',
    montar: () => ({
      nome: gerarNomeProdutoUnico('Produto Quantidade Texto'),
      preco: 250,
      descricao: 'Descrição quantidade texto',
      quantidade: 'abc',
    }),
    corpoEsperado: { quantidade: 'quantidade deve ser um número' },
  },
  {
    rotulo: 'quantidade decimal',
    montar: () => ({
      nome: gerarNomeProdutoUnico('Produto Quantidade Decimal'),
      preco: 250,
      descricao: 'Descrição quantidade decimal',
      quantidade: 2.5,
    }),
    corpoEsperado: { quantidade: 'quantidade deve ser um inteiro' },
  },
];

export async function criarUsuarioProdutoTeste(
  request: APIRequestContext,
  tipoAdministrador: 'true' | 'false',
): Promise<UsuarioCriado> {
  return criarUsuarioTeste(request, { administrador: tipoAdministrador });
}

export async function criarProdutoTeste(
  request: APIRequestContext,
  token: string,
  dados: Partial<DadosProduto> = {},
): Promise<ProdutoCriado> {
  const payload: DadosProduto = {
    nome: dados.nome ?? gerarNomeProdutoUnico('Produto Playwright QA'),
    preco: dados.preco ?? gerarPrecoUnico(),
    descricao:
      dados.descricao ??
      `Produto criado pelo teste automatizado em ${gerarSufixo()}`,
    quantidade: dados.quantidade ?? gerarQuantidadeUnica(),
  };

  const response = await request.post('/produtos', {
    data: payload,
    headers: { Authorization: bearer(token) },
  });

  expect(response.status()).toBe(201);
  expect(response.headers()['content-type'] ?? '').toContain('application/json');

  const body = (await response.json()) as MensagemResposta;
  expect(body.message).toBe('Cadastro realizado com sucesso');
  expect(body._id, 'criação de produto deve retornar um _id').toBeTruthy();

  return { id: body._id!, ...payload };
}

export async function excluirProduto(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  try {
    const response = await request.delete(`/produtos/${id}`, {
      headers: { Authorization: bearer(token) },
    });
    if (response.status() !== 200) {
      console.warn(
        `Cleanup do produto de teste ${id} falhou (status ${response.status()}).`,
      );
    }
  } catch {
    console.warn(`Cleanup do produto de teste ${id} falhou.`);
  }
}