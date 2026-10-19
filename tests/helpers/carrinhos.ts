import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { fazerLogin } from './autenticacao';
import {
  bearer,
  criarUsuarioProdutoTeste,
  MENSAGEM_TOKEN_INVALIDO,
  type ProdutoApi,
} from './produtos';
import { type UsuarioCriado } from './usuarios';

export interface ItemCarrinho {
  idProduto: string;
  quantidade: number;
}

export interface ItemCarrinhoApi extends ItemCarrinho {
  precoUnitario: number;
}

export interface CarrinhoApi {
  _id: string;
  idUsuario: string;
  precoTotal: number;
  quantidadeTotal: number;
  produtos: ItemCarrinhoApi[];
}

export interface ListaCarrinhos {
  quantidade: number;
  carrinhos: CarrinhoApi[];
}

export interface MensagemCarrinho {
  message?: string;
  _id?: string;
}

export interface ItemErroCarrinho {
  idProduto?: string;
  quantidade?: number;
  quantidadeEstoque?: number;
  index?: number;
}

export interface ErroCarrinho {
  message?: string;
  id?: string;
  produtos?: string;
  item?: ItemErroCarrinho;
  idProdutosDuplicados?: string[];
  [chave: string]: unknown;
}

export interface CasoPayloadCarrinhoInvalido {
  rotulo: string;
  montar: () => Record<string, unknown>;
  corpoEsperado: Record<string, string>;
}

export interface UsuarioAutenticado {
  usuario: UsuarioCriado;
  token: string;
}

export const MENSAGEM_TOKEN_CARRINHO = MENSAGEM_TOKEN_INVALIDO;
export const MENSAGEM_CARRINHO_NAO_ENCONTRADO = 'Carrinho não encontrado';
export const MENSAGEM_ID_INVALIDO_CARRINHO =
  'id deve ter exatamente 16 caracteres alfanuméricos';
export const MENSAGEM_SEGUNDO_CARRINHO = 'Não é permitido ter mais de 1 carrinho';
export const MENSAGEM_PRODUTO_DUPLICADO =
  'Não é permitido possuir produto duplicado';
export const MENSAGEM_PRODUTO_INEXISTENTE = 'Produto não encontrado';
export const MENSAGEM_ESTOQUE_INSUFICIENTE =
  'Produto não possui quantidade suficiente';
export const MENSAGEM_CONCLUSAO_SUCESSO = 'Registro excluído com sucesso';
export const MENSAGEM_CANCELAMENTO_SUCESSO =
  'Registro excluído com sucesso. Estoque dos produtos reabastecido';
export const MENSAGEM_USUARIO_SEM_CARRINHO =
  'Não foi encontrado carrinho para esse usuário';

export const CASOS_PAYLOAD_CARRINHO_INVALIDO: CasoPayloadCarrinhoInvalido[] = [
  {
    rotulo: 'corpo vazio',
    montar: () => ({}),
    corpoEsperado: { produtos: 'produtos é obrigatório' },
  },
  {
    rotulo: 'campo produtos ausente',
    montar: () => ({ outroCampo: 'valor' }),
    corpoEsperado: { produtos: 'produtos é obrigatório' },
  },
  {
    rotulo: 'lista de produtos vazia',
    montar: () => ({ produtos: [] }),
    corpoEsperado: { produtos: 'produtos não contém 1 valor obrigatório' },
  },
  {
    rotulo: 'item sem idProduto',
    montar: () => ({ produtos: [{ quantidade: 1 }] }),
    corpoEsperado: {
      'produtos[0].idProduto': 'produtos[0].idProduto é obrigatório',
    },
  },
  {
    rotulo: 'item sem quantidade',
    montar: () => ({ produtos: [{ idProduto: 'aaaaaaaaaaaaaaaa' }] }),
    corpoEsperado: {
      'produtos[0].quantidade': 'produtos[0].quantidade é obrigatório',
    },
  },
  {
    rotulo: 'idProduto com formato inválido',
    montar: () => ({ produtos: [{ idProduto: 'curto', quantidade: 1 }] }),
    corpoEsperado: { message: MENSAGEM_PRODUTO_INEXISTENTE },
  },
  {
    rotulo: 'quantidade igual a zero',
    montar: () => ({
      produtos: [{ idProduto: 'aaaaaaaaaaaaaaaa', quantidade: 0 }],
    }),
    corpoEsperado: {
      'produtos[0].quantidade': 'produtos[0].quantidade deve ser um número positivo',
    },
  },
  {
    rotulo: 'quantidade negativa',
    montar: () => ({
      produtos: [{ idProduto: 'aaaaaaaaaaaaaaaa', quantidade: -1 }],
    }),
    corpoEsperado: {
      'produtos[0].quantidade': 'produtos[0].quantidade deve ser um número positivo',
    },
  },
  {
    rotulo: 'quantidade com tipo inválido',
    montar: () => ({
      produtos: [{ idProduto: 'aaaaaaaaaaaaaaaa', quantidade: 'dois' }],
    }),
    corpoEsperado: {
      'produtos[0].quantidade': 'produtos[0].quantidade deve ser um número',
    },
  },
  {
    rotulo: 'item com estrutura inválida',
    montar: () => ({ produtos: ['string-invalida'] }),
    corpoEsperado: { 'produtos[0]': 'produtos[0] deve ser um objeto' },
  },
];

export async function criarUsuarioAutenticado(
  request: APIRequestContext,
  administrador: 'true' | 'false' = 'false',
): Promise<UsuarioAutenticado> {
  const usuario = await criarUsuarioProdutoTeste(request, administrador);
  const token = await fazerLogin(request, usuario.email, usuario.password);
  return { usuario, token };
}

export async function criarCarrinhoTeste(
  request: APIRequestContext,
  token: string,
  itens: ItemCarrinho[],
): Promise<string> {
  const response = await request.post('/carrinhos', {
    data: { produtos: itens },
    headers: { Authorization: bearer(token) },
  });

  expect(response.status()).toBe(201);
  expect(response.headers()['content-type'] ?? '').toContain('application/json');

  const body = (await response.json()) as MensagemCarrinho;
  expect(body.message).toBe('Cadastro realizado com sucesso');
  expect(body._id, 'criação de carrinho deve retornar um _id').toBeTruthy();

  return body._id!;
}

export async function obterProduto(
  request: APIRequestContext,
  idProduto: string,
): Promise<ProdutoApi> {
  const response = await request.get(`/produtos/${idProduto}`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type'] ?? '').toContain('application/json');
  return (await response.json()) as ProdutoApi;
}

export async function obterEstoque(
  request: APIRequestContext,
  idProduto: string,
): Promise<number> {
  const produto = await obterProduto(request, idProduto);
  return produto.quantidade;
}

export async function obterCarrinho(
  request: APIRequestContext,
  idCarrinho: string,
): Promise<CarrinhoApi> {
  const response = await request.get(`/carrinhos/${idCarrinho}`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type'] ?? '').toContain('application/json');
  return (await response.json()) as CarrinhoApi;
}

export async function listarCarrinhos(
  request: APIRequestContext,
  params: Record<string, string> = {},
): Promise<ListaCarrinhos> {
  const response = await request.get('/carrinhos', { params });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type'] ?? '').toContain('application/json');
  return (await response.json()) as ListaCarrinhos;
}

export async function concluirCompra(
  request: APIRequestContext,
  token: string,
): Promise<APIResponse> {
  return request.delete('/carrinhos/concluir-compra', {
    headers: { Authorization: bearer(token) },
  });
}

export async function cancelarCompra(
  request: APIRequestContext,
  token: string,
): Promise<APIResponse> {
  return request.delete('/carrinhos/cancelar-compra', {
    headers: { Authorization: bearer(token) },
  });
}

export async function cancelarCompraSeguro(
  request: APIRequestContext,
  token: string,
): Promise<void> {
  try {
    const response = await request.delete('/carrinhos/cancelar-compra', {
      headers: { Authorization: bearer(token) },
    });
    if (response.status() !== 200) {
      console.warn(
        `Cleanup do carrinho falhou ao cancelar a compra (status ${response.status()}).`,
      );
    }
  } catch {
    console.warn('Cleanup do carrinho falhou ao cancelar a compra.');
  }
}
