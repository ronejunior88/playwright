import { expect, type APIRequestContext } from '@playwright/test';

export interface DadosUsuario {
  nome: string;
  email: string;
  password: string;
  administrador: string;
}

export interface UsuarioApi extends DadosUsuario {
  _id: string;
}

export interface UsuarioCriado extends DadosUsuario {
  id: string;
}

export interface ListaUsuarios {
  quantidade: number;
  usuarios: UsuarioApi[];
}

export interface MensagemResposta {
  message?: string;
  _id?: string;
}

export interface ErroValidacao {
  nome?: string;
  email?: string;
  password?: string;
  administrador?: string;
  id?: string;
  message?: string;
}

function gerarSufixo(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function gerarEmailUnico(prefixo: string): string {
  return `${prefixo}-${gerarSufixo()}@example.com`;
}

export function gerarNomeUnico(prefixo: string): string {
  return `${prefixo} ${gerarSufixo()}`;
}

export function gerarIdUnico(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export async function criarUsuarioTeste(
  request: APIRequestContext,
  dados: Partial<DadosUsuario> = {},
): Promise<UsuarioCriado> {
  const payload: DadosUsuario = {
    nome: dados.nome ?? gerarNomeUnico('Usuário de Teste'),
    email: dados.email ?? gerarEmailUnico('usuario-test'),
    password: dados.password ?? 'SenhaTeste@123',
    administrador: dados.administrador ?? 'false',
  };

  const response = await request.post('/usuarios', { data: payload });

  expect(response.status()).toBe(201);

  const body = (await response.json()) as MensagemResposta;
  expect(body._id, 'criação de usuário deve retornar um _id').toBeTruthy();

  return { id: body._id!, ...payload };
}

export async function excluirUsuario(
  request: APIRequestContext,
  id: string,
): Promise<void> {
  try {
    const response = await request.delete(`/usuarios/${id}`);
    if (response.status() !== 200) {
      console.warn(
        `Cleanup do usuário de teste ${id} falhou (status ${response.status()}).`,
      );
    }
  } catch {
    console.warn(`Cleanup do usuário de teste ${id} falhou.`);
  }
}