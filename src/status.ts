
let status = false;

export const setStatus = (next: any) => {
  status = next;
}

export const getStatus = () => status;
