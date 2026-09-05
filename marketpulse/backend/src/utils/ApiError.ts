export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown) {
    return new ApiError(400, code, message, details);
  }
  static notFound(message: string, code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }
  static conflict(message: string, code = 'CONFLICT') {
    return new ApiError(409, code, message);
  }
  static unavailable(message: string, code = 'SERVICE_UNAVAILABLE') {
    return new ApiError(503, code, message);
  }
  static internal(message: string, code = 'INTERNAL_ERROR') {
    return new ApiError(500, code, message);
  }
}
