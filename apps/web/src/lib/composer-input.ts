const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isImeKey(event: {
  isComposing?: boolean;
  keyCode?: number;
  nativeEvent?: { isComposing?: boolean; keyCode?: number };
}): boolean {
  const composing = event.nativeEvent?.isComposing ?? event.isComposing;
  const keyCode = event.nativeEvent?.keyCode ?? event.keyCode;
  return Boolean(composing) || keyCode === 229;
}

export function shouldSubmitOnEnter(
  event: {
    key: string;
    shiftKey: boolean;
    isComposing?: boolean;
    keyCode?: number;
    nativeEvent?: { isComposing?: boolean; keyCode?: number };
  },
  composingLocked = false,
): boolean {
  if (event.key !== "Enter" || event.shiftKey) return false;
  if (composingLocked || isImeKey(event)) return false;
  return true;
}

type ClipboardItemLike = {
  kind: string;
  getAsFile: () => File | null;
};

type ClipboardLike = {
  files?: Iterable<File> | ArrayLike<File>;
  items?: Iterable<ClipboardItemLike>;
};

function normalizeImageType(type: string): string {
  if (type === "image/jpg") return "image/jpeg";
  return type;
}

function isAllowedImage(file: File): boolean {
  const type = normalizeImageType(file.type);
  if (ALLOWED_IMAGE_TYPES.has(type)) return true;
  if (file.type) return false;
  return /\.(png|jpe?g|webp)$/i.test(file.name);
}

export function filesFromClipboard(data: ClipboardLike | null | undefined): File[] {
  if (!data) return [];
  const files: File[] = [];
  const seen = new Set<File>();

  const add = (file: File | null | undefined) => {
    if (!file || seen.has(file) || !isAllowedImage(file)) return;
    seen.add(file);
    files.push(file);
  };

  if (data.files) {
    for (const file of Array.from(data.files as ArrayLike<File>)) add(file);
  }
  if (data.items) {
    for (const item of data.items) {
      if (item.kind === "file") add(item.getAsFile());
    }
  }
  return files;
}
