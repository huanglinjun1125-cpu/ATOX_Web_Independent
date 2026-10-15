"use client";
import { createContext, useContext } from "react";
const Context = createContext(false);
export function SiteNavigationProvider({
  ticketingEnabled,
  children,
}: {
  ticketingEnabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <Context.Provider value={ticketingEnabled}>{children}</Context.Provider>
  );
}
export const useTicketingNavigation = () => useContext(Context);
