import { Navigate, Link } from "react-router-dom";
import { useSelector } from "react-redux";

export default function Home() {
  const user = useSelector((state) => state.auth.user);

  // If user is logged in, redirect directly to dashboard gallery
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // If user is not logged in, show landing page with login/register options
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex flex-col items-center justify-center p-8">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-xl">
        {/* Logo */}
        <div className="mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl shadow-2xl shadow-orange-500/30 mb-6 transform hover:scale-110 transition-transform">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight mb-3">
            Signatur<span className="text-orange-500">ly</span>
          </h1>
          <p className="text-gray-300 text-lg">Modern, Cryptographically Secure PDF E-Signatures</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            to="/login"
            className="w-full sm:w-auto px-8 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 transition-all text-center"
          >
            Sign In
          </Link>

          <Link
            to="/register"
            className="w-full sm:w-auto px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/10 transition-all text-center"
          >
            Create Account
          </Link>
        </div>

        {/* Subtle hint */}
        <div className="mt-12 text-gray-500 text-xs tracking-widest uppercase">
          Fast • Pixel-Accurate • Secure
        </div>
      </div>
    </div>
  );
}