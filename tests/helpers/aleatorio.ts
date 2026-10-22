/**
 * Sufixo aleatório usado para garantir unicidade de nomes, e-mails e
 * descrições criados durante a execução da suíte.
 *
 * Fica em um módulo próprio porque é usado por mais de um domínio (usuários e
 * produtos) e não pertence a nenhum deles.
 */
export function gerarSufixo(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
