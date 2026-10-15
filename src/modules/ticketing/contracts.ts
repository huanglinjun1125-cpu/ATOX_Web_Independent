export type Localized = { zh: string; en: string };
export type TicketState =
  "not_open" | "on_sale" | "ended" | "sold_out" | "disabled";
export interface BuyerAnswers {
  displayName: string;
  country: string;
  source: string;
  purposes: string[];
  notes: string;
  acceptedPolicy: boolean;
}
export interface Selection {
  ticketId: string;
  quantity: number;
}
export interface QuoteInput extends Selection {
  answers: BuyerAnswers;
}
export interface TicketDto {
  id: string;
  name: Localized;
  unitAmount: number;
  currency: string;
  opensAt: string;
  closesAt: string;
  state: TicketState;
  available: number;
}
export interface CatalogDto {
  event: {
    id: string;
    name: Localized;
    introduction: Localized;
    organizer: Localized;
    location: Localized;
    startsAt: string;
    endsAt: string;
    timeZone: string;
    policy: Localized;
    contact: Localized;
  };
  tickets: TicketDto[];
  questions: {
    sources: { id: string; label: Localized }[];
    purposes: { id: string; label: Localized }[];
  };
  maxPerAccount: number;
  reservationMinutes: number;
  serverNow: string;
}
export interface QuoteDto extends Selection {
  quoteVersion: string;
  unitAmount: number;
  totalAmount: number;
  currency: string;
  ticketName: Localized;
  policy: Localized;
}
export interface CreateOrderInput extends QuoteInput {
  quoteVersion: string;
  idempotencyKey: string;
}
export type SimulationAction =
  "success" | "failure" | "cancel" | "unknown" | "duplicate" | "late_success";
export interface OrderDto {
  id: string;
  eventId: string;
  eventName: Localized;
  event: CatalogDto["event"];
  questions: CatalogDto["questions"];
  ticketId: string;
  ticketName: Localized;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  currency: string;
  answers: BuyerAnswers;
  email: string;
  status: "pending" | "paid" | "closed";
  paymentStatus:
    | "idle"
    | "creating"
    | "pending"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "closed"
    | "unknown";
  expiresAt: string;
  createdAt: string;
  paidAt: string | null;
  closeReason: string | null;
  reconciliationRequired: boolean;
  canPay: boolean;
  canClose: boolean;
  policy: Localized;
}
export const TICKETING_API = "/api/preview/ticketing/demo";
export interface OrderSummaryDto extends Pick<
  OrderDto,
  | "id"
  | "eventId"
  | "eventName"
  | "ticketName"
  | "quantity"
  | "totalAmount"
  | "currency"
  | "createdAt"
  | "status"
  | "paymentStatus"
  | "reconciliationRequired"
  | "canPay"
> {
  timeZone: string;
}
export interface OrderListDto {
  orders: OrderSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export const TICKETING_PAGE = "/preview/ticketing/demo";
export const emptyAnswers = (): BuyerAnswers => ({
  displayName: "",
  country: "",
  source: "",
  purposes: [],
  notes: "",
  acceptedPolicy: false,
});
