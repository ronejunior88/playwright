const fs = require('node:fs');
const path = require('node:path');

const DIRETORIOS_IGNORADOS = new Set([
  'node_modules',
  '.git',
  '.stryker-tmp',
  'reports',
  'test-results',
  'playwright-report',
  'performance-results',
]);

function paraPosix(caminho) {
  return caminho.split(path.sep).join('/');
}

function listarArquivos(diretorio) {
  if (!fs.existsSync(diretorio)) return [];
  const resultado = [];
  for (const entrada of fs.readdirSync(diretorio, { withFileTypes: true })) {
    if (DIRETORIOS_IGNORADOS.has(entrada.name)) continue;
    const completo = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      resultado.push(...listarArquivos(completo));
    } else if (entrada.isFile()) {
      resultado.push(completo);
    }
  }
  return resultado;
}

function extrairImportacoes(conteudo) {
  const importacoes = [];
  const regex = /(?:from\s+|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;
  let encontrado;
  while ((encontrado = regex.exec(conteudo))) {
    importacoes.push(encontrado[1]);
  }
  return importacoes;
}

function resolverImportacao(arquivoAbsoluto, especificador) {
  if (!especificador.startsWith('.')) return null;
  const base = path.resolve(path.dirname(arquivoAbsoluto), especificador);
  const candidatos = [base];
  if (base.endsWith('.js')) candidatos.push(base.replace(/\.js$/, '.ts'));
  candidatos.push(`${base}.ts`, path.join(base, 'index.ts'));
  for (const candidato of candidatos) {
    try {
      if (fs.statSync(candidato).isFile()) return candidato;
    } catch {
      continue;
    }
  }
  return null;
}

function listarArquivosFonte(raiz) {
  const arquivos = [];
  for (const pasta of ['tests', 'contracts']) {
    for (const arquivo of listarArquivos(path.join(raiz, pasta))) {
      if (arquivo.endsWith('.ts')) arquivos.push(arquivo);
    }
  }
  return arquivos.sort();
}

function listarSpecs(raiz) {
  const testes = listarArquivos(path.join(raiz, 'tests'))
    .filter((arquivo) => arquivo.endsWith('.spec.ts'))
    .map((arquivo) => paraPosix(path.relative(raiz, arquivo)))
    .sort();
  return {
    principais: testes.filter((spec) => !spec.startsWith('tests/performance/')),
    performance: testes.filter((spec) => spec.startsWith('tests/performance/')),
  };
}

function construirDependentes(raiz, specsPrincipais) {
  const arquivos = listarArquivosFonte(raiz);
  const importa = new Map();

  for (const arquivo of arquivos) {
    const relativo = paraPosix(path.relative(raiz, arquivo));
    const conteudo = fs.readFileSync(arquivo, 'utf8');
    const destinos = new Set();
    for (const especificador of extrairImportacoes(conteudo)) {
      const resolvido = resolverImportacao(arquivo, especificador);
      if (resolvido) destinos.add(paraPosix(path.relative(raiz, resolvido)));
    }
    importa.set(relativo, [...destinos].sort());
  }

  const dependentes = {};
  for (const spec of specsPrincipais) {
    if (!importa.has(spec)) continue;
    const visitados = new Set();
    const pilha = [...(importa.get(spec) ?? [])];
    while (pilha.length > 0) {
      const atual = pilha.pop();
      if (!atual || visitados.has(atual)) continue;
      visitados.add(atual);
      for (const proximo of importa.get(atual) ?? []) pilha.push(proximo);
    }
    for (const dependente of visitados) {
      if (!dependentes[dependente]) dependentes[dependente] = [];
      dependentes[dependente].push(spec);
    }
  }

  for (const chave of Object.keys(dependentes)) {
    dependentes[chave] = [...new Set(dependentes[chave])].sort();
  }
  return dependentes;
}

function carregarProjeto(raiz = process.cwd()) {
  const raizAbsoluta = path.resolve(raiz);
  const specs = listarSpecs(raizAbsoluta);
  return {
    raiz: raizAbsoluta,
    specs: specs.principais,
    specsPerformance: specs.performance,
    specsSelecao: specs.principais.filter((spec) =>
      spec.startsWith('tests/impacto/'),
    ),
    dependentes: construirDependentes(raizAbsoluta, specs.principais),
  };
}

module.exports = {
  carregarProjeto,
  construirDependentes,
  listarSpecs,
  resolverImportacao,
  extrairImportacoes,
};
