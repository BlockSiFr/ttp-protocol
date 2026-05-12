export class TtpError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TtpError";
    this.code = code;
  }
}

export function toCliError(error) {
  if (error instanceof TtpError) {
    return { error: error.code, message: error.message };
  }

  return {
    error: "UNEXPECTED_ERROR",
    message: error instanceof Error ? error.message : String(error)
  };
}
