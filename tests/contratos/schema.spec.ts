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

  test('aceita textos exatamente nos limites mínimo e máximo', () => {
    expect(validarSchema(texto({ min: 3 }), 'abc')).toEqual([]);
    expect(validarSchema(texto({ max: 3 }), 'abc')).toEqual([]);
  });

  test('descreve o tipo e os limites nas divergências de texto', () => {
    const tipo = validarSchema(texto(), 42)[0];
    const maximo = validarSchema(texto({ max: 2 }), 'abc')[0];
    const formato = validarSchema(texto({ padrao: /^[a-z]+$/ }), 'ABC')[0];

    expect(tipo.esperado).toBe('texto');
    expect(tipo.recebido).toBe('number (42)');
    expect(tipo.mensagem).toContain('esperado texto, recebido number (42)');
    expect(maximo.esperado).toContain('no máximo 2');
    expect(formato.esperado).toContain('^[a-z]+$');
  });

  test('descreve os valores recebidos sem expor conteúdo de strings', () => {
    const casos: Array<[unknown, string]> = [
      [undefined, 'ausente'],
      [null, 'null'],
      [['a', 'b'], 'array (2 itens)'],
      [{ a: 1, b: 2 }, 'objeto (2 chaves: a, b)'],
      [42, 'number (42)'],
    ];

    for (const [valor, esperado] of casos) {
      const [divergencia] = validarSchema(texto(), valor);
      expect(divergencia.recebido, String(valor)).toBe(esperado);
    }
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

  test('aceita valores nos limites inclusivos e inteiros exatos', () => {
    expect(validarSchema(numero({ min: 0 }), 0)).toEqual([]);
    expect(validarSchema(numero({ max: 10 }), 10)).toEqual([]);
    expect(validarSchema(numero({ inteiro: true }), 2)).toEqual([]);
  });

  test('descreve o tipo numérico esperado e os limites', () => {
    expect(validarSchema(numero(), '10')[0].esperado).toBe('número');
    expect(validarSchema(numero({ inteiro: true }), '10')[0].esperado).toBe(
      'número inteiro',
    );
    expect(validarSchema(numero({ min: 0 }), -1)[0].esperado).toContain(
      'maior ou igual a 0',
    );
    expect(validarSchema(numero({ max: 10 }), 11)[0].esperado).toContain(
      'menor ou igual a 10',
    );
    expect(validarSchema(numero({ exclusivoMin: 0 }), 0)[0].esperado).toContain(
      'maior que 0',
    );
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

  test('rejeita valores primitivos que não são objeto', () => {
    expect(categorias(validarSchema(objeto({}), 'texto'))).toEqual([
      'estrutura-incompativel',
    ]);
    expect(categorias(validarSchema(objeto({}), 10))).toEqual([
      'estrutura-incompativel',
    ]);
  });

  test('considera obrigatórios campos de todos os tipos', () => {
    const schemaCompleto = objeto({
      booleanoObrigatorio: booleano(),
      nuloObrigatorio: nulo(),
      qualquerObrigatorio: qualquer(),
      objetoObrigatorio: objeto({}),
      arrayObrigatorio: array(texto()),
      mapaObrigatorio: mapaDeTextos(),
    });

    const divergencias = validarSchema(schemaCompleto, {});

    expect(categorias(divergencias)).toEqual(
      Array(6).fill('campo-obrigatorio-ausente'),
    );
    expect(divergencias.map((divergencia) => divergencia.esperado)).toEqual([
      'booleano',
      'null',
      'qualquer valor',
      'objeto',
      'array',
      'objeto de mensagens por campo',
    ]);
  });

  test('descreve o campo proibido e o adicional com caminho completo', () => {
    const schemaAninhado = objeto({
      filho: objeto({ nome: texto() }, { proibidos: ['_id'] }),
    });

    const proibido = validarSchema(schemaAninhado, {
      filho: { nome: 'item', _id: 'abc' },
    })[0];

    expect(proibido.caminho).toBe('filho._id');
    expect(proibido.esperado).toBe('campo ausente');
    expect(proibido.categoria).toBe('campo-proibido-presente');

    const adicional = validarSchema(schemaAninhado, {
      filho: { nome: 'item', extra: 'novo' },
    })[0];

    expect(adicional.caminho).toBe('filho.extra');
    expect(adicional.esperado).toBe('campo não documentado no contrato');
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

  test('aceita array com exatamente o mínimo de itens', () => {
    expect(validarSchema(array(texto(), { minItens: 1 }), ['ok'])).toEqual([]);
  });

  test('descreve a estrutura de array esperada', () => {
    expect(validarSchema(array(texto()), 'texto')[0].esperado).toBe('array');
    expect(
      validarSchema(array(texto(), { minItens: 2 }), ['ok'])[0].esperado,
    ).toContain('pelo menos 2 item(ns)');
  });
});

test.describe('Motor de contratos — mapa de textos', () => {
  test('aceita mapa com valores textuais', () => {
    expect(validarSchema(mapaDeTextos(), { nome: 'nome é obrigatório' })).toEqual([]);
  });

  test('rejeita valor não textual', () => {
    const divergencias = validarSchema(mapaDeTextos(), { nome: 10 });

    expect(categorias(divergencias)).toEqual(['tipo-incompativel']);
    expect(divergencias[0].esperado).toBe('texto');
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

  test('rejeita valores primitivos e null no lugar de mapa de textos', () => {
    expect(categorias(validarSchema(mapaDeTextos(), 'texto'))).toEqual([
      'estrutura-incompativel',
    ]);
    expect(categorias(validarSchema(mapaDeTextos(), 10))).toEqual([
      'estrutura-incompativel',
    ]);
    expect(categorias(validarSchema(mapaDeTextos(), null))).toEqual([
      'estrutura-incompativel',
    ]);
  });

  test('valida a quantidade mínima de chaves', () => {
    const schema = mapaDeTextos({ minChaves: 1 });

    const divergencias = validarSchema(schema, {});
    expect(categorias(divergencias)).toEqual(['estrutura-incompativel']);
    expect(divergencias[0].esperado).toContain('pelo menos 1 chave');
    expect(validarSchema(schema, { nome: 'erro' })).toEqual([]);
  });

  test('descreve a chave proibida com caminho completo', () => {
    const schemaAninhado = objeto({
      erro: mapaDeTextos({ proibidas: ['message'] }),
    });

    const [divergencia] = validarSchema(schemaAninhado, {
      erro: { message: 'erro' },
    });

    expect(divergencia.caminho).toBe('erro.message');
    expect(divergencia.esperado).toBe(
      'chave não permitida neste formato de erro',
    );
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
    expect(divergencia.esperado).toBe('igual ao tamanho de usuarios');
    expect(divergencia.recebido).toBe('number (3)');
    expect(divergencia.mensagem).toContain('igual ao tamanho de usuarios');
  });

  test('descreve o tipo esperado de booleano e null', () => {
    expect(validarSchema(booleano(), 'true')[0].esperado).toBe('booleano');
    expect(validarSchema(nulo(), 0)[0].esperado).toBe('null');
  });

  test('usa (corpo) quando a divergência não tem caminho', () => {
    const divergencia = criarDivergencia(
      '',
      'JSON válido',
      undefined,
      'estrutura-incompativel',
    );

    expect(divergencia.recebido).toBe('ausente');
    expect(divergencia.mensagem).toBe(
      '(corpo): esperado JSON válido, recebido ausente',
    );
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
