/**
 * Binary ZON Decoder
 * 
 * Decodes binary ZON format back to JavaScript values
 */

import {
  MAGIC_HEADER,
  TypeMarker,
  isPositiveFixint,
  isNegativeFixint,
  isFixmap,
  isFixarray,
  isFixstr,
  getFixmapSize,
  getFixarraySize,
  getFixstrSize
} from './constants';

/**
 * Binary ZON Decoder
 */
export class BinaryZonDecoder {
  private buffer!: Uint8Array;
  private offset!: number;
  
  /**
   * Decode binary ZON format to JavaScript value
   */
  decode(buffer: Uint8Array): any {
    this.buffer = buffer;
    this.offset = 0;
    

    this.verifyMagicHeader();
    

    return this.decodeValue();
  }
  
  /**
   * Verify magic header
   */
  private verifyMagicHeader(): void {
    for (let i = 0; i < MAGIC_HEADER.length; i++) {
      if (this.buffer[this.offset++] !== MAGIC_HEADER[i]) {
        throw new Error('Invalid binary ZON format: magic header mismatch');
      }
    }
  }
  
  /**
   * Decode a single value
   */
  private decodeValue(): any {
    const marker = this.buffer[this.offset++];
    

    if (isPositiveFixint(marker)) {
      return marker;
    }
    

    if (isNegativeFixint(marker)) {
      return marker - 256;
    }
    

    if (isFixmap(marker)) {
      return this.decodeMap(getFixmapSize(marker));
    }
    

    if (isFixarray(marker)) {
      return this.decodeArray(getFixarraySize(marker));
    }
    

    if (isFixstr(marker)) {
      return this.decodeString(getFixstrSize(marker));
    }
    

    switch (marker) {
      case TypeMarker.NIL:
        return null;
      
      case TypeMarker.FALSE:
        return false;
      
      case TypeMarker.TRUE:
        return true;
      
      case TypeMarker.UINT8:
        return this.readUint8();
      
      case TypeMarker.UINT16:
        return this.readUint16();
      
      case TypeMarker.UINT32:
        return this.readUint32();
      
      case TypeMarker.INT8:
        return this.readInt8();
      
      case TypeMarker.INT16:
        return this.readInt16();
      
      case TypeMarker.INT32:
        return this.readInt32();
      
      case TypeMarker.FLOAT32:
        return this.readFloat32();
      
      case TypeMarker.FLOAT64:
        return this.readFloat64();
      
      case TypeMarker.STR8:
        return this.decodeString(this.readUint8());
      
      case TypeMarker.STR16:
        return this.decodeString(this.readUint16());
      
      case TypeMarker.STR32:
        return this.decodeString(this.readUint32());
      
      case TypeMarker.ARRAY16:
        return this.decodeArray(this.readUint16());
      
      case TypeMarker.ARRAY32:
        return this.decodeArray(this.readUint32());
      
      case TypeMarker.MAP16:
        return this.decodeMap(this.readUint16());
      
      case TypeMarker.MAP32:
        return this.decodeMap(this.readUint32());
      
      default:
        throw new Error(`Unknown type marker: 0x${marker.toString(16)}`);
    }
  }
  
  /**
   * Decode a string of known length
   */
  private decodeString(length: number): string {
    const bytes = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return new TextDecoder().decode(bytes);
  }
  
  /**
   * Decode an array of known length
   */
  private decodeArray(length: number): any[] {
    const array: any[] = [];
    for (let i = 0; i < length; i++) {
      array.push(this.decodeValue());
    }
    return array;
  }
  
  /**
   * Decode a map/object of known length
   */
  private decodeMap(length: number): Record<string, any> {
    const map: Record<string, any> = {};
    for (let i = 0; i < length; i++) {
      const key = this.decodeValue() as string;
      const value = this.decodeValue();
      map[key] = value;
    }
    return map;
  }
  
  // Helper methods for reading multi-byte values
  
  private readUint8(): number {
    return this.buffer[this.offset++];
  }
  
  private readUint16(): number {
    const value = (this.buffer[this.offset] << 8) | this.buffer[this.offset + 1];
    this.offset += 2;
    return value;
  }
  
  private readUint32(): number {
    const value = (
      (this.buffer[this.offset] << 24) |
      (this.buffer[this.offset + 1] << 16) |
      (this.buffer[this.offset + 2] << 8) |
      this.buffer[this.offset + 3]
    ) >>> 0;
    this.offset += 4;
    return value;
  }
  
  private readInt8(): number {
    const value = this.buffer[this.offset++];
    return value > 127 ? value - 256 : value;
  }
  
  private readInt16(): number {
    const value = (this.buffer[this.offset] << 8) | this.buffer[this.offset + 1];
    this.offset += 2;
    return value > 32767 ? value - 65536 : value;
  }
  
  private readInt32(): number {
    const value = (
      (this.buffer[this.offset] << 24) |
      (this.buffer[this.offset + 1] << 16) |
      (this.buffer[this.offset + 2] << 8) |
      this.buffer[this.offset + 3]
    );
    this.offset += 4;
    return value;
  }
  
  private readFloat32(): number {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    
    for (let i = 0; i < 4; i++) {
      view.setUint8(i, this.buffer[this.offset++]);
    }
    
    return view.getFloat32(0, false);
  }
  
  private readFloat64(): number {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    
    for (let i = 0; i < 8; i++) {
      view.setUint8(i, this.buffer[this.offset++]);
    }
    
    return view.getFloat64(0, false);
  }
}

/**
 * Decode binary ZON format to JavaScript value
 */
export function decodeBinary(buffer: Uint8Array): any {
  const decoder = new BinaryZonDecoder();
  return decoder.decode(buffer);
}
