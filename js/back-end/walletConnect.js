import * as crypto from 'crypto';
import { pool } from './mysql.js';

async function generateChallenge(req, res){
    const walletAddress = req.body.walletAddress;
    if(!walletAddress){
        return res.status(400).json({ error: 'Wallet address required' });
    }
    const challenge = `TON Login Challenge: ${crypto.randomBytes(32).toString('hex')}`;
    const createdAt = new Date().toISOString();
    await pool.query(
        'INSERT INTO challenges (wallet_address, challenge, created_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE challenge = VALUES(challenge), created_at = VALUES(created_at)',
        [walletAddress, challenge, createdAt]
    );
    return res.json({ challenge });
}

export { generateChallenge };