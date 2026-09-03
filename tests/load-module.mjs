import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm'
import ts from 'typescript'

// Run the actual TypeScript source in isolation. Every runtime import must be
// supplied explicitly: no .env loading, real database client or network access.
// Uses the existing TypeScript dependency; no extra test packages required.
export async function loadModule(path, imports = {}, env = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  })
  const context = createContext({
    Buffer,
    process: { env },
    console: { log() {}, warn() {}, error() {} },
  })
  const module = new SourceTextModule(outputText, { context, identifier: path })
  await module.link((specifier) => {
    if (!Object.hasOwn(imports, specifier)) throw new Error(`Unmocked import: ${specifier}`)
    const exports = imports[specifier]
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  return module.namespace
}

// Normalize objects crossing VM realms for strict assertions.
export const plain = (value) => JSON.parse(JSON.stringify(value))
