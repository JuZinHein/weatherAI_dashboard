/**
 * Pure TypeScript in-browser NPY / NPZ file parser.
 * Handles NumPy format (.npy) within zip archives without requiring Python or native backend.
 */

export interface ParsedNpy {
  descr: string;
  shape: number[];
  fortranOrder: boolean;
  data: Float32Array | Float64Array | BigInt64Array | Uint8Array | string[];
}

export function parseNpyBuffer(arrayBuffer: ArrayBuffer): ParsedNpy {
  const u8 = new Uint8Array(arrayBuffer);
  // Check magic \x93NUMPY
  const magic = String.fromCharCode(...u8.subarray(1, 6));
  if (magic !== 'NUMPY') {
    throw new Error('Invalid NPY header: magic string mismatch');
  }

  const major = u8[6];
  let headerLen = 0;
  let offset = 0;

  if (major === 1) {
    headerLen = u8[8] | (u8[9] << 8);
    offset = 10 + headerLen;
  } else {
    headerLen = u8[8] | (u8[9] << 8) | (u8[10] << 16) | (u8[11] << 24);
    offset = 12 + headerLen;
  }

  const headerStr = new TextDecoder('ascii').decode(u8.subarray(major === 1 ? 10 : 12, offset));

  const descrMatch = headerStr.match(/'descr'\s*:\s*'([^']+)'/);
  const shapeMatch = headerStr.match(/'shape'\s*:\s*\(([^)]*)\)/);
  const fortranMatch = headerStr.match(/'fortran_order'\s*:\s*(True|False)/);

  const descr = descrMatch ? descrMatch[1] : '';
  const fortranOrder = fortranMatch ? fortranMatch[1] === 'True' : false;
  const shape = shapeMatch
    ? shapeMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
    : [];

  const dataBuffer = arrayBuffer.slice(offset);

  let data: Float32Array | Float64Array | BigInt64Array | Uint8Array | string[];

  if (descr === '<f4' || descr === 'f4') {
    data = new Float32Array(dataBuffer);
  } else if (descr === '<f8' || descr === 'f8') {
    data = new Float64Array(dataBuffer);
  } else if (descr === '<i8' || descr === 'i8') {
    data = new BigInt64Array(dataBuffer);
  } else if (descr === '|b1' || descr === 'b1') {
    data = new Uint8Array(dataBuffer);
  } else if (descr.startsWith('<U') || descr.startsWith('U')) {
    // UTF-32 LE string array
    const charLen = parseInt(descr.replace(/[^0-9]/g, ''), 10) || 16;
    const bytePerStr = charLen * 4;
    const count = dataBuffer.byteLength / bytePerStr;
    const view = new DataView(dataBuffer);
    const strList: string[] = [];
    for (let i = 0; i < count; i++) {
      let str = '';
      for (let j = 0; j < charLen; j++) {
        const code = view.getUint32(i * bytePerStr + j * 4, true);
        if (code !== 0) str += String.fromCodePoint(code);
      }
      strList.push(str.trim());
    }
    data = strList;
  } else {
    // Default fallback to Float32
    data = new Float32Array(dataBuffer);
  }

  return {
    descr,
    shape,
    fortranOrder,
    data,
  };
}
