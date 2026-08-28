export type AuthCatalogItem = {
  id: string;
  label: string;
  hint?: string;
  oauth: boolean;
  apiKey: boolean;
};

export type AuthMode = "oauth" | "api_key";

const PREFERRED_ORDER = ["github", "openai"];

/** auth.json keys that count as logged-in for a UI oauth provider. */
export function oauthAuthIds(providerId: string): string[] {
  if (providerId === "github" || providerId === "github-copilot") {
    return ["github-copilot", "github"];
  }
  if (providerId === "openai" || providerId === "openai-codex") {
    return ["openai-codex"];
  }
  return [providerId];
}

export function findAuthEntry(
  entries: Array<{ id: string; label: string; kind: "api_key" | "oauth" | "other" }>,
  providerId: string,
  mode: AuthMode,
): { id: string; label: string; kind: "api_key" | "oauth" | "other" } | undefined {
  if (mode === "oauth") {
    const ids = new Set(oauthAuthIds(providerId));
    return entries.find((entry) => ids.has(entry.id) && entry.kind === "oauth");
  }
  return entries.find((entry) => entry.id === providerId && entry.kind === "api_key");
}

export function mergeAuthCatalog(
  oauthProviders: Array<{ id: string; label: string }>,
  keyProviders: Array<{ id: string; label: string; hint: string }>,
  extraEntries: Array<{ id: string; label: string }> = [],
): AuthCatalogItem[] {
  const items = new Map<string, AuthCatalogItem>();

  const touch = (partial: AuthCatalogItem) => {
    const current = items.get(partial.id);
    if (!current) {
      items.set(partial.id, { ...partial });
      return;
    }
    items.set(partial.id, {
      id: partial.id,
      label: current.label || partial.label,
      hint: current.hint ?? partial.hint,
      oauth: current.oauth || partial.oauth,
      apiKey: current.apiKey || partial.apiKey,
    });
  };

  for (const provider of oauthProviders) {
    touch({ id: provider.id, label: provider.label, oauth: true, apiKey: false });
  }
  for (const provider of keyProviders) {
    touch({
      id: provider.id,
      label: provider.label,
      hint: provider.hint,
      oauth: false,
      apiKey: true,
    });
  }
  for (const entry of extraEntries) {
    touch({ id: entry.id, label: entry.label, oauth: false, apiKey: false });
  }

  const preferred = PREFERRED_ORDER.filter((id) => items.has(id));
  const rest = [...items.keys()]
    .filter((id) => !preferred.includes(id))
    .sort((left, right) => {
      const leftIndex = keyProviders.findIndex((item) => item.id === left);
      const rightIndex = keyProviders.findIndex((item) => item.id === right);
      if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
      if (leftIndex >= 0) return -1;
      if (rightIndex >= 0) return 1;
      return left.localeCompare(right);
    });

  return [...preferred, ...rest].map((id) => items.get(id)!);
}

/** Providers available in the current auth mode (login vs API key). */
export function providersForMode(catalog: AuthCatalogItem[], mode: AuthMode): AuthCatalogItem[] {
  return catalog.filter((item) => (mode === "oauth" ? item.oauth : item.apiKey));
}

export function pickDefaultProvider(
  catalog: AuthCatalogItem[],
  mode: AuthMode,
  preferredId?: string | null,
): string {
  const list = providersForMode(catalog, mode);
  if (preferredId && list.some((item) => item.id === preferredId)) return preferredId;
  return list[0]?.id ?? "";
}

export function authStatusLabel(
  kind: "api_key" | "oauth" | "other" | undefined,
  capabilities: { oauth?: boolean; apiKey?: boolean } = {},
): string {
  if (kind === "oauth") return "已登录";
  if (kind === "api_key") return "已保存密钥";
  if (kind === "other") return "已连接";
  if (capabilities.oauth) return "未登录";
  return "未配置密钥";
}

export function oauthButtonLabel(kind: "api_key" | "oauth" | "other" | undefined): string {
  return kind === "oauth" ? "重新登录" : "订阅登录";
}

export function logoutNotice(kind: "api_key" | "oauth" | "other" | undefined): string {
  return kind === "api_key" ? "已移除密钥。" : "已退出登录。";
}
