// Abstração de provedor blockchain (TON ou mock)
import TonWeb from 'tonweb';

const MODE = process.env.BLOCKCHAIN_MODE || 'mock'; // 'mock' | 'ton'

class MockProvider {
  constructor() { this.txs = []; }
  async sendMessage({ toAddress, amountTon, payload }) {
    const txId = 'mock_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10);
    const tx = { txId, toAddress, amountTon, payload: payload || 'Mock Tx', timestamp: Date.now() };
    this.txs.push(tx);
    return tx;
  }
  async listRecent(limit = 10) { return this.txs.slice(-limit).reverse(); }
}

class TonProvider {
  constructor() {
    this.tonweb = new TonWeb();
    const publicKey = process.env.TON_PUBLIC_KEY || 'chave_publica_do_contrato';
    const secretKey = process.env.TON_SECRET_KEY || 'chave_privada_do_contrato';
    this.wallet = this.tonweb.wallet.create({ publicKey, secretKey });
  }
  async sendMessage({ toAddress, amountTon, payload }) {
    const seqno = await this.wallet.getSeqno();
    const result = await this.wallet.transfer({
      toAddress,
      amount: TonWeb.utils.toNano(amountTon),
      seqno,
      payload: payload || 'Transação automatizada'
    });
    return { txId: result?.id || `${seqno}-${Date.now()}`, raw: result };
  }
  async listRecent(_limit = 10) { return []; }
}

export const blockchain = MODE === 'ton' ? new TonProvider() : new MockProvider();
export function isMock() { return MODE !== 'ton'; }
