import { type APIRequestContext } from '@playwright/test';
import {
  cancelarCompraSeguro,
  criarUsuarioAutenticado,
  type UsuarioAutenticado,
} from './carrinhos';
import {
  criarProdutoTeste,
  excluirProduto,
  type ProdutoCriado,
} from './produtos';
import { excluirUsuario, type UsuarioCriado } from './usuarios';

/**
 * Contexto compartilhado pelos specs de carrinhos.
 *
 * A API permite apenas **1 carrinho ativo por usuário**. Por isso os specs
 * de carrinho rodam em modo serial e precisam cancelar os carrinhos criados
 * antes do próximo teste. O contexto centraliza esse ciclo de vida (criar
 * conta, criar produto, cancelar carrinhos, excluir recursos), que antes era
 * copiado em cada spec e podia divergir entre eles.
 *
 * A API pública é compartilhada: as contas e os produtos criados aqui são
 * removidos em `limpar`, inclusive quando o teste falha.
 */
export interface ContextoCarrinhos {
  /** Conta de administrador usada para criar produtos. */
  readonly admin: UsuarioCriado;
  /** Token do administrador, necessário para criar e excluir produtos. */
  readonly tokenAdmin: string;
  /** Cria uma conta nova (não administradora por padrão) e a registra para limpeza. */
  novaConta(
    request: APIRequestContext,
    administrador?: 'true' | 'false',
  ): Promise<UsuarioAutenticado>;
  /** Cria um produto com o token do administrador e o registra para limpeza. */
  novoProduto(
    request: APIRequestContext,
    opcoes: { preco: number; quantidade: number },
  ): Promise<ProdutoCriado>;
  /** Marca o início de um teste: as contas criadas a partir daqui são canceladas no `afterEach`. */
  iniciarTeste(): void;
  /** Cancela os carrinhos das contas criadas no teste atual. */
  cancelarContasDoTeste(request: APIRequestContext): Promise<void>;
  /** Remove todos os recursos criados (carrinhos, produtos e contas). */
  limpar(request: APIRequestContext): Promise<void>;
}

/**
 * Cria o contexto de um describe de carrinhos.
 *
 * O administrador é criado de imediato, porque é preciso para criar produtos
 * antes do primeiro teste.
 */
export async function criarContextoCarrinhos(
  request: APIRequestContext,
): Promise<ContextoCarrinhos> {
  const contaAdmin = await criarUsuarioAutenticado(request, 'true');
  const contasCriadas: UsuarioAutenticado[] = [];
  const produtosCriados: ProdutoCriado[] = [];
  let contasDoTeste: UsuarioAutenticado[] = [];

  return {
    admin: contaAdmin.usuario,
    tokenAdmin: contaAdmin.token,

    async novaConta(
      req: APIRequestContext,
      administrador: 'true' | 'false' = 'false',
    ): Promise<UsuarioAutenticado> {
      const conta = await criarUsuarioAutenticado(req, administrador);
      contasCriadas.push(conta);
      contasDoTeste.push(conta);
      return conta;
    },

    async novoProduto(
      req: APIRequestContext,
      opcoes: { preco: number; quantidade: number },
    ): Promise<ProdutoCriado> {
      const produto = await criarProdutoTeste(req, contaAdmin.token, {
        preco: opcoes.preco,
        quantidade: opcoes.quantidade,
      });
      produtosCriados.push(produto);
      return produto;
    },

    iniciarTeste(): void {
      contasDoTeste = [];
    },

    async cancelarContasDoTeste(req: APIRequestContext): Promise<void> {
      for (const conta of contasDoTeste) {
        await cancelarCompraSeguro(req, conta.token);
      }
    },

    async limpar(req: APIRequestContext): Promise<void> {
      for (const conta of contasCriadas) {
        await cancelarCompraSeguro(req, conta.token);
      }
      for (const produto of produtosCriados) {
        await excluirProduto(req, contaAdmin.token, produto.id);
      }
      for (const conta of contasCriadas) {
        await excluirUsuario(req, conta.usuario.id);
      }
      await excluirUsuario(req, contaAdmin.usuario.id);
    },
  };
}
