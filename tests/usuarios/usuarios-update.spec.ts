import { expect, test } from '../fixtures';
import {
  type ErroValidacao,
  lerJson,
  MENSAGEM_ALTERADO_SUCESSO,
  MENSAGEM_CADASTRO_SUCESSO,
  type MensagemResposta,
} from '../helpers/resposta';
import { validarContrato } from '../helpers/contratos';
import {
  criarUsuarioTeste,
  excluirUsuario,
  gerarEmailUnico,
  gerarIdUnico,
  gerarNomeUnico,
  MENSAGEM_EMAIL_EM_USO,
  type DadosUsuario,
  type UsuarioApi,
  type UsuarioCriado,
} from '../helpers/usuarios';

test.describe('Atualização de usuários - PUT /usuarios/{_id}', () => {
  let usuarioBase: UsuarioCriado;
  const idsCriados: string[] = [];

  test.beforeAll(async ({ request }) => {
    usuarioBase = await criarUsuarioTeste(request);
  });

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirUsuario(request, id);
    }
  });

  test.afterAll(async ({ request }) => {
    await excluirUsuario(request, usuarioBase.id);
  });

  test('deve atualizar um usuário existente e persistir as alterações @critico', async ({
    request,
  }) => {
    const usuario = await criarUsuarioTeste(request);
    idsCriados.push(usuario.id);

    const dadosAtualizados: DadosUsuario = {
      nome: `${usuario.nome} Atualizado`,
      email: gerarEmailUnico('usuario-atualizado'),
      password: 'SenhaAtualizada@123',
      administrador: 'true',
    };

    const response = await request.put(`/usuarios/${usuario.id}`, {
      data: dadosAtualizados,
    });

    const body = await lerJson<MensagemResposta>(response, 200);
    expect(body.message).toBe(MENSAGEM_ALTERADO_SUCESSO);

    await validarContrato('usuarios.atualizacao', response);

    const consulta = await request.get(`/usuarios/${usuario.id}`);
    const corpo = await lerJson<UsuarioApi>(consulta, 200);
    expect(corpo._id).toBe(usuario.id);
    expect(corpo.nome).toBe(dadosAtualizados.nome);
    expect(corpo.email).toBe(dadosAtualizados.email);
    expect(corpo.administrador).toBe(dadosAtualizados.administrador);
    expect(typeof corpo.password).toBe('string');
    expect(corpo.password.length).toBeGreaterThan(0);

    await validarContrato('usuarios.item', consulta);
  });

  test('deve rejeitar atualização utilizando email de outro usuário', async ({
    request,
  }) => {
    const usuarioA = await criarUsuarioTeste(request);
    const usuarioB = await criarUsuarioTeste(request);
    idsCriados.push(usuarioA.id, usuarioB.id);

    const response = await request.put(`/usuarios/${usuarioA.id}`, {
      data: {
        nome: usuarioA.nome,
        email: usuarioB.email,
        password: usuarioA.password,
        administrador: usuarioA.administrador,
      },
    });

    const body = await lerJson<MensagemResposta>(response, 400);
    expect(body.message).toBe(MENSAGEM_EMAIL_EM_USO);

    await validarContrato('usuarios.email-duplicado', response);

    const consultaA = await request.get(`/usuarios/${usuarioA.id}`);
    const corpoA = await lerJson<UsuarioApi>(consultaA, 200);
    expect(corpoA.email).toBe(usuarioA.email);

    const consultaB = await request.get(`/usuarios/${usuarioB.id}`);
    const corpoB = await lerJson<UsuarioApi>(consultaB, 200);
    expect(corpoB.email).toBe(usuarioB.email);
  });

  test('deve criar um novo usuário ao atualizar com id inexistente', async ({
    request,
  }) => {
    const id = gerarIdUnico();

    const consultaPrevia = await request.get(`/usuarios/${id}`);
    expect(consultaPrevia.status()).toBe(400);

    const dados: DadosUsuario = {
      nome: gerarNomeUnico('Usuário Via Put'),
      email: gerarEmailUnico('usuario-via-put'),
      password: 'SenhaPut@123',
      administrador: 'false',
    };

    const response = await request.put(`/usuarios/${id}`, { data: dados });

    const body = await lerJson<MensagemResposta>(response, 201);
    expect(body.message).toBe(MENSAGEM_CADASTRO_SUCESSO);
    expect(typeof body._id).toBe('string');
    expect(body._id!.length).toBeGreaterThan(0);

    // PUT com id inexistente cria o registro: a resposta segue o formato de
    // criação (201 + message + _id), verificado pelo mesmo contrato.
    await validarContrato('usuarios.criacao', response);

    idsCriados.push(body._id!);

    const consulta = await request.get(`/usuarios/${body._id}`);
    const corpo = await lerJson<UsuarioApi>(consulta, 200);
    expect(corpo.nome).toBe(dados.nome);
    expect(corpo.email).toBe(dados.email);
    expect(corpo.administrador).toBe(dados.administrador);
  });

  test('deve retornar erro ao atualizar sem nome', async ({ request }) => {
    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: {
        email: usuarioBase.email,
        password: usuarioBase.password,
        administrador: usuarioBase.administrador,
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.nome).toBe('nome é obrigatório');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao atualizar sem email', async ({ request }) => {
    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: {
        nome: usuarioBase.nome,
        password: usuarioBase.password,
        administrador: usuarioBase.administrador,
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.email).toBe('email é obrigatório');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao atualizar sem password', async ({ request }) => {
    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: {
        nome: usuarioBase.nome,
        email: usuarioBase.email,
        administrador: usuarioBase.administrador,
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.password).toBe('password é obrigatório');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao atualizar sem administrador', async ({
    request,
  }) => {
    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: {
        nome: usuarioBase.nome,
        email: usuarioBase.email,
        password: usuarioBase.password,
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.administrador).toBe('administrador é obrigatório');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao atualizar com payload vazio', async ({
    request,
  }) => {
    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: {},
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.nome).toBe('nome é obrigatório');
    expect(body.email).toBe('email é obrigatório');
    expect(body.password).toBe('password é obrigatório');
    expect(body.administrador).toBe('administrador é obrigatório');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao atualizar com dados de tipos incompatíveis', async ({
    request,
  }) => {
    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: {
        nome: usuarioBase.nome,
        email: usuarioBase.email,
        password: usuarioBase.password,
        administrador: true,
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.administrador).toBe("administrador deve ser 'true' ou 'false'");
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });
});