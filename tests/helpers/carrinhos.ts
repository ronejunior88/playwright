import {
  expect,
  type APIRequestContext,
  type APIResponse,
} from '@playwright/test';
import { bearer, fazerLogin, MENSAGEM_TOKEN_INVALIDO } from './autenticacao';
import { executarLimpeza } from './limpeza';
import {
  criarUsuarioProdutoTeste,
  MENSAGEM_PRODUTO_NAO_ENCONTRADO,
  type ProdutoApi,
} from './produtos';
import {
  lerJson,
  MENSAGEM_CADASTRO_SUCESSO,
  type MensagemResposta,
} from './resposta';
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
export const MENSAGEM_SEGUNDO_CARRINHO = 'Não é permitido ter mais de 1 carrinho';
export const MENSAGEM_PRODUTO_DUPLICADO =
  'Não é permitido possuir produto duplicado';
export const MENSAGEM_ESTOQUE_INSUFICIENTE =
  'Produto não possui quantidade suficiente';
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
    corpoEsperado: { message: MENSAGEM_PRODUTO_NAO_ENCONTRADO },
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

  const body = await lerJson<MensagemResposta>(response, 201, 'criação de carrinho');
  expect(body.message).toBe(MENSAGEM_CADASTRO_SUCESSO);
  expect(body._id, 'criação de carrinho deve retornar um _id').toBeTruthy();

  return body._id!;
}

export async function obterProduto(
  request: APIRequestContext,
  idProduto: string,
): Promise<ProdutoApi> {
  const response = await request.get(`/produtos/${idProduto}`);
  return lerJson<ProdutoApi>(response, 200, 'consulta de produto');
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
  return lerJson<CarrinhoApi>(response, 200, 'consulta de carrinho');
}

export async function listarCarrinhos(
  request: APIRequestContext,
  params: Record<string, string> = {},
): Promise<ListaCarrinhos> {
  const response = await request.get('/carrinhos', { params });
  return lerJson<ListaCarrinhos>(response, 200, 'listagem de carrinhos');
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
  await executarLimpeza('do carrinho ao cancelar a compra', () =>
    request.delete('/carrinhos/cancelar-compra', {
      headers: { Authorization: bearer(token) },
    }),
  );
}
