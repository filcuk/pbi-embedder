import { parseBooleanAttr, setHidden } from "../utils/dom.js";
import { createIcon } from "../utils/icons.js";

/**
 * Drag-and-drop / click-to-browse file picker.
 *
 * Markup:
 *   <div class="file-dropzone" data-file-accept=".json,.txt" data-file-multiple data-file-max="5">
 *     <input type="file" class="file-dropzone-input" hidden />
 *     <button type="button" class="file-dropzone-prompt">
 *       <span data-icon="upload" data-icon-class="file-dropzone-icon"></span>
 *       <span class="file-dropzone-text">
 *         <span class="file-dropzone-primary">Drop files here</span>
 *         <span class="file-dropzone-secondary">select to browse</span>
 *       </span>
 *     </button>
 *     <ul class="file-dropzone-list hidden" hidden></ul>
 *   </div>
 *
 * data-file-accept — passed to the hidden input's `accept`; also shown in the prompt meta line
 * data-file-multiple — presence or "true" for multiple files
 * data-file-max — optional maximum file count; shown in the prompt meta line
 *
 * Init fills `.file-dropzone-meta` (created if missing) with allowed types and file count.
 */

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human-readable label for one `accept` token (e.g. `.json` → `JSON`, `image/*` → `Images`). */
function formatAcceptToken(token) {
  const value = token.trim();
  if (!value) return "";

  if (value.startsWith(".")) {
    return value.slice(1).toUpperCase();
  }

  const slash = value.indexOf("/");
  if (slash !== -1) {
    const type = value.slice(0, slash);
    const subtype = value.slice(slash + 1);
    if (subtype === "*") {
      if (type === "image") return "Images";
      if (type === "audio") return "Audio";
      if (type === "video") return "Videos";
      return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
    }
    return subtype.toUpperCase();
  }

  return value;
}

function formatAcceptLabel(accept) {
  if (!accept?.trim()) return "";
  return accept
    .split(",")
    .map(formatAcceptToken)
    .filter(Boolean)
    .join(", ");
}

function formatFilesLabel(max) {
  if (max && Number.isFinite(max) && max > 0) {
    return `Up to ${max} file${max === 1 ? "" : "s"}`;
  }
  return "Multiple files";
}

function formatConstraintsLabel(acceptTypes, isMultiple, max) {
  const parts = [];
  const acceptLabel = formatAcceptLabel(acceptTypes);
  if (acceptLabel) parts.push(acceptLabel);
  // Single + unrestricted is the default — no note needed.
  if (isMultiple) parts.push(formatFilesLabel(max));
  return parts.join(" · ");
}

function syncInputFiles(input, files) {
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
}

export function initFileDropzone(
  dropzoneEl,
  { accept, multiple, maxFiles, onFiles, onError, onClear } = {}
) {
  if (!dropzoneEl) return null;

  const input = dropzoneEl.querySelector(".file-dropzone-input");
  const prompt = dropzoneEl.querySelector(".file-dropzone-prompt");
  const list = dropzoneEl.querySelector(".file-dropzone-list");
  if (!input || !prompt) return null;

  const acceptTypes = accept ?? dropzoneEl.dataset.fileAccept ?? "";
  const isMultiple =
    multiple ?? parseBooleanAttr(dropzoneEl.dataset.fileMultiple) ?? false;
  const max =
    maxFiles ??
    (dropzoneEl.dataset.fileMax ? Number(dropzoneEl.dataset.fileMax) : undefined);

  if (acceptTypes) input.accept = acceptTypes;
  input.multiple = isMultiple;

  const constraintsLabel = formatConstraintsLabel(acceptTypes, isMultiple, max);
  const text = prompt.querySelector(".file-dropzone-text") ?? prompt;
  let meta = text.querySelector(".file-dropzone-meta");
  if (constraintsLabel) {
    if (!meta) {
      meta = document.createElement("span");
      meta.className = "file-dropzone-meta";
      text.append(meta);
    }
    meta.textContent = constraintsLabel;
    setHidden(meta, false);
  } else if (meta) {
    meta.textContent = "";
    setHidden(meta, true);
  }

  /** @type {File[]} */
  let files = [];
  let dragDepth = 0;

  function setDragover(active) {
    dropzoneEl.classList.toggle("is-dragover", active);
  }

  function commitFiles(nextFiles) {
    const hadFiles = files.length > 0;
    files = nextFiles;
    syncInputFiles(input, files);
    renderList();

    if (!files.length) {
      if (hadFiles) onClear?.({ dropzoneEl });
      onFiles?.({ dropzoneEl, files });
      return;
    }

    onFiles?.({ dropzoneEl, files });
  }

  function trimToMax(candidateFiles) {
    if (!max || !Number.isFinite(max) || max <= 0) return candidateFiles;
    if (candidateFiles.length <= max) return candidateFiles;

    onError?.({
      dropzoneEl,
      message: `You can add at most ${max} file${max === 1 ? "" : "s"}.`,
      files: candidateFiles,
    });
    return candidateFiles.slice(0, max);
  }

  function addFiles(incoming) {
    if (!incoming.length) return;

    const next = isMultiple ? [...files, ...incoming] : incoming.slice(0, 1);
    commitFiles(trimToMax(next));
  }

  function removeFile(index) {
    commitFiles(files.filter((_, fileIndex) => fileIndex !== index));
  }

  function renderList() {
    if (!list) return;

    if (!files.length) {
      setHidden(list, true);
      list.replaceChildren();
      return;
    }

    setHidden(list, false);
    list.replaceChildren();

    files.forEach((file, index) => {
      const item = document.createElement("li");
      item.className = "file-dropzone-item";

      const name = document.createElement("span");
      name.className = "file-dropzone-item-name";
      name.textContent = file.name;

      const meta = document.createElement("span");
      meta.className = "file-dropzone-item-meta";
      meta.textContent = formatFileSize(file.size);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "file-dropzone-remove btn btn-icon";
      removeBtn.setAttribute("aria-label", `Remove ${file.name}`);
      removeBtn.append(createIcon("error", { className: "file-dropzone-remove-icon" }));
      removeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        removeFile(index);
      });

      item.append(name, meta, removeBtn);
      list.append(item);
    });
  }

  function openPicker() {
    input.value = "";
    input.click();
  }

  function onPromptClick() {
    openPicker();
  }

  function onInputChange() {
    const incoming = [...input.files];
    if (!incoming.length) return;

    if (isMultiple) {
      addFiles(incoming);
      return;
    }

    commitFiles(incoming.slice(0, 1));
  }

  function onDragEnter(event) {
    event.preventDefault();
    dragDepth += 1;
    setDragover(true);
  }

  function onDragOver(event) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(event) {
    event.preventDefault();
    dragDepth -= 1;
    if (dragDepth <= 0) {
      dragDepth = 0;
      setDragover(false);
    }
  }

  function onDrop(event) {
    event.preventDefault();
    dragDepth = 0;
    setDragover(false);

    const incoming = [...(event.dataTransfer?.files ?? [])];
    if (!incoming.length) return;

    if (isMultiple) {
      addFiles(incoming);
      return;
    }

    commitFiles(incoming.slice(0, 1));
  }

  prompt.addEventListener("click", onPromptClick);
  input.addEventListener("change", onInputChange);
  dropzoneEl.addEventListener("dragenter", onDragEnter);
  dropzoneEl.addEventListener("dragover", onDragOver);
  dropzoneEl.addEventListener("dragleave", onDragLeave);
  dropzoneEl.addEventListener("drop", onDrop);

  renderList();

  return {
    openPicker,
    clear: () => commitFiles([]),
    getFiles: () => [...files],
    destroy: () => {
      prompt.removeEventListener("click", onPromptClick);
      input.removeEventListener("change", onInputChange);
      dropzoneEl.removeEventListener("dragenter", onDragEnter);
      dropzoneEl.removeEventListener("dragover", onDragOver);
      dropzoneEl.removeEventListener("dragleave", onDragLeave);
      dropzoneEl.removeEventListener("drop", onDrop);
      dragDepth = 0;
      setDragover(false);
    },
  };
}

/** Wire every `.file-dropzone` block in `root`. */
export function initFileDropzones(root = document) {
  const instances = [];
  root.querySelectorAll(".file-dropzone").forEach((dropzoneEl) => {
    const instance = initFileDropzone(dropzoneEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
