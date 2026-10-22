import { expect, test } from '../fixtures';
import {
  bearer,
  fazerLogin,
  MENSAGEM_CREDENCIAIS_INVALIDAS,
  MENSAGEM_TOKEN_INVALIDO,
} from '../helpers/autenticacao';
import { validarContrato } from '../helpers/contratos';
import {
  criarProdutoTeste,
  criarUsuarioProdutoTeste,
  excluirProduto,
  MENSAGEM_PRODUTO_NAO_ENCONTRADO,
  type ProdutoApi,
} from '../helpers/produtos';
import {
  lerJson,
  MENSAGEM_CADASTRO_SUCESSO,
  type MensagemResposta,
} from '../helpers/resposta';
import {
  excluirUsuario,
  gerarEmailUnico,
  gerarIdUnico,
  gerarNomeUnico,
  type DadosUsuario,
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
    const criado = await lerJson<MensagemResposta>(criacao, 201);
    idsUsuarios.push(criado._id!);

    const consulta = await request.get(`/usuarios/${criado._id}`);
    const corpo = await lerJson<
      UsuarioApi & {
        authorization?: string;
        token?: string;
        hash?: string;
        salt?: string;
      }
    >(consulta, 200);

    // Contrato observado: a API devolve o campo `password` do recurso.
    expect(corpo.password).toBe(dados.password);
    // Mas não deve devolver artefatos de sessão/credenciais adicionais.
    expect(corpo).not.toHaveProperty('authorization');
    expect(corpo).not.toHaveProperty('token');
    expect(corpo).not.toHaveProperty('hash');
    expect(corpo).not.toHaveProperty('salt');

    await validarContrato('usuarios.item', consulta);
  });

  test('não deve ecoar o valor da senha em mensagem de erro de login', async ({
    request,
  }) => {
    const senhaTentada = 'SenhaQueNaoDeveVazar@123';

    const response = await request.post('/login', {
      data: { email: usuarioAdmin.email, password: senhaTentada },
    });

    const corpo = await lerJson<MensagemResposta>(response, 401);
    expect(JSON.stringify(corpo)).not.toContain(senhaTentada);

    expect(corpo.message).toBe(MENSAGEM_CREDENCIAIS_INVALIDAS);

    await validarContrato('login.credenciais-invalidas', response);
  });

  test('não deve expor detalhes internos ao consultar recursos inexistentes', async ({
    request,
  }) => {
    for (const endpoint of ['/usuarios', '/produtos', '/carrinhos']) {
      const response = await request.get(`${endpoint}/${gerarIdUnico()}`);

      const corpo = await lerJson<MensagemResposta>(
        response,
        400,
        `${endpoint}: id inexistente`,
      );
      assertSemVazamentoInterno(corpo, `GET ${endpoint}/{id}`);
      expect(corpo.message).toBeTruthy();

      await validarContrato('erros.mensagem', response);
    }
  });

  test('não deve expor detalhes internos ao rejeitar operação sem autenticação', async ({
    request,
  }) => {
    const response = await request.post('/produtos', {
      data: { nome: gerarNomeUnico('Sem Token'), preco: 10 },
    });

    const corpo = await lerJson<MensagemResposta>(response, 401);
    assertSemVazamentoInterno(corpo, 'POST /produtos sem token');
    expect(corpo.message).toBe(MENSAGEM_TOKEN_INVALIDO);

    await validarContrato('auth.sem-token', response);
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

    const corpo = await lerJson<MensagemResposta>(response, 201);
    assertSemVazamentoInterno(corpo, `PUT /produtos/${id}`);

    expect(corpo.message).toBe(MENSAGEM_CADASTRO_SUCESSO);
    expect(corpo._id).toBeTruthy();
    idsProdutos.push(corpo._id!);

    await validarContrato('produtos.criacao', response);

    const consultaUrl = await request.get(`/produtos/${id}`);
    const corpoUrl = await lerJson<MensagemResposta>(consultaUrl, 400);
    assertSemVazamentoInterno(corpoUrl, `GET /produtos/${id}`);
    expect(corpoUrl.message).toBe(MENSAGEM_PRODUTO_NAO_ENCONTRADO);

    await validarContrato('erros.mensagem', consultaUrl);
  });

  test('deve rejeitar id de formato inválido sem expor detalhes internos', async ({
    request,
  }) => {
    for (const endpoint of ['/usuarios', '/produtos', '/carrinhos']) {
      const response = await request.get(`${endpoint}/curto`);

      const corpo = await lerJson<Record<string, unknown>>(
        response,
        400,
        `${endpoint}: id malformado`,
      );
      assertSemVazamentoInterno(corpo, `GET ${endpoint}/curto`);

      await validarContrato('erros.id-invalido', response);
    }
  });

  test('deve devolver produto consultado sem token de autorização embutido', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsProdutos.push(produto.id);

    const consulta = await request.get(`/produtos/${produto.id}`);
    const corpo = await lerJson<
      ProdutoApi & {
        authorization?: string;
        token?: string;
      }
    >(consulta, 200);
    expect(corpo).not.toHaveProperty('authorization');
    expect(corpo).not.toHaveProperty('token');
  });
});
