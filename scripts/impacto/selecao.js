const path = require('node:path');

const LIMIAR_COMPLETA = 0.6;

const CONFIGURACOES_GLOBAIS = new Set([
  'playwright.config.ts',
  'playwright.latencia.config.ts',
  'tsconfig.json',
  'package.json',
  'package-lock.json',
]);

const CONFIGURACOES_SEM_TESTES = new Set([
  'stryker.conf.json',
  '.gitignore',
  '.editorconfig',
]);

function normalizarCaminho(caminho) {
  if (typeof caminho !== 'string') return '';
  const semEspacos = caminho.trim().replace(/\\/g, '/');
  if (!semEspacos) return '';
  const normalizado = path.posix.normalize(semEspacos);
  return normalizado === '.' ? '' : normalizado.replace(/^\.\//, '');
}

function categoria(caminho) {
  if (!caminho) return 'invalido';
  if (caminho.endsWith('.md')) return 'documentacao';
  if (caminho.startsWith('.github/workflows/')) return 'workflow';
  if (caminho.startsWith('.github/')) return 'configuracao-ci';
  if (CONFIGURACOES_SEM_TESTES.has(caminho)) return 'sem-testes';
  if (CONFIGURACOES_GLOBAIS.has(caminho)) return 'configuracao-global';
  if (caminho.startsWith('tests/performance/')) return 'performance';
  if (caminho.startsWith('tests/') && caminho.endsWith('.spec.ts')) return 'teste';
  if (caminho.startsWith('scripts/')) return 'selecao';
  if (caminho.startsWith('tests/') || caminho.startsWith('contracts/')) return 'codigo';
  return 'desconhecido';
}

function selecionar(opcoes = {}) {
  const {
    arquivos,
    dependentes = {},
    specs = [],
    limiarCompleta = LIMIAR_COMPLETA,
  } = opcoes;

  const motivos = [];
  const avisos = [];
  const ignorados = [];
  const selecionados = new Set();
  let latencia = false;

  const registrarMotivo = (motivo) => {
    if (!motivos.includes(motivo)) motivos.push(motivo);
  };
  const registrarAviso = (aviso) => {
    if (!avisos.includes(aviso)) avisos.push(aviso);
  };
  const completa = (motivo) => {
    registrarMotivo(motivo);
    return {
      modo: 'completa',
      nivel: 'C',
      testes: [],
      latencia: false,
      motivos: [...motivos],
      avisos: [...avisos],
      arquivosIgnorados: [...ignorados].sort(),
      completaPor: motivo,
    };
  };

  if (!Array.isArray(arquivos)) {
    return completa(
      'lista de arquivos alterados ausente ou inválida; impacto inconclusivo',
    );
  }
  if (!Array.isArray(specs) || specs.length === 0) {
    return completa(
      'lista de testes do projeto ausente; não é possível avaliar impacto',
    );
  }
  if (
    typeof limiarCompleta !== 'number' ||
    !Number.isFinite(limiarCompleta) ||
    limiarCompleta <= 0 ||
    limiarCompleta > 1
  ) {
    return completa('limiar de regressão completa inválido; impacto inconclusivo');
  }

  const specsNormalizadas = [...new Set(specs.map(normalizarCaminho))]
    .filter(Boolean)
    .sort();
  const specsSet = new Set(specsNormalizadas);

  const alteracoes = [];
  for (const item of arquivos) {
    if (typeof item === 'string') {
      const caminho = normalizarCaminho(item);
      if (!caminho) {
        return completa('entrada de alteração vazia; impacto inconclusivo');
      }
      alteracoes.push({ caminho, status: 'M', caminhoAnterior: null });
      continue;
    }
    if (!item || typeof item !== 'object' || typeof item.caminho !== 'string') {
      return completa('entrada de alteração inválida; impacto inconclusivo');
    }
    const caminho = normalizarCaminho(item.caminho);
    const caminhoAnterior = item.caminhoAnterior
      ? normalizarCaminho(item.caminhoAnterior)
      : null;
    if (!caminho) {
      return completa('entrada de alteração vazia; impacto inconclusivo');
    }
    alteracoes.push({
      caminho,
      status: item.status || 'M',
      caminhoAnterior,
    });
  }

  const vistos = new Set();
  const alteracoesUnicas = alteracoes
    .filter((alteracao) => {
      const chave = `${alteracao.status}|${alteracao.caminho}|${alteracao.caminhoAnterior ?? ''}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .sort((a, b) => {
      const chaveA = `${a.caminho}|${a.status}|${a.caminhoAnterior ?? ''}`;
      const chaveB = `${b.caminho}|${b.status}|${b.caminhoAnterior ?? ''}`;
      if (chaveA < chaveB) return -1;
      if (chaveA > chaveB) return 1;
      return 0;
    });

  if (alteracoesUnicas.length === 0) {
    return {
      modo: 'nenhum',
      nivel: 'A',
      testes: [],
      latencia: false,
      motivos: ['nenhum arquivo alterado; nada a executar além das validações locais'],
      avisos: [],
      arquivosIgnorados: [],
      completaPor: null,
    };
  }

  const specsSelecao = specsNormalizadas.filter((spec) =>
    spec.startsWith('tests/impacto/'),
  );

  for (const alteracao of alteracoesUnicas) {
    const { caminho, status, caminhoAnterior } = alteracao;
    const categoriaAtual = categoria(caminho);
    const categoriaAnterior = caminhoAnterior ? categoria(caminhoAnterior) : null;

    if (!['A', 'M', 'D', 'R', 'C'].includes(status)) {
      return completa(
        `status Git não suportado (${status}) em ${caminho}; impacto inconclusivo`,
      );
    }

    if (status === 'D') {
      if (categoriaAtual === 'documentacao' || categoriaAtual === 'sem-testes') {
        ignorados.push(caminho);
        registrarMotivo(
          `exclusão de documentação ou configuração sem teste de API: ${caminho}`,
        );
        continue;
      }
      return completa(
        `exclusão de ${caminho} exige revisão e regressão completa`,
      );
    }

    if (status === 'R') {
      if (!categoriaAnterior) {
        return completa(
          `renomeação de ${caminho} sem caminho anterior; impacto inconclusivo`,
        );
      }
      if (categoriaAnterior !== categoriaAtual) {
        return completa(
          `renomeação de ${caminhoAnterior} para ${caminho} muda a categoria do arquivo; impacto inconclusivo`,
        );
      }
    }

    if (categoriaAtual === 'invalido') {
      return completa(`caminho inválido (${caminho}); impacto inconclusivo`);
    }

    if (categoriaAtual === 'documentacao') {
      ignorados.push(caminho);
      registrarMotivo(`alteração documental sem teste de API: ${caminho}`);
      continue;
    }

    if (categoriaAtual === 'sem-testes') {
      ignorados.push(caminho);
      registrarAviso(
        `configuração de ferramenta alterada (${caminho}); valide manualmente quando aplicável`,
      );
      continue;
    }

    if (categoriaAtual === 'workflow') {
      registrarAviso(
        `workflow alterado (${caminho}); a execução real no GitHub Actions é a validação do pipeline`,
      );
      return completa(
        `alteração no workflow do CI (${caminho}) exige regressão completa`,
      );
    }

    if (categoriaAtual === 'configuracao-ci') {
      return completa(
        `alteração de configuração de CI (${caminho}) exige regressão completa`,
      );
    }

    if (categoriaAtual === 'configuracao-global') {
      return completa(
        `alteração de configuração global (${caminho}) exige regressão completa`,
      );
    }

    if (categoriaAtual === 'performance') {
      latencia = true;
      registrarMotivo(`suíte de latência isolada afetada: ${caminho}`);
      continue;
    }

    if (categoriaAtual === 'teste') {
      selecionados.add(caminho);
      registrarMotivo(`alteração do próprio teste: ${caminho}`);
      continue;
    }

    if (categoriaAtual === 'selecao') {
      if (specsSelecao.length === 0) {
        return completa(
          `alteração na lógica de seleção (${caminho}) sem testes próprios mapeados; impacto inconclusivo`,
        );
      }
      for (const spec of specsSelecao) selecionados.add(spec);
      registrarMotivo(
        `alteração na estratégia de seleção (${caminho}); executar os testes da própria estratégia`,
      );
      continue;
    }

    if (categoriaAtual === 'codigo') {
      const dependentesBrutos = dependentes[caminho];
      if (!Array.isArray(dependentesBrutos) || dependentesBrutos.length === 0) {
        return completa(
          `nenhum teste dependente mapeado para ${caminho}; impacto inconclusivo`,
        );
      }
      const dependentesValidos = [
        ...new Set(dependentesBrutos.map(normalizarCaminho)),
      ]
        .filter((spec) => specsSet.has(spec))
        .sort();
      if (dependentesValidos.length === 0) {
        return completa(
          `dependentes de ${caminho} não pertencem à suíte principal; impacto inconclusivo`,
        );
      }
      if (dependentesValidos.length / specsNormalizadas.length >= limiarCompleta) {
        return completa(
          `${caminho} afeta ${dependentesValidos.length} de ${specsNormalizadas.length} testes (limiar ${Math.round(
            limiarCompleta * 100,
          )}%); regressão completa`,
        );
      }
      for (const spec of dependentesValidos) selecionados.add(spec);
      registrarMotivo(
        `${caminho} afeta ${dependentesValidos.length} teste(s) dependente(s)`,
      );
      continue;
    }

    return completa(
      `arquivo desconhecido (${caminho}); impacto inconclusivo, regressão completa por precaução`,
    );
  }

  if (selecionados.size === 0 && !latencia) {
    if (motivos.length === 0) {
      registrarMotivo('nenhuma alteração exige testes de API');
    }
    return {
      modo: 'nenhum',
      nivel: 'A',
      testes: [],
      latencia: false,
      motivos,
      avisos,
      arquivosIgnorados: [...ignorados].sort(),
      completaPor: null,
    };
  }

  return {
    modo: 'direcionada',
    nivel: 'B',
    testes: [...selecionados].sort(),
    latencia,
    motivos,
    avisos,
    arquivosIgnorados: [...ignorados].sort(),
    completaPor: null,
  };
}

module.exports = {
  LIMIAR_COMPLETA,
  normalizarCaminho,
  categoria,
  selecionar,
};
