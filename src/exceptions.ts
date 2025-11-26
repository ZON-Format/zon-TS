/**
 * ZON Exceptions
 */

export class ZonDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZonDecodeError';
    Object.setPrototypeOf(this, ZonDecodeError.prototype);
  }
}
