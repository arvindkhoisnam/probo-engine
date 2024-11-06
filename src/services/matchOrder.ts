import { Engine } from "../engine";
import { BuyOrder, Orderbook, SellOrder } from "../Orderbook";
import { Redis } from "../Redis";
import {
  calcFillableBUYQuantity,
  calcFillableSELLQuantity,
} from "./calcFillableQuantity";
import { updateStockBalance } from "./updateStockBalance";

export function matchBuyOrders(
  userId: string,
  stockType: string,
  quantity: number,
  price: number,
  buy: BuyOrder,
  stockSymbol: string
) {
  const arr = Object.entries(buy[stockType]).reverse();
  let maxFillableQuant = calcFillableSELLQuantity(quantity, price, arr);
  let executedOrders = 0;
  let LTP: number = 0;
  arr.forEach(([key, value]) => {
    const [buyer] = Object.keys(value.orders);
    if (price <= Number(key) && maxFillableQuant > 0) {
      let toFill = Math.min(value.total, maxFillableQuant);

      maxFillableQuant -= toFill;
      value.total -= toFill;
      value.orders[buyer] -= toFill;
      executedOrders += toFill;
      LTP = Number(key);

      Engine.getInstance().inrbalances[buyer].balance -= toFill * Number(key);

      Engine.getInstance().inrbalances[userId].balance += toFill * Number(key);

      Engine.getInstance().stockBalances[userId][stockSymbol][
        stockType
      ].locked -= toFill;

      updateStockBalance(buyer, stockSymbol, stockType, quantity);

      // clean-up
      if (value.total === 0) {
        delete buy[stockType][Number(key)];
      }
      if (Object.keys(buy[stockType]).length === 0) {
        delete buy[stockType];
      }
    }
  });

  const pendingOrders = quantity - executedOrders;
  return { pendingOrders, executedOrders, LTP };
}

export function matchSellOrders(
  userId: string,
  stockType: string,
  quantity: number,
  price: number,
  sell: SellOrder,
  stockSymbol: string
) {
  const arr = Object.entries(sell[stockType]);
  let maxFillableQuant = calcFillableBUYQuantity(quantity, price, arr);
  let executedOrders = 0;
  let LTP: number = 0;

  arr.forEach(([key, value]) => {
    const [seller] = Object.keys(value.orders);
    if (price >= Number(key) && maxFillableQuant > 0) {
      let toFill = Math.min(value.total, maxFillableQuant);

      maxFillableQuant -= toFill;
      value.total -= toFill;
      value.orders[seller] -= toFill;
      executedOrders += toFill;
      LTP = Number(key);

      if (value.reverseOrder) {
        Engine.getInstance().inrbalances[seller].locked -=
          toFill * (1000 - Number(key));
        Engine.getInstance().inrbalances[userId].locked -= toFill * Number(key);

        updateStockBalance(userId, stockSymbol, stockType, toFill);

        if (stockType === "yes") {
          updateStockBalance(seller, stockSymbol, "no", toFill);
        } else {
          updateStockBalance(seller, stockSymbol, "yes", toFill);
        }
      } else {
        // credit seller's INR balance
        Engine.getInstance().inrbalances[seller].balance +=
          toFill * Number(key);
        // debit buyer's INR balance
        Engine.getInstance().inrbalances[userId].locked -= toFill * Number(key);
        // debit seller's STOCK balances
        Engine.getInstance().stockBalances[seller][stockSymbol][
          stockType
        ].locked -= toFill;
        // credit buyer's STOCK balances
      }

      // clean-up
      if (value.total === 0) {
        delete sell[stockType][Number(key)];
      }
      if (Object.keys(sell[stockType]).length === 0) {
        delete sell[stockType];
      }
    }
  });

  const pendingOrders = quantity - executedOrders;
  return { pendingOrders, executedOrders, LTP };
}
