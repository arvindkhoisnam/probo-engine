export function calcFillableSELLQuantity(
  quantity: number,
  price: number,
  arr: any
) {
  let maxFillableQuant = 0;
  let remainingQuant = quantity;

  arr.forEach(([key, value]: [key: string, value: { total: number }]) => {
    if (Number(key) >= price && maxFillableQuant < quantity) {
      if (remainingQuant > value.total) {
        maxFillableQuant += value.total;
        remainingQuant -= value.total;
      } else {
        maxFillableQuant += remainingQuant;
        return;
      }
    }
  });
  return maxFillableQuant;
}

export function calcFillableBUYQuantity(
  quantity: number,
  price: number,
  arr: any
) {
  let fillQuant = 0;
  let remainingQuant = quantity;
  arr.forEach(([key, value]: [key: string, value: { total: number }]) => {
    if (Number(key) <= price && fillQuant < quantity) {
      if (remainingQuant > value.total) {
        fillQuant += value.total;
        remainingQuant -= value.total;
      } else {
        fillQuant += remainingQuant;
        return;
      }
    }
  });
  return fillQuant;
}
