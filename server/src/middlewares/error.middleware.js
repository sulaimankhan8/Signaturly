export const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Only log full stack traces for unhandled 5xx server errors
  if (statusCode >= 500) {
    console.error(`🔥 [500 Internal Error] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal Server Error"
        : err.message,
    errors: err.errors || [],
  });
};
