import { expect, type APIRequestContext } from '@playwright/test';
import { gerarSufixo } from './aleatorio';
import { executarLimpeza } from './limpeza';
import {
  lerJson,
  MENSAGEM_CADASTRO_SUCESSO,
  type MensagemResposta,
} from './resposta';

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

/** Mensagem devolvida quando o usuário não existe. */
export const MENSAGEM_USUARIO_NAO_ENCONTRADO = 'Usuário não encontrado';

/** Mensagem devolvida quando o e-mail informado já está em uso. */
export const MENSAGEM_EMAIL_EM_USO = 'Este email já está sendo usado';

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

  const body = await lerJson<MensagemResposta>(response, 201, 'criação de usuário');
  expect(body.message).toBe(MENSAGEM_CADASTRO_SUCESSO);
  expect(body._id, 'criação de usuário deve retornar um _id').toBeTruthy();

  return { id: body._id!, ...payload };
}

export async function excluirUsuario(
  request: APIRequestContext,
  id: string,
): Promise<void> {
  await executarLimpeza(`do usuário de teste ${id}`, () =>
    request.delete(`/usuarios/${id}`),
  );
}