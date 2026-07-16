export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code = "INTERNAL_SERVER_ERROR",
    statusCode = 500,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    const errCtor = Error as any;
    if (errCtor.captureStackTrace) {
      errCtor.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message = "Authentication required") {
    super(message, "AUTHENTICATION_ERROR", 401);
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message = "Unauthorized access") {
    super(message, "AUTHORIZATION_ERROR", 403);
  }
}

export class DomainError extends ApplicationError {
  constructor(message: string, code = "DOMAIN_ERROR", details?: unknown) {
    super(message, code, 422, details);
  }
}

export class InfrastructureError extends ApplicationError {
  constructor(message: string, code = "INFRASTRUCTURE_ERROR", details?: unknown) {
    super(message, code, 500, details);
  }
}

export class ExternalServiceError extends ApplicationError {
  constructor(message: string, code = "EXTERNAL_SERVICE_ERROR", details?: unknown) {
    super(message, code, 502, details);
  }
}
