export type Rejectable = {
  reject: (error: Error) => void;
};

export function failPendingRequests(pending: Map<string, Rejectable>, error: Error): void {
  for (const item of pending.values()) item.reject(error);
  pending.clear();
}
