import path from 'node:path';
import { expect, test } from '@playwright/test';
import { selecionar, type ResultadoSelecao } from '../../scripts/impacto/selecao';
import { carregarProjeto } from '../../scripts/impacto/projeto';

const SPECS = [
  'tests/auth/login.spec.ts',
  'tests/carrinhos/carrinhos-get.spec.ts',
  'tests/contratos/contratos.spec.ts',
  'tests/contratos/schema.spec.ts',
  'tests/impacto/selecao.spec.ts',
];

const DEPENDENTES: Record<string, string[]> = {
  'tests/helpers/autenticacao.ts': [
    'tests/auth/login.spec.ts',
    'tests/carrinhos/carrinhos-get.spec.ts',
  ],
  'tests/fixtures.ts': [
    'tests/auth/login.spec.ts',
    'tests/carrinhos/carrinhos-get.spec.ts',
    'tests/contratos/contratos.spec.ts',
    'tests/contratos/schema.spec.ts',
  ],
  'contracts/schema.ts': ['tests/contratos/schema.spec.ts'],
  'tests/helpers/cenario-carrinhos.ts': ['tests/carrinhos/carrinhos-get.spec.ts'],
};

function rodar(
  arquivos: Parameters<typeof selecionar>[0]['arquivos'],
  limiarCompleta?: number,
): ResultadoSelecao {
  return selecionar({
    arquivos,
    dependentes: DEPENDENTES,
    specs: SPECS,
    limiarCompleta,
  });
}

test.describe('seleção de testes por impacto', () => {
  test('alteração no teste de login seleciona apenas esse teste', () => {
    const resultado = rodar(['tests/auth/login.spec.ts']);
    expect(resultado.modo).toBe('direcionada');
    expect(resultado.nivel).toBe('B');
    expect(resultado.testes).toEqual(['tests/auth/login.spec.ts']);
    expect(resultado.latencia).toBe(false);
    expect(resultado.completaPor).toBeNull();
  });

  test('alteração no schema de contrato seleciona o teste de schema', () => {
    expect(rodar(['contracts/schema.ts']).testes).toEqual([
      'tests/contratos/schema.spec.ts',
    ]);
  });

  test('helper compartilhado seleciona todos os dependentes diretos', () => {
    const resultado = rodar(['tests/helpers/autenticacao.ts']);
    expect(resultado.modo).toBe('direcionada');
    expect(resultado.testes).toEqual([
      'tests/auth/login.spec.ts',
      'tests/carrinhos/carrinhos-get.spec.ts',
    ]);
  });

  test('helper que afeta a maior parte da suíte escala para regressão completa', () => {
    const resultado = rodar(['tests/fixtures.ts']);
    expect(resultado.modo).toBe('completa');
    expect(resultado.nivel).toBe('C');
    expect(resultado.completaPor).toContain('4 de 5');
  });

  test('limiar de 60% decide entre direcionada e completa', () => {
    expect(rodar(['tests/helpers/autenticacao.ts']).modo).toBe('direcionada');
    expect(rodar(['tests/fixtures.ts']).modo).toBe('completa');
  });

  for (const configuracao of [
    'playwright.config.ts',
    'playwright.latencia.config.ts',
    'tsconfig.json',
    'package.json',
    'package-lock.json',
  ]) {
    test(`configuração global ${configuracao} exige regressão completa`, () => {
      const resultado = rodar([configuracao]);
      expect(resultado.modo).toBe('completa');
      expect(resultado.motivos.join(' ')).toContain('configuração global');
    });
  }

  test('alteração apenas em documentação não executa testes de API', () => {
    const resultado = rodar(['docs/change-impact-analysis.md', 'README.md']);
    expect(resultado.modo).toBe('nenhum');
    expect(resultado.nivel).toBe('A');
    expect(resultado.testes).toEqual([]);
    expect(resultado.arquivosIgnorados).toEqual([
      'README.md',
      'docs/change-impact-analysis.md',
    ]);
  });

  test('arquivo desconhecido cai em regressão completa conservadora', () => {
    const resultado = rodar(['infra/desconhecido.cfg']);
    expect(resultado.modo).toBe('completa');
    expect(resultado.completaPor).toContain('arquivo desconhecido');
  });

  test('lista de arquivos ausente cai em regressão completa', () => {
    expect(rodar(undefined).modo).toBe('completa');
    expect(rodar(null).modo).toBe('completa');
  });

  test('lista vazia não executa testes', () => {
    const resultado = rodar([]);
    expect(resultado.modo).toBe('nenhum');
    expect(resultado.motivos.length).toBeGreaterThan(0);
  });

  test('múltiplos recursos combinam os testes afetados', () => {
    const resultado = rodar([
      'contracts/schema.ts',
      'tests/auth/login.spec.ts',
    ]);
    expect(resultado.modo).toBe('direcionada');
    expect(resultado.testes).toEqual([
      'tests/auth/login.spec.ts',
      'tests/contratos/schema.spec.ts',
    ]);
  });

  test('a ordem dos arquivos alterados não muda a seleção', () => {
    const direta = rodar([
      'contracts/schema.ts',
      'tests/helpers/autenticacao.ts',
    ]);
    const inversa = rodar([
      'tests/helpers/autenticacao.ts',
      'contracts/schema.ts',
    ]);
    expect(inversa).toEqual(direta);
  });

  test('a seleção é determinística entre execuções', () => {
    const arquivos = ['tests/fixtures.ts', 'contracts/schema.ts'];
    expect(rodar(arquivos)).toEqual(rodar(arquivos));
  });

  test('entradas duplicadas são deduplicadas', () => {
    expect(
      rodar([
        'contracts/schema.ts',
        'contracts/schema.ts',
        'contracts/schema.ts',
      ]).testes,
    ).toEqual(['tests/contratos/schema.spec.ts']);
  });

  test('exclusão de teste exige regressão completa', () => {
    const resultado = rodar([{ caminho: 'tests/auth/login.spec.ts', status: 'D' }]);
    expect(resultado.modo).toBe('completa');
    expect(resultado.completaPor).toContain('exclusão');
  });

  test('exclusão de documentação é ignorada', () => {
    const resultado = rodar([{ caminho: 'docs/antigo.md', status: 'D' }]);
    expect(resultado.modo).toBe('nenhum');
    expect(resultado.arquivosIgnorados).toContain('docs/antigo.md');
  });

  test('exclusão de helper compartilhado exige regressão completa', () => {
    const resultado = rodar([
      { caminho: 'tests/helpers/autenticacao.ts', status: 'D' },
    ]);
    expect(resultado.modo).toBe('completa');
  });

  test('renomeação de teste usa o novo caminho', () => {
    const resultado = rodar([
      {
        caminho: 'tests/auth/login-novo.spec.ts',
        status: 'R',
        caminhoAnterior: 'tests/auth/login.spec.ts',
      },
    ]);
    expect(resultado.modo).toBe('direcionada');
    expect(resultado.testes).toEqual(['tests/auth/login-novo.spec.ts']);
  });

  test('renomeação que muda a categoria exige regressão completa', () => {
    const resultado = rodar([
      {
        caminho: 'tests/helpers/login-renomeado.ts',
        status: 'R',
        caminhoAnterior: 'tests/auth/login.spec.ts',
      },
    ]);
    expect(resultado.modo).toBe('completa');
    expect(resultado.completaPor).toContain('muda a categoria');
  });

  test('renomeação de documentação continua sem testes', () => {
    const resultado = rodar([
      {
        caminho: 'docs/novo.md',
        status: 'R',
        caminhoAnterior: 'docs/antigo.md',
      },
    ]);
    expect(resultado.modo).toBe('nenhum');
    expect(resultado.arquivosIgnorados).toContain('docs/novo.md');
  });

  test('alteração no workflow exige regressão completa e aviso', () => {
    const resultado = rodar(['.github/workflows/playwright.yml']);
    expect(resultado.modo).toBe('completa');
    expect(resultado.avisos.join(' ')).toContain('GitHub Actions');
  });

  test('exclusão do workflow exige regressão completa', () => {
    expect(
      rodar([{ caminho: '.github/workflows/playwright.yml', status: 'D' }]).modo,
    ).toBe('completa');
  });

  test('alteração na suíte de latência agenda apenas a suíte de latência', () => {
    const resultado = rodar(['tests/performance/api-latency.spec.ts']);
    expect(resultado.modo).toBe('direcionada');
    expect(resultado.latencia).toBe(true);
    expect(resultado.testes).toEqual([]);
  });

  test('alteração na estratégia executa os testes da própria estratégia', () => {
    const resultado = rodar(['scripts/impacto/selecao.js']);
    expect(resultado.modo).toBe('direcionada');
    expect(resultado.testes).toEqual(['tests/impacto/selecao.spec.ts']);
  });

  test('alteração em configuração de ferramenta não agenda API', () => {
    const resultado = rodar(['stryker.conf.json']);
    expect(resultado.modo).toBe('nenhum');
    expect(resultado.avisos.length).toBeGreaterThan(0);
  });

  test('helper sem dependentes mapeados exige regressão completa', () => {
    const resultado = rodar(['tests/helpers/latencia.ts']);
    expect(resultado.modo).toBe('completa');
    expect(resultado.completaPor).toContain('nenhum teste dependente');
  });

  test('entrada inválida exige regressão completa', () => {
    const resultado = rodar([
      'contracts/schema.ts',
      null as unknown as string,
    ]);
    expect(resultado.modo).toBe('completa');
  });

  test('status Git não suportado exige regressão completa', () => {
    const resultado = rodar([{ caminho: 'tests/auth/login.spec.ts', status: 'U' }]);
    expect(resultado.modo).toBe('completa');
  });

  test('normaliza barras invertidas e prefixo relativo', () => {
    const resultado = rodar(['.\\tests\\auth\\login.spec.ts']);
    expect(resultado.testes).toEqual(['tests/auth/login.spec.ts']);
  });

  test('cópia de teste executa o novo caminho', () => {
    const resultado = rodar([
      {
        caminho: 'tests/auth/login-copia.spec.ts',
        status: 'C',
        caminhoAnterior: 'tests/auth/login.spec.ts',
      },
    ]);
    expect(resultado.testes).toEqual(['tests/auth/login-copia.spec.ts']);
  });

  test('lista de specs vazia exige regressão completa', () => {
    const resultado = selecionar({
      arquivos: ['contracts/schema.ts'],
      dependentes: DEPENDENTES,
      specs: [],
    });
    expect(resultado.modo).toBe('completa');
  });

  test('limiar inválido exige regressão completa', () => {
    expect(rodar(['contracts/schema.ts'], 0).modo).toBe('completa');
    expect(rodar(['contracts/schema.ts'], 1.5).modo).toBe('completa');
    expect(rodar(['contracts/schema.ts'], Number.NaN).modo).toBe('completa');
  });
});

test.describe('grafo real do projeto', () => {
  const raiz = path.resolve(__dirname, '..', '..');
  const projeto = carregarProjeto(raiz);

  test('mapeia specs principais, de performance e da estratégia', () => {
    expect(projeto.specs).toContain('tests/auth/login.spec.ts');
    expect(projeto.specs).toContain('tests/carrinhos/carrinhos-get.spec.ts');
    expect(projeto.specs).not.toContain('tests/performance/api-latency.spec.ts');
    expect(projeto.specsPerformance).toContain(
      'tests/performance/api-latency.spec.ts',
    );
    expect(projeto.specsSelecao).toContain('tests/impacto/selecao.spec.ts');
  });

  test('mapeia dependentes transitivos de helper compartilhado', () => {
    const dependentes = projeto.dependentes['tests/helpers/autenticacao.ts'];
    expect(dependentes).toContain('tests/auth/login.spec.ts');
    expect(dependentes).toContain('tests/carrinhos/carrinhos-get.spec.ts');
  });

  test('mapeia dependentes de contratos compartilhados', () => {
    const dependentes = projeto.dependentes['contracts/schema.ts'];
    expect(dependentes).toContain('tests/contratos/schema.spec.ts');
    expect(dependentes).toContain('tests/contratos/contratos.spec.ts');
  });

  test('seleção real de helper de carrinhos não inclui contratos', () => {
    const resultado = selecionar({
      arquivos: ['tests/helpers/cenario-carrinhos.ts'],
      dependentes: projeto.dependentes,
      specs: projeto.specs,
    });
    expect(resultado.modo).toBe('direcionada');
    expect(resultado.testes.length).toBeGreaterThan(0);
    for (const teste of resultado.testes) {
      expect(teste.startsWith('tests/carrinhos/')).toBe(true);
    }
    expect(resultado.testes).not.toContain('tests/contratos/schema.spec.ts');
  });
});
