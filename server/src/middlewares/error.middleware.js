export const errorMiddleware = (err, req, res, next) => {
  // Errors raised on purpose (ApiError, body-parser, multer) carry their own status
  // A malformed identifier in a database lookup is the caller's mistake, not a server fault
  if (err.name === "CastError") {
    err = { statusCode: 400, message: "Invalid identifier" };
  }

  const expected = Boolean(err.statusCode || err.status || err.code === "LIMIT_FILE_SIZE");
  const statusCode = err.statusCode || err.status || (err.code === "LIMIT_FILE_SIZE" ? 413 : 500);

  // Unexpected failures are logged in full and never described to the caller
  if (!expected) {
    console.error(`[500 Internal Error] ${req.method} ${req.path}:`, err);
  }

  const message = expected ? err.message : "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message,
    error: message,
    errors: err.errors || [],
  });
};
