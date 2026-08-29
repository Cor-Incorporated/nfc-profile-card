import { AuthRedirect } from "@/components/providers/AuthRedirect";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center p-4">
      <AuthRedirect />

      <div className="mb-12 text-center">
        <div className="mb-4">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl">
            <span className="text-white text-5xl">✨</span>
          </div>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          TapForge
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-12 max-w-xs w-full">
        <div className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-lg flex flex-col items-center">
          <span className="text-3xl mb-2">👆</span>
          <span className="text-2xl">📱</span>
        </div>
        <div className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-lg flex flex-col items-center">
          <span className="text-3xl mb-2">🔗</span>
          <span className="text-2xl">✨</span>
        </div>
        <div className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-lg flex flex-col items-center">
          <span className="text-3xl mb-2">📸</span>
          <span className="text-2xl">💼</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/signin?tab=signup"
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-semibold text-center shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
        >
          Get Started
        </Link>
        <Link
          href="/signin?tab=signin"
          className="w-full py-4 bg-white/80 backdrop-blur text-gray-700 rounded-2xl font-semibold text-center shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
        >
          ログイン
        </Link>
      </div>

      <div className="mt-12 flex gap-2">
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
        <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse delay-100"></div>
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-200"></div>
      </div>
    </div>
  );
}
