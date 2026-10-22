import {
  array,
  criarDivergencia,
  mapaDeTextos,
  numero,
  objeto,
  texto,
  type Divergencia,
  type Schema,
} from './schema';

/**
 * Contratos registrados da API ServeRest (versão 1).
 *
 * Este arquivo é a **fonte da verdade estrutural** da suíte: descreve o que a
 * API deve responder em cada endpoint e cenário de erro, com a origem de cada
 * informação (documentação publicada, observação em execução ou ambas).
 *
 * Regras aplicadas ao escrever os schemas:
 * - nenhum campo dinâmico é exigido por valor (nomes, e-mails e descrições
 *   são apenas "texto");
 * - identificadores seguem o formato aceito pela própria API (16 caracteres
 *   alfanuméricos);
 * - campos cuja ausência quebraria operações posteriores (token, `_id`,
 *   quantidade) são obrigatórios;
 * - o texto das mensagens não é fixado aqui: a grafia exata é verificada pelos
 *   testes funcionais, e o contrato garante apenas a **forma** do campo
 *   (`message` presente e não vazio), evitando duplicar asserções frágeis;
 * - campos adicionais são aceitos e reportados como **compatíveis**.
 */

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** Regra de autenticação/autorização aplicável ao endpoint. */
export type ExigenciaAuth = 'nenhuma' | 'token' | 'administrador';

/** Origem das informações do contrato. */
export type FonteContrato =
  | 'documentacao'
  | 'observado'
  | 'documentacao+observado';

/** Situação da confirmação do contrato (§11 do roteiro). */
export type SituacaoContrato =
  | 'confirmado'
  | 'parcialmente-validado'
  | 'pendente-de-confirmacao'
  | 'divergente';

export interface Contrato {
  id: string;
  metodo: MetodoHttp;
  endpoint: string;
  status: number;
  contentType: string;
  autenticacao: ExigenciaAuth;
  fonte: FonteContrato;
  situacao: SituacaoContrato;
  corpo: Schema;
  /** Exemplo sintético (sem dado real) usado pelos testes locais. */
  exemploValido: unknown;
  /** Arquivos de teste que confirmam o contrato por execução. */
  confirmadoPor: string[];
  /** Invariantes semânticas verificadas junto com o schema. */
  invariantes?: Array<(corpo: unknown) => Divergencia[]>;
  observacoes?: string;
}

const IDENTIFICADOR = texto({ padrao: /^[a-zA-Z0-9]{16}$/ });
const MENSAGEM = texto({ min: 1 });

export const usuarioSchema: Schema = objeto({
  _id: IDENTIFICADOR,
  nome: texto({ min: 1 }),
  email: texto({ min: 3 }),
  password: texto({ min: 1 }),
  administrador: texto({ valores: ['true', 'false'] }),
});

export const produtoSchema: Schema = objeto({
  _id: IDENTIFICADOR,
  nome: texto({ min: 1 }),
  descricao: texto({ min: 1 }),
  preco: numero({ exclusivoMin: 0 }),
  quantidade: numero({ inteiro: true, min: 0 }),
});

export const itemCarrinhoSchema: Schema = objeto({
  idProduto: IDENTIFICADOR,
  quantidade: numero({ inteiro: true, min: 1 }),
  precoUnitario: numero({ exclusivoMin: 0 }),
});

export const carrinhoSchema: Schema = objeto({
  _id: IDENTIFICADOR,
  idUsuario: IDENTIFICADOR,
  produtos: array(itemCarrinhoSchema, { minItens: 1 }),
  precoTotal: numero({ min: 0 }),
  quantidadeTotal: numero({ inteiro: true, min: 0 }),
});

export const criacaoSchema: Schema = objeto({
  message: MENSAGEM,
  _id: IDENTIFICADOR,
});

export const mensagemSchema: Schema = objeto({
  message: MENSAGEM,
});

/**
 * Formato de erro por campo: `{ "nome": "nome é obrigatório" }`.
 *
 * Não pode conter a chave `message`: nesse formato a API sempre descreve o
 * campo problemático (`nome`, `email`, `preco`, `_id`...). A chave `_id` pode
 * aparecer **como nome do campo** (quando `_id` é enviado na requisição), e
 * nesse caso continua sendo um erro por campo.
 */
export const erroPorCampoSchema: Schema = mapaDeTextos({
  minChaves: 1,
  proibidas: ['message'],
});

export const loginSucessoSchema: Schema = objeto({
  message: MENSAGEM,
  authorization: texto({ padrao: /^Bearer [^.\s]+\.[^.\s]+\.[^.\s]+$/ }),
});

const EXEMPLO_ID = 'a1b2c3d4e5f6g7h8';

const EXEMPLO_USUARIO = {
  _id: EXEMPLO_ID,
  nome: 'Usuário de Exemplo',
  email: 'exemplo@example.com',
  password: 'senha-ficticia',
  administrador: 'false',
};

const EXEMPLO_PRODUTO = {
  _id: EXEMPLO_ID,
  nome: 'Produto de Exemplo',
  descricao: 'Produto sintético',
  preco: 100,
  quantidade: 5,
};

const EXEMPLO_CARRINHO = {
  _id: EXEMPLO_ID,
  idUsuario: 'h8g7f6e5d4c3b2a1',
  produtos: [
    { idProduto: EXEMPLO_ID, quantidade: 2, precoUnitario: 50 },
  ],
  precoTotal: 100,
  quantidadeTotal: 2,
};

/**
 * Invariante: `quantidade` deve refletir o tamanho da lista devolvida.
 * Serve para detectar mudança de estrutura (por exemplo, a API passar a
 * devolver um objeto no lugar do array).
 */
function quantidadeCoerenteComLista(chaveLista: string) {
  return (corpo: unknown): Divergencia[] => {
    if (typeof corpo !== 'object' || corpo === null) {
      return [];
    }
    const registro = corpo as Record<string, unknown>;
    const lista = registro[chaveLista];
    if (!Array.isArray(lista) || typeof registro.quantidade !== 'number') {
      return [];
    }
    if (registro.quantidade !== lista.length) {
      return [
        criarDivergencia(
          'quantidade',
          `igual ao tamanho de ${chaveLista}`,
          registro.quantidade,
          'valor-incompativel',
        ),
      ];
    }
    return [];
  };
}

export const CONTRATOS: Contrato[] = [
  // ---------------------------------------------------------------- login
  {
    id: 'login.sucesso',
    metodo: 'POST',
    endpoint: '/login',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: loginSucessoSchema,
    exemploValido: {
      message: 'Login realizado com sucesso',
      authorization:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJleGFtcGxvIn0.assinatura-ficticia',
    },
    confirmadoPor: [
      'tests/auth/login.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
    observacoes:
      'O campo `authorization` traz o token com o prefixo `Bearer ` e três ' +
      'segmentos separados por ponto; é o campo exigido para as rotas ' +
      'protegidas. A grafia da mensagem é verificada no teste funcional.',
  },
  {
    id: 'login.credenciais-invalidas',
    metodo: 'POST',
    endpoint: '/login',
    status: 401,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: mensagemSchema,
    exemploValido: { message: 'Email e/ou senha inválidos' },
    confirmadoPor: [
      'tests/auth/login.spec.ts',
      'tests/seguranca/exposicao-erros.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },
  {
    id: 'login.payload-invalido',
    metodo: 'POST',
    endpoint: '/login',
    status: 400,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: erroPorCampoSchema,
    exemploValido: { email: 'email é obrigatório' },
    confirmadoPor: ['tests/auth/login.spec.ts', 'tests/contratos/contratos-api.spec.ts'],
  },

  // ------------------------------------------------------------- usuários
  {
    id: 'usuarios.lista',
    metodo: 'GET',
    endpoint: '/usuarios',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: objeto({
      quantidade: numero({ inteiro: true, min: 0 }),
      usuarios: array(usuarioSchema),
    }),
    exemploValido: { quantidade: 1, usuarios: [EXEMPLO_USUARIO] },
    invariantes: [quantidadeCoerenteComLista('usuarios')],
    confirmadoPor: [
      'tests/usuarios/usuarios-get.spec.ts',
      'tests/health.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
    observacoes:
      'O item da lista expõe `password` em texto claro (achado SEC-01 da ' +
      'ETAPA 11). O contrato registra a forma observada; a exposição é ' +
      'problema de segurança, não de forma.',
  },
  {
    id: 'usuarios.item',
    metodo: 'GET',
    endpoint: '/usuarios/{_id}',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: usuarioSchema,
    exemploValido: EXEMPLO_USUARIO,
    confirmadoPor: [
      'tests/usuarios/usuarios-get.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },
  {
    id: 'usuarios.criacao',
    metodo: 'POST',
    endpoint: '/usuarios',
    status: 201,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: criacaoSchema,
    exemploValido: { message: 'Cadastro realizado com sucesso', _id: EXEMPLO_ID },
    confirmadoPor: [
      'tests/usuarios/usuarios-create.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
    observacoes:
      'A rota não exige autenticação (achado SEC-02 da ETAPA 11): o ' +
      'contrato registra o comportamento observado, e a exposição é tratada ' +
      'como achado de segurança.',
  },
  {
    id: 'usuarios.email-duplicado',
    metodo: 'POST',
    endpoint: '/usuarios',
    status: 400,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: mensagemSchema,
    exemploValido: { message: 'Este email já está sendo usado' },
    confirmadoPor: [
      'tests/usuarios/usuarios-create.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
    observacoes:
      'Erro de negócio no formato `{ message }`, e não no formato de ' +
      'validação por campo. A resposta não traz `_id`.',
  },
  {
    id: 'usuarios.atualizacao',
    metodo: 'PUT',
    endpoint: '/usuarios/{_id}',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: mensagemSchema,
    exemploValido: { message: 'Registro alterado com sucesso' },
    confirmadoPor: [
      'tests/usuarios/usuarios-update.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
    observacoes:
      'Atualizar exige o payload completo (nome, e-mail, senha e ' +
      'administrador): envio parcial devolve 400 por campo. Com `_id` ' +
      'inexistente a rota cria o registro (201) em vez de alterar.',
  },
  {
    id: 'usuarios.exclusao',
    metodo: 'DELETE',
    endpoint: '/usuarios/{_id}',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: mensagemSchema,
    exemploValido: { message: 'Registro excluído com sucesso' },
    confirmadoPor: [
      'tests/usuarios/usuarios-delete.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
    observacoes:
      'Exclusão de registro inexistente também devolve 200, com mensagem ' +
      'diferente; a resposta permanece no mesmo formato.',
  },

  // -------------------------------------------------------------- produtos
  {
    id: 'produtos.lista',
    metodo: 'GET',
    endpoint: '/produtos',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: objeto({
      quantidade: numero({ inteiro: true, min: 0 }),
      produtos: array(produtoSchema),
    }),
    exemploValido: { quantidade: 1, produtos: [EXEMPLO_PRODUTO] },
    invariantes: [quantidadeCoerenteComLista('produtos')],
    confirmadoPor: [
      'tests/produtos/produtos-get.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },
  {
    id: 'produtos.item',
    metodo: 'GET',
    endpoint: '/produtos/{_id}',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: produtoSchema,
    exemploValido: EXEMPLO_PRODUTO,
    confirmadoPor: [
      'tests/produtos/produtos-get.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
    observacoes:
      'O preço é devolvido como número. A API, porém, só aceita preço ' +
      '**inteiro** na criação (400 "preco deve ser um inteiro"), enquanto a ' +
      'documentação o descreve como número: divergência registrada em ' +
      '`docs/api-contracts.md`. O contrato de resposta aceita qualquer ' +
      'número positivo para não gerar falso positivo.',
  },
  {
    id: 'produtos.criacao',
    metodo: 'POST',
    endpoint: '/produtos',
    status: 201,
    contentType: 'application/json',
    autenticacao: 'administrador',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: criacaoSchema,
    exemploValido: { message: 'Cadastro realizado com sucesso', _id: EXEMPLO_ID },
    confirmadoPor: [
      'tests/produtos/produtos-create.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },
  {
    id: 'produtos.nome-duplicado',
    metodo: 'POST',
    endpoint: '/produtos',
    status: 400,
    contentType: 'application/json',
    autenticacao: 'administrador',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: mensagemSchema,
    exemploValido: { message: 'Já existe produto com esse nome' },
    confirmadoPor: [
      'tests/produtos/produtos-create.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
    observacoes:
      'Erro de negócio no formato `{ message }`. O mesmo formato de ' +
      'validação por campo (`{ nome: "..." }`) é usado quando o campo ' +
      'ausente é identificado — são dois formatos distintos.',
  },
  {
    id: 'produtos.atualizacao',
    metodo: 'PUT',
    endpoint: '/produtos/{_id}',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'administrador',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: mensagemSchema,
    exemploValido: { message: 'Registro alterado com sucesso' },
    confirmadoPor: [
      'tests/produtos/produtos-update.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
    observacoes:
      'Com `_id` inexistente a rota cria o registro e devolve 201 com o ' +
      'formato de criação (achado SEC-04 da ETAPA 11).',
  },
  {
    id: 'produtos.exclusao',
    metodo: 'DELETE',
    endpoint: '/produtos/{_id}',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'administrador',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: mensagemSchema,
    exemploValido: { message: 'Registro excluído com sucesso' },
    confirmadoPor: [
      'tests/produtos/produtos-delete.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },

  // -------------------------------------------------------------- carrinhos
  {
    id: 'carrinhos.lista',
    metodo: 'GET',
    endpoint: '/carrinhos',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: objeto({
      quantidade: numero({ inteiro: true, min: 0 }),
      carrinhos: array(carrinhoSchema),
    }),
    exemploValido: { quantidade: 1, carrinhos: [EXEMPLO_CARRINHO] },
    invariantes: [quantidadeCoerenteComLista('carrinhos')],
    confirmadoPor: [
      'tests/carrinhos/carrinhos-get.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },
  {
    id: 'carrinhos.item',
    metodo: 'GET',
    endpoint: '/carrinhos/{_id}',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: carrinhoSchema,
    exemploValido: EXEMPLO_CARRINHO,
    confirmadoPor: [
      'tests/carrinhos/carrinhos-get.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },
  {
    id: 'carrinhos.criacao',
    metodo: 'POST',
    endpoint: '/carrinhos',
    status: 201,
    contentType: 'application/json',
    autenticacao: 'token',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: criacaoSchema,
    exemploValido: { message: 'Cadastro realizado com sucesso', _id: EXEMPLO_ID },
    confirmadoPor: [
      'tests/carrinhos/carrinhos-create.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },
  {
    id: 'carrinhos.conclusao',
    metodo: 'DELETE',
    endpoint: '/carrinhos/concluir-compra',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'token',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: mensagemSchema,
    exemploValido: { message: 'Registro excluído com sucesso' },
    confirmadoPor: [
      'tests/carrinhos/carrinhos-concluir.spec.ts',
      'tests/carrinhos/carrinhos-integridade.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },
  {
    id: 'carrinhos.cancelamento',
    metodo: 'DELETE',
    endpoint: '/carrinhos/cancelar-compra',
    status: 200,
    contentType: 'application/json',
    autenticacao: 'token',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: mensagemSchema,
    exemploValido: {
      message: 'Registro excluído com sucesso. Estoque dos produtos reabastecido',
    },
    confirmadoPor: [
      'tests/carrinhos/carrinhos-cancelar.spec.ts',
      'tests/carrinhos/carrinhos-integridade.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },

  // ----------------------------------------------------------------- erros
  {
    id: 'erros.mensagem',
    metodo: 'GET',
    endpoint: '/{recurso}/{_id}',
    status: 400,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: mensagemSchema,
    exemploValido: { message: 'Produto não encontrado' },
    confirmadoPor: [
      'tests/produtos/produtos-get.spec.ts',
      'tests/usuarios/usuarios-get.spec.ts',
      'tests/carrinhos/carrinhos-get.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
    observacoes:
      'Recurso inexistente responde **400** (e não 404) com `{ message }`. ' +
      'Divergência em relação à convenção REST, registrada em ' +
      '`docs/api-contracts.md`.',
  },
  {
    id: 'erros.id-invalido',
    metodo: 'GET',
    endpoint: '/{recurso}/{_id}',
    status: 400,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'observado',
    situacao: 'confirmado',
    corpo: objeto({ id: MENSAGEM }, { proibidos: ['message', '_id'] }),
    exemploValido: { id: 'id deve ter exatamente 16 caracteres alfanuméricos' },
    confirmadoPor: ['tests/contratos/contratos-api.spec.ts'],
    observacoes:
      'Formato **divergente** do restante: identificador fora do padrão ' +
      'devolve `{ id: "..." }`, e não `{ message: "..." }`. Descrito na ' +
      'documentação apenas como 400.',
  },
  {
    id: 'erros.validacao-campos',
    metodo: 'POST',
    endpoint: '/{recurso}',
    status: 400,
    contentType: 'application/json',
    autenticacao: 'nenhuma',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: erroPorCampoSchema,
    exemploValido: { nome: 'nome é obrigatório' },
    confirmadoPor: [
      'tests/seguranca/entrada-validacao.spec.ts',
      'tests/produtos/produtos-create.spec.ts',
      'tests/carrinhos/carrinhos-create.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },
  {
    id: 'auth.sem-token',
    metodo: 'POST',
    endpoint: '/{recurso-protegido}',
    status: 401,
    contentType: 'application/json',
    autenticacao: 'token',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: mensagemSchema,
    exemploValido: {
      message:
        'Token de acesso ausente, inválido, expirado ou usuário do token não existe mais',
    },
    confirmadoPor: [
      'tests/produtos/produtos-create.spec.ts',
      'tests/carrinhos/carrinhos-create.spec.ts',
      'tests/seguranca/exposicao-erros.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },
  {
    id: 'auth.nao-admin',
    metodo: 'POST',
    endpoint: '/{recurso-protegido}',
    status: 403,
    contentType: 'application/json',
    autenticacao: 'administrador',
    fonte: 'documentacao+observado',
    situacao: 'confirmado',
    corpo: mensagemSchema,
    exemploValido: { message: 'Rota exclusiva para administradores' },
    confirmadoPor: [
      'tests/produtos/produtos-create.spec.ts',
      'tests/produtos/produtos-update.spec.ts',
      'tests/produtos/produtos-delete.spec.ts',
      'tests/contratos/contratos-api.spec.ts',
    ],
  },
];

export const CONTRATOS_POR_ID: Map<string, Contrato> = new Map(
  CONTRATOS.map((contrato) => [contrato.id, contrato]),
);
