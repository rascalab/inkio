export class InkioError extends Error {
  public readonly source: string;
  public readonly recoverable: boolean;
  public readonly originalError?: Error;

  constructor(
    message: string,
    source: string,
    recoverable = true,
    originalError?: Error
  ) {
    super(message);
    this.name = 'InkioError';
    this.source = source;
    this.recoverable = recoverable;
    this.originalError = originalError;
  }
}
