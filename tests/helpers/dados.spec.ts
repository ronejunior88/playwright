import { expect, test } from '@playwright/test';
import { criarGeradorSufixos, gerarSufixo } from './aleatorio';
import {
  gerarNomeProdutoUnico,
  gerarPrecoAleatorio,
  gerarQuantidadeAleatoria,
  montarDadosProduto,
} from './produtos';
import {
  gerarEmailUnico,
  gerarIdUnico,
  gerarNomeUnico,
  gerarSenhaUnica,
  montarDadosUsuario,
  SENHA_PADRAO,
} from './usuarios';

const FORMATO_SUFIXO = /^[a-z0-9]+-[a-z0-9]+-[a-f0-9]+$/;

test.describe('Geração de dados de teste', () => {
  test('gera sufixos únicos e no formato esperado', () => {
    const sufixos = new Set(Array.from({ length: 200 }, () => gerarSufixo()));

    expect(sufixos.size).toBe(200);

    for (const sufixo of sufixos) {
      expect(sufixo).toMatch(FORMATO_SUFIXO);
    }
  });

  test('gera a mesma sequência para a mesma semente e o mesmo instante', () => {
    const opcoes = { agora: 1_700_000_000_000, semente: 'semente-fixa' };
    const primeiro = criarGeradorSufixos(opcoes);
    const segundo = criarGeradorSufixos(opcoes);

    expect([primeiro(), primeiro(), primeiro()]).toEqual([
      segundo(),
      segundo(),
      segundo(),
    ]);
  });

  test('sementes diferentes produzem sufixos diferentes', () => {
    const primeiro = criarGeradorSufixos({
      agora: 1,
      semente: 'semente-a',
    })();
    const segundo = criarGeradorSufixos({
      agora: 1,
      semente: 'semente-b',
    })();

    expect(primeiro).not.toBe(segundo);
  });

  test('uma semente sozinha também torna a geração determinística', () => {
    const primeiro = criarGeradorSufixos({ semente: 'reproduzivel' })();
    const segundo = criarGeradorSufixos({ semente: 'reproduzivel' })();

    expect(primeiro).toBe(segundo);
    expect(primeiro.startsWith('0-1-')).toBe(true);
  });

  test('gera identificadores hexadecimais de 16 caracteres', () => {
    const ids = new Set(Array.from({ length: 200 }, () => gerarIdUnico()));

    expect(ids.size).toBe(200);

    for (const id of ids) {
      expect(id).toMatch(/^[a-f0-9]{16}$/);
    }
  });

  test('gera e-mails, nomes e senhas únicos', () => {
    const emails = new Set(
      Array.from({ length: 100 }, () => gerarEmailUnico('usuario-teste')),
    );
    const nomes = new Set(
      Array.from({ length: 100 }, () => gerarNomeUnico('Usuário Teste')),
    );
    const senhas = new Set(
      Array.from({ length: 100 }, () => gerarSenhaUnica('SenhaFiltro')),
    );

    expect(emails.size).toBe(100);
    expect(nomes.size).toBe(100);
    expect(senhas.size).toBe(100);
    expect([...emails][0]).toMatch(
      /^usuario-teste-[a-z0-9]+-[a-z0-9]+-[a-f0-9]+@example\.com$/,
    );
    expect([...nomes][0]).toContain('Usuário Teste');
    expect([...senhas][0]).toMatch(/^SenhaFiltro@[a-f0-9]{12}$/);
  });

  test('monta usuário padrão com dados sintéticos e permite sobrescrever', () => {
    const padrao = montarDadosUsuario();

    expect(padrao.nome).toContain('Usuário de Teste');
    expect(padrao.email).toMatch(/^usuario-test-.+@example\.com$/);
    expect(padrao.password).toBe(SENHA_PADRAO);
    expect(padrao.administrador).toBe('false');

    const sobrescrito = montarDadosUsuario({
      nome: 'Nome Informado',
      email: 'informado@example.com',
      password: 'SenhaInformada@123',
      administrador: 'true',
    });

    expect(sobrescrito).toEqual({
      nome: 'Nome Informado',
      email: 'informado@example.com',
      password: 'SenhaInformada@123',
      administrador: 'true',
    });
  });

  test('gera usuários distintos a cada montagem', () => {
    const primeiro = montarDadosUsuario();
    const segundo = montarDadosUsuario();

    expect(primeiro.email).not.toBe(segundo.email);
    expect(primeiro.nome).not.toBe(segundo.nome);
  });

  test('monta produto padrão dentro das faixas e permite sobrescrever', () => {
    const padrao = montarDadosProduto();

    expect(padrao.nome).toContain('Produto Playwright QA');
    expect(padrao.descricao).toContain(
      'Produto criado pelo teste automatizado em',
    );
    expect(Number.isInteger(padrao.preco)).toBe(true);
    expect(padrao.preco).toBeGreaterThanOrEqual(1);
    expect(padrao.preco).toBeLessThanOrEqual(100_000);
    expect(Number.isInteger(padrao.quantidade)).toBe(true);
    expect(padrao.quantidade).toBeGreaterThanOrEqual(0);
    expect(padrao.quantidade).toBeLessThanOrEqual(99);

    const sobrescrito = montarDadosProduto({
      nome: 'Produto Informado',
      preco: 123,
      descricao: 'Descrição informada',
      quantidade: 7,
    });

    expect(sobrescrito).toEqual({
      nome: 'Produto Informado',
      preco: 123,
      descricao: 'Descrição informada',
      quantidade: 7,
    });
  });

  test('gera produtos distintos a cada montagem', () => {
    const primeiro = montarDadosProduto();
    const segundo = montarDadosProduto();

    expect(primeiro.nome).not.toBe(segundo.nome);
    expect(primeiro.descricao).not.toBe(segundo.descricao);
  });

  test('gera preços e quantidades dentro das faixas esperadas', () => {
    for (let i = 0; i < 200; i += 1) {
      const preco = gerarPrecoAleatorio();
      const quantidade = gerarQuantidadeAleatoria();

      expect(Number.isInteger(preco)).toBe(true);
      expect(preco).toBeGreaterThanOrEqual(1);
      expect(preco).toBeLessThanOrEqual(100_000);
      expect(Number.isInteger(quantidade)).toBe(true);
      expect(quantidade).toBeGreaterThanOrEqual(0);
      expect(quantidade).toBeLessThanOrEqual(99);
    }
  });
});
