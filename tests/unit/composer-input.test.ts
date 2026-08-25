import { describe, expect, it } from "vitest";
import { filesFromClipboard, isImeKey, shouldSubmitOnEnter, composerCanSubmit } from "../../apps/web/src/lib/composer-input.ts";

describe("composer input", () => {
  it("does not submit while IME is composing", () => {
    expect(shouldSubmitOnEnter({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false);
    expect(shouldSubmitOnEnter({ key: "Enter", shiftKey: false, keyCode: 229 })).toBe(false);
    expect(shouldSubmitOnEnter({ key: "Enter", shiftKey: false }, true)).toBe(false);
    expect(shouldSubmitOnEnter({ key: "Enter", shiftKey: true })).toBe(false);
    expect(shouldSubmitOnEnter({ key: "Enter", shiftKey: false })).toBe(true);
  });

  it("treats keyCode 229 as IME", () => {
    expect(isImeKey({ keyCode: 229 })).toBe(true);
    expect(isImeKey({ nativeEvent: { isComposing: true } })).toBe(true);
    expect(isImeKey({ isComposing: false, keyCode: 13 })).toBe(false);
  });

  it("collects image files from a paste payload", () => {
    const png = new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" });
    const txt = new File(["hello"], "note.txt", { type: "text/plain" });
    const files = filesFromClipboard({
      files: [png, txt],
      items: [
        { kind: "file", getAsFile: () => png },
        { kind: "string", getAsFile: () => null },
      ],
    });
    expect(files.map((file) => file.name)).toEqual(["shot.png"]);
  });

  it("dedupes the same paste when files and items are different File objects", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const fromFiles = new File([bytes], "shot.png", { type: "image/png", lastModified: 1_700_000_000_000 });
    const fromItems = new File([bytes], "shot.png", { type: "image/png", lastModified: 1_700_000_000_000 });
    expect(fromFiles).not.toBe(fromItems);
    const files = filesFromClipboard({
      files: [fromFiles],
      items: [{ kind: "file", getAsFile: () => fromItems }],
    });
    expect(files).toHaveLength(1);
    expect(files[0]).toBe(fromFiles);
  });

  it("reads images from items when the FileList is empty", () => {
    const png = new File([new Uint8Array([1, 2, 3])], "clip.png", { type: "image/png" });
    const files = filesFromClipboard({
      files: [],
      items: [{ kind: "file", getAsFile: () => png }],
    });
    expect(files.map((file) => file.name)).toEqual(["clip.png"]);
  });

  it("allows sending with only attached images", () => {
    expect(composerCanSubmit("", 1)).toBe(true);
    expect(composerCanSubmit("   ", 0)).toBe(false);
    expect(composerCanSubmit("hello", 0)).toBe(true);
  });
});
