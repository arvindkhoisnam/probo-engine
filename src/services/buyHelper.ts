import { SellOrder } from "../Orderbook";
// import { reverseOrder } from "./reverseOrder";

export function OrderReverse(
  OB: SellOrder,
  userId: string,
  stockType: string,
  quantity: number,
  price: number
) {
  const newStrikePrice = 1000 - Number(price);
  const existingStockType = OB.hasOwnProperty(stockType);
  const existingStrikePrice = OB[stockType]?.hasOwnProperty(newStrikePrice);

  if (!existingStockType) {
    OB[stockType] = {
      [newStrikePrice]: {
        reverseOrder: true,
        total: quantity,
        orders: {
          [userId]: quantity,
        },
      },
    };
  }
  if (!existingStrikePrice) {
    OB[stockType] = {
      ...OB[stockType],
      [newStrikePrice]: {
        reverseOrder: true,
        total: quantity,
        orders: {
          [userId]: quantity,
        },
      },
    };
  }

  if (existingStrikePrice) {
    OB[stockType][newStrikePrice].total += quantity;
    OB[stockType][newStrikePrice].orders[userId] += quantity;
  }

  return OB;
}
