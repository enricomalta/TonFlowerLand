# Ledger de Transações

Este documento descreve o funcionamento do ledger de transações introduzido para garantir rastreabilidade e idempotência em operações financeiras e econômicas do jogo.

## Objetivos
- Registrar operações sensíveis (compras, saques, depósitos futuros) de forma append-only.
- Permitir detecção de replays idempotentes através do `requestId` (cabeçalho `x-idempotency-key`).
- Facilitar auditoria e investigações de fraude ou inconsistências.

## Estrutura da Entrada
Cada documento na coleção `ledger` possui (campos podem evoluir):
```
{
  id: <gerado pelo Firestore>,
  type: 'purchase' | 'withdraw' | 'deposit' | 'other',
  walletAddress: string,
  amountTon?: number,
  amountToken?: number,
  itemNome?: string,
  direction?: 'debit' | 'credit',
  status: 'committed',
  requestId: string, // vindo do header x-idempotency-key
  timestamp: ISOString,
  metadata?: { ... }
}
```

## Fluxo de Idempotência
1. O cliente envia operações críticas com o header: `x-idempotency-key: <uuid>`.
2. Middleware verifica se a chave já existe em `idempotencyKeys` (Firestore) e ainda não expirou (TTL 15 min).
3. Se já processada: resposta 200 com `{ replay: true }` (ou dados prévios quando aplicável).
4. Caso novo: reserva a chave e segue para execução.
5. Após sucesso, insere entrada no `ledger`.

## TTL e Limpeza
- Chaves de idempotência expiram em 15 minutos (`expiresAt`).
- Estratégia de limpeza futura: job periódico para remover chaves expiradas para evitar crescimento indefinido.

## Boas Práticas de Cliente
- Gerar UUID v4 para cada operação financeira antes de enviar.
- Reutilizar a mesma chave em caso de timeout de rede para evitar duplicidade.
- Nunca reutilizar a chave para operações diferentes.

## Erros e Considerações
- Ausência do header: HTTP 428.
- Reutilização dentro do período: HTTP 200 com `replay: true`.
- Falhas internas no ledger não devem impedir a operação principal; são logadas e monitoradas.

## Roadmap Futuro
- Assinatura digital opcional por operação.
- Exportação batch para armazenamento frio.
- Métricas Prometheus (contagem por tipo e status).
- Painel de auditoria interno.

## Segurança
- Operações devem validar autenticidade do usuário antes de registrar.
- Evitar armazenar dados sensíveis em `metadata` (somente referências).

---
Atualizado automaticamente pelo assistente.
