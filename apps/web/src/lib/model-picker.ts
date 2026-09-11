import type { ThinkingLevel } from "@qingzhou/protocol";

export type PickerModel = { provider: string; id: string; name?: string };

export const THINKING_LABEL: Record<ThinkingLevel, string> = {
  off: "关闭",
  minimal: "很少",
  low: "较低",
  medium: "中等",
  high: "较高",
  xhigh: "很高",
  max: "最大",
};

export const THINKING_SHORT: Record<ThinkingLevel, string> = {
  off: "关",
  minimal: "微",
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "极",
  max: "最",
};

export function modelKey(model: PickerModel): string {
  return `${model.provider}/${model.id}`;
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(length - 1, Math.max(0, Math.round(index)));
}

export function indexOfModel(models: PickerModel[], modelId: string | null): number {
  const index = models.findIndex((model) => modelKey(model) === modelId);
  return index < 0 ? 0 : index;
}

export function nextModelIndex(models: PickerModel[], modelId: string | null): number {
  if (models.length === 0) return 0;
  return (indexOfModel(models, modelId) + 1) % models.length;
}

export function sliderPercent(index: number, length: number): number {
  if (length <= 1) return 0;
  return (clampIndex(index, length) / (length - 1)) * 100;
}
