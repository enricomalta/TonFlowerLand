import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit"; // Importando rate limit
import * as crypto from "crypto";
import TonWeb from "tonweb"; // (legado) - manter se outras partes dependem diretamente
import jwt from 'jsonwebtoken';
import fs from "fs";
import https from "https";
import cookieParser from 'cookie-parser';
import cron from "node-cron";
import helmet from 'helmet';
import hpp from 'hpp';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import { appendLedger, findByRequestId } from './js/back-end/ledger.js';
import { metricsMiddleware, metrics, renderAllMetrics } from './js/back-end/metrics.js';
import { blockchain, isMock } from './js/back-end/blockchainProvider.js';


// Local Functions
import { pool } from "./js/back-end/mysql.js";
import { processarCompra } from "./js/back-end/processarCompra.js";
import { removeItem } from "./js/back-end/removeItem.js";
import { createUser } from "./js/back-end/createUser.js";
import { updateTokenBalance } from './js/back-end/updateTokenBalance.js';
import { plantSeed } from "./js/back-end/plantSeed.js";
import { colectSeed } from "./js/back-end/colectSeed.js";
import { verifyToken } from "./js/back-end/verifyToken.js";
import { updatePlantStatus } from "./js/back-end/updatePlant.js";
import { removeParasita } from "./js/back-end/removeParasita.js";
import { checkAndApplyParasites } from "./js/back-end/checkAndApplyParasites.js";
import { body, validationResult } from "express-validator";
import 'dotenv/config';
// Removido: importação de cert do firebase-admin/app
import { 
    createUserSchema,
    loginSchema,
    processarCompraSchema,
    removeItemSchema,
    plantSeedSchema,
    colectSeedSchema,
    withdrawSchema,
    updateBalanceSchema,
    updatePlantStatusSchema,
    challengeSchema,
    verifyTransactionSchema,
    monitorDepositSchema,
    idempotentHeader
} from './js/validation/schemas.js';
import { validateBody, requireIdempotency } from './js/validation/middleware.js';

// ---- Test-only legacy fallback stubs (permit exercising routes with legacy/undefined symbols) ----
if (process.env.JEST_WORKER_ID !== undefined) {
    if (typeof global.validateSignature === 'undefined') {
        global.validateSignature = () => true; // aceita sempre durante testes
    }
    if (typeof global.verifyTransaction === 'undefined') {
        global.verifyTransaction = () => true; // sempre válida em testes; cenários negativos simulados sobrescrevendo
    }
    if (typeof global.User === 'undefined') {
        class TestUser {
            constructor(data){ Object.assign(this, data); }
            static async findOne(){ return null; }
            async save(){ /* no-op */ }
        }
        global.User = TestUser;
    }
}

// ==== Configuração do Express & Hardening Básico ====
const server = express();
server.disable('x-powered-by');

// Validação mínima de variáveis de ambiente críticas
const requiredEnv = ['PORT','JWT_SECRET'];
const missing = requiredEnv.filter(k => !process.env[k]);
if (missing.length) {
    console.warn(`[WARN] Variáveis de ambiente ausentes: ${missing.join(', ')}`);
}
const corsOptions = {
    origin: [
        'https://walletbot.me',
        'https://ton-flower-land.vercel.app',
        'http://localhost:5501',
        'https://192.168.56.1:5501',
        'http://192.168.56.1:5501'
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    preflightContinue: false
};

server.use((req, res, next) => {
    cors(corsOptions)(req, res, () => {
        // Adiciona headers CORS manualmente para garantir compatibilidade máxima
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        next();
    });
});
// Handler global para OPTIONS (CORS preflight)
server.options('*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.status(204).end();
});
server.use((req,res,next)=>{ // attach requestId early
    req.requestId = req.headers['x-request-id'] || Math.random().toString(16).slice(2)+Date.now().toString(16);
    next();
});
const httpLogger = pinoHttp({
    redact: ['req.headers.authorization','req.headers.cookie'],
    customProps: (req) => ({ requestId: req.requestId })
});
server.use(httpLogger);
server.use((req,res,next)=>{
    // Gera nonce por request
    const cspNonce = crypto.randomBytes(16).toString('base64');
    res.locals.cspNonce = cspNonce;
    helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                "default-src": ["'self'"],
                "script-src": ["'self'",`'nonce-${cspNonce}'`],
                "style-src": ["'self'","'unsafe-inline'"], // manter inline styles temporariamente
                "img-src": ["'self'","data:","blob:"],
                "connect-src": ["'self'","https://toncenter.com"],
                "font-src": ["'self'","data:"],
                "frame-ancestors": ["'none'"],
            }
        },
        crossOriginEmbedderPolicy: false
    })(req,res,next);
});
server.use((req,res,next)=>{ res.setHeader('Strict-Transport-Security','max-age=63072000; includeSubDomains; preload'); next(); });
server.use(hpp());
server.use(metricsMiddleware);
server.use(express.json({ limit: '512kb' }));
server.use(cookieParser());
// Sanitização simples de inputs (defesa em profundidade). Escapa caracteres HTML perigosos em strings.
function sanitizeString(str){
    return str
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;')
        .replace(/\//g,'&#x2F;');
}
function deepSanitize(obj, depth=0){
    if(depth>5) return obj; // evita recursão profunda/DoS
    if(Array.isArray(obj)) return obj.map(v=>deepSanitize(v, depth+1));
    if(obj && typeof obj === 'object'){
        const out={};
        for(const k of Object.keys(obj)) out[k]=deepSanitize(obj[k], depth+1);
        return out;
    }
    if(typeof obj === 'string') return sanitizeString(obj);
    return obj;
}
server.use((req,_res,next)=>{
    if(req.body) req.body = deepSanitize(req.body);
    if(req.query) req.query = deepSanitize(req.query);
    if(req.params) req.params = deepSanitize(req.params);
    next();
});

// Headers de segurança adicionais
server.use((req,res,next)=>{
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Permissions-Policy','geolocation=(), microphone=()');
    next();
});

// Carregar os certificados SSL
const options = {
    key: fs.readFileSync('./ssl/192.168.56.1-key.pem'),
    cert: fs.readFileSync('./ssl/192.168.56.1.pem'),
};



// Blockchain / TON (fallback mock em ambiente de teste)
let tonweb;
try {
    tonweb = new TonWeb();
} catch(_e) {
    tonweb = { wallet: { create: () => ({ mock:true }) } };
}
const revokedTokens = new Set();
const contractAddress = process.env.CONTRACT;



//#region MIDDLEWARE

// Middleware compras
const compraLimiter = rateLimit({
    windowMs: 5000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas compras seguidas! Aguarde um momento." }
});

// Middleware atualização de saldo
const saldoLimiter = rateLimit({
    windowMs: 1000,
    max: 1,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições para atualizar saldo! Aguarde um momento." }
});

// Middleware plantar
const plantLimiter = rateLimit({
    windowMs: 1000,
    max: 1,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições para plantar! Aguarde um momento." }
});

// Middleware colher
const colherLimiter = rateLimit({
    windowMs: 1000,
    max: 1,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições para plantar! Aguarde um momento." }
});

// Middleware Login
const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
});

// Middleware Utilitarios
const utilityLimiter = rateLimit({
    windowMs: 1000,
    max: 1,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições de utilitários! Aguarde um momento." }
});

//#endregion


//#region WEB-3

// Rate limit global (colocado após CORS, antes das rotas de negócio)
server.use(rateLimit({ windowMs: 15*60*1000, max: 1000, standardHeaders: true, legacyHeaders: false }));

// Rate limit específico para eventos de segurança do front
const securityEventLimiter = rateLimit({
    windowMs: 5*60*1000, // 5 min
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitos eventos de segurança enviados.' }
});

const wallet = tonweb.wallet.create({
    publicKey: "chave_publica_do_contrato",
    secretKey: "chave_privada_do_contrato",
});

// ENVIA 
async function sendMessageToContract(walletAddress, amountTon) {
    try {
        const tx = await blockchain.sendMessage({ toAddress: walletAddress, amountTon, payload: 'Depósito registrado pelo back-end' });
        if (isMock()) {
            console.log('Mock TX registrada', tx);
        }
        return tx;
    } catch (error) {
        console.error('Erro ao enviar mensagem ao contrato:', error);
        throw error;
    }
}

// DESAFIO ASSINATURA WALLET
server.post("/generate-challenge", validateBody(challengeSchema), async (req, res) => {
    const { walletAddress } = req.validated;

    const challenge = `TON Login Challenge: ${crypto.randomBytes(32).toString("hex")}`;

    // Salvar challenge temporário no Firestore
    // Salvar challenge temporário no MySQL
    await pool.query('INSERT INTO challenges (wallet_address, challenge, createdAt) VALUES (?, ?, ?)', [walletAddress, challenge, new Date()]);

    res.json({ challenge });
});

// VALIDAR ASSINATURA WALLET
server.post('/verify-transaction', validateBody(verifyTransactionSchema), async (req, res) => {
    const { walletAddress, challenge, transaction } = req.validated;

    // Verifique a transação aqui...
    const isValidTransaction = verifyTransaction(transaction, challenge);

    if (!isValidTransaction) {
        return res.status(400).json({ success: false, message: 'Transação inválida' });
    }

    // Verifique se o usuário já existe
    const [[user]] = await pool.query('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
    if (!user) {
        await pool.query('INSERT INTO users (wallet_address) VALUES (?)', [walletAddress]);
        return res.status(200).json({ success: true, userCreated: true });
    }
    res.status(200).json({ success: true, userCreated: false });
});


// RECEBER DADOS DO SMART CONTRACT
server.post("/deposit", async (req, res) => {
    if (!validateSignature(req)) {
      return res.status(401).send("Assinatura inválida");
    }

    const { transactionId, amountTon, timestamp } = req.body;
    const walletAddress = req.body.walletAddress; // Deve ser enviado pelo contrato

    if (!walletAddress) {
      return res.status(400).send("Endereço da carteira ausente");
    }

        const [[user]] = await pool.query('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
        if (!user) {
            return res.status(404).send("Usuário não encontrado");
        }
        await pool.query('UPDATE users SET tokenBalance = tokenBalance + ? WHERE wallet_address = ?', [amountTon, walletAddress]);
        await pool.query('INSERT INTO historyDeposit (transactionId, wallet_address, quantidadeTon, quantidadeToken, dataTransacao, status) VALUES (?, ?, ?, ?, ?, ?)', [transactionId, walletAddress, amountTon, 0, timestamp, "confirmado"]);
        res.status(200).send("Depósito registrado com sucesso");
  });


server.post("/monitor-deposit", async (req, res) => {
    try {
        const { transactionId, walletAddress, amountTon } = req.body;

        // Atualizar saldo no Firestore
        await pool.query('UPDATE users SET tokenBalance = tokenBalance + ? WHERE wallet_address = ?', [amountTon, walletAddress]);
        await pool.query('INSERT INTO historyDeposit (transactionId, wallet_address, quantidadeTon, dataTransacao, status) VALUES (?, ?, ?, ?, ?)', [transactionId, walletAddress, amountTon, new Date().toISOString(), "confirmado"]);

        res.status(200).json({ success: true, message: "Depósito registrado com sucesso" });
    } catch (error) {
        console.error("Erro ao registrar depósito:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

server.post("/withdraw", validateBody(withdrawSchema), requireIdempotency(), async (req, res) => {
    try {
        const { walletAddress, amountTon } = req.validated;
        const reqId = req.headers[idempotentHeader];
        // Replay check via ledger (handles server restarts)
        const existing = await findByRequestId(reqId);
        if (existing) {
            return res.status(200).json({ replay: true, ledger: existing });
        }

        // Verificar saldo no Firestore
        const [[user]] = await pool.query('SELECT tokenBalance FROM users WHERE wallet_address = ?', [walletAddress]);
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (user.tokenBalance < amountTon) {
            return res.status(400).json({ error: "Saldo insuficiente" });
        }
        await pool.query('UPDATE users SET tokenBalance = tokenBalance - ? WHERE wallet_address = ?', [amountTon, walletAddress]);

        // Enviar mensagem ao contrato para transferir TONs
        await sendMessageToContract(walletAddress, amountTon);

        try {
            await appendLedger({
                type: 'withdraw',
                walletAddress,
                amountTon,
                direction: 'debit',
                requestId: reqId,
                metadata: { route: 'withdraw' }
            });
        } catch (e) {
            req.log?.error({ err: e }, 'failed to append withdraw ledger');
        }

        res.status(200).json({ success: true, message: "Saque processado com sucesso" });
    } catch (error) {
        req.log?.error({ err: error }, 'Erro ao processar saque');
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

//#endregion


//#region ROTAS BANCO

// ==== ROTA: Receber eventos de segurança do front (observação console/devtools) ====
const securityEventSchema = z.object({
    events: z.array(z.object({
        type: z.string().max(40),
        ts: z.number().optional(),
        wallet: z.string().optional(),
        v: z.string().optional(),
        open: z.boolean().optional(),
        len: z.number().optional()
    })).max(50)
});

server.post('/client-security-event', securityEventLimiter, express.json({ limit:'32kb'}), async (req,res)=>{
    try {
        const parsed = securityEventSchema.safeParse(req.body);
        if(!parsed.success){
            return res.status(400).json({ error: 'Payload inválido' });
        }
        const events = parsed.data.events.map(e=> ({
            type: e.type,
            ts: e.ts || Date.now(),
            wallet: e.wallet || 'anon',
            meta: { open: e.open ?? undefined, len: e.len ?? undefined }
        }));
        // Firestore removido: Armazenamento de eventos deve ser implementado via MySQL ou outro mecanismo.
        // Métrica simples por tipo
        events.forEach(ev=>{ metrics.requests?.inc?.({ method:'POST', route:'/client-security-event', status:202 }); metrics.securityEvents?.inc?.({ type: ev.type }); });
        return res.status(202).json({ accepted: events.length });
    } catch(err){
        req.log?.error({ err }, 'erro ao registrar eventos de segurança');
        return res.status(500).json({ error: 'Erro ao registrar eventos' });
    }
});

// ==== Rate limit hook para registrar hits (colocar depois das definições de limiters) ====
// Express-rate-limit não expõe diretamente callback global; adicionamos wrapper utilitário se necessário no futuro.

// ==== Coleta de lag do event loop (timer simples) ====
let lastCheck = process.hrtime.bigint();
setInterval(()=>{
    const now = process.hrtime.bigint();
    const diffMs = Number(now - lastCheck)/1e6; // ms entre ticks
    lastCheck = now;
    const lagSec = Math.max(0, (diffMs - 1000)/1000); // se setInterval(1000) atrasou
    if(lagSec>0) metrics.eventLoopLag.observe({}, lagSec);
}, 1000).unref?.();

// ==== Scheduler limpeza idempotência (best-effort) ====
async function cleanupIdempotency(){
    try {
    // Firestore removido: Limpeza de idempotencyKeys deve ser implementada via MySQL ou outro mecanismo.
    } catch(e){
        // log silencioso
    }
}
setInterval(()=>{ if(process.env.JEST_WORKER_ID === undefined) cleanupIdempotency(); }, 5*60*1000).unref?.();


//#region ESCRITA //

// Rota para criar um usuário
server.post("/createUser", validateBody(createUserSchema), async (req, res) => {
    const { walletAddress } = req.validated;

    try {
        const result = await createUser(walletAddress);
        res.json(result);
    } catch (error) {
        req.log?.error({ err: error }, 'Erro ao criar/logar usuário');
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});

// Rota para enviar o token JWT em um cookie HttpOnly
server.post("/login", loginLimiter, validateBody(loginSchema), async (req, res) => {
    const { walletAddress } = req.validated;

    try {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        const [[user]] = await pool.query('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        const token = jwt.sign({ uid: walletAddress }, process.env.JWT_SECRET, { expiresIn: "7d" });
        res.cookie("jwt", token, {
            httpOnly: true,
            secure: process.env.JEST_WORKER_ID === undefined,
            maxAge: 7 * 24 * 3600 * 1000,
            sameSite: 'None',
            path: '/'
        });
        res.json({ message: "Login realizado com sucesso", token });
    } catch (error) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        req.log?.error({ err: error }, 'Erro no login');
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});


// Rota para adicionar item ao inventário
server.post("/processarCompra", compraLimiter, validateBody(processarCompraSchema), requireIdempotency(),
    async (req, res) => {
        try {
            const { walletAddress, itemNome, quantidade } = req.validated;
            const reqId = req.headers[idempotentHeader];
            const existing = await findByRequestId(reqId);
            if (existing) {
                return res.status(200).json({ replay: true, ledger: existing });
            }

            const result = await processarCompra(walletAddress, itemNome, quantidade);

            if (result.error) {
                if (result.error.includes("não encontrado")) {
                    return res.status(404).json(result);
                } else if (result.error.includes("Saldo insuficiente")) {
                    return res.status(402).json(result);
                } else {
                    return res.status(400).json(result);
                }
            }

            try {
                await appendLedger({
                    type: 'purchase',
                    walletAddress,
                    itemNome,
                    amountToken: quantidade,
                    requestId: reqId,
                    metadata: { route: 'processarCompra' }
                });
                if (metrics && metrics.ledgerWrites) metrics.ledgerWrites.inc();
            } catch (e) {
                req.log?.error({ err: e }, 'failed to append purchase ledger');
            }

            res.status(200).json(result);
        } catch (error) {
            req.log?.error({ err: error }, 'Erro ao processar compra');
            res.status(500).json({ error: "Erro interno do servidor" });
        }
    }
);
// Rota para remover item do inventario
server.post("/removeItem", validateBody(removeItemSchema), async (req, res) => {
    const { walletAddress, itemNome, quantidade } = req.validated;

    try {
        // Chama a função removeItem passando os parâmetros recebidos
        const result = await removeItem(walletAddress, itemNome, quantidade);

        // Se a função removeItem retornou um erro, envia de volta
        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        // Se tudo deu certo, retorna a resposta de sucesso
        res.status(200).json(result);
    } catch (error) {
    req.log?.error({ err: error }, 'Erro ao remover item');
        res.status(500).json({ error: "Erro ao processar a remoção do item." });
    }
});

// Basic health endpoint
server.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now(), version: process.env.APP_VERSION || '0.0.1' });
});

// Simple metrics placeholder (Prometheus style to be expanded later)
server.get('/metrics', (req, res) => {
    res.type('text/plain').send(`# HELP app_uptime_seconds The uptime of the process\n# TYPE app_uptime_seconds gauge\napp_uptime_seconds ${process.uptime()}\n`);
});

// Rota update grothStatus
server.post('/updatePlantStatus', async (req, res) => {
    try {
        const { walletAddress, slotId, statusField, newValue, utilityName } = req.body;

        if (!walletAddress || !slotId || !statusField || newValue === undefined || !utilityName) {
            return res.status(400).json({ success: false, message: "Parâmetros incompletos. Todos os campos são obrigatórios." });
        }

        const result = await updatePlantStatus(walletAddress, slotId, statusField, newValue, utilityName);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);

    } catch (error) {
    req.log?.error({ err: error }, 'Erro updatePlantStatus');
        return res.status(500).json({ success: false, message: "Erro interno do servidor", error: error.message });
    }
});

// Rota para remover parasitas
server.post("/removeParasita", utilityLimiter, async (req, res) => {
    const { walletAddress, slotId } = req.body;

    if (!walletAddress || !slotId) {
        return res.status(400).json({ success: false, message: "Parâmetros obrigatórios ausentes." });
    }

    try {
        const result = await removeParasita(walletAddress, slotId);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
    req.log?.error({ err: error }, 'Erro ao remover parasita');
        return res.status(500).json({ success: false, message: "Erro interno do servidor" });
    }
});

// Rota para coletar
server.post("/colectSeed", colherLimiter, validateBody(colectSeedSchema),
    async (req, res) => {
        try {
            const { walletAddress, slotID } = req.validated;

            // Chama a função de coleta da planta
            const resultado = await colectSeed(walletAddress, parseInt(slotID));

            // Verifica se ocorreu algum erro na coleta
            if (resultado.error) {
                if (resultado.error.includes("não encontrado")) {
                    return res.status(404).json(resultado);
                } else if (resultado.error.includes("pronta para colheita")) {
                    return res.status(403).json(resultado);
                } else {
                    return res.status(400).json(resultado);
                }
            }

            return res.status(200).json(resultado);
        } catch (error) {
            req.log?.error({ err: error }, 'Erro ao coletar semente');
            return res.status(500).json({
                error: "Erro interno do servidor.",
                message: process.env.NODE_ENV === "development" ? error.message : undefined,
            });
        }
    }
);

// Rota para renovar o token JWT
server.post("/renew-token", verifyToken, (req, res) => {
    try {
        // O middleware verifyToken já verificou o token e adicionou req.user
        const walletAddress = req.user.uid;

        // Gerar um novo token JWT
        const newToken = jwt.sign({ uid: walletAddress }, process.env.JWT_SECRET, {
            expiresIn: "7d"
        });

        // Definir o novo cookie HTTP-only
        res.cookie("jwt", newToken, {
            httpOnly: true,
            secure: process.env.JEST_WORKER_ID === undefined,
            maxAge: 7 * 24 * 3600 * 1000, // 7 dias
            sameSite: 'None',
            path: '/'
        });

        // Retornar o novo token
        res.json({
            message: "Token renovado com sucesso",
            token: newToken
        });
    } catch (error) {
    req.log?.error({ err: error }, 'Erro ao renovar token');
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// Rota Logout
server.post("/logout", (req, res) => {
    const token = req.cookies.jwt;
    if (token) {
        revokedTokens.add(token);
    }
    res.clearCookie("jwt");
    res.json({ message: "Logout realizado com sucesso" });
});
// (removido código órfão de métricas que nunca seria executado aqui)

function isTokenRevoked(token) {
    return revokedTokens.has(token);
}

server.use((req, res, next) => {
    const token = req.cookies.jwt;
    if (token && isTokenRevoked(token)) {
        return res.status(401).json({ error: "Token revogado" });
    }
    next();
});

//#endregion


//#region LEITURA //

// Rota GET para buscar dados do usuário no Firestore
server.get("/user/:walletAddress", verifyToken, async (req, res) => {
    const { walletAddress } = req.params;

    // Garante que o usuário autenticado só pode acessar os próprios dados
    if (req.user.uid !== walletAddress) {  // Compara o ID do usuário autenticado com o ID na URL
        return res.status(403).json({ error: "Acesso não autorizado" });
    }

    try {
        const [[user]] = await pool.query('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        res.json(user);
    } catch (error) {
        req.log?.error({ err: error }, 'Erro ao buscar usuário');
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// Rota GET para buscar os itens do Shop na Firestore
server.get('/items', async (req, res) => {
    try {
        const [items] = await pool.query('SELECT * FROM items');
        res.json({ items });
    } catch (error) {
        req.log?.error({ err: error }, 'Erro ao buscar itens');
        res.status(500).json({ error: 'Erro ao buscar os itens' });
    }
});

// Wallet Protetion 
server.get("/getProfile", async (req, res) => {
    const token = req.cookies.jwt || req.headers.authorization?.split(" ")[1]; // Primeiro tenta pegar dos cookies, depois do header

    if (!token) {
        return res.status(401).json({ error: "Token não encontrado, autenticação necessária." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [[user]] = await pool.query('SELECT * FROM users WHERE wallet_address = ?', [decoded.uid]);
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        res.json({ profile: user });
    } catch (error) {
        req.log?.error({ err: error }, 'Erro ao verificar token');
        res.status(401).json({ error: "Token inválido ou expirado" });
    }
});

// Rota para verificar se o usuário tem uma sessão válida
server.get("/session/check", verifyToken, async (req, res) => {
    try {
        // O middleware verifyToken já verificou o token e adicionou req.user
        const walletAddress = req.user.uid;
        // Buscar dados do usuário
        const [[user]] = await pool.query('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
        if (!user) {
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        // Forçar header CORS na resposta
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.json({ walletAddress });
    } catch (error) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        req.log?.error({ err: error }, 'Erro ao verificar sessão');
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

//#endregion

//#endregion


// async function monitorContract() {
//     try {
//         const transactions = await provider.getTransactions(contractAddress, 10); // Obtém as últimas 10 transações
//         transactions.forEach((tx) => {
//             if (!cache.has(tx.id)) {
//                 cache.set(tx.id, tx);
//                 logger.info("Nova transação detectada:", tx);
//                 // Processar a transação
//             }
//         });
//     } catch (error) {
//         logger.error("Erro ao monitorar contrato:", error);
//     }
// }
// setInterval(monitorContract, 5000);

// Middleware para esconder mensagens de erro detalhadas em produção

// Iniciar o servidor
// Handler global para 404 (Not Found) com CORS
server.use((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.status(404).json({ error: 'Rota não encontrada' });
});


const PORT = process.env.PORT;

// Criar servidor HTTPS
/* istanbul ignore next - ambiente de produção/https não exercitado em testes unitários */
if (process.env.JEST_WORKER_ID === undefined) {
  https.createServer(options, server).listen(PORT, () => {
      console.log(`Servidor HTTPS rodando na porta ${PORT}`);
      cron.schedule("0 * * * * *", async () => { // TODO: ajustar para produção
          try { await checkAndApplyParasites(); } catch (error) {
              console.error("Erro ao executar o cron job:", error);
          }
      });
  });
}

// Export para testes (impede inicialização redundante dentro de Jest)
export { server };
