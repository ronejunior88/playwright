import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '../fixtures';
import {
  CONTRATOS,
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

test.describe('Registro de contratos — consultas', () => {
  test('buscarContrato devolve o contrato solicitado', () => {
    expect(buscarContrato('login.sucesso').metodo).toBe('POST');
  });

  test('buscarContrato falha para identificador desconhecido', () => {
    expect(() => buscarContrato('contrato.inexistente')).toThrow(
      /Contrato desconhecido/,
    );
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
  });

  test('tipoMime extrai o tipo do cabeçalho content-type', () => {
    expect(tipoMime('application/json; charset=utf-8')).toBe('application/json');
    expect(tipoMime('APPLICATION/JSON')).toBe('application/json');
    expect(tipoMime(null)).toBeNull();
  });
});
