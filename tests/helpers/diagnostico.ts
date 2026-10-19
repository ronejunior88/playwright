const MARCADOR = '[REDACTED]';

const CHAVES_SENSIVEIS = new Set([
  'authorization',
  'auth',
  'password',
  'senha',
  'token',
  'access_token',
  'accesstoken',
  'refresh_token',
  'secret',
  'apikey',
  'api_key',
  'cookie',
  'set-cookie',
  'x-access-token',
]);

const PADROES_SENSIVEIS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

export function sanitizarTexto(texto: string): string {
  return PADROES_SENSIVEIS.reduce(
    (resultado, padrao) =>
      resultado.replace(padrao, (ocorrencia) =>
        ocorrencia.toLowerCase().startsWith('bearer')
          ? `Bearer ${MARCADOR}`
          : MARCADOR,
      ),
    texto,
  );
}

export function sanitizar(valor: unknown): unknown {
  if (typeof valor === 'string') {
    return sanitizarTexto(valor);
  }

  if (Array.isArray(valor)) {
    return valor.map((item) => sanitizar(item));
  }

  if (valor instanceof Error) {
    return { nome: valor.name, mensagem: sanitizarTexto(valor.message) };
  }

  if (valor && typeof valor === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [chave, conteudo] of Object.entries(
      valor as Record<string, unknown>,
    )) {
      saida[chave] = CHAVES_SENSIVEIS.has(chave.toLowerCase())
        ? MARCADOR
        : sanitizar(conteudo);
    }
    return saida;
  }

  return valor;
}

export function classificarStatus(status: number): string | undefined {
  if (status === 0) {
    return 'sem resposta da API (possível erro de rede ou timeout)';
  }
  if (status === 401) {
    return 'não autenticado (token ausente, inválido ou expirado)';
  }
  if (status === 403) {
    return 'acesso negado (autorização/administrador)';
  }
  if (status === 404) {
    return 'recurso não encontrado';
  }
  if (status === 429) {
    return 'limite de requisições atingido (instabilidade do ambiente compartilhado)';
  }
  if (status >= 500) {
    return 'erro do servidor (verificar indisponibilidade da API)';
  }
  return undefined;
}
