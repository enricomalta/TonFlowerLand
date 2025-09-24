import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config(); // Carrega as variáveis do .env

// Middleware para verificar token JWT (no servidor)
async function verifyToken(req, res, next) {
    // console.log("Headers:", req.headers);
    // console.log("Cookies:", req.cookies);
    
    // Tentar obter o token do cookie
    let token = req.cookies.jwt;
    
    
    // Se não encontrar no cookie, tentar no header
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        // Formato esperado: "Bearer [token]"
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        }
    }
    
    if (!token) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        return res.status(401).json({ error: "Token não fornecido" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        console.error("Erro ao verificar token:", error);
        return res.status(401).json({ error: "Token inválido" });
    }
}

export { verifyToken };