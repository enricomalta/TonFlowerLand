// Observador de comportamento do console / DevTools (modo passivo)
// Objetivo: gerar eventos de telemetria para backend, NÃO punir diretamente.
// Estratégia: detectar abertura frequente do DevTools, uso explícito de eval / Function / patterns suspeitos.
// Envia lotes para endpoint /client-security-event (a ser implementado) com rate limit client-side.

const SECURITY_OBSERVER_VERSION = '1.1.0';

export function observeDeveloperConsole(walletAddress, options = {}) {
    try {
        const cfg = Object.assign({
            debounceMs: 1500,
            batchSize: 10,
            maxBuffer: 50,
            suspiciousPatterns: [/eval\s*\(/i, /Function\s*\(/, /XMLHttpRequest/i],
            devtoolsIntervalMs: 1200,
            endpoint: '/client-security-event',
            fetch: window.fetch.bind(window),
            enabled: true
        }, options);

        if (!cfg.enabled) return;

        const buffer = [];
        let lastSend = 0;

        function pushEvent(evt) {
            evt.ts = Date.now();
            evt.wallet = walletAddress;
            evt.v = SECURITY_OBSERVER_VERSION;
            buffer.push(evt);
            if (buffer.length >= cfg.batchSize) {
                flush('batch');
            }
        }

        async function flush(reason='timer') {
            if (!buffer.length) return;
            const now = Date.now();
            if (now - lastSend < cfg.debounceMs && reason !== 'batch') return;
            const payload = buffer.splice(0, cfg.batchSize);
            lastSend = now;
            try {
                await cfg.fetch(cfg.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ events: payload })
                });
            } catch (e) {
                // requeue on failure (simple retry once)
                payload.forEach(p => buffer.unshift(p));
            }
            if (buffer.length > cfg.maxBuffer) {
                buffer.splice(0, buffer.length - cfg.maxBuffer);
            }
        }

        // Monitor de console (sem sobrescrever totalmente -> envolvemos métodos)
        ["log","warn","error","info"].forEach(method => {
            const original = console[method];
            console[method] = function(...args) {
                try {
                    const joined = args.map(a => (typeof a === 'string' ? a : (a && a.message) || '')).join(' ');
                    if (cfg.suspiciousPatterns.some(rx => rx.test(joined))) {
                        pushEvent({ type: 'consolePattern', level: method, sample: joined.slice(0,180) });
                    }
                } catch(_e) { /* noop */ }
                return original.apply(this, args);
            };
        });

        // Wrapper passivo de eval e Function
        try {
            const originalEval = window.eval; // eslint-disable-line no-eval
            window.eval = function(code) { // eslint-disable-line no-eval
                pushEvent({ type: 'evalCall', len: (code||'').length });
                return originalEval(code);
            };
        } catch(_) { /* ignore */ }

        try {
            const OriginalFunction = window.Function; // eslint-disable-line no-new-func
            // Proxy para capturar criação dinâmica
            // eslint-disable-next-line no-new-func
            window.Function = new Proxy(OriginalFunction, {
                construct(target, args) {
                    pushEvent({ type: 'FunctionCtor', args: args.map(a=> (''+a).slice(0,60)) });
                    return new target(...args);
                },
                apply(target, thisArg, args) {
                    pushEvent({ type: 'FunctionCall', argsCount: args.length });
                    return target.apply(thisArg, args);
                }
            });
        } catch(_) { /* ignore */ }

        // Detecção heurística de DevTools (sem ban)
        let lastState = false;
        setInterval(() => {
            const threshold = 160;
            const open = (window.outerWidth - window.innerWidth > threshold) || (window.outerHeight - window.innerHeight > threshold);
            if (open !== lastState) {
                lastState = open;
                pushEvent({ type: 'devtoolsToggle', open });
            }
            flush('timer');
        }, cfg.devtoolsIntervalMs);

        // Flush antes de unload
        window.addEventListener('beforeunload', () => { try { flush('unload'); } catch(_e){} });

        // Exposição manual para debug
        window.__SECURITY_OBSERVER__ = { flush, pushEvent, buffer };

    } catch(e) {
        // Falha silenciosa para não impactar usuário
        // eslint-disable-next-line no-console
        console.warn('[security-observer] init failed', e);
    }
}

// Mantém compat com chamadas antigas
export const detectConsoleHacks = observeDeveloperConsole;

