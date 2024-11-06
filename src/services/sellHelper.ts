import { SellOrder } from "../Orderbook";

export function addStockType(
  OB: SellOrder,
  userId: string,
  stockType: string,
  price: number,
  quantity: number
) {
  OB = {
    ...OB,
    [stockType]: {
      [price]: {
        reverseOrder: false,
        total: quantity,
        orders: {
          [userId]: quantity,
        },
      },
    },
  };
  return OB;
}

export function addStrikePrice(
  OB: SellOrder,
  userId: string,
  stockType: string,
  price: number,
  quantity: number
) {
  OB[stockType] = {
    ...OB[stockType],
    [price]: {
      reverseOrder: false,
      total: quantity,
      orders: {
        [userId]: quantity,
      },
    },
  };

  return OB;
}

export function addNewUser(
  OB: SellOrder,
  userId: string,
  stockType: string,
  price: number,
  quantity: number
) {
  OB[stockType][price].total += quantity;
  OB[stockType][price].orders = {
    ...OB[stockType][price].orders,
    [userId]: quantity,
  };
  return OB;
}

export function updateExistingOrder(
  OB: SellOrder,
  userId: string,
  stockType: string,
  price: number,
  quantity: number
) {
  OB[stockType][price].total += quantity;
  OB[stockType][price].orders[userId] += quantity;

  return OB;
}
