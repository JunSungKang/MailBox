import {
  normalizeUserId,
  isValidPassword,
  mayProvisionServiceAccount,
} from "../domain/session.mjs";
export function createRegisterAccount({
  accountStore,
  serviceUser,
  servicePassword,
}) {
  return async ({ userId, password, remoteAddress }) => {
    if (
      userId === normalizeUserId(serviceUser) &&
      !mayProvisionServiceAccount(remoteAddress, password, servicePassword)
    )
      throw Object.assign(Error("Reserved service account"), {
        code: "ACCOUNT_EXISTS",
      });
    if (!isValidPassword(password))
      throw Object.assign(Error("Invalid password"), {
        code: "INVALID_PASSWORD",
      });
    return accountStore.provision(userId, password);
  };
}
