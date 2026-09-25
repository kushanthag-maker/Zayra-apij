// Error type shared by the Dragon Hosting modules. `status`/`message` match ZAYRA's error handling.
class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
module.exports = { ApiError };
