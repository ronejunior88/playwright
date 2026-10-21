import { expect, test } from '@playwright/test';
import {
  classificarStatus,
  sanitizar,
  sanitizarTexto,
} from './diagnostico';

// Valor sensível usado apenas como entrada das asserções. Nunca é impresso no
// terminal: as verificações são feitas por comparação, sem ecoar o conteúdo.
const TOKEN_JWT_FALSO =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0ZSJ9.assinatura-falsa-123456';
const SEGREDO_TEXTO = 'valor-secreto-nao-deve-vazar';
const MARCADOR = '[REDACTED]';

test.describe('Sanitizador de diagnóstico', () => {
  test('substitui senha, token, authorization e cookie em objetos planos', () => {
    const entrada = {
      password: SEGREDO_TEXTO,
      senha: SEGREDO_TEXTO,
      token: SEGREDO_TEXTO,
      authorization: `Bearer ${SEGREDO_TEXTO}`,
      cookie: SEGREDO_TEXTO,
      'set-cookie': SEGREDO_TEXTO,
      secret: SEGREDO_TEXTO,
      apiKey: SEGREDO_TEXTO,
      campoNormal: 'valor-publico',
    };

    const saida = sanitizar(entrada) as Record<string, unknown>;

    for (const chave of [
      'password',
      'senha',
      'token',
      'authorization',
      'cookie',
      'set-cookie',
      'secret',
      'apiKey',
    ]) {
      expect(saida[chave], `${chave} deve ser mascarado`).toBe(MARCADOR);
    }
    expect(saida.campoNormal).toBe('valor-publico');
  });

  test('reconhece chaves sensíveis sem diferenciar maiúsculas/minúsculas', () => {
    const entrada = {
      Authorization: `Bearer ${SEGREDO_TEXTO}`,
      PASSWORD: SEGREDO_TEXTO,
      Token: SEGREDO_TEXTO,
    };

    const saida = sanitizar(entrada) as Record<string, unknown>;
    expect(saida.Authorization).toBe(MARCADOR);
    expect(saida.PASSWORD).toBe(MARCADOR);
    expect(saida.Token).toBe(MARCADOR);
  });

  test('mascara chaves sensíveis em objetos aninhados', () => {
    const entrada = {
      usuario: {
        email: 'teste@example.com',
        credenciais: {
          password: SEGREDO_TEXTO,
          token: SEGREDO_TEXTO,
        },
      },
    };

    const saida = sanitizar(entrada) as {
      usuario: { email: string; credenciais: Record<string, string> };
    };

    expect(saida.usuario.email).toBe('teste@example.com');
    expect(saida.usuario.credenciais.password).toBe(MARCADOR);
    expect(saida.usuario.credenciais.token).toBe(MARCADOR);
  });

  test('mascara valores sensíveis dentro de arrays', () => {
    const entrada = [
      { metodo: 'GET', status: 200 },
      { authorization: `Bearer ${SEGREDO_TEXTO}` },
    ];

    const saida = sanitizar(entrada) as Array<Record<string, unknown>>;
    expect(saida[0]).toEqual({ metodo: 'GET', status: 200 });
    expect(saida[1].authorization).toBe(MARCADOR);
  });

  test('substitui tokens Bearer e JWTs presentes em texto livre', () => {
    const texto = `Falha ao usar Bearer ${SEGREDO_TEXTO} e o JWT ${TOKEN_JWT_FALSO}`;
    const resultado = sanitizarTexto(texto);

    expect(resultado).not.toContain(SEGREDO_TEXTO);
    expect(resultado).not.toContain(TOKEN_JWT_FALSO);
    expect(resultado).toContain('[REDACTED]');
  });

  test('não altera strings sem conteúdo sensível', () => {
    const texto = 'GET https://serverest.dev/usuarios 200 em 42 ms';
    expect(sanitizarTexto(texto)).toBe(texto);
  });

  test('preserva o prefixo Bearer ao mascarar o valor do token', () => {
    const resultado = sanitizarTexto(`Bearer ${SEGREDO_TEXTO}`);
    expect(resultado).toBe('Bearer [REDACTED]');
    expect(resultado).not.toContain(SEGREDO_TEXTO);
  });

  test('converte instâncias de Error mascarando a mensagem sensível', () => {
    const erro = new Error(`request failed with token Bearer ${SEGREDO_TEXTO}`);
    const saida = sanitizar(erro) as { nome: string; mensagem: string };

    expect(saida.nome).toBe('Error');
    expect(saida.mensagem).not.toContain(SEGREDO_TEXTO);
    expect(saida.mensagem).toContain('[REDACTED]');
  });

  test('não muta o objeto original recebido', () => {
    const entrada = { password: SEGREDO_TEXTO, token: SEGREDO_TEXTO };
    const copia = { ...entrada };

    sanitizar(entrada);

    expect(entrada).toEqual(copia);
    expect(entrada.password).toBe(SEGREDO_TEXTO);
  });

  test('mascara a chave Authorization do histórico de requisições', () => {
    const historico = [
      {
        metodo: 'POST',
        endpoint: 'https://serverest.dev/produtos',
        status: 401,
        duracaoMs: 12,
        dica: 'não autenticado (token ausente, inválido ou expirado)',
        Authorization: `Bearer ${TOKEN_JWT_FALSO}`,
      },
    ];

    const saida = sanitizar(historico) as Array<Record<string, unknown>>;
    expect(saida[0].Authorization).toBe(MARCADOR);
    expect(JSON.stringify(saida)).not.toContain(TOKEN_JWT_FALSO);
  });
});

test.describe('Classificação de status para diagnóstico', () => {
  test('classifica os status relevantes de segurança', () => {
    expect(classificarStatus(0)).toContain('sem resposta');
    expect(classificarStatus(401)).toContain('não autenticado');
    expect(classificarStatus(403)).toContain('acesso negado');
    expect(classificarStatus(404)).toContain('não encontrado');
    expect(classificarStatus(429)).toContain('limite de requisições');
    expect(classificarStatus(500)).toContain('erro do servidor');
  });

  test('retorna indefinido para status sem tratamento específico', () => {
    expect(classificarStatus(200)).toBeUndefined();
    expect(classificarStatus(400)).toBeUndefined();
  });
});
