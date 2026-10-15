// All browser flows use verified accounts in an isolated database, including
// official administrator roles. Never run mutation suites on the live site.
export { default } from "./playwright.admin.config";
