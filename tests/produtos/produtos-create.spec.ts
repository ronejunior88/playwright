import { expect, test } from '../fixtures';
import {
  bearer,
  fazerLogin,
  MENSAGEM_ROTA_ADMIN,
  MENSAGEM_TOKEN_INVALIDO,
} from '../helpers/autenticacao';
import { validarContrato } from '../helpers/contratos';
import {
  CASOS_PAYLOAD_INVALIDO,
  criarProdutoTeste,
  criarUsuarioProdutoTeste,
  excluirProduto,
  gerarNomeProdutoUnico,
  MENSAGEM_NOME_PRODUTO_EM_USO,
  type ListaProdutos,
} from '../helpers/produtos';
import {
  lerJson,
  type ErroValidacao,
  type MensagemResposta,
} from '../helpers/resposta';
import {
  excluirUsuario,
  gerarIdUnico,
  type UsuarioCriado,
} from '../helpers/usuarios';

test.describe('Criação de produtos - POST /produtos', () => {
  let usuarioAdmin: UsuarioCriado;
  let usuarioComum: UsuarioCriado;
  let tokenAdmin: string;
  let tokenComum: string;
  const idsCriados: string[] = [];

  test.beforeAll(async ({ request }) => {
    usuarioAdmin = await criarUsuarioProdutoTeste(request, 'true');
    usuarioComum = await criarUsuarioProdutoTeste(request, 'false');
    tokenAdmin = await fazerLogin(
      request,
      usuarioAdmin.email,
      usuarioAdmin.password,
    );
    tokenComum = await fazerLogin(
      request,
      usuarioComum.email,
      usuarioComum.password,
    );
  });

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirProduto(request, tokenAdmin, id);
    }
  });

  test.afterAll(async ({ request }) => {
    await excluirUsuario(request, usuarioAdmin.id);
    await excluirUsuario(request, usuarioComum.id);
  });

  test('deve criar um produto com sucesso e persistir os dados @critico', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const consulta = await request.get(`/produtos/${produto.id}`);
    const corpo = await lerJson<{
      _id: string;
      nome: string;
      preco: number;
      descricao: string;
      quantidade: number;
    }>(consulta, 200);
    expect(corpo._id).toBe(produto.id);
    expect(corpo.nome).toBe(produto.nome);
    expect(corpo.preco).toBe(produto.preco);
    expect(corpo.descricao).toBe(produto.descricao);
    expect(corpo.quantidade).toBe(produto.quantidade);

    await validarContrato('produtos.item', consulta);
  });

  test('deve rejeitar a criação sem token de autorização @critico', async ({
    request,
  }) => {
    const payload = {
      nome: gerarNomeProdutoUnico('Produto Sem Token'),
      preco: 100,
      descricao: 'Descrição sem token',
      quantidade: 1,
    };

    const response = await request.post('/produtos', { data: payload });

    const body = await lerJson<MensagemResposta>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);
    expect(body).not.toHaveProperty('_id');

    await validarContrato('auth.sem-token', response);

    const consulta = await request.get('/produtos', {
      params: { nome: payload.nome },
    });
    const lista = await lerJson<ListaProdutos>(consulta, 200);
    expect(lista.quantidade).toBe(0);
  });

  test('deve rejeitar a criação com token inválido', async ({ request }) => {
    const payload = {
      nome: gerarNomeProdutoUnico('Produto Token Invalido'),
      preco: 100,
      descricao: 'Descrição token inválido',
      quantidade: 1,
    };

    const response = await request.post('/produtos', {
      data: payload,
      headers: { Authorization: bearer('token-invalido') },
    });

    const body = await lerJson<MensagemResposta>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);
    expect(body).not.toHaveProperty('_id');

    const consulta = await request.get('/produtos', {
      params: { nome: payload.nome },
    });
    const lista = await lerJson<ListaProdutos>(consulta, 200);
    expect(lista.quantidade).toBe(0);
  });

  const CABECALHOS_AUTH_MALFORMADO = [
    { rotulo: 'apenas "Bearer"', valor: 'Bearer' },
    { rotulo: 'valor vazio', valor: '' },
    { rotulo: 'token sem prefixo "Bearer"', valor: 'token-sem-prefixo' },
  ];

  for (const caso of CABECALHOS_AUTH_MALFORMADO) {
    test(`deve rejeitar a criação com Authorization malformado (${caso.rotulo})`, async ({
      request,
    }) => {
      const payload = {
        nome: gerarNomeProdutoUnico('Produto Auth Malformado'),
        preco: 100,
        descricao: 'Descrição com cabeçalho Authorization malformado',
        quantidade: 1,
      };

      const response = await request.post('/produtos', {
        data: payload,
        headers: { Authorization: caso.valor },
      });

      const body = await lerJson<MensagemResposta>(response, 401);
      expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);
      expect(body).not.toHaveProperty('_id');

      await validarContrato('auth.sem-token', response);

      const consulta = await request.get('/produtos', {
        params: { nome: payload.nome },
      });
      const lista = await lerJson<ListaProdutos>(consulta, 200);
      expect(lista.quantidade).toBe(0);
    });
  }

  test('deve rejeitar a criação com usuário comum (não administrador) @critico', async ({
    request,
  }) => {
    const payload = {
      nome: gerarNomeProdutoUnico('Produto Usuario Comum'),
      preco: 100,
      descricao: 'Descrição usuário comum',
      quantidade: 1,
    };

    const response = await request.post('/produtos', {
      data: payload,
      headers: { Authorization: bearer(tokenComum) },
    });

    const body = await lerJson<MensagemResposta>(response, 403);
    expect(body.message).toBe(MENSAGEM_ROTA_ADMIN);
    expect(body).not.toHaveProperty('_id');

    await validarContrato('auth.nao-admin', response);

    const consulta = await request.get('/produtos', {
      params: { nome: payload.nome },
    });
    const lista = await lerJson<ListaProdutos>(consulta, 200);
    expect(lista.quantidade).toBe(0);
  });

  test('deve rejeitar a criação com nome duplicado', async ({ request }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const segundo = await request.post('/produtos', {
      data: {
        nome: produto.nome,
        preco: 300,
        descricao: 'Tentativa de nome duplicado',
        quantidade: 5,
      },
      headers: { Authorization: bearer(tokenAdmin) },
    });

    const segundoBody = await lerJson<MensagemResposta>(segundo, 400);
    expect(segundoBody.message).toBe(MENSAGEM_NOME_PRODUTO_EM_USO);
    expect(segundoBody).not.toHaveProperty('_id');

    await validarContrato('produtos.nome-duplicado', segundo);

    const consulta = await request.get('/produtos', {
      params: { nome: produto.nome },
    });
    const lista = await lerJson<ListaProdutos>(consulta, 200);
    expect(lista.quantidade).toBe(1);
    expect(lista.produtos).toHaveLength(1);
    expect(lista.produtos[0]._id).toBe(produto.id);
  });

  test('deve rejeitar campos não documentados no payload de criação', async ({
    request,
  }) => {
    const nome = gerarNomeProdutoUnico('Produto Campos Extras');
    const tokenForjado = 'token-forjado-nao-deve-ser-usado';

    const response = await request.post('/produtos', {
      data: {
        nome,
        preco: 123,
        descricao: 'Produto com campos não documentados',
        quantidade: 7,
        _id: gerarIdUnico(),
        authorization: `Bearer ${tokenForjado}`,
        administrador: 'true',
      },
      headers: { Authorization: bearer(tokenAdmin) },
    });

    // Comportamento observado: a API valida o schema em modo estrito e rejeita
    // explicitamente os campos não documentados em vez de ignorá-los. A forma
    // do corpo pode variar (lista por campo ou mensagem genérica), mas o
    // resultado é sempre 400 e nenhum produto é criado.
    const body = await lerJson<Record<string, string>>(response, 400);
    const rejeitouCampo =
      body._id === '_id não é permitido' ||
      body.administrador === 'administrador não é permitido' ||
      typeof body.message === 'string';
    expect(
      rejeitouCampo,
      'campos não documentados devem ser rejeitados',
    ).toBe(true);

    await validarContrato('erros.validacao-campos', response);

    const consulta = await request.get('/produtos', { params: { nome } });
    const lista = await lerJson<ListaProdutos>(consulta, 200);
    expect(lista.quantidade).toBe(0);
  });

  for (const caso of CASOS_PAYLOAD_INVALIDO) {
    test(`deve retornar erro ao criar produto com ${caso.rotulo}`, async ({
      request,
    }) => {
      const response = await request.post('/produtos', {
        data: caso.montar(),
        headers: { Authorization: bearer(tokenAdmin) },
      });

      const body = await lerJson<ErroValidacao>(response, 400);
      expect(body).toMatchObject(caso.corpoEsperado);
      expect(body).not.toHaveProperty('_id');

      await validarContrato('erros.validacao-campos', response);
    });
  }
});