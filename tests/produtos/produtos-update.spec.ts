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
  MENSAGEM_PRODUTO_NAO_ENCONTRADO,
  type ProdutoApi,
  type ProdutoCriado,
} from '../helpers/produtos';
import {
  type ErroValidacao,
  lerJson,
  MENSAGEM_ALTERADO_SUCESSO,
  MENSAGEM_CADASTRO_SUCESSO,
  type MensagemResposta,
} from '../helpers/resposta';
import {
  excluirUsuario,
  gerarIdUnico,
  type UsuarioCriado,
} from '../helpers/usuarios';

test.describe('Atualização de produtos - PUT /produtos/{_id}', () => {
  let usuarioAdmin: UsuarioCriado;
  let usuarioComum: UsuarioCriado;
  let tokenAdmin: string;
  let tokenComum: string;
  let produtoBase: ProdutoCriado;
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
    produtoBase = await criarProdutoTeste(request, tokenAdmin);
  });

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirProduto(request, tokenAdmin, id);
    }
  });

  test.afterAll(async ({ request }) => {
    await excluirProduto(request, tokenAdmin, produtoBase.id);
    await excluirUsuario(request, usuarioAdmin.id);
    await excluirUsuario(request, usuarioComum.id);
  });

  test('deve atualizar um produto existente e persistir as alterações @critico', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const dadosAtualizados = {
      nome: `${produto.nome} Atualizado`,
      preco: 8888,
      descricao: `${produto.descricao} - Atualizada`,
      quantidade: 9,
    };

    const response = await request.put(`/produtos/${produto.id}`, {
      data: dadosAtualizados,
      headers: { Authorization: bearer(tokenAdmin) },
    });

    const body = await lerJson<MensagemResposta>(response, 200);
    expect(body.message).toBe(MENSAGEM_ALTERADO_SUCESSO);

    await validarContrato('produtos.atualizacao', response);

    const consulta = await request.get(`/produtos/${produto.id}`);
    const corpo = await lerJson<ProdutoApi>(consulta, 200);
    expect(corpo._id).toBe(produto.id);
    expect(corpo.nome).toBe(dadosAtualizados.nome);
    expect(corpo.preco).toBe(dadosAtualizados.preco);
    expect(corpo.descricao).toBe(dadosAtualizados.descricao);
    expect(corpo.quantidade).toBe(dadosAtualizados.quantidade);

    await validarContrato('produtos.item', consulta);
  });

  test('deve rejeitar atualização utilizando o nome de outro produto', async ({
    request,
  }) => {
    const produtoA = await criarProdutoTeste(request, tokenAdmin);
    const produtoB = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produtoA.id, produtoB.id);

    const response = await request.put(`/produtos/${produtoB.id}`, {
      data: {
        nome: produtoA.nome,
        preco: produtoB.preco,
        descricao: produtoB.descricao,
        quantidade: produtoB.quantidade,
      },
      headers: { Authorization: bearer(tokenAdmin) },
    });

    const body = await lerJson<MensagemResposta>(response, 400);
    expect(body.message).toBe(MENSAGEM_NOME_PRODUTO_EM_USO);

    await validarContrato('produtos.nome-duplicado', response);

    const consultaB = await request.get(`/produtos/${produtoB.id}`);
    const corpoB = await lerJson<ProdutoApi>(consultaB, 200);
    expect(corpoB.nome).toBe(produtoB.nome);
    expect(corpoB.preco).toBe(produtoB.preco);
    expect(corpoB.descricao).toBe(produtoB.descricao);
    expect(corpoB.quantidade).toBe(produtoB.quantidade);
  });

  test('deve rejeitar a atualização sem token de autorização', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.put(`/produtos/${produto.id}`, {
      data: {
        nome: `${produto.nome} Sem Token`,
        preco: 111,
        descricao: produto.descricao,
        quantidade: 1,
      },
    });

    const body = await lerJson<MensagemResposta>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);

    await validarContrato('auth.sem-token', response);

    const consulta = await request.get(`/produtos/${produto.id}`);
    const corpo = await lerJson<ProdutoApi>(consulta, 200);
    expect(corpo.nome).toBe(produto.nome);
    expect(corpo.preco).toBe(produto.preco);
  });

  test('deve rejeitar a atualização com token inválido', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.put(`/produtos/${produto.id}`, {
      data: {
        nome: `${produto.nome} Token Invalido`,
        preco: 222,
        descricao: produto.descricao,
        quantidade: 2,
      },
      headers: { Authorization: bearer('token-invalido') },
    });

    const body = await lerJson<MensagemResposta>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);

    await validarContrato('auth.sem-token', response);

    const consulta = await request.get(`/produtos/${produto.id}`);
    const corpo = await lerJson<ProdutoApi>(consulta, 200);
    expect(corpo.nome).toBe(produto.nome);
    expect(corpo.preco).toBe(produto.preco);
  });

  test('deve rejeitar a atualização com usuário comum (não administrador) @critico', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.put(`/produtos/${produto.id}`, {
      data: {
        nome: `${produto.nome} Usuario Comum`,
        preco: 333,
        descricao: produto.descricao,
        quantidade: 3,
      },
      headers: { Authorization: bearer(tokenComum) },
    });

    const body = await lerJson<MensagemResposta>(response, 403);
    expect(body.message).toBe(MENSAGEM_ROTA_ADMIN);

    await validarContrato('auth.nao-admin', response);

    const consulta = await request.get(`/produtos/${produto.id}`);
    const corpo = await lerJson<ProdutoApi>(consulta, 200);
    expect(corpo.nome).toBe(produto.nome);
    expect(corpo.preco).toBe(produto.preco);
  });

  test('deve criar um novo produto ao atualizar com id inexistente', async ({
    request,
  }) => {
    const id = gerarIdUnico();

    const consultaPrevia = await request.get(`/produtos/${id}`);
    expect(consultaPrevia.status()).toBe(400);

    const dados = {
      nome: gerarNomeProdutoUnico('Produto Criado Via Put'),
      preco: 444,
      descricao: 'Produto criado por PUT com id inexistente',
      quantidade: 4,
    };

    const response = await request.put(`/produtos/${id}`, {
      data: dados,
      headers: { Authorization: bearer(tokenAdmin) },
    });

    const body = await lerJson<MensagemResposta>(response, 201);
    expect(body.message).toBe(MENSAGEM_CADASTRO_SUCESSO);
    expect(typeof body._id).toBe('string');
    expect(body._id!.length).toBeGreaterThan(0);
    idsCriados.push(body._id!);

    // PUT com id inexistente cria o produto: a resposta segue o formato de
    // criação (201 + message + _id).
    await validarContrato('produtos.criacao', response);

    const consulta = await request.get(`/produtos/${body._id}`);
    const corpo = await lerJson<ProdutoApi>(consulta, 200);
    expect(corpo._id).toBe(body._id);
    expect(corpo.nome).toBe(dados.nome);
    expect(corpo.preco).toBe(dados.preco);
    expect(corpo.descricao).toBe(dados.descricao);
    expect(corpo.quantidade).toBe(dados.quantidade);

    const consultaIdUrl = await request.get(`/produtos/${id}`);
    const corpoIdUrl = await lerJson<MensagemResposta>(consultaIdUrl, 400);
    expect(corpoIdUrl.message).toBe(MENSAGEM_PRODUTO_NAO_ENCONTRADO);
  });

  for (const caso of CASOS_PAYLOAD_INVALIDO) {
    test(`deve retornar erro ao atualizar produto com ${caso.rotulo}`, async ({
      request,
    }) => {
      const dadosBase = {
        nome: produtoBase.nome,
        preco: produtoBase.preco,
        descricao: produtoBase.descricao,
        quantidade: produtoBase.quantidade,
      };

      const response = await request.put(`/produtos/${produtoBase.id}`, {
        data: caso.montar(),
        headers: { Authorization: bearer(tokenAdmin) },
      });

      const body = await lerJson<ErroValidacao>(response, 400);
      expect(body).toMatchObject(caso.corpoEsperado);
      expect(body).not.toHaveProperty('_id');

      await validarContrato('erros.validacao-campos', response);

      const consulta = await request.get(`/produtos/${produtoBase.id}`);
      const corpo = await lerJson<ProdutoApi>(consulta, 200);
      expect(corpo.nome).toBe(dadosBase.nome);
      expect(corpo.preco).toBe(dadosBase.preco);
      expect(corpo.descricao).toBe(dadosBase.descricao);
      expect(corpo.quantidade).toBe(dadosBase.quantidade);
    });
  }
});