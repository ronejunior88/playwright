import { expect } from '@playwright/test';

function esperarObjeto(corpo: unknown, contexto: string): Record<string, unknown> {
  expect(corpo, `${contexto} deve existir`).toBeTruthy();
  expect(typeof corpo, `${contexto} deve ser um objeto`).toBe('object');
  return corpo as Record<string, unknown>;
}

function esperarString(valor: unknown, campo: string): string {
  expect(typeof valor, `${campo} deve ser string`).toBe('string');
  return valor as string;
}

function esperarNumero(valor: unknown, campo: string): number {
  expect(typeof valor, `${campo} deve ser número`).toBe('number');
  expect(Number.isFinite(valor as number), `${campo} deve ser um número finito`).toBe(
    true,
  );
  return valor as number;
}

function esperarArray(valor: unknown, campo: string): unknown[] {
  expect(Array.isArray(valor), `${campo} deve ser um array`).toBe(true);
  return valor as unknown[];
}

export function validarUsuario(corpo: unknown): void {
  const usuario = esperarObjeto(corpo, 'usuário');
  esperarString(usuario._id, '_id');
  esperarString(usuario.nome, 'nome');
  esperarString(usuario.email, 'email');
  esperarString(usuario.password, 'password');
  const administrador = esperarString(usuario.administrador, 'administrador');
  expect(['true', 'false'], 'administrador deve ser "true" ou "false"').toContain(
    administrador,
  );
}

export function validarProduto(corpo: unknown): void {
  const produto = esperarObjeto(corpo, 'produto');
  esperarString(produto._id, '_id');
  esperarString(produto.nome, 'nome');
  esperarString(produto.descricao, 'descricao');
  const preco = esperarNumero(produto.preco, 'preco');
  expect(preco, 'preco deve ser positivo').toBeGreaterThan(0);
  const quantidade = esperarNumero(produto.quantidade, 'quantidade');
  expect(Number.isInteger(quantidade), 'quantidade deve ser inteira').toBe(true);
  expect(quantidade, 'quantidade deve ser maior ou igual a 0').toBeGreaterThanOrEqual(0);
}

export function validarItemCarrinho(corpo: unknown): void {
  const item = esperarObjeto(corpo, 'item do carrinho');
  esperarString(item.idProduto, 'idProduto');
  const precoUnitario = esperarNumero(item.precoUnitario, 'precoUnitario');
  expect(precoUnitario, 'precoUnitario deve ser positivo').toBeGreaterThan(0);
  const quantidade = esperarNumero(item.quantidade, 'quantidade');
  expect(quantidade, 'quantidade do item deve ser positiva').toBeGreaterThan(0);
}

export function validarCarrinho(corpo: unknown): void {
  const carrinho = esperarObjeto(corpo, 'carrinho');
  esperarString(carrinho._id, '_id');
  esperarString(carrinho.idUsuario, 'idUsuario');
  esperarNumero(carrinho.precoTotal, 'precoTotal');
  esperarNumero(carrinho.quantidadeTotal, 'quantidadeTotal');
  const produtos = esperarArray(carrinho.produtos, 'produtos');
  for (const item of produtos) {
    validarItemCarrinho(item);
  }
}

export function validarListaUsuarios(corpo: unknown): void {
  const lista = esperarObjeto(corpo, 'listagem de usuários');
  esperarNumero(lista.quantidade, 'quantidade');
  for (const usuario of esperarArray(lista.usuarios, 'usuarios')) {
    validarUsuario(usuario);
  }
}

export function validarListaProdutos(corpo: unknown): void {
  const lista = esperarObjeto(corpo, 'listagem de produtos');
  esperarNumero(lista.quantidade, 'quantidade');
  for (const produto of esperarArray(lista.produtos, 'produtos')) {
    validarProduto(produto);
  }
}

export function validarListaCarrinhos(corpo: unknown): void {
  const lista = esperarObjeto(corpo, 'listagem de carrinhos');
  esperarNumero(lista.quantidade, 'quantidade');
  for (const carrinho of esperarArray(lista.carrinhos, 'carrinhos')) {
    validarCarrinho(carrinho);
  }
}

export function validarMensagemComId(corpo: unknown): void {
  const corpoMensagem = esperarObjeto(corpo, 'resposta de cadastro');
  const message = esperarString(corpoMensagem.message, 'message');
  expect(message.length, 'message não pode ser vazio').toBeGreaterThan(0);
  const id = esperarString(corpoMensagem._id, '_id');
  expect(id.length, '_id não pode ser vazio').toBeGreaterThan(0);
}

export function validarErroDeCampos(corpo: unknown): void {
  const erro = esperarObjeto(corpo, 'corpo de erro');
  const chaves = Object.keys(erro);
  expect(chaves.length, 'o corpo de erro deve apontar ao menos um problema').toBeGreaterThan(
    0,
  );
  expect(erro._id, 'resposta de erro não deve conter _id').toBeUndefined();
  for (const chave of chaves) {
    expect(typeof erro[chave], `mensagem de erro em "${chave}" deve ser texto`).toBe(
      'string',
    );
  }
}
