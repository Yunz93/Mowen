export type AuthCatalogItem = {
  id: string;
  label: string;
  hint?: string;
  oauth: boolean;
  apiKey: boolean;
};

const PREFERRED_ORDER = ["github", "openai"];

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

export function authStatusLabel(
  kind: "api_key" | "oauth" | "other" | undefined,
  capabilities: { oauth?: boolean; apiKey?: boolean } = {},
): string {
  if (kind === "oauth") return "已登录";
  if (kind === "api_key") return "已保存密钥";
  if (kind === "other") return "已连接";
  if (capabilities.oauth && capabilities.apiKey) return "订阅登录或粘贴密钥";
  if (capabilities.oauth) return "未登录";
  return "未配置密钥";
}

export function oauthButtonLabel(kind: "api_key" | "oauth" | "other" | undefined): string {
  return kind === "api_key" ? "改用订阅登录" : "订阅登录";
}

export function logoutNotice(kind: "api_key" | "oauth" | "other" | undefined): string {
  return kind === "api_key" ? "已移除密钥。" : "已退出登录。";
}
