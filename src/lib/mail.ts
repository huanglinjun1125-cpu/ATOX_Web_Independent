/** @deprecated Use the auth server facade for mail preview operations. */
import "server-only";
export {
  createDevMail,
  isDevMailEnabled,
  listDevMails,
} from "../modules/auth/mail";
