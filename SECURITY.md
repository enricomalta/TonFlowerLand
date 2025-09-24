# Security Policy

## Supported Versions
Atualmente mantemos a branch principal (main) e última release publicada. Hotfixes críticos são priorizados.

## Reporte de Vulnerabilidades
Envie um e-mail para security@example.com com:
- Descrição clara
- Passos de reprodução
- Impacto estimado
- Sugestão (opcional)

Não abra issues públicas para vulnerabilidades não divulgadas.

## Controles Implementados
- HTTP Security Headers (CSP com nonce, HSTS, X-Frame-Options, Referrer-Policy, X-Content-Type-Options, Permissions-Policy)
- Rate limiting por rota + global
- Proteção contra HTTP Parameter Pollution (hpp)
- Idempotência persistente (Firestore) para evitar replay em endpoints sensíveis
- Ledger append-only em Firestore
- Validação com Zod nas principais rotas
- Sanitização defensiva de inputs (escape de caracteres HTML)
- Observabilidade: métricas (req, erros, latência, ledger writes, security events, status classes, payload bytes, lag)
- Logging estruturado com pino + requestId
- CSP com nonce por request (remoção progressiva de 'unsafe-inline')

## Práticas Recomendadas de Deploy
- Executar atrás de proxy reverso que force HTTPS
- Variáveis de ambiente secretas fora do repositório
- Rotacionar chaves JWT periodicamente
- Ativar logs imutáveis (WORM) para auditoria crítica

## Política de Dependências
- Scanner automático (npm audit / dependabot)
- Versões pinadas no `package.json` quando necessário

## Roadmap de Segurança
- Assinatura de respostas críticas (response MAC)
- Storage de ledger em append-only bucket + checksum Merkle
- Análise de comportamento anômalo baseada em métricas
- Remoção completa de 'unsafe-inline' (style-src) após refator front-end

## Tratamento de Incidentes
1. Confirmar impacto e escopo
2. Criar issue interna (privada)
3. Preparar hotfix e patch release
4. Comunicar usuários afetados se necessário
5. Pós-mortem resumido (interno) em 5 dias úteis

## Contato
security@example.com
