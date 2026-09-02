import test from "node:test";
import assert from "node:assert/strict";
import {
  TOOLING_STORAGE_KEY,
  loadPersistedTooling,
  savePersistedTooling,
} from "../app/tools/persist.js";

/**
 * @returns {{
 *   store: Map<string, string>,
 *   install: () => void,
 *   restore: () => void,
 * }}
 */
function createMemoryLocalStorage() {
  /** @type {Map<string, string>} */
  const store = new Map();
  const previous = globalThis.localStorage;

  const localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };

  return {
    store,
    install() {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: localStorage,
      });
    },
    restore() {
      if (previous === undefined) {
        // @ts-ignore — Node has no localStorage by default
        delete globalThis.localStorage;
      } else {
        Object.defineProperty(globalThis, "localStorage", {
          configurable: true,
          value: previous,
        });
      }
    },
  };
}

test("save and load round-trip selection and inputs", () => {
  const memory = createMemoryLocalStorage();
  memory.install();
  try {
    const selection = {
      family: /** @type {const} */ ("m"),
      input: /** @type {const} */ ("json"),
      output: /** @type {const} */ ("m-json"),
      quoteStyle: /** @type {const} */ ("single"),
      compact: true,
      includeParsing: true,
      convertQuotes: false,
    };
    const tabular = {
      columns: [{ id: "c1", label: "Name", type: /** @type {const} */ ("text") }],
      rows: [{ id: "r1", cells: { c1: "Widget" } }],
    };

    savePersistedTooling({
      selection,
      inputs: {
        tabular,
        json: '[{"Name":"Widget"}]',
        "m-json": `"[{'Name':'Widget'}]"`,
      },
    });

    const loaded = loadPersistedTooling();
    assert.ok(loaded);
    assert.equal(loaded.v, 1);
    assert.deepEqual(loaded.selection, selection);
    assert.deepEqual(loaded.inputs.tabular, tabular);
    assert.equal(loaded.inputs.json, '[{"Name":"Widget"}]');
    assert.equal(loaded.inputs["m-json"], `"[{'Name':'Widget'}]"`);
  } finally {
    memory.restore();
  }
});

test("load returns null when storage is empty", () => {
  const memory = createMemoryLocalStorage();
  memory.install();
  try {
    assert.equal(loadPersistedTooling(), null);
  } finally {
    memory.restore();
  }
});

test("load rejects wrong storage version", () => {
  const memory = createMemoryLocalStorage();
  memory.install();
  try {
    memory.store.set(
      TOOLING_STORAGE_KEY,
      JSON.stringify({ v: 999, selection: { family: "m" }, inputs: {} })
    );
    assert.equal(loadPersistedTooling(), null);
  } finally {
    memory.restore();
  }
});

test("load ignores bad tabular shape and unknown selection fields", () => {
  const memory = createMemoryLocalStorage();
  memory.install();
  try {
    memory.store.set(
      TOOLING_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        selection: {
          family: "nope",
          input: "json",
          output: "csv",
          quoteStyle: "weird",
          compact: "yes",
        },
        inputs: {
          tabular: { columns: "bad", rows: [] },
          json: 12,
          "m-json": true,
        },
      })
    );
    const loaded = loadPersistedTooling();
    assert.ok(loaded);
    assert.deepEqual(loaded.selection, { input: "json" });
    assert.deepEqual(loaded.inputs, {});
  } finally {
    memory.restore();
  }
});

test("load returns null when getItem throws", () => {
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem() {
        throw new Error("denied");
      },
      setItem() {},
    },
  });
  try {
    assert.equal(loadPersistedTooling(), null);
  } finally {
    if (previous === undefined) {
      // @ts-ignore
      delete globalThis.localStorage;
    } else {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: previous,
      });
    }
  }
});

test("save swallows setItem failures", () => {
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error("quota");
      },
    },
  });
  try {
    assert.doesNotThrow(() =>
      savePersistedTooling({
        selection: {
          family: "m",
          input: "tabular",
          output: "m-json",
          quoteStyle: "escaped",
          compact: false,
          includeParsing: false,
          convertQuotes: true,
        },
        inputs: {},
      })
    );
  } finally {
    if (previous === undefined) {
      // @ts-ignore
      delete globalThis.localStorage;
    } else {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: previous,
      });
    }
  }
});
