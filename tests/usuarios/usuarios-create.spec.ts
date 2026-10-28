import { expect, test } from '../fixtures';
import {
  lerJson,
  MENSAGEM_CADASTRO_SUCESSO,
  type ErroValidacao,
  type MensagemResposta,
} from '../helpers/resposta';
import { validarMensagemComId, validarUsuario } from '../helpers/contrato';
import { validarContrato } from '../helpers/contratos';
import {
  excluirUsuario,
  gerarEmailUnico,
  gerarNomeUnico,
  MENSAGEM_EMAIL_EM_USO,
  type DadosUsuario,
  type ListaUsuarios,
  type UsuarioApi,
} from '../helpers/usuarios';

test.describe('Criação de usuários - POST /usuarios', () => {
  const idsCriados: string[] = [];

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirUsuario(request, id);
    }
  });

  test('deve criar um usuário com sucesso e persistir os dados @critico', async ({
    request,
  }) => {
    const dados: DadosUsuario = {
      nome: gerarNomeUnico('Usuário Criado'),
      email: gerarEmailUnico('usuario-create'),
      password: 'SenhaCriada@123',
      administrador: 'true',
    };

    const response = await request.post('/usuarios', { data: dados });

    const body = await lerJson<MensagemResposta>(response, 201);
    expect(body.message).toBe(MENSAGEM_CADASTRO_SUCESSO);
    validarMensagemComId(body);
    idsCriados.push(body._id!);

    await validarContrato('usuarios.criacao', response);

    const consulta = await request.get(`/usuarios/${body._id}`);
    const corpo = await lerJson<UsuarioApi>(consulta, 200);
    validarUsuario(corpo);
    expect(corpo._id).toBe(body._id);
    expect(corpo.nome).toBe(dados.nome);
    expect(corpo.email).toBe(dados.email);
    expect(corpo.administrador).toBe(dados.administrador);
    expect(corpo.password).toBe(dados.password);

    await validarContrato('usuarios.item', consulta);
  });

  test('deve rejeitar a criação com email duplicado', async ({ request }) => {
    const dados: DadosUsuario = {
      nome: gerarNomeUnico('Usuário Duplicado'),
      email: gerarEmailUnico('usuario-duplicado'),
      password: 'SenhaDuplicada@123',
      administrador: 'false',
    };

    const primeiro = await request.post('/usuarios', { data: dados });
    const primeiroBody = await lerJson<MensagemResposta>(primeiro, 201);
    expect(primeiroBody._id, 'o primeiro cadastro deve retornar um _id').toBeTruthy();
    idsCriados.push(primeiroBody._id!);

    const segundo = await request.post('/usuarios', { data: dados });

    const segundoBody = await lerJson<MensagemResposta>(segundo, 400);
    expect(segundoBody.message).toBe(MENSAGEM_EMAIL_EM_USO);
    expect(segundoBody).not.toHaveProperty('_id');

    await validarContrato('usuarios.email-duplicado', segundo);

    const consulta = await request.get('/usuarios', {
      params: { email: dados.email },
    });
    const lista = await lerJson<ListaUsuarios>(consulta, 200);
    expect(lista.quantidade).toBe(1);
    expect(lista.usuarios).toHaveLength(1);
    expect(lista.usuarios[0]._id).toBe(primeiroBody._id);
  });

  test('deve retornar erro ao criar usuário sem nome', async ({ request }) => {
    const response = await request.post('/usuarios', {
      data: {
        email: gerarEmailUnico('usuario-sem-nome'),
        password: 'Senha123',
        administrador: 'false',
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.nome).toBe('nome é obrigatório');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao criar usuário sem email', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Sem Email'),
        password: 'Senha123',
        administrador: 'false',
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.email).toBe('email é obrigatório');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao criar usuário sem password', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Sem Senha'),
        email: gerarEmailUnico('usuario-sem-password'),
        administrador: 'false',
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.password).toBe('password é obrigatório');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao criar usuário sem administrador', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Sem Admin'),
        email: gerarEmailUnico('usuario-sem-admin'),
        password: 'Senha123',
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.administrador).toBe('administrador é obrigatório');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao enviar payload vazio', async ({ request }) => {
    const response = await request.post('/usuarios', { data: {} });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.nome).toBe('nome é obrigatório');
    expect(body.email).toBe('email é obrigatório');
    expect(body.password).toBe('password é obrigatório');
    expect(body.administrador).toBe('administrador é obrigatório');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao criar usuário com email inválido', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Email Inválido'),
        email: 'email-invalido',
        password: 'Senha123',
        administrador: 'false',
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.email).toBe('email deve ser um email válido');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao criar usuário com nome vazio', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: '',
        email: gerarEmailUnico('usuario-nome-vazio'),
        password: 'Senha123',
        administrador: 'false',
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.nome).toBe('nome não pode ficar em branco');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao criar usuário com email vazio', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Email Vazio'),
        email: '',
        password: 'Senha123',
        administrador: 'false',
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.email).toBe('email não pode ficar em branco');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao criar usuário com password vazio', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Sem Senha'),
        email: gerarEmailUnico('usuario-password-vazio'),
        password: '',
        administrador: 'false',
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.password).toBe('password não pode ficar em branco');
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao criar usuário com administrador de tipo incorreto', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Admin Booleano'),
        email: gerarEmailUnico('usuario-admin-booleano'),
        password: 'Senha123',
        administrador: true,
      },
    });

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.administrador).toBe("administrador deve ser 'true' ou 'false'");
    expect(body).not.toHaveProperty('_id');

    await validarContrato('erros.validacao-campos', response);
  });
});