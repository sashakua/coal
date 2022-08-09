
const isWorking = new Set();

export function singeltonFactory(id: number, callback: any) {
  return async (...params: any[]) => {
    if (isWorking.has(id)) { return; }
    isWorking.add(id);
    try {
      await callback(...params);
    } catch {};
    isWorking.delete(id);
  };
}
