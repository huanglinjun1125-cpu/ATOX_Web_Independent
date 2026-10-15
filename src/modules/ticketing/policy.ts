export function isTicketingEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ENABLE_TICKETING_PREVIEW === "true"
  );
}
