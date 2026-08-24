/**
 * Architectural Seating Plan Configuration for The Music Academy, Madras
 * Ground Floor: 648 Seats (3 Seating Blocks + Audio Console across Rows A–N)
 * Balcony: 750 Seats (4 Seating Columns / Blocks across Rows A–N)
 */

export interface RowBlockConfig {
  blockName: string;
  startSeat: number;
  endSeat: number;
}

export interface RowLayoutConfig {
  rowLabel: string;
  totalSeats: number;
  blocks: RowBlockConfig[];
  hasAudioConsoleBehind?: boolean;
}

// Ground Floor Exact Row Layout Breakdown
export const GROUND_FLOOR_LAYOUT: Record<string, RowLayoutConfig> = {
  A: {
    rowLabel: 'A',
    totalSeats: 34,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 8 },
      { blockName: 'Center', startSeat: 9, endSeat: 26 },
      { blockName: 'Right', startSeat: 27, endSeat: 34 },
    ],
  },
  B: {
    rowLabel: 'B',
    totalSeats: 40,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 10 },
      { blockName: 'Center', startSeat: 11, endSeat: 30 },
      { blockName: 'Right', startSeat: 31, endSeat: 40 },
    ],
  },
  C: {
    rowLabel: 'C',
    totalSeats: 42,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 11 },
      { blockName: 'Center', startSeat: 12, endSeat: 31 },
      { blockName: 'Right', startSeat: 32, endSeat: 42 },
    ],
  },
  D: {
    rowLabel: 'D',
    totalSeats: 43,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 11 },
      { blockName: 'Center', startSeat: 12, endSeat: 32 },
      { blockName: 'Right', startSeat: 33, endSeat: 43 },
    ],
  },
  E: {
    rowLabel: 'E',
    totalSeats: 46,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 12 },
      { blockName: 'Center', startSeat: 13, endSeat: 34 },
      { blockName: 'Right', startSeat: 35, endSeat: 46 },
    ],
  },
  F: {
    rowLabel: 'F',
    totalSeats: 46,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 12 },
      { blockName: 'Center', startSeat: 13, endSeat: 34 },
      { blockName: 'Right', startSeat: 35, endSeat: 46 },
    ],
  },
  G: {
    rowLabel: 'G',
    totalSeats: 47,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 12 },
      { blockName: 'Center', startSeat: 13, endSeat: 35 },
      { blockName: 'Right', startSeat: 36, endSeat: 47 },
    ],
  },
  H: {
    rowLabel: 'H',
    totalSeats: 50,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 13 },
      { blockName: 'Center', startSeat: 14, endSeat: 37 },
      { blockName: 'Right', startSeat: 38, endSeat: 50 },
    ],
  },
  I: {
    rowLabel: 'I',
    totalSeats: 53,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 14 },
      { blockName: 'Center', startSeat: 15, endSeat: 39 },
      { blockName: 'Right', startSeat: 40, endSeat: 53 },
    ],
  },
  J: {
    rowLabel: 'J',
    totalSeats: 54,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 14 },
      { blockName: 'Center', startSeat: 15, endSeat: 40 },
      { blockName: 'Right', startSeat: 41, endSeat: 54 },
    ],
  },
  K: {
    rowLabel: 'K',
    totalSeats: 56,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 15 },
      { blockName: 'Center', startSeat: 16, endSeat: 41 },
      { blockName: 'Right', startSeat: 42, endSeat: 56 },
    ],
  },
  L: {
    rowLabel: 'L',
    totalSeats: 57,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 15 },
      { blockName: 'Center', startSeat: 16, endSeat: 42 },
      { blockName: 'Right', startSeat: 43, endSeat: 57 },
    ],
  },
  M: {
    rowLabel: 'M',
    totalSeats: 40,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 12 },
      { blockName: 'Center', startSeat: 13, endSeat: 28 },
      { blockName: 'Right', startSeat: 29, endSeat: 40 },
    ],
    hasAudioConsoleBehind: true,
  },
  N: {
    rowLabel: 'N',
    totalSeats: 40,
    blocks: [
      { blockName: 'Left', startSeat: 1, endSeat: 12 },
      { blockName: 'Center', startSeat: 13, endSeat: 28 },
      { blockName: 'Right', startSeat: 29, endSeat: 40 },
    ],
    hasAudioConsoleBehind: true,
  },
};

// Balcony 4-Block Breakdown across Rows A–N
export const BALCONY_LAYOUT: Record<string, RowLayoutConfig> = {
  A: { rowLabel: 'A', totalSeats: 54, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 14 }, { blockName: 'Block 2', startSeat: 15, endSeat: 27 }, { blockName: 'Block 3', startSeat: 28, endSeat: 40 }, { blockName: 'Block 4', startSeat: 41, endSeat: 54 }] },
  B: { rowLabel: 'B', totalSeats: 54, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 14 }, { blockName: 'Block 2', startSeat: 15, endSeat: 27 }, { blockName: 'Block 3', startSeat: 28, endSeat: 40 }, { blockName: 'Block 4', startSeat: 41, endSeat: 54 }] },
  C: { rowLabel: 'C', totalSeats: 54, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 14 }, { blockName: 'Block 2', startSeat: 15, endSeat: 27 }, { blockName: 'Block 3', startSeat: 28, endSeat: 40 }, { blockName: 'Block 4', startSeat: 41, endSeat: 54 }] },
  D: { rowLabel: 'D', totalSeats: 54, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 14 }, { blockName: 'Block 2', startSeat: 15, endSeat: 27 }, { blockName: 'Block 3', startSeat: 28, endSeat: 40 }, { blockName: 'Block 4', startSeat: 41, endSeat: 54 }] },
  E: { rowLabel: 'E', totalSeats: 54, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 14 }, { blockName: 'Block 2', startSeat: 15, endSeat: 27 }, { blockName: 'Block 3', startSeat: 28, endSeat: 40 }, { blockName: 'Block 4', startSeat: 41, endSeat: 54 }] },
  F: { rowLabel: 'F', totalSeats: 54, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 14 }, { blockName: 'Block 2', startSeat: 15, endSeat: 27 }, { blockName: 'Block 3', startSeat: 28, endSeat: 40 }, { blockName: 'Block 4', startSeat: 41, endSeat: 54 }] },
  G: { rowLabel: 'G', totalSeats: 54, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 14 }, { blockName: 'Block 2', startSeat: 15, endSeat: 27 }, { blockName: 'Block 3', startSeat: 28, endSeat: 40 }, { blockName: 'Block 4', startSeat: 41, endSeat: 54 }] },
  H: { rowLabel: 'H', totalSeats: 54, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 14 }, { blockName: 'Block 2', startSeat: 15, endSeat: 27 }, { blockName: 'Block 3', startSeat: 28, endSeat: 40 }, { blockName: 'Block 4', startSeat: 41, endSeat: 54 }] },
  I: { rowLabel: 'I', totalSeats: 54, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 14 }, { blockName: 'Block 2', startSeat: 15, endSeat: 27 }, { blockName: 'Block 3', startSeat: 28, endSeat: 40 }, { blockName: 'Block 4', startSeat: 41, endSeat: 54 }] },
  J: { rowLabel: 'J', totalSeats: 54, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 14 }, { blockName: 'Block 2', startSeat: 15, endSeat: 27 }, { blockName: 'Block 3', startSeat: 28, endSeat: 40 }, { blockName: 'Block 4', startSeat: 41, endSeat: 54 }] },
  K: { rowLabel: 'K', totalSeats: 54, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 14 }, { blockName: 'Block 2', startSeat: 15, endSeat: 27 }, { blockName: 'Block 3', startSeat: 28, endSeat: 40 }, { blockName: 'Block 4', startSeat: 41, endSeat: 54 }] },
  L: { rowLabel: 'L', totalSeats: 54, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 14 }, { blockName: 'Block 2', startSeat: 15, endSeat: 27 }, { blockName: 'Block 3', startSeat: 28, endSeat: 40 }, { blockName: 'Block 4', startSeat: 41, endSeat: 54 }] },
  M: { rowLabel: 'M', totalSeats: 51, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 13 }, { blockName: 'Block 2', startSeat: 14, endSeat: 26 }, { blockName: 'Block 3', startSeat: 27, endSeat: 38 }, { blockName: 'Block 4', startSeat: 39, endSeat: 51 }] },
  N: { rowLabel: 'N', totalSeats: 51, blocks: [{ blockName: 'Block 1', startSeat: 1, endSeat: 13 }, { blockName: 'Block 2', startSeat: 14, endSeat: 26 }, { blockName: 'Block 3', startSeat: 27, endSeat: 38 }, { blockName: 'Block 4', startSeat: 39, endSeat: 51 }] },
};
