import { test } from '../fixtures';
import { bearer, fazerLogin } from '../helpers/autenticacao';
import {
  cancelarCompraSeguro,
  criarCarrinhoTeste,
  criarUsuarioAutenticado,
} from '../helpers/carrinhos';
import { validarContrato } from '../helpers/contratos';
import { lerJson, type MensagemResposta } from '../helpers/resposta';
import {
  criarProdutoTeste,
  excluirProduto,
  gerarNomeProdutoUnico,
  gerarPrecoUnico,
  gerarQuantidadeUnica,
} from '../helpers/produtos';
import {
  criarUsuarioTeste,
  excluirUsuario,
  gerarEmailUnico,
  gerarNomeUnico,
} from '../helpers/usuarios';

/**
 * Testes de contrato contra a API real.
 *
 * Cada teste confere a resposta recebida com o contrato registrado em
 * `contracts/contratos.ts`: status, content-type, estrutura e tipos do corpo.
 * A falha só acontece quando há divergência **incompatível**; campos
 * adicionais são aceitos (divergência compatível).
 *
 * Os dados criados aqui são sintéticos e removidos ao final de cada teste.
 */

function produtoSintetico() {
  return {
    nome: gerarNomeProdutoUnico('Produto Contrato'),
    preco: gerarPrecoUnico(),
    descricao: 'Produto criado para conferência de contrato',
    quantidade: gerarQuantidadeUnica(),
  };
}

test.describe('Contratos da API — autenticação', () => {
  test('login com credenciais válidas cumpre o contrato de sucesso', async ({
    request,
  }) => {
    const usuario = await criarUsuarioTeste(request);

    try {
      const resposta = await request.post('/login', {
        data: { email: usuario.email, password: usuario.password },
      });

      await validarContrato('login.sucesso', resposta);
    } finally {
      await excluirUsuario(request, usuario.id);
    }
  });

  test('login com credenciais inválidas cumpre o contrato de erro', async ({
    request,
  }) => {
    const resposta = await request.post('/login', {
      data: {
        email: gerarEmailUnico('inexistente'),
        password: 'SenhaInvalida@123',
      },
    });

    await validarContrato('login.credenciais-invalidas', resposta);
  });

  test('login com payload vazio cumpre o contrato de validação por campo', async ({
    request,
  }) => {
    const resposta = await request.post('/login', { data: {} });

    await validarContrato('login.payload-invalido', resposta);
  });
});

test.describe('Contratos da API — usuários', () => {
  test('listagem de usuários cumpre o contrato', async ({ request }) => {
    const resposta = await request.get('/usuarios');

    await validarContrato('usuarios.lista', resposta);
  });

  test('criação de usuário cumpre o contrato', async ({ request }) => {
    const resposta = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Contrato'),
        email: gerarEmailUnico('usuario-contrato'),
        password: 'SenhaTeste@123',
        administrador: 'false',
      },
    });

    await validarContrato('usuarios.criacao', resposta);

    const corpo = await lerJson<MensagemResposta>(resposta, 201);
    await excluirUsuario(request, corpo._id!);
  });

  test('consulta de usuário cumpre o contrato', async ({ request }) => {
    const usuario = await criarUsuarioTeste(request);

    try {
      const resposta = await request.get(`/usuarios/${usuario.id}`);

      await validarContrato('usuarios.item', resposta);
    } finally {
      await excluirUsuario(request, usuario.id);
    }
  });

  test('atualização de usuário cumpre o contrato', async ({ request }) => {
    const usuario = await criarUsuarioTeste(request);

    try {
      const resposta = await request.put(`/usuarios/${usuario.id}`, {
        data: {
          nome: gerarNomeUnico('Usuário Atualizado'),
          email: usuario.email,
          password: usuario.password,
          administrador: 'false',
        },
      });

      await validarContrato('usuarios.atualizacao', resposta);
    } finally {
      await excluirUsuario(request, usuario.id);
    }
  });

  test('exclusão de usuário cumpre o contrato', async ({ request }) => {
    const usuario = await criarUsuarioTeste(request);

    const resposta = await request.delete(`/usuarios/${usuario.id}`);

    await validarContrato('usuarios.exclusao', resposta);
  });

  test('criação com payload vazio cumpre o contrato de erro por campo', async ({
    request,
  }) => {
    const resposta = await request.post('/usuarios', { data: {} });

    await validarContrato('erros.validacao-campos', resposta);
  });

  test('email duplicado cumpre o contrato de erro de negócio', async ({
    request,
  }) => {
    const dados = {
      nome: gerarNomeUnico('Usuário Duplicado'),
      email: gerarEmailUnico('usuario-duplicado'),
      password: 'SenhaTeste@123',
      administrador: 'false',
    };

    const primeiro = await request.post('/usuarios', { data: dados });
    const corpo = await lerJson<MensagemResposta>(primeiro, 201);

    try {
      const resposta = await request.post('/usuarios', { data: dados });

      await validarContrato('usuarios.email-duplicado', resposta);
    } finally {
      await excluirUsuario(request, corpo._id!);
    }
  });

  test('identificador malformado devolve o contrato de id inválido', async ({
    request,
  }) => {
    const resposta = await request.get('/usuarios/abc');

    await validarContrato('erros.id-invalido', resposta);
  });

  test('registro inexistente devolve o contrato de mensagem de erro', async ({
    request,
  }) => {
    const resposta = await request.get('/usuarios/aaaaaaaaaaaaaaaa');

    await validarContrato('erros.mensagem', resposta);
  });
});

test.describe('Contratos da API — produtos', () => {
  test('listagem de produtos cumpre o contrato', async ({ request }) => {
    const resposta = await request.get('/produtos');

    await validarContrato('produtos.lista', resposta);
  });

  test('criação sem token cumpre o contrato de acesso negado', async ({
    request,
  }) => {
    const resposta = await request.post('/produtos', { data: produtoSintetico() });

    await validarContrato('auth.sem-token', resposta);
  });

  test('criação com usuário não administrador cumpre o contrato de rota restrita', async ({
    request,
  }) => {
    const { usuario, token } = await criarUsuarioAutenticado(request, 'false');

    try {
      const resposta = await request.post('/produtos', {
        data: produtoSintetico(),
        headers: { Authorization: bearer(token) },
      });

      await validarContrato('auth.nao-admin', resposta);
    } finally {
      await excluirUsuario(request, usuario.id);
    }
  });

  test('criação com administrador cumpre o contrato', async ({ request }) => {
    const admin = await criarUsuarioAutenticado(request, 'true');

    try {
      const resposta = await request.post('/produtos', {
        data: produtoSintetico(),
        headers: { Authorization: bearer(admin.token) },
      });

      await validarContrato('produtos.criacao', resposta);
    } finally {
      await excluirUsuario(request, admin.usuario.id);
    }
  });

  test('nome duplicado cumpre o contrato de erro de negócio', async ({
    request,
  }) => {
    const admin = await criarUsuarioAutenticado(request, 'true');

    try {
      const produto = await criarProdutoTeste(request, admin.token);

      try {
        const resposta = await request.post('/produtos', {
          data: {
            nome: produto.nome,
            preco: produto.preco,
            descricao: produto.descricao,
            quantidade: produto.quantidade,
          },
          headers: { Authorization: bearer(admin.token) },
        });

        await validarContrato('produtos.nome-duplicado', resposta);
      } finally {
        await excluirProduto(request, admin.token, produto.id);
      }
    } finally {
      await excluirUsuario(request, admin.usuario.id);
    }
  });

  test('consulta de produto cumpre o contrato', async ({ request }) => {
    const admin = await criarUsuarioAutenticado(request, 'true');

    try {
      const produto = await criarProdutoTeste(request, admin.token);

      try {
        const resposta = await request.get(`/produtos/${produto.id}`);

        await validarContrato('produtos.item', resposta);
      } finally {
        await excluirProduto(request, admin.token, produto.id);
      }
    } finally {
      await excluirUsuario(request, admin.usuario.id);
    }
  });

  test('atualização de produto cumpre o contrato', async ({ request }) => {
    const admin = await criarUsuarioAutenticado(request, 'true');

    try {
      const produto = await criarProdutoTeste(request, admin.token);

      try {
        const resposta = await request.put(`/produtos/${produto.id}`, {
          data: {
            nome: gerarNomeProdutoUnico('Produto Atualizado'),
            preco: gerarPrecoUnico(),
            descricao: 'Produto atualizado na conferência de contrato',
            quantidade: gerarQuantidadeUnica(),
          },
          headers: { Authorization: bearer(admin.token) },
        });

        await validarContrato('produtos.atualizacao', resposta);
      } finally {
        await excluirProduto(request, admin.token, produto.id);
      }
    } finally {
      await excluirUsuario(request, admin.usuario.id);
    }
  });

  test('exclusão de produto cumpre o contrato', async ({ request }) => {
    const admin = await criarUsuarioAutenticado(request, 'true');

    try {
      const produto = await criarProdutoTeste(request, admin.token);

      const resposta = await request.delete(`/produtos/${produto.id}`, {
        headers: { Authorization: bearer(admin.token) },
      });

      await validarContrato('produtos.exclusao', resposta);
    } finally {
      await excluirUsuario(request, admin.usuario.id);
    }
  });
});

test.describe('Contratos da API — carrinhos', () => {
  test('listagem de carrinhos cumpre o contrato', async ({ request }) => {
    const resposta = await request.get('/carrinhos');

    await validarContrato('carrinhos.lista', resposta);
  });

  test('criação de carrinho cumpre o contrato', async ({ request }) => {
    const admin = await criarUsuarioAutenticado(request, 'true');
    const { usuario, token } = await criarUsuarioAutenticado(request, 'false');
    let produtoId = '';

    try {
      const produto = await criarProdutoTeste(request, admin.token, {
        quantidade: 5,
      });
      produtoId = produto.id;

      const resposta = await request.post('/carrinhos', {
        data: { produtos: [{ idProduto: produto.id, quantidade: 1 }] },
        headers: { Authorization: bearer(token) },
      });

      await validarContrato('carrinhos.criacao', resposta);
    } finally {
      await cancelarCompraSeguro(request, token);
      if (produtoId) {
        await excluirProduto(request, admin.token, produtoId);
      }
      await excluirUsuario(request, usuario.id);
      await excluirUsuario(request, admin.usuario.id);
    }
  });

  test('consulta de carrinho cumpre o contrato', async ({ request }) => {
    const admin = await criarUsuarioAutenticado(request, 'true');
    const { usuario, token } = await criarUsuarioAutenticado(request, 'false');
    let produtoId = '';

    try {
      const produto = await criarProdutoTeste(request, admin.token, {
        quantidade: 5,
      });
      produtoId = produto.id;

      const idCarrinho = await criarCarrinhoTeste(request, token, [
        { idProduto: produto.id, quantidade: 1 },
      ]);

      const resposta = await request.get(`/carrinhos/${idCarrinho}`);

      await validarContrato('carrinhos.item', resposta);
    } finally {
      await cancelarCompraSeguro(request, token);
      if (produtoId) {
        await excluirProduto(request, admin.token, produtoId);
      }
      await excluirUsuario(request, usuario.id);
      await excluirUsuario(request, admin.usuario.id);
    }
  });

  test('conclusão de compra cumpre o contrato', async ({ request }) => {
    const admin = await criarUsuarioAutenticado(request, 'true');
    const { usuario, token } = await criarUsuarioAutenticado(request, 'false');
    let produtoId = '';

    try {
      const produto = await criarProdutoTeste(request, admin.token, {
        quantidade: 5,
      });
      produtoId = produto.id;

      await criarCarrinhoTeste(request, token, [
        { idProduto: produto.id, quantidade: 1 },
      ]);

      const resposta = await request.delete('/carrinhos/concluir-compra', {
        headers: { Authorization: bearer(token) },
      });

      await validarContrato('carrinhos.conclusao', resposta);
    } finally {
      await cancelarCompraSeguro(request, token);
      if (produtoId) {
        await excluirProduto(request, admin.token, produtoId);
      }
      await excluirUsuario(request, usuario.id);
      await excluirUsuario(request, admin.usuario.id);
    }
  });

  test('cancelamento de compra cumpre o contrato', async ({ request }) => {
    const admin = await criarUsuarioAutenticado(request, 'true');
    const { usuario, token } = await criarUsuarioAutenticado(request, 'false');
    let produtoId = '';

    try {
      const produto = await criarProdutoTeste(request, admin.token, {
        quantidade: 5,
      });
      produtoId = produto.id;

      await criarCarrinhoTeste(request, token, [
        { idProduto: produto.id, quantidade: 1 },
      ]);

      const resposta = await request.delete('/carrinhos/cancelar-compra', {
        headers: { Authorization: bearer(token) },
      });

      await validarContrato('carrinhos.cancelamento', resposta);
    } finally {
      await cancelarCompraSeguro(request, token);
      if (produtoId) {
        await excluirProduto(request, admin.token, produtoId);
      }
      await excluirUsuario(request, usuario.id);
      await excluirUsuario(request, admin.usuario.id);
    }
  });
});
