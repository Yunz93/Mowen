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

export function fileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${normalizeImageType(file.type)}:${file.lastModified}`;
}

export function filesFromClipboard(data: ClipboardLike | null | undefined): File[] {
  if (!data) return [];
  const files: File[] = [];
  const seen = new Set<string>();

  const add = (file: File | null | undefined) => {
    if (!file || !isAllowedImage(file)) return;
    const key = fileFingerprint(file);
    if (seen.has(key)) return;
    seen.add(key);
    files.push(file);
  };

  if (data.files) {
    for (const file of Array.from(data.files as ArrayLike<File>)) add(file);
  }
  // Browsers often expose the same paste on both `files` and `items` as distinct
  // File objects. Prefer the FileList and only read items when it was empty.
  if (files.length > 0) return files;
  if (data.items) {
    for (const item of data.items) {
      if (item.kind === "file") add(item.getAsFile());
    }
  }
  return files;
}

export function composerCanSubmit(text: string, imageCount: number): boolean {
  return Boolean(text.trim()) || imageCount > 0;
}
