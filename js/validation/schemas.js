import { z } from 'zod';

export const walletSchema = z.string().min(10, 'walletAddress inválido');

export const createUserSchema = z.object({
  walletAddress: walletSchema
});

export const loginSchema = z.object({
  walletAddress: walletSchema
});

export const processarCompraSchema = z.object({
  walletAddress: walletSchema,
  itemNome: z.string().min(1, 'Nome do item obrigatório'),
  quantidade: z.number().int().positive('Quantidade deve ser > 0')
});

export const removeItemSchema = z.object({
  walletAddress: walletSchema,
  itemNome: z.string().min(1),
  quantidade: z.number().int().nonnegative()
});

export const plantSeedSchema = z.object({
  walletAddress: walletSchema,
  slotID: z.number().int().nonnegative(),
  itemNome: z.string().min(1),
  itemTime: z.number().positive(),
  itemId: z.string().optional(),
  raridade: z.string().optional(),
  plantDate: z.string().datetime(),
  harvestDate: z.string().datetime(),
  isWatered: z.boolean().optional(),
  isParasita: z.boolean().optional(),
  isProtect: z.boolean().optional(),
  isFertilized: z.boolean().optional()
});

export const colectSeedSchema = z.object({
  walletAddress: walletSchema,
  slotID: z.number().int().nonnegative()
});

export const withdrawSchema = z.object({
  walletAddress: walletSchema,
  amountTon: z.number().positive('Valor deve ser > 0')
});

export const updateBalanceSchema = z.object({
  walletAddress: walletSchema,
  novoSaldo: z.number().nonnegative()
});

export const updatePlantStatusSchema = z.object({
  walletAddress: walletSchema,
  slotId: z.union([z.string(), z.number()]),
  statusField: z.string().min(1),
  newValue: z.any(),
  utilityName: z.string().min(1)
});

export const renewTokenSchema = z.object({}); // sem body

export const logoutSchema = z.object({});

export const challengeSchema = z.object({
  walletAddress: walletSchema
});

export const verifyTransactionSchema = z.object({
  walletAddress: walletSchema,
  challenge: z.string().min(10),
  transaction: z.any()
});

export const monitorDepositSchema = z.object({
  transactionId: z.string().min(1),
  walletAddress: walletSchema,
  amountTon: z.number().positive()
});

// Header usado para controle de idempotência. Separado do x-request-id (correlação de logs).
export const idempotentHeader = 'x-idempotency-key';


