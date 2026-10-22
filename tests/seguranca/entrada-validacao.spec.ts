import { expect, test } from '../fixtures';
import { bearer, fazerLogin } from '../helpers/autenticacao';
import { validarContrato } from '../helpers/contratos';
import {
  criarUsuarioProdutoTeste,
  excluirProduto,
  gerarNomeProdutoUnico,
  type ProdutoApi,
} from '../helpers/produtos';
import {
  lerJson,
  type ErroValidacao,
  type MensagemResposta,
} from '../helpers/resposta';
import {
  excluirUsuario,
  gerarEmailUnico,
  gerarIdUnico,
  gerarNomeUnico,
  type DadosUsuario,
  type UsuarioCriado,
} from '../helpers/usuarios';

// Valores controlados para avaliar o tratamento de entradas exóticas, sem ser
// destrutivos nem tentar executar código contra a infraestrutura pública.
const STRINGS_ESPECIAIS = [
  { rotulo: 'aspas e barra invertida', valor: `Aspas " e barra \\ texto` },
  { rotulo: 'marcação HTML/script', valor: '<script>alert(1)</script>' },
  { rotulo: 'caracteres unicode', valor: 'Produto ção ñ 日本語 emoji 🚀' },
  { rotulo: 'chaves e operadores JSON', valor: '{"a":1} $(whoami) `id`' },
];

test.describe('Validação de segurança de entradas - produtos', () => {
  let usuarioAdmin: UsuarioCriado;
  let tokenAdmin: string;
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
  });

  test.afterAll(async ({ request }) => {
    await excluirUsuario(request, usuarioAdmin.id);
  });

  test('deve persistir strings com caracteres especiais sem alterá-las', async ({
    request,
  }) => {
    for (const caso of STRINGS_ESPECIAIS) {
      const nome = gerarNomeProdutoUnico(`Produto ${caso.rotulo}`);

      const response = await request.post('/produtos', {
        data: {
          nome,
          preco: 77,
          descricao: caso.valor,
          quantidade: 2,
        },
        headers: { Authorization: bearer(tokenAdmin) },
      });

      const criado = await lerJson<MensagemResposta>(
        response,
        201,
        `${caso.rotulo}: criação`,
      );
      idsProdutos.push(criado._id!);

      const consulta = await request.get(`/produtos/${criado._id}`);
      const corpo = await lerJson<ProdutoApi>(consulta, 200);
      // O texto deve voltar idêntico ao enviado: nem escapado nem executado.
      expect(corpo.descricao).toBe(caso.valor);
    }
  });

  test('deve rejeitar corpo JSON malformado sem erro interno', async ({
    request,
  }) => {
    const response = await request.post('/produtos', {
      headers: {
        Authorization: bearer(tokenAdmin),
        'Content-Type': 'application/json',
      },
      data: '{"nome": "Produto Quebrado", preco: }',
    });

    // Comportamento observado: JSON inválido é tratado como payload sem os
    // campos obrigatórios (400) e nunca como 5xx.
    expect(response.status()).toBeLessThan(500);
    expect([400, 401]).toContain(response.status());

    const corpo = await response.json();
    const serializado = JSON.stringify(corpo).toLowerCase();
    expect(serializado).not.toContain('stack');
    expect(serializado).not.toContain('syntaxerror');

    await validarContrato('erros.mensagem', response);
  });

  test('deve rejeitar campos não documentados no payload de produto (schema estrito)', async ({
    request,
  }) => {
    const nome = gerarNomeProdutoUnico('Produto Campos Extras');

    const response = await request.post('/produtos', {
      data: {
        nome,
        preco: 88,
        descricao: 'Produto com campos não documentados',
        quantidade: 4,
        _id: gerarIdUnico(),
        administrador: 'true',
        authorization: `Bearer ${gerarIdUnico()}`,
      },
      headers: { Authorization: bearer(tokenAdmin) },
    });

    // Comportamento observado: a API rejeita campos extras (schema estrito) em
    // vez de os ignorar. A forma do corpo varia entre a lista por campo e uma
    // mensagem genérica; ambas resultam em 400 e nenhum registro criado.
    const corpo = await lerJson<Record<string, string>>(response, 400);
    const rejeitouCampo =
      corpo._id === '_id não é permitido' ||
      typeof corpo.message === 'string';
    expect(
      rejeitouCampo,
      'campos não documentados devem ser rejeitados',
    ).toBe(true);

    await validarContrato('erros.validacao-campos', response);

    const consulta = await request.get('/produtos', { params: { nome } });
    const lista = await lerJson<{ quantidade: number }>(consulta, 200);
    expect(lista.quantidade).toBe(0);
  });

  test('deve rejeitar campos obrigatórios ausentes mesmo com campo extra presente', async ({
    request,
  }) => {
    const response = await request.post('/produtos', {
      data: { observacao: 'apenas um campo não documentado' },
      headers: { Authorization: bearer(tokenAdmin) },
    });

    const corpo = await lerJson<Record<string, unknown>>(response, 400);
    expect(corpo).not.toHaveProperty('_id');
    expect(corpo.nome).toBe('nome é obrigatório');
    expect(corpo.quantidade).toBe('quantidade é obrigatório');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve rejeitar id de produto fora do formato documentado (16 alfanuméricos)', async ({
    request,
  }) => {
    for (const idInvalido of ['curto', 'x'.repeat(17), '!!!@@@###$$$%%%%']) {
      const response = await request.get(`/produtos/${idInvalido}`);
      expect(response.status(), `id "${idInvalido}"`).toBeLessThan(500);

      await validarContrato('erros.id-invalido', response);
    }
  });
});

test.describe('Validação de segurança de entradas - usuários', () => {
  test('deve rejeitar campos não documentados no payload de usuário', async ({
    request,
  }) => {
    const dados = {
      nome: gerarNomeUnico('Usuário Campos Extras'),
      email: gerarEmailUnico('campos-extras'),
      password: 'SenhaCamposExtras@123',
      administrador: 'false',
      _id: gerarIdUnico(),
      authorization: `Bearer ${gerarIdUnico()}`,
      token: gerarIdUnico(),
    };

    const response = await request.post('/usuarios', { data: dados });

    // Comportamento observado: a API rejeita o payload com 400 e não cria o
    // registro. A forma do corpo varia entre rejeição por campo (ex.: `_id não
    // é permitido`) e uma mensagem genérica de payload não permitido — ambos
    // são rejeições, nunca um cadastro bem-sucedido. Nenhum dos dois deve
    // devolver um `_id` de recurso criado.
    const corpo = await lerJson<Record<string, string>>(response, 400);
    const ehErroDeCampo = corpo._id === '_id não é permitido';
    const ehErroGenerico = typeof corpo.message === 'string';
    expect(
      ehErroDeCampo || ehErroGenerico,
      'resposta deve ser uma rejeição reconhecível',
    ).toBe(true);

    await validarContrato('erros.validacao-campos', response);

    const consulta = await request.get('/usuarios', {
      params: { email: dados.email },
    });
    const lista = await lerJson<{ quantidade: number }>(consulta, 200);
    expect(lista.quantidade).toBe(0);
  });

  test('deve rejeitar e-mail com formato inválido independentemente do restante', async ({
    request,
  }) => {
    for (const emailInvalido of ['sem-arroba', 'a@', '@b.com', 'a b@c.com']) {
      const dados: DadosUsuario = {
        nome: gerarNomeUnico('Usuário Email Inválido'),
        email: emailInvalido,
        password: 'SenhaEmail@123',
        administrador: 'false',
      };

      const response = await request.post('/usuarios', { data: dados });
      const corpo = await lerJson<ErroValidacao>(
        response,
        400,
        `email "${emailInvalido}"`,
      );
      expect(corpo.email).toBe('email deve ser um email válido');

      await validarContrato('erros.validacao-campos', response);
    }
  });
});
