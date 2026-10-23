import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '../fixtures';
import {
  CONTRATOS,
  ContratoDesconhecidoError,
  buscarContrato,
  filtrarContratos,
  listarContratos,
  tipoMime,
  verificarContrato,
  type Contrato,
} from '../../contracts';

/**
 * Testes do **registro de contratos** (`contracts/contratos.ts`).
 *
 * São locais: validam a consistência do registro e o comportamento do
 * verificador usando os exemplos sintéticos, sem tocar na API.
 */

const METODOS_VALIDOS = new Set(['GET', 'POST', 'PUT', 'DELETE']);
const FONTES_VALIDAS = new Set([
  'documentacao',
  'observado',
  'documentacao+observado',
]);
const SITUACOES_VALIDAS = new Set([
  'confirmado',
  'parcialmente-validado',
  'pendente-de-confirmacao',
  'divergente',
]);
const EXIGENCIAS_VALIDAS = new Set(['nenhuma', 'token', 'administrador']);

function respostaDeReferencia(contrato: Contrato) {
  return {
    status: contrato.status,
    contentType: contrato.contentType,
    corpo: contrato.exemploValido,
  };
}

function capturarErro(acao: () => void): Error {
  try {
    acao();
  } catch (erro) {
    return erro as Error;
  }
  throw new Error('esperava que a ação lançasse um erro');
}

test.describe('Registro de contratos — consistência', () => {
  test('não possui identificadores duplicados', () => {
    const identificadores = CONTRATOS.map((contrato) => contrato.id);

    expect(new Set(identificadores).size).toBe(identificadores.length);
  });

  test('todo contrato declara método, endpoint, status e content-type válidos', () => {
    for (const contrato of CONTRATOS) {
      expect(METODOS_VALIDOS.has(contrato.metodo), contrato.id).toBe(true);
      expect(contrato.endpoint.startsWith('/'), contrato.id).toBe(true);
      expect(contrato.status, contrato.id).toBeGreaterThanOrEqual(200);
      expect(contrato.status, contrato.id).toBeLessThan(600);
      expect(contrato.contentType, contrato.id).toBe('application/json');
      expect(EXIGENCIAS_VALIDAS.has(contrato.autenticacao), contrato.id).toBe(true);
    }
  });

  test('todo contrato declara fonte e situação dentro do conjunto conhecido', () => {
    for (const contrato of CONTRATOS) {
      expect(FONTES_VALIDAS.has(contrato.fonte), contrato.id).toBe(true);
      expect(SITUACOES_VALIDAS.has(contrato.situacao), contrato.id).toBe(true);
    }
  });

  test('todo contrato é confirmado por ao menos um teste existente', () => {
    for (const contrato of CONTRATOS) {
      expect(contrato.confirmadoPor.length, contrato.id).toBeGreaterThan(0);
      for (const arquivo of contrato.confirmadoPor) {
        expect(
          existsSync(resolve(process.cwd(), arquivo)),
          `${contrato.id} referencia arquivo inexistente: ${arquivo}`,
        ).toBe(true);
      }
    }
  });

  test('todo contrato divergente ou parcial explica a situação em observações', () => {
    for (const contrato of CONTRATOS) {
      if (
        contrato.situacao === 'divergente' ||
        contrato.situacao === 'parcialmente-validado'
      ) {
        expect(contrato.observacoes, contrato.id).toBeTruthy();
      }
    }
  });

  test('o exemplo válido de cada contrato cumpre o próprio schema', () => {
    for (const contrato of CONTRATOS) {
      const verificacao = verificarContrato(
        contrato.id,
        respostaDeReferencia(contrato),
      );

      expect(
        verificacao.incompativeis.map((divergencia) => divergencia.mensagem),
        contrato.id,
      ).toEqual([]);
      expect(verificacao.valido, contrato.id).toBe(true);
    }
  });

  test('todo contrato incompatível possui mensagem de diagnóstico legível', () => {
    for (const contrato of CONTRATOS) {
      const verificacao = verificarContrato(contrato.id, {
        status: contrato.status,
        contentType: contrato.contentType,
        corpo: 'não é um objeto válido',
      });

      for (const divergencia of verificacao.incompativeis) {
        expect(divergencia.mensagem.length, contrato.id).toBeGreaterThan(0);
        expect(divergencia.esperado.length, contrato.id).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Registro de contratos — verificação de respostas', () => {
  test('aprova a resposta de referência de cada contrato', () => {
    for (const contrato of CONTRATOS) {
      const verificacao = verificarContrato(
        contrato.id,
        respostaDeReferencia(contrato),
      );

      expect(verificacao.valido, contrato.id).toBe(true);
      expect(verificacao.incompativeis, contrato.id).toEqual([]);
    }
  });

  test('detecta status HTTP divergente', () => {
    const verificacao = verificarContrato('usuarios.lista', {
      status: 500,
      contentType: 'application/json',
      corpo: { quantidade: 0, usuarios: [] },
    });

    expect(verificacao.valido).toBe(false);
    expect(
      verificacao.incompativeis.map((divergencia) => divergencia.categoria),
    ).toContain('status-incompativel');
  });

  test('detecta content-type divergente', () => {
    const verificacao = verificarContrato('usuarios.lista', {
      status: 200,
      contentType: 'text/html; charset=utf-8',
      corpo: { quantidade: 0, usuarios: [] },
    });

    expect(verificacao.valido).toBe(false);
    expect(
      verificacao.incompativeis.map((divergencia) => divergencia.categoria),
    ).toContain('content-type-incompativel');
  });

  test('detecta campo obrigatório ausente no corpo', () => {
    const verificacao = verificarContrato('usuarios.item', {
      status: 200,
      contentType: 'application/json',
      corpo: { _id: 'a1b2c3d4e5f6g7h8', nome: 'Exemplo' },
    });

    expect(verificacao.valido).toBe(false);
    expect(
      verificacao.incompativeis.map((divergencia) => divergencia.caminho),
    ).toContain('email');
  });

  test('detecta tipo incompatível em campo do corpo', () => {
    const verificacao = verificarContrato('usuarios.item', {
      status: 200,
      contentType: 'application/json',
      corpo: {
        _id: 'a1b2c3d4e5f6g7h8',
        nome: 'Exemplo',
        email: 'exemplo@example.com',
        password: 'senha-ficticia',
        administrador: true,
      },
    });

    expect(verificacao.valido).toBe(false);
    expect(
      verificacao.incompativeis.map((divergencia) => divergencia.caminho),
    ).toContain('administrador');
  });

  test('aceita campo adicional como divergência compatível', () => {
    const verificacao = verificarContrato('usuarios.item', {
      status: 200,
      contentType: 'application/json',
      corpo: {
        _id: 'a1b2c3d4e5f6g7h8',
        nome: 'Exemplo',
        email: 'exemplo@example.com',
        password: 'senha-ficticia',
        administrador: 'false',
        campoNovo: 'valor',
      },
    });

    expect(verificacao.valido).toBe(true);
    expect(
      verificacao.compativeis.map((divergencia) => divergencia.categoria),
    ).toEqual(['campo-adicional']);
  });

  test('detecta corpo que não é JSON válido', () => {
    const verificacao = verificarContrato('usuarios.item', {
      status: 200,
      contentType: 'application/json',
      corpoTexto: '<html>erro</html>',
    });

    expect(verificacao.valido).toBe(false);
    expect(
      verificacao.incompativeis.map((divergencia) => divergencia.categoria),
    ).toContain('estrutura-incompativel');
  });

  test('detecta quebra da invariante de quantidade da lista', () => {
    const verificacao = verificarContrato('produtos.lista', {
      status: 200,
      contentType: 'application/json',
      corpo: {
        quantidade: 5,
        produtos: [
          {
            _id: 'a1b2c3d4e5f6g7h8',
            nome: 'Produto',
            descricao: 'Descrição',
            preco: 10,
            quantidade: 1,
          },
        ],
      },
    });

    expect(verificacao.valido).toBe(false);
    expect(
      verificacao.incompativeis.map((divergencia) => divergencia.categoria),
    ).toContain('valor-incompativel');
  });

  test('detecta corpo que não é objeto no lugar da lista', () => {
    const verificacao = verificarContrato('produtos.lista', {
      status: 200,
      contentType: 'application/json',
      corpo: { quantidade: 1, produtos: { nome: 'Produto' } },
    });

    expect(verificacao.valido).toBe(false);
    expect(
      verificacao.incompativeis.map((divergencia) => divergencia.categoria),
    ).toContain('estrutura-incompativel');
  });
});

test.describe('Registro de contratos — diagnóstico e precedência', () => {
  test('descreve status divergente no caminho e na mensagem', () => {
    const verificacao = verificarContrato('usuarios.lista', {
      status: 500,
      contentType: 'application/json',
      corpo: { quantidade: 0, usuarios: [] },
    });

    const divergencia = verificacao.incompativeis.find(
      (item) => item.categoria === 'status-incompativel',
    );

    expect(divergencia).toBeDefined();
    expect(divergencia!.caminho).toBe('(status)');
    expect(divergencia!.esperado).toBe('status 200');
    expect(divergencia!.mensagem).toContain('status 200');
  });

  test('descreve content-type divergente e ausente', () => {
    const divergente = verificarContrato('usuarios.lista', {
      status: 200,
      contentType: 'text/html',
      corpo: { quantidade: 0, usuarios: [] },
    }).incompativeis.find(
      (item) => item.categoria === 'content-type-incompativel',
    );

    expect(divergente).toBeDefined();
    expect(divergente!.caminho).toBe('(content-type)');
    expect(divergente!.esperado).toBe('content-type application/json');
    expect(divergente!.mensagem).toContain('content-type application/json');
    expect(divergente!.recebido).not.toBe('ausente');

    const ausente = verificarContrato('usuarios.lista', {
      status: 200,
      contentType: null,
      corpo: { quantidade: 0, usuarios: [] },
    }).incompativeis.find(
      (item) => item.categoria === 'content-type-incompativel',
    );

    expect(ausente).toBeDefined();
    expect(ausente!.mensagem).toContain('recebido ausente');
  });

  test('descreve corpo inválido no caminho e na mensagem', () => {
    const verificacao = verificarContrato('usuarios.item', {
      status: 200,
      contentType: 'application/json',
      corpoTexto: '<html>erro</html>',
    });

    const divergencia = verificacao.incompativeis.find(
      (item) => item.categoria === 'estrutura-incompativel',
    );

    expect(divergencia).toBeDefined();
    expect(divergencia!.caminho).toBe('(corpo)');
    expect(divergencia!.esperado).toBe('JSON válido');
    expect(divergencia!.mensagem).toContain('esperado JSON válido');
  });

  test('prioriza o corpo já convertido sobre o texto bruto', () => {
    const verificacao = verificarContrato('usuarios.lista', {
      status: 200,
      contentType: 'application/json',
      corpo: { quantidade: 0, usuarios: [] },
      corpoTexto: 'conteúdo que não é JSON',
    });

    expect(verificacao.divergencias).toEqual([]);
    expect(verificacao.valido).toBe(true);
  });

  test('não valida corpo quando a resposta não informa conteúdo', () => {
    const verificacao = verificarContrato('usuarios.lista', {
      status: 200,
      contentType: 'application/json',
    });

    expect(verificacao.divergencias).toEqual([]);
    expect(verificacao.valido).toBe(true);
  });

  test('separa divergências incompatíveis das compatíveis', () => {
    const verificacao = verificarContrato('usuarios.item', {
      status: 200,
      contentType: 'application/json',
      corpo: {
        _id: 'a1b2c3d4e5f6g7h8',
        nome: 'Exemplo',
        email: 'exemplo@example.com',
        password: 'senha-ficticia',
        administrador: true,
        campoNovo: 'valor',
      },
    });

    expect(verificacao.incompativeis.map((item) => item.categoria)).toEqual([
      'tipo-incompativel',
    ]);
    expect(verificacao.compativeis.map((item) => item.categoria)).toEqual([
      'campo-adicional',
    ]);
    expect(verificacao.divergencias).toHaveLength(2);
    expect(verificacao.valido).toBe(false);
  });
});

test.describe('Registro de contratos — consultas', () => {
  test('buscarContrato devolve o contrato solicitado', () => {
    expect(buscarContrato('login.sucesso').metodo).toBe('POST');
  });

  test('buscarContrato falha com erro tipado para identificador desconhecido', () => {
    const erro = capturarErro(() => buscarContrato('contrato.inexistente'));

    expect(erro).toBeInstanceOf(ContratoDesconhecidoError);
    expect(erro.name).toBe('ContratoDesconhecidoError');
    expect(erro.message).toContain('Contrato desconhecido');
  });

  test('listarContratos devolve todos os contratos registrados', () => {
    expect(listarContratos()).toHaveLength(CONTRATOS.length);
  });

  test('filtrarContratos filtra por método e por situação', () => {
    const deletes = filtrarContratos({ metodo: 'DELETE' });

    expect(deletes.length).toBeGreaterThan(0);
    expect(deletes.every((contrato) => contrato.metodo === 'DELETE')).toBe(true);

    const confirmados = filtrarContratos({ situacao: 'confirmado' });

    expect(confirmados.length).toBeGreaterThan(0);
    expect(
      confirmados.every((contrato) => contrato.situacao === 'confirmado'),
    ).toBe(true);

    expect(filtrarContratos({ situacao: 'divergente' })).toEqual([]);
  });

  test('filtrarContratos filtra por endpoint, autenticação e fonte', () => {
    const porEndpoint = filtrarContratos({
      metodo: 'GET',
      endpoint: '/produtos',
    });

    expect(porEndpoint.length).toBeGreaterThan(0);
    expect(
      porEndpoint.every(
        (contrato) =>
          contrato.metodo === 'GET' && contrato.endpoint === '/produtos',
      ),
    ).toBe(true);

    const comToken = filtrarContratos({ autenticacao: 'token' });

    expect(comToken.length).toBeGreaterThan(0);
    expect(
      comToken.every((contrato) => contrato.autenticacao === 'token'),
    ).toBe(true);

    const observados = filtrarContratos({ fonte: 'observado' });

    expect(observados.length).toBeGreaterThan(0);
    expect(
      observados.every((contrato) => contrato.fonte === 'observado'),
    ).toBe(true);
  });

  test('tipoMime extrai o tipo do cabeçalho content-type', () => {
    expect(tipoMime('application/json; charset=utf-8')).toBe('application/json');
    expect(tipoMime('APPLICATION/JSON')).toBe('application/json');
    expect(tipoMime('  Application/JSON ; charset=utf-8  ')).toBe(
      'application/json',
    );
    expect(tipoMime(null)).toBeNull();
  });
});
