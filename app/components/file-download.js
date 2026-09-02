import { createIcon } from "../utils/icons.js";

/**
 * Click-to-download file rows. Content is generated on demand via `getContent`.
 *
 * Markup:
 *   <div class="file-download">
 *     <ul class="file-download-list">
 *       <li>
 *         <button type="button" class="file-download-item btn" data-file-download-name="notes.txt"
 *           aria-label="Download notes.txt">
 *           <span class="file-download-item-name">notes<span class="file-download-item-ext">.txt</span></span>
 *           <span class="file-download-item-meta">Plain text</span>
 *           <span data-icon="download" data-icon-class="btn-icon-svg"></span>
 *         </button>
 *       </li>
 *     </ul>
 *   </div>
 *
 * data-file-download-name — default filename
 * data-file-download-mime — MIME type (defaults to text/plain)
 */

const DEFAULT_MIME_TYPE = "text/plain;charset=utf-8";

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveByteLength(content) {
  if (typeof content === "string") {
    return new TextEncoder().encode(content).byteLength;
  }
  if (content instanceof Blob) return content.size;
  if (content instanceof ArrayBuffer) return content.byteLength;
  return 0;
}

async function resolveContent(getContent, fallbackContent) {
  if (getContent) return getContent();
  return fallbackContent ?? "";
}

function toBlob(content, mimeType) {
  if (content instanceof Blob) return content;
  if (content instanceof ArrayBuffer) {
    return new Blob([content], { type: mimeType });
  }
  return new Blob([String(content)], { type: mimeType });
}

/**
 * Trigger a browser download for the given content.
 *
 * @param {{ filename: string, content?: string | Blob | ArrayBuffer, mimeType?: string, getContent?: () => string | Blob | ArrayBuffer | Promise<string | Blob | ArrayBuffer> }} options
 */
export async function downloadFile({
  filename,
  content,
  mimeType = DEFAULT_MIME_TYPE,
  getContent,
} = {}) {
  const resolved = await resolveContent(getContent, content);
  const blob = toBlob(resolved, mimeType);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return { filename, size: blob.size };
}

function readMimeType(sourceEl, fallback) {
  return sourceEl?.dataset.fileDownloadMime?.trim() || fallback || DEFAULT_MIME_TYPE;
}

function readFilename(sourceEl, fallback) {
  return sourceEl?.dataset.fileDownloadName?.trim() || fallback || "download.txt";
}

function formatItemMeta(byteLength) {
  return byteLength ? formatFileSize(byteLength) : "";
}

function splitFilename(filename) {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) return { stem: filename, ext: "" };
  return {
    stem: filename.slice(0, lastDot),
    ext: filename.slice(lastDot),
  };
}

function updateItemMeta(itemEl, { filename, byteLength }) {
  const nameEl = itemEl.querySelector(".file-download-item-name");
  const metaEl = itemEl.querySelector(".file-download-item-meta");

  if (nameEl) {
    const { stem, ext } = splitFilename(filename);
    nameEl.replaceChildren();
    nameEl.append(stem);
    if (ext) {
      const extEl = document.createElement("span");
      extEl.className = "file-download-item-ext";
      extEl.textContent = ext;
      nameEl.append(extEl);
    }
  }
  if (metaEl) metaEl.textContent = formatItemMeta(byteLength);
}

function ensureDownloadItem(itemEl, filename) {
  itemEl.type = "button";
  itemEl.classList.add("btn");
  itemEl.setAttribute("aria-label", `Download ${filename}`);

  const hasIcon =
    itemEl.querySelector(".btn-icon-svg") ||
    itemEl.querySelector('[data-icon="download"]');
  if (!hasIcon) {
    itemEl.append(createIcon("download", { className: "btn-icon-svg" }));
  }

  return itemEl;
}

function bindDownloadAction(actionEl, handler) {
  actionEl.addEventListener("click", handler);
  return () => actionEl.removeEventListener("click", handler);
}

export function initFileDownload(
  downloadEl,
  { filename, mimeType, content, getContent, files, onDownload } = {}
) {
  if (!downloadEl) return null;

  const items = [...downloadEl.querySelectorAll(".file-download-item")];
  if (!items.length) return null;

  const cleanups = [];

  async function runDownload(fileConfig, sourceEl) {
    const resolvedFilename = fileConfig.filename ?? readFilename(sourceEl, filename);
    const resolvedMimeType = fileConfig.mimeType ?? readMimeType(sourceEl, mimeType);
    const result = await downloadFile({
      filename: resolvedFilename,
      content: fileConfig.content ?? content,
      mimeType: resolvedMimeType,
      getContent: fileConfig.getContent ?? getContent,
    });
    onDownload?.({
      downloadEl,
      filename: resolvedFilename,
      size: result.size,
      sourceEl,
    });
    return result;
  }

  items.forEach((itemEl, index) => {
    const fromOptions = files?.[index] ?? {};
    const fileConfig = {
      filename: fromOptions.filename ?? readFilename(itemEl, filename),
      mimeType: fromOptions.mimeType ?? readMimeType(itemEl, mimeType),
      content: fromOptions.content ?? content,
      getContent: fromOptions.getContent ?? getContent,
    };

    ensureDownloadItem(itemEl, fileConfig.filename);

    void resolveContent(fileConfig.getContent, fileConfig.content).then((resolved) => {
      updateItemMeta(itemEl, {
        filename: fileConfig.filename,
        byteLength: resolveByteLength(resolved),
      });
    });

    cleanups.push(
      bindDownloadAction(itemEl, () => {
        void runDownload(fileConfig, itemEl);
      })
    );
  });

  return {
    download: (index = 0) => {
      const itemEl = items[index];
      if (!itemEl) return Promise.resolve(null);
      const fromOptions = files?.[index] ?? {};
      return runDownload(
        {
          filename: fromOptions.filename ?? readFilename(itemEl, filename),
          mimeType: fromOptions.mimeType ?? readMimeType(itemEl, mimeType),
          content: fromOptions.content ?? content,
          getContent: fromOptions.getContent ?? getContent,
        },
        itemEl
      );
    },
    destroy: () => cleanups.forEach((cleanup) => cleanup()),
  };
}

/** Wire every `.file-download` block in `root`. */
export function initFileDownloads(root = document) {
  const instances = [];
  root.querySelectorAll(".file-download").forEach((downloadEl) => {
    const instance = initFileDownload(downloadEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
