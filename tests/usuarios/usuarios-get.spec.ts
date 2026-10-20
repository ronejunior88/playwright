import { expect, test } from '../fixtures';
import {
  validarErroDeCampos,
  validarListaUsuarios,
  validarUsuario,
} from '../helpers/contrato';
import {
  criarUsuarioTeste,
  excluirUsuario,
  gerarIdUnico,
  gerarNomeUnico,
  type ErroValidacao,
  type ListaUsuarios,
  type MensagemResposta,
  type UsuarioApi,
} from '../helpers/usuarios';

test.describe('Consulta de usuários - GET /usuarios', () => {
  const idsCriados: string[] = [];

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirUsuario(request, id);
    }
  });

  test('deve listar usuários com estrutura válida', async ({ request }) => {
    const response = await request.get('/usuarios');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaUsuarios;

    expect(body).toHaveProperty('quantidade');
    expect(typeof body.quantidade).toBe('number');

    expect(body).toHaveProperty('usuarios');
    expect(Array.isArray(body.usuarios)).toBe(true);

    validarListaUsuarios(body);
    expect(body.quantidade).toBe(body.usuarios.length);
  });

  test('deve retornar somente o usuário esperado ao filtrar por id', async ({
    request,
  }) => {
    const usuario = await criarUsuarioTeste(request);
    idsCriados.push(usuario.id);

    const response = await request.get('/usuarios', {
      params: { _id: usuario.id },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaUsuarios;
    expect(body.quantidade).toBe(1);
    expect(body.usuarios).toHaveLength(1);
    expect(body.usuarios[0]._id).toBe(usuario.id);
  });

  test('deve filtrar usuários por nome', async ({ request }) => {
    const usuario = await criarUsuarioTeste(request);
    idsCriados.push(usuario.id);

    const response = await request.get('/usuarios', {
      params: { nome: usuario.nome },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaUsuarios;
    expect(body.quantidade).toBeGreaterThanOrEqual(1);

    for (const usuarioEncontrado of body.usuarios) {
      expect(usuarioEncontrado.nome).toBe(usuario.nome);
    }

    const usuariosCriados = body.usuarios.filter(
      (u) => u._id === usuario.id,
    );
    expect(usuariosCriados).toHaveLength(1);
  });

  test('deve filtrar usuários por email', async ({ request }) => {
    const usuario = await criarUsuarioTeste(request);
    idsCriados.push(usuario.id);

    const response = await request.get('/usuarios', {
      params: { email: usuario.email },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaUsuarios;
    expect(body.quantidade).toBe(1);
    expect(body.usuarios).toHaveLength(1);
    expect(body.usuarios[0]._id).toBe(usuario.id);
    expect(body.usuarios[0].email).toBe(usuario.email);
  });

  test('deve filtrar usuários por administrador', async ({ request }) => {
    const usuario = await criarUsuarioTeste(request, { administrador: 'true' });
    idsCriados.push(usuario.id);

    const response = await request.get('/usuarios', {
      params: { administrador: 'true' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaUsuarios;
    expect(body.quantidade).toBeGreaterThanOrEqual(1);

    for (const usuarioEncontrado of body.usuarios) {
      expect(usuarioEncontrado.administrador).toBe('true');
    }

    const usuariosCriados = body.usuarios.filter(
      (u) => u._id === usuario.id,
    );
    expect(usuariosCriados).toHaveLength(1);
  });

  test('deve filtrar usuários por password', async ({ request }) => {
    const senhaExclusiva = 'SenhaFiltroPassword@123';
    const usuario = await criarUsuarioTeste(request, { password: senhaExclusiva });
    idsCriados.push(usuario.id);

    const response = await request.get('/usuarios', {
      params: { password: senhaExclusiva },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaUsuarios;
    validarListaUsuarios(body);

    for (const usuarioEncontrado of body.usuarios) {
      expect(usuarioEncontrado.password).toBe(senhaExclusiva);
    }

    const usuariosCriados = body.usuarios.filter((u) => u._id === usuario.id);
    expect(usuariosCriados).toHaveLength(1);

    const semCorrespondencia = await request.get('/usuarios', {
      params: { password: 'senha-que-nao-existe-9f3a1' },
    });

    expect(semCorrespondencia.status()).toBe(200);

    const corpoVazio = (await semCorrespondencia.json()) as ListaUsuarios;
    validarListaUsuarios(corpoVazio);
    expect(corpoVazio.quantidade).toBe(0);
    expect(corpoVazio.usuarios).toHaveLength(0);
  });

  test('deve filtrar usuários por nome e administrador combinados', async ({
    request,
  }) => {
    const usuario = await criarUsuarioTeste(request, {
      administrador: 'true',
      nome: gerarNomeUnico('Filtro Combinado'),
    });
    idsCriados.push(usuario.id);

    const response = await request.get('/usuarios', {
      params: { nome: usuario.nome, administrador: 'true' },
    });

    expect(response.status()).toBe(200);

    const body = (await response.json()) as ListaUsuarios;
    validarListaUsuarios(body);

    for (const encontrado of body.usuarios) {
      expect(encontrado.nome).toBe(usuario.nome);
      expect(encontrado.administrador).toBe('true');
    }

    const conflitante = await request.get('/usuarios', {
      params: { nome: usuario.nome, administrador: 'false' },
    });

    expect(conflitante.status()).toBe(200);

    const corpoConflitante = (await conflitante.json()) as ListaUsuarios;
    validarListaUsuarios(corpoConflitante);
    expect(corpoConflitante.quantidade).toBe(0);
    expect(corpoConflitante.usuarios).toHaveLength(0);
  });

  test('deve rejeitar filtro de query com chave não permitida', async ({
    request,
  }) => {
    const response = await request.get('/usuarios', {
      params: { chave_nao_documentada: '1' },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as Record<string, string>;
    validarErroDeCampos(body);
    expect(body.chave_nao_documentada).toBe(
      'chave_nao_documentada não é permitido',
    );
    expect(body).not.toHaveProperty('usuarios');
    expect(body).not.toHaveProperty('quantidade');
  });

  test('deve consultar um usuário por id válido', async ({ request }) => {
    const usuario = await criarUsuarioTeste(request);
    idsCriados.push(usuario.id);

    const response = await request.get(`/usuarios/${usuario.id}`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as UsuarioApi;
    validarUsuario(body);
    expect(body._id).toBe(usuario.id);
    expect(body.nome).toBe(usuario.nome);
    expect(body.email).toBe(usuario.email);
    expect(body.administrador).toBe(usuario.administrador);
    expect(body.password).toBe(usuario.password);
  });

  test('deve retornar erro ao consultar usuário inexistente', async ({
    request,
  }) => {
    const id = gerarIdUnico();

    const response = await request.get(`/usuarios/${id}`);

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Usuário não encontrado');
    expect(body).not.toHaveProperty('nome');
  });

  test('deve retornar erro ao consultar usuário com id de formato inválido', async ({
    request,
  }) => {
    const response = await request.get('/usuarios/id-invalido');

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.id).toBe('id deve ter exatamente 16 caracteres alfanuméricos');
  });
});