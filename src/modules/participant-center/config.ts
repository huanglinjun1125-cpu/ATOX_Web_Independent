import type { EventDefinition } from "../event-board/contracts";
export function centerConfig(event: EventDefinition) {
  const config = {
    minSize: event.participantCenter?.minSize ?? 2,
    maxSize: event.participantCenter?.maxSize ?? 4,
    opensAt: event.participantCenter?.opensAt ?? event.registrationOpensAt,
    closesAt: event.participantCenter?.closesAt ?? event.submissionClosesAt,
  };
  if (
    !Number.isInteger(config.minSize) ||
    !Number.isInteger(config.maxSize) ||
    config.minSize < 2 ||
    config.maxSize < config.minSize ||
    config.maxSize > 20 ||
    !Number.isFinite(Date.parse(config.opensAt)) ||
    !Number.isFinite(Date.parse(config.closesAt)) ||
    Date.parse(config.opensAt) >= Date.parse(config.closesAt)
  )
    throw new Error("Invalid participant center configuration");
  return config;
}
export function centerOpen(config: ReturnType<typeof centerConfig>, now: Date) {
  return (
    now.getTime() >= Date.parse(config.opensAt) &&
    now.getTime() < Date.parse(config.closesAt)
  );
}
