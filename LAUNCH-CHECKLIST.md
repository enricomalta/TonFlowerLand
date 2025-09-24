# Launch Checklist - TonFlower Land

## Segurança
- [ ] Variáveis de ambiente definidas (PORT, JWT_SECRET, CONTRACT, BLOCKCHAIN_MODE, TON_PUBLIC_KEY, TON_SECRET_KEY)
- [ ] Headers de segurança verificados (Helmet + extras)
- [ ] CSP revisada e habilitada quando domínio final definido
- [ ] Tokens JWT com secret robusto (>32 chars)
- [ ] Revogação de tokens monitorada

## Infra & Deploy
- [ ] Pipeline CI passando (build, testes, cobertura)
- [ ] Logs estruturados enviados para agregador (ELK, Loki ou similar)
- [ ] Estratégia de backup Firestore/BD definida
- [ ] Domínio + HTTPS válido configurado
- [ ] Escalonamento horizontal planejado (stateless API / sessão via JWT)

## Observabilidade
- [ ] `/health` integrado ao load balancer
- [ ] `/metrics` raspado por Prometheus (ou equivalente)
- [ ] Alertas configurados (erros 5xx, latência alta, queda de cobertura)
- [ ] Painel de métricas (Grafana ou outro)

## Ledger & Idempotência
- [ ] Verificação de integridade do ledger (amostra manual)
- [ ] Export periódico planejado (opcional)
- [ ] Limpeza (GC) de chaves de idempotência expiradas agendada

## Qualidade & Testes
- [ ] Cobertura mínima atingida
- [ ] Testes de carga básica executados
- [ ] Testes de regressão aprovados

## Documentação
- [ ] README atualizado
- [ ] LEDGER.md validado
- [ ] Plano de resposta a incidentes documentado
- [ ] Fluxo de suporte (SLA interno) definido

## Segurança Adicional (Fase 2)
- [ ] Rate limit ajustado em produção após métricas reais
- [ ] Auditoria de dependências (npm audit / Snyk)
- [ ] Scan de vulnerabilidades container/host

## Go / No-Go
- [ ] Bug crítico zero
- [ ] Aprovação de stakeholders
- [ ] Janela de deploy definida

---
Preencha os itens antes do lançamento oficial.
