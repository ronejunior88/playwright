const fs = require('node:fs');
const path = require('node:path');
const { selecionar } = require('./impacto/selecao');
const { carregarProjeto } = require('./impacto/projeto');

function lerArgumentos(argv) {
  const opcoes = {
    arquivos: null,
    completa: false,
    motivo: null,
    json: false,
    githubOutput: false,
    saidaJson: null,
  };
  for (let indice = 0; indice < argv.length; indice += 1) {
    const argumento = argv[indice];
    if (argumento === '--arquivos') {
      opcoes.arquivos = argv[indice + 1];
      indice += 1;
    } else if (argumento === '--completa') {
      opcoes.completa = true;
    } else if (argumento === '--motivo') {
      opcoes.motivo = argv[indice + 1];
      indice += 1;
    } else if (argumento === '--json') {
      opcoes.json = true;
    } else if (argumento === '--github-output') {
      opcoes.githubOutput = true;
    } else if (argumento === '--saida-json') {
      opcoes.saidaJson = argv[indice + 1];
      indice += 1;
    } else {
      throw new Error(`argumento desconhecido: ${argumento}`);
    }
  }
  return opcoes;
}

function lerAlteracoes(caminho) {
  const conteudo = fs.readFileSync(caminho, 'utf8').replace(/^\uFEFF/, '');
  const alteracoes = [];
  for (const linha of conteudo.split(/\r?\n/)) {
    const texto = linha.trim();
    if (!texto) continue;
    const partes = texto.split('\t');
    if (partes.length >= 2 && /^(A|M|D|R\d*|C\d*|T|U|X|B)$/.test(partes[0])) {
      const status = partes[0][0];
      if (status === 'R' || status === 'C') {
        const anterior = partes[1];
        const atual = partes[2];
        if (!atual) throw new Error(`renomeação sem destino: ${texto}`);
        alteracoes.push({
          caminho: atual,
          status: status === 'C' ? 'A' : status,
          caminhoAnterior: anterior,
        });
      } else {
        if (!partes[1]) throw new Error(`alteração sem caminho: ${texto}`);
        alteracoes.push({ caminho: partes[1], status });
      }
      continue;
    }
    alteracoes.push({ caminho: texto, status: 'M' });
  }
  return alteracoes;
}

function resultadoCompleto(motivo) {
  return {
    modo: 'completa',
    nivel: 'C',
    testes: [],
    latencia: false,
    motivos: [motivo],
    avisos: [],
    arquivosIgnorados: [],
    completaPor: motivo,
  };
}

function sanitizarValor(valor) {
  return String(valor).replace(/[\r\n]+/g, ' ').trim().slice(0, 3500);
}

function escreverGithubOutput(resultado) {
  const destino = process.env.GITHUB_OUTPUT;
  if (!destino) {
    process.stderr.write(
      'aviso: --github-output solicitado sem GITHUB_OUTPUT; saída ignorada\n',
    );
    return;
  }
  const linhas = [
    `modo=${sanitizarValor(resultado.modo)}`,
    `nivel=${sanitizarValor(resultado.nivel)}`,
    `testes=${sanitizarValor(resultado.testes.join(' '))}`,
    `latencia=${resultado.latencia ? 'true' : 'false'}`,
    `motivos=${sanitizarValor(resultado.motivos.join(' | '))}`,
    `avisos=${sanitizarValor(resultado.avisos.join(' | '))}`,
    `completa_por=${sanitizarValor(resultado.completaPor ?? '')}`,
  ];
  fs.appendFileSync(destino, `${linhas.join('\n')}\n`, 'utf8');
}

function imprimirHumano(resultado) {
  const linhas = [
    'Seleção de testes por impacto',
    `Modo: ${resultado.modo} (nível ${resultado.nivel})`,
    `Testes selecionados: ${resultado.testes.length}`,
    ...resultado.testes.map((teste) => `  - ${teste}`),
    `Suíte de latência: ${resultado.latencia ? 'sim' : 'não'}`,
    'Motivos:',
    ...resultado.motivos.map((motivo) => `  - ${motivo}`),
  ];
  if (resultado.arquivosIgnorados.length > 0) {
    linhas.push('Ignorados (sem testes de API):');
    linhas.push(...resultado.arquivosIgnorados.map((arquivo) => `  - ${arquivo}`));
  }
  if (resultado.avisos.length > 0) {
    linhas.push('Avisos:');
    linhas.push(...resultado.avisos.map((aviso) => `  - ${aviso}`));
  }
  process.stdout.write(`${linhas.join('\n')}\n`);
}

function main() {
  let opcoes;
  try {
    opcoes = lerArgumentos(process.argv.slice(2));
  } catch (erro) {
    process.stderr.write(`${erro.message}\n`);
    process.stderr.write(
      'uso: node scripts/selecionar-testes.js --arquivos <arquivo> [--json] [--github-output] [--saida-json <arquivo>]\n' +
        '     node scripts/selecionar-testes.js --completa --motivo "<motivo>" [--github-output]\n',
    );
    process.exitCode = 2;
    return;
  }

  if (!opcoes.completa && !opcoes.arquivos) {
    process.stderr.write('informe --arquivos ou --completa\n');
    process.exitCode = 2;
    return;
  }

  let resultado;
  if (opcoes.completa) {
    resultado = resultadoCompleto(
      opcoes.motivo || 'regressão completa solicitada explicitamente',
    );
  } else {
    try {
      const raiz = path.resolve(__dirname, '..');
      const projeto = carregarProjeto(raiz);
      const alteracoes = lerAlteracoes(opcoes.arquivos);
      resultado = selecionar({
        arquivos: alteracoes,
        dependentes: projeto.dependentes,
        specs: projeto.specs,
      });
    } catch (erro) {
      resultado = resultadoCompleto(
        `falha ao analisar o impacto (${erro.message}); regressão completa por precaução`,
      );
      resultado.avisos.push(
        'a análise de impacto falhou; os motivos podem estar incompletos',
      );
    }
  }

  if (opcoes.saidaJson) {
    const destino = path.resolve(process.cwd(), opcoes.saidaJson);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, `${JSON.stringify(resultado, null, 2)}\n`, 'utf8');
  }

  if (opcoes.githubOutput) escreverGithubOutput(resultado);

  if (opcoes.json) {
    process.stdout.write(`${JSON.stringify(resultado, null, 2)}\n`);
  } else {
    imprimirHumano(resultado);
  }
}

main();
