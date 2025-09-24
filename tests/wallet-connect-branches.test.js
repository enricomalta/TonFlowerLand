
import { jest } from '@jest/globals';

// Mock pool.query para MySQL
const queryMock = jest.fn(async () => [true]);
const poolMock = { query: queryMock };

jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool: poolMock }));

const { generateChallenge } = await import('../js/back-end/walletConnect.js');

describe('walletConnect generateChallenge branches', () => {
  test('400 when wallet missing', async () => {
    const req = { body: {} };
    const res = { status: jest.fn(function(c){ this.statusCode=c; return this; }), json: jest.fn(function(o){ this.payload=o; return this; }) };
    await generateChallenge(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/Wallet address required/);
  });

  test('success path', async () => {
    const req = { body: { walletAddress: 'wa1' } };
    const res = { status: jest.fn(function(c){ this.statusCode=c; return this; }), json: jest.fn(function(o){ this.payload=o; return this; }) };
    await generateChallenge(req, res);
    expect(res.payload.challenge).toMatch(/TON Login Challenge/);
    expect(queryMock).toHaveBeenCalled();
  });
});
