import type { QuoteDto } from "./contracts";
export class TicketingError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    public readonly orderId?: string,
    public readonly quote?: QuoteDto,
  ) {
    super(code);
  }
}
