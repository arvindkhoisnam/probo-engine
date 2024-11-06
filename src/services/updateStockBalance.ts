import { Engine } from "../engine";

export function updateStockBalance(
  userId: string,
  stockSymbol: string,
  stockType: string,
  quantity: number
) {
  const existingStockSymbol =
    Engine.getInstance().stockBalances[userId].hasOwnProperty(stockSymbol);
  const existingStockType =
    Engine.getInstance().stockBalances[userId][stockSymbol]?.hasOwnProperty(
      stockType
    );

  if (!existingStockSymbol) {
    Engine.getInstance().stockBalances[userId] = {
      ...Engine.getInstance().stockBalances[userId],
      [stockSymbol]: {
        [stockType]: {
          quantity: quantity,
          locked: 0,
        },
      },
    };
    return;
  }

  if (!existingStockType) {
    Engine.getInstance().stockBalances[userId][stockSymbol] = {
      ...Engine.getInstance().stockBalances[userId][stockSymbol],
      [stockType]: {
        quantity: quantity,
        locked: 0,
      },
    };
    return;
  }
  if (existingStockType) {
    Engine.getInstance().stockBalances[userId][stockSymbol][
      stockType
    ].quantity += quantity;
    return;
  }
}
