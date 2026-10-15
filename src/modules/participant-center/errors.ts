export class CenterError extends Error {
  constructor(
    public code: string,
    public status = 409,
  ) {
    super(code);
  }
}
