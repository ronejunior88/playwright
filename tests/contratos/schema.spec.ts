import { expect, test } from '../fixtures';
import {
  array,
  booleano,
  classificar,
  criarDivergencia,
  mapaDeTextos,
  nulo,
  numero,
  objeto,
  opcionado,
  qualquer,
  texto,
  validarSchema,
  type Divergencia,
} from '../../contracts';

/**
 * Testes do motor de contratos (`contracts/schema.ts`).
 *
 * São **locais**: não acessam a API e podem rodar em qualquer ambiente
 * (inclusive sem rede), servindo de trava rápida para o motor usado pelos
 * testes de contrato.
 */

function categorias(divergencias: Divergencia[]): string[] {
  return divergencias.map((divergencia) => divergencia.categoria);
}

test.describe('Motor de contratos — texto', () => {
  test('aceita um texto qualquer sem gerar divergências', () => {
    const divergencias = validarSchema(texto(), 'valor');

    expect(divergencias).toEqual([]);
  });

  test('rejeita tipos diferentes de texto', () => {
    const divergencias = validarSchema(texto(), 42);

    expect(categorias(divergencias)).toEqual(['tipo-incompativel']);
    expect(divergencias[0].compatibilidade).toBe('incompativel');
  });

  test('valida o comprimento mínimo', () => {
    const divergencias = validarSchema(texto({ min: 3 }), 'ab');

    expect(categorias(divergencias)).toEqual(['valor-incompativel']);
    expect(divergencias[0].esperado).toContain('pelo menos 3');
  });

  test('valida o comprimento máximo', () => {
    const divergencias = validarSchema(texto({ max: 2 }), 'abc');

    expect(categorias(divergencias)).toEqual(['valor-incompativel']);
  });

  test('valida o formato esperado', () => {
    const divergencias = validarSchema(texto({ padrao: /^[a-z0-9]{16}$/ }), 'curto');

    expect(categorias(divergencias)).toEqual(['valor-incompativel']);
  });

  test('valida a lista de valores permitidos', () => {
    const divergencias = validarSchema(texto({ valores: ['true', 'false'] }), 'talvez');

    expect(categorias(divergencias)).toEqual(['valor-incompativel']);
    expect(divergencias[0].esperado).toContain('true | false');
  });

  test('aceita um valor da lista permitida', () => {
    expect(validarSchema(texto({ valores: ['true', 'false'] }), 'true')).toEqual([]);
  });
});

test.describe('Motor de contratos — número', () => {
  test('aceita número e rejeita texto', () => {
    expect(validarSchema(numero(), 10)).toEqual([]);
    expect(categorias(validarSchema(numero(), '10'))).toEqual(['tipo-incompativel']);
  });

  test('rejeita valores não finitos', () => {
    expect(categorias(validarSchema(numero(), Number.NaN))).toEqual([
      'tipo-incompativel',
    ]);
    expect(categorias(validarSchema(numero(), Number.POSITIVE_INFINITY))).toEqual([
      'tipo-incompativel',
    ]);
  });

  test('valida número inteiro', () => {
    expect(categorias(validarSchema(numero({ inteiro: true }), 2.5))).toEqual([
      'valor-incompativel',
    ]);
  });

  test('valida limites inferior e superior', () => {
    expect(categorias(validarSchema(numero({ min: 0 }), -1))).toEqual([
      'valor-incompativel',
    ]);
    expect(categorias(validarSchema(numero({ max: 10 }), 11))).toEqual([
      'valor-incompativel',
    ]);
  });

  test('valida limite exclusivamente positivo', () => {
    expect(categorias(validarSchema(numero({ exclusivoMin: 0 }), 0))).toEqual([
      'valor-incompativel',
    ]);
    expect(validarSchema(numero({ exclusivoMin: 0 }), 0.5)).toEqual([]);
  });
});

test.describe('Motor de contratos — objeto', () => {
  const schema = objeto({
    nome: texto(),
    quantidade: numero({ inteiro: true }),
  });

  test('detecta campo obrigatório ausente', () => {
    const divergencias = validarSchema(schema, { nome: 'item' });

    expect(categorias(divergencias)).toEqual(['campo-obrigatorio-ausente']);
    expect(divergencias[0].caminho).toBe('quantidade');
  });

  test('aceita campo opcional ausente', () => {
    const schemaOpcional = objeto({
      nome: texto(),
      apelido: opcionado(texto()),
    });

    expect(validarSchema(schemaOpcional, { nome: 'item' })).toEqual([]);
  });

  test('detecta tipo incompatível em campo', () => {
    const divergencias = validarSchema(schema, { nome: 'item', quantidade: 'dois' });

    expect(categorias(divergencias)).toEqual(['tipo-incompativel']);
    expect(divergencias[0].caminho).toBe('quantidade');
  });

  test('detecta campo proibido presente', () => {
    const schemaProibido = objeto({ nome: texto() }, { proibidos: ['_id'] });
    const divergencias = validarSchema(schemaProibido, { nome: 'item', _id: 'abc' });

    expect(categorias(divergencias)).toEqual(['campo-proibido-presente']);
  });

  test('reporta campo adicional como divergência compatível', () => {
    const divergencias = validarSchema(schema, {
      nome: 'item',
      quantidade: 1,
      extra: 'novo',
    });

    expect(categorias(divergencias)).toEqual(['campo-adicional']);
    expect(divergencias[0].compatibilidade).toBe('compativel');
  });

  test('pode ignorar campos adicionais não documentados', () => {
    const schemaEstrito = objeto(
      { nome: texto() },
      { camposConhecidos: false },
    );

    expect(validarSchema(schemaEstrito, { nome: 'item', extra: 'novo' })).toEqual([]);
  });

  test('rejeita estrutura que não é objeto', () => {
    expect(categorias(validarSchema(schema, ['lista']))).toEqual([
      'estrutura-incompativel',
    ]);
    expect(categorias(validarSchema(schema, null))).toEqual([
      'estrutura-incompativel',
    ]);
  });

  test('indica o caminho completo de campos aninhados', () => {
    const schemaAninhado = objeto({
      produto: objeto({ preco: numero() }),
    });

    const divergencias = validarSchema(schemaAninhado, {
      produto: { preco: 'grátis' },
    });

    expect(divergencias[0].caminho).toBe('produto.preco');
  });
});

test.describe('Motor de contratos — array', () => {
  test('rejeita valor que não é array', () => {
    expect(categorias(validarSchema(array(texto()), 'texto'))).toEqual([
      'estrutura-incompativel',
    ]);
  });

  test('valida a quantidade mínima de itens', () => {
    expect(categorias(validarSchema(array(texto(), { minItens: 1 }), []))).toEqual([
      'estrutura-incompativel',
    ]);
  });

  test('valida cada item com caminho indexado', () => {
    const divergencias = validarSchema(array(texto()), ['ok', 2]);

    expect(divergencias[0].caminho).toBe('[1]');
    expect(categorias(divergencias)).toEqual(['tipo-incompativel']);
  });
});

test.describe('Motor de contratos — mapa de textos', () => {
  test('aceita mapa com valores textuais', () => {
    expect(validarSchema(mapaDeTextos(), { nome: 'nome é obrigatório' })).toEqual([]);
  });

  test('rejeita valor não textual', () => {
    const divergencias = validarSchema(mapaDeTextos(), { nome: 10 });

    expect(categorias(divergencias)).toEqual(['tipo-incompativel']);
  });

  test('rejeita chaves proibidas no formato de erro', () => {
    const schema = mapaDeTextos({ proibidas: ['message', '_id'] });
    const divergencias = validarSchema(schema, { nome: 'erro', message: 'x' });

    expect(categorias(divergencias)).toEqual(['campo-proibido-presente']);
  });

  test('rejeita estrutura que não é objeto', () => {
    expect(categorias(validarSchema(mapaDeTextos(), ['erro']))).toEqual([
      'estrutura-incompativel',
    ]);
  });
});

test.describe('Motor de contratos — tipos simples e classificação', () => {
  test('valida booleano', () => {
    expect(validarSchema(booleano(), true)).toEqual([]);
    expect(categorias(validarSchema(booleano(), 'true'))).toEqual([
      'tipo-incompativel',
    ]);
  });

  test('valida null', () => {
    expect(validarSchema(nulo(), null)).toEqual([]);
    expect(categorias(validarSchema(nulo(), 0))).toEqual(['tipo-incompativel']);
  });

  test('aceita qualquer valor', () => {
    expect(validarSchema(qualquer(), { qualquer: 'coisa' })).toEqual([]);
  });

  test('classifica divergências incompatíveis e compatíveis', () => {
    expect(classificar('campo-obrigatorio-ausente')).toBe('incompativel');
    expect(classificar('tipo-incompativel')).toBe('incompativel');
    expect(classificar('campo-proibido-presente')).toBe('incompativel');
    expect(classificar('campo-adicional')).toBe('compativel');
  });

  test('cria divergência manual com caminho e expectativa', () => {
    const divergencia = criarDivergencia(
      'quantidade',
      'igual ao tamanho de usuarios',
      3,
      'valor-incompativel',
    );

    expect(divergencia.caminho).toBe('quantidade');
    expect(divergencia.compatibilidade).toBe('incompativel');
    expect(divergencia.mensagem).toContain('igual ao tamanho de usuarios');
  });
});

test.describe('Motor de contratos — segurança das mensagens', () => {
  test('não ecoa o conteúdo de strings nas divergências', () => {
    const segredo = 'senha-super-secreta-123';

    const divergencias = validarSchema(texto({ min: 50 }), segredo);

    expect(divergencias).toHaveLength(1);
    expect(divergencias[0].recebido).toBe(`texto (${segredo.length} caracteres)`);
    expect(divergencias[0].mensagem).not.toContain(segredo);
  });

  test('não ecoa o conteúdo de strings em campos de objeto', () => {
    const segredo = 'token-jwt-que-nao-deve-aparecer';

    const divergencias = validarSchema(
      objeto({ password: texto({ min: 100 }) }),
      { password: segredo },
    );

    expect(divergencias[0].mensagem).not.toContain(segredo);
    expect(divergencias[0].recebido).not.toContain(segredo);
  });

  test('não ecoa o corpo bruto quando o JSON é inválido', () => {
    const corpo = '{"password": "valor-secreto"';

    const divergencias = validarSchema(objeto({ password: texto() }), corpo);

    expect(divergencias[0].recebido).not.toContain('valor-secreto');
  });
});
