/**
 * Shared error handler type used across all Inkio extensions.
 */
export type InkioErrorHandler = (
    error: Error,
    context: { source: string; recoverable: boolean }
) => void;

/**
 * Normalize an unknown thrown value into a proper Error instance.
 * String() itself can throw on poisoned toString — never let the
 * normalizer become the crash.
 */
export function toError(error: unknown): Error {
    if (error instanceof Error) return error;
    let message: string;
    try {
      message = String(error);
    } catch {
      message = Object.prototype.toString.call(error);
    }
    return new Error(message);
}

export class InkioError extends Error {
  public readonly source: string;
  public readonly recoverable: boolean;
  public readonly originalError?: Error;
  /** Chains the original stack (ES2022 Error cause shape, lib-safe). */
  public readonly cause: Error | undefined;

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
    this.cause = originalError;
  }
}
