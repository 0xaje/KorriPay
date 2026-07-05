export class KorriPayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KorriPayError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class KorriPayValidationError extends KorriPayError {
  constructor(message: string) {
    super(message);
    this.name = 'KorriPayValidationError';
  }
}

export class KorriPayAuthenticationError extends KorriPayError {
  constructor(message: string = 'Unauthorized: Missing or invalid authentication credentials.') {
    super(message);
    this.name = 'KorriPayAuthenticationError';
  }
}

export class KorriPayAPIError extends KorriPayError {
  public statusCode: number;
  public details: any;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = 'KorriPayAPIError';
    this.statusCode = statusCode;
    this.details = details;
  }
}
