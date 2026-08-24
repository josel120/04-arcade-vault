/**
 * Resuelve el alias `@/…` de `tsconfig.json` para que Node pueda importar los
 * módulos del proyecto tal cual, sin bundler.
 *
 * Node no sabe nada de `paths`, así que sin esto un `import "@/lib/games/…"`
 * dentro de un motor falla al cargarse desde un script suelto.
 */

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Raíz del repositorio: este fichero vive en `scripts/`. */
const ROOT = fileURLToPath(new URL("../", import.meta.url));

export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);

  const base = ROOT + specifier.slice(2);
  // Los imports del proyecto no llevan extensión; Node no la añade sola.
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(candidate)) return next(pathToFileURL(candidate).href, context);
  }
  return next(specifier, context);
}
