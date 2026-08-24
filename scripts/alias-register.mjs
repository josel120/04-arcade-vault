/**
 * Engancha `alias-loader.mjs`. Va en `--import`, porque el cargador corre en su
 * propio hilo y hay que registrarlo antes de que se resuelva nada.
 */

import { register } from "node:module";

register("./alias-loader.mjs", import.meta.url);
