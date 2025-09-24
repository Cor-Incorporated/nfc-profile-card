"use client";

import { Loader2 } from "lucide-react";
import React from "react";

const LoadingSpinner: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
        <div className="text-center space-y-2">
          <p className="text-base sm:text-lg font-medium text-gray-900">
            🔍 名刺を解析中...
          </p>
          <p className="text-xs sm:text-sm text-gray-500">
            AIが情報を読み取っています
          </p>
        </div>
        <div className="mt-4 text-center">
          <div className="inline-flex items-center space-x-2">
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></div>
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse delay-150"></div>
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse delay-300"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
