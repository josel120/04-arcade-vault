/**
 * Los cinco muros de ARKANOID — port de
 * `references/started-games/04-arkanoid/levels.js`.
 *
 * Traducción literal: los mismos generadores, las mismas velocidades y el mismo
 * reparto de colores por hilera. Lo único que cambia es qué es un color: donde
 * el original tenía siete recortes de un `png`, aquí hay siete valores CSS.
 *
 * Las hileras se numeran de arriba abajo y las columnas de izquierda a derecha,
 * como en el original. La posición en píxeles la pone el motor.
 */

export type BlockColor = "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

/** Un bloque, en coordenadas de rejilla. */
export type BlockSpec = {
  col: number;
  row: number;
  color: BlockColor;
};

export type Level = {
  /** Multiplicador de la velocidad base de la pelota. */
  speed: number;
  blocks: BlockSpec[];
};

export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;

/**
 * El spritesheet del original no se porta: los bloques se dibujan a lienzo. Los
 * nombres se conservan porque son los que usan los generadores de niveles.
 */
export const BLOCK_COLORS: Record<BlockColor, string> = {
  red: "#ff3860",
  yellow: "#f5ff00",
  cyan: "#00f5ff",
  magenta: "#ff006e",
  hotpink: "#ff5fd2",
  green: "#00ff88",
  gray: "#8891a8",
};

const rowColors1: BlockColor[] = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
const rowColors2: BlockColor[] = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
const rowColors4: BlockColor[] = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

/** Nivel 1: la parrilla completa, una hilera de cada color. */
function grid(): BlockSpec[] {
  const blocks: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      blocks.push({ col, row, color: rowColors1[row] });
    }
  }
  return blocks;
}

/** Nivel 2: la pirámide, que se ensancha hacia abajo. */
function pyramid(): BlockSpec[] {
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  const blocks: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = pyStart[row]; col <= pyEnd[row]; col++) {
      blocks.push({ col, row, color: rowColors2[row] });
    }
  }
  return blocks;
}

/** Nivel 3: el tablero de ajedrez, amarillo arriba y magenta abajo. */
function checkerboard(): BlockSpec[] {
  const blocks: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      if ((col + row) % 2 === 0) {
        blocks.push({ col, row, color: row < 3 ? "yellow" : "magenta" });
      }
    }
  }
  return blocks;
}

/** Nivel 4: la parrilla con huecos distintos en cada hilera. */
function gapped(): BlockSpec[] {
  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const blocks: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      if (!gaps4[row].includes(col)) {
        blocks.push({ col, row, color: rowColors4[row] });
      }
    }
  }
  return blocks;
}

/** Nivel 5: el marco, cian, con la cruz central en rosa. */
function frame(): BlockSpec[] {
  const blocks: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross) {
        blocks.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
      }
    }
  }
  return blocks;
}

/**
 * Las cinco velocidades del original, sin redondear: cada nivel lanza la pelota
 * un diez por ciento más rápido que el anterior.
 */
export const LEVELS: Level[] = [
  { speed: 1.0, blocks: grid() },
  { speed: 1.1, blocks: pyramid() },
  { speed: 1.21, blocks: checkerboard() },
  { speed: 1.33, blocks: gapped() },
  { speed: 1.46, blocks: frame() },
];
