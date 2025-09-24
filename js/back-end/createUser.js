import { pool } from "./mysql.js";

// Verifica se o usuário existe ou cria novo usuário usando MySQL
async function createUser(walletAddress) {
  if (!walletAddress || typeof walletAddress !== "string" || walletAddress.trim() === "") {
    return { error: "Endereço de carteira inválido" };
  }

  try {
    // Verifica se o usuário já existe
    const [rows] = await pool.query("SELECT * FROM users WHERE wallet_address = ?", [walletAddress]);
    if (rows.length > 0) {
      return { message: "Login realizado com sucesso!", userData: rows[0] };
    }

    // Dados iniciais do usuário
    const userData = {
      wallet_address: walletAddress,
      token_balance: 1000.0,
      cripto_balance: 0.0,
      is_banned: false,
      history_deposit: JSON.stringify([]),
      history_withdrawn: JSON.stringify([]),
      inventario: JSON.stringify([]),
      plant_time: JSON.stringify([]),
      created_at: new Date()
    };

    // Cria o usuário no MySQL
    const [result] = await pool.query(
      `INSERT INTO users 
        (wallet_address, token_balance, cripto_balance, is_banned, history_deposit, history_withdrawn, inventario, plant_time, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.wallet_address,
        userData.token_balance,
        userData.cripto_balance,
        userData.is_banned,
        userData.history_deposit,
        userData.history_withdrawn,
        userData.inventario,
        userData.plant_time,
        userData.created_at
      ]
    );

    userData.id = result.insertId;

    // Inventário inicial (opcional: já insere itens padrão na tabela inventory)
    const inventarioInicial = [
      { item_id: "u1", quantity: 0 }, // Vaso
      { item_id: "u2", quantity: 0 }  // Regador
    ];

    for (const item of inventarioInicial) {
      await pool.query(
        "INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)",
        [userData.id, item.item_id, item.quantity]
      );
    }

    return { message: "Usuário criado com sucesso!", userData };
  } catch (error) {
    console.error("Erro ao verificar/criar usuário:", error);
    return { error: "Erro ao processar a solicitação." };
  }
}

export { createUser };
