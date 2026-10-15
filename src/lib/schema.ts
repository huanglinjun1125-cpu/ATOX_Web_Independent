/** Shared schema registry. Add future domain schemas here without editing auth. */
export { managedContent } from "../modules/content-management/schema";
export {
  administrators,
  adminAuditLogs,
  businessAuditLogs,
} from "../modules/admin/schema";
export {
  eventTeams,
  teamMembers,
  teamApplications,
} from "../modules/participant-center/schema";
export {
  users,
  challenges,
  sessions,
  sendEvents,
  devMails,
} from "../modules/auth/schema";
export {
  eventRegistrations,
  eventMaterials,
  eventAssets,
} from "../modules/event-participation/schema";
export {
  ticketInventory,
  ticketOrders,
  ticketOrderKeys,
  ticketReservations,
  ticketPaymentAttempts,
  ticketPaymentNotifications,
  mockPaymentTransactions,
} from "../modules/ticketing/schema";
