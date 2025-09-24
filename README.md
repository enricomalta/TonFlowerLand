# TonFlower Land

...existing code...

## Observabilidade e Saúde
- Endpoint `GET /health` retorna status, uptime e versão.
- Endpoint `GET /metrics` expõe métrica inicial `app_uptime_seconds` (formato Prometheus). Será expandido.

## Idempotência
Operações sensíveis exigem header:
```
x-idempotency-key: <uuid>
```
Respostas possíveis:
- `200 { success: true, ... }` (processada)
- `200 { replay: true, ... }` (replay detectado - mesma chave)
- `428` ausência do header.

## Ledger
Ver `LEDGER.md` para detalhes. Toda compra e saque gera entrada append-only.

## Logging Estruturado
Usamos `pino` e `pino-http` com `requestId` (header opcional `x-request-id` ou gerado automaticamente) para correlação.

## Validação
Todas as rotas principais migradas para `zod`. Erros de validação retornam:
```
{
  error: 'Erro de validação',
  issues: [ { path, message }, ... ]
}
```

## Blockchain Provider
Abstração em `js/back-end/blockchainProvider.js` permite modo `mock` (default) ou real (`BLOCKCHAIN_MODE=ton`).

## Testes & Cobertura
Executar:
```
npm test
```
Coverage thresholds globais (mínimos): branches 70%, functions 70%, lines 70%, statements 70%.
Relatório HTML em `coverage/`.

## Roadmap Próximo
- Expandir métricas (latência, contadores de ledger)
- Limpeza automática de chaves de idempotência expiradas
- Checklist de lançamento (LAUNCH-CHECKLIST.md)

...existing code...