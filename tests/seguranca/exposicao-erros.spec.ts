import { expect, test } from '../fixtures';
import { fazerLogin } from '../helpers/autenticacao';
import {
  bearer,
  criarProdutoTeste,
  criarUsuarioProdutoTeste,
  excluirProduto,
  MENSAGEM_TOKEN_INVALIDO,
  type MensagemResposta,
  type ProdutoApi,
} from '../helpers/produtos';
import {
  excluirUsuario,
  gerarEmailUnico,
  gerarIdUnico,
  gerarNomeUnico,
  type DadosUsuario,
  type MensagemResposta as MensagemUsuario,
  type UsuarioApi,
  type UsuarioCriado,
} from '../helpers/usuarios';

// Padrões de vazamento interno: stack trace, caminho de arquivo do servidor e
// termos que denunciariam o framework de persistência. A verificação é feita
// por comparação, sem imprimir o corpo recebido.
const INDICIOS_DE_ERRO_INTERNO = [
  'stack',
  'at Object',
  'node_modules',
  '.js:',
  'MongoError',
  'MongooseError',
  'CastError',
  'ECONNREFUSED',
  'SyntaxError',
];

function assertSemVazamentoInterno(corpo: unknown, contexto: string): void {
  const serializado = JSON.stringify(corpo).toLowerCase();
  for (const indicio of INDICIOS_DE_ERRO_INTERNO) {
    expect(
      serializado,
      `${contexto}: resposta não deve expor "${indicio}"`,
    ).not.toContain(indicio.toLowerCase());
  }
}

test.describe('Exposição de dados sensíveis e tratamento de erros', () => {
  let usuarioAdmin: UsuarioCriado;
  let tokenAdmin: string;
  const idsUsuarios: string[] = [];
  const idsProdutos: string[] = [];

  test.beforeAll(async ({ request }) => {
    usuarioAdmin = await criarUsuarioProdutoTeste(request, 'true');
    tokenAdmin = await fazerLogin(
      request,
      usuarioAdmin.email,
      usuarioAdmin.password,
    );
  });

  test.afterEach(async ({ request }) => {
    for (const id of idsProdutos.splice(0)) {
      await excluirProduto(request, tokenAdmin, id);
    }
    for (const id of idsUsuarios.splice(0)) {
      await excluirUsuario(request, id);
    }
  });

  test.afterAll(async ({ request }) => {
    await excluirUsuario(request, usuarioAdmin.id);
  });

  test('deve expor a senha do próprio usuário consultado, sem artefatos de sessão', async ({
    request,
  }) => {
    const dados: DadosUsuario = {
      nome: gerarNomeUnico('Usuário Exposição'),
      email: gerarEmailUnico('exposicao'),
      password: 'SenhaExposicao@123',
      administrador: 'false',
    };

    const criacao = await request.post('/usuarios', { data: dados });
    expect(criacao.status()).toBe(201);
    const criado = (await criacao.json()) as MensagemUsuario;
    idsUsuarios.push(criado._id!);

    const consulta = await request.get(`/usuarios/${criado._id}`);
    expect(consulta.status()).toBe(200);

    const corpo = (await consulta.json()) as UsuarioApi & {
      authorization?: string;
      token?: string;
      hash?: string;
      salt?: string;
    };

    // Contrato observado: a API devolve o campo `password` do recurso.
    expect(corpo.password).toBe(dados.password);
    // Mas não deve devolver artefatos de sessão/credenciais adicionais.
    expect(corpo).not.toHaveProperty('authorization');
    expect(corpo).not.toHaveProperty('token');
    expect(corpo).not.toHaveProperty('hash');
    expect(corpo).not.toHaveProperty('salt');
  });

  test('não deve ecoar o valor da senha em mensagem de erro de login', async ({
    request,
  }) => {
    const senhaTentada = 'SenhaQueNaoDeveVazar@123';

    const response = await request.post('/login', {
      data: { email: usuarioAdmin.email, password: senhaTentada },
    });

    expect(response.status()).toBe(401);

    const corpo = await response.json();
    expect(JSON.stringify(corpo)).not.toContain(senhaTentada);

    const body = corpo as MensagemResposta;
    expect(body.message).toBe('Email e/ou senha inválidos');
  });

  test('não deve expor detalhes internos ao consultar recursos inexistentes', async ({
    request,
  }) => {
    for (const endpoint of ['/usuarios', '/produtos', '/carrinhos']) {
      const response = await request.get(`${endpoint}/${gerarIdUnico()}`);

      expect(response.status(), `${endpoint}: id inexistente`).toBe(400);
      const corpo = await response.json();
      assertSemVazamentoInterno(corpo, `GET ${endpoint}/{id}`);
      expect((corpo as MensagemResposta).message).toBeTruthy();
    }
  });

  test('não deve expor detalhes internos ao rejeitar operação sem autenticação', async ({
    request,
  }) => {
    const response = await request.post('/produtos', {
      data: { nome: gerarNomeUnico('Sem Token'), preco: 10 },
    });

    expect(response.status()).toBe(401);
    const corpo = await response.json();
    assertSemVazamentoInterno(corpo, 'POST /produtos sem token');
    expect((corpo as MensagemResposta).message).toBe(MENSAGEM_TOKEN_INVALIDO);
  });

  test('deve responder sem vazamento em PUT com id inexistente (caminho 201)', async ({
    request,
  }) => {
    const id = gerarIdUnico();
    const nome = gerarNomeUnico('Produto PUT Inexistente');

    const response = await request.put(`/produtos/${id}`, {
      data: {
        nome,
        preco: 321,
        descricao: 'Produto criado via PUT em id inexistente',
        quantidade: 3,
      },
      headers: { Authorization: bearer(tokenAdmin) },
    });

    expect(response.status()).toBe(201);

    const corpo = await response.json();
    assertSemVazamentoInterno(corpo, `PUT /produtos/${id}`);

    const body = corpo as MensagemResposta;
    expect(body.message).toBe('Cadastro realizado com sucesso');
    expect(body._id).toBeTruthy();
    idsProdutos.push(body._id!);

    const consultaUrl = await request.get(`/produtos/${id}`);
    expect(consultaUrl.status()).toBe(400);
    const corpoUrl = (await consultaUrl.json()) as MensagemResposta;
    assertSemVazamentoInterno(corpoUrl, `GET /produtos/${id}`);
    expect(corpoUrl.message).toBe('Produto não encontrado');
  });

  test('deve rejeitar id de formato inválido sem expor detalhes internos', async ({
    request,
  }) => {
    for (const endpoint of ['/usuarios', '/produtos', '/carrinhos']) {
      const response = await request.get(`${endpoint}/curto`);

      expect(response.status(), `${endpoint}: id malformado`).toBe(400);
      const corpo = await response.json();
      assertSemVazamentoInterno(corpo, `GET ${endpoint}/curto`);
    }
  });

  test('deve devolver produto consultado sem token de autorização embutido', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsProdutos.push(produto.id);

    const consulta = await request.get(`/produtos/${produto.id}`);
    expect(consulta.status()).toBe(200);

    const corpo = (await consulta.json()) as ProdutoApi & {
      authorization?: string;
      token?: string;
    };
    expect(corpo).not.toHaveProperty('authorization');
    expect(corpo).not.toHaveProperty('token');
  });
});
