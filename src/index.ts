/**
 * ZON Format v1.0.2
 * Zero Overhead Notation - A human-readable data serialization format
 * optimized for LLM token efficiency
 */

export { encode, ZonEncoder } from './encoder';
export { decode, ZonDecoder } from './decoder';
export { ZonDecodeError } from './exceptions';
export * as constants from './constants';
