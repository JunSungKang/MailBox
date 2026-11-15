import bcrypt from "bcryptjs";
const bcryptPattern =
  /^\{BLF-CRYPT\}\$2[aby]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;
export const isBcrypt = (encoded) =>
  typeof encoded === "string" && bcryptPattern.exec(encoded)?.[0] === encoded;
export const verifyBcrypt = (password, encoded) =>
  bcrypt.compare(password, encoded.slice("{BLF-CRYPT}".length));
