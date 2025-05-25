import { useState } from "react";
import { useRouter } from "next/router";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Star,
  Crown,
  Gift,
  Sparkles,
  Lock,
  CheckCircle,
  XCircle,
} from "lucide-react";

export default function RedeemCode() {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      toast.error("Please enter a VIP code");
      return;
    }

    setIsLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      // Verify code first
      const verifyResponse = await fetch(API_ENDPOINTS.vip.verifyCode(code), {
        ...defaultFetchOptions,
        headers: {
          ...defaultFetchOptions.headers,
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.detail || "Invalid code");
      }

      // If verified, redeem code
      const redeemResponse = await fetch(API_ENDPOINTS.vip.redeemCode(code), {
        ...defaultFetchOptions,
        method: "POST",
        headers: {
          ...defaultFetchOptions.headers,
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      if (!redeemResponse.ok) {
        const error = await redeemResponse.json();
        throw new Error(error.detail || "Failed to redeem code");
      }

      setStatus("success");
      setMessage("VIP status activated successfully!");
      toast.success("VIP status activated successfully!");

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/profile");
      }, 2000);
    } catch (error: any) {
      setStatus("error");
      setMessage(error.message || "Something went wrong");
      toast.error(error.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  if (user?.is_vip) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-full -translate-y-20 translate-x-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-purple-400/20 to-pink-500/20 rounded-full translate-y-16 -translate-x-16"></div>

              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl mx-auto mb-6 flex items-center justify-center transform rotate-3 shadow-lg">
                  <Crown className="w-10 h-10 text-white" />
                </div>

                <h2 className="text-center text-2xl font-bold text-gray-900 mb-4">
                  You are already a VIP member!
                </h2>
                <p className="text-center text-gray-600 mb-6">
                  Enjoy your VIP benefits and exclusive features.
                </p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl text-center">
                    <Star className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                    <p className="text-sm font-medium text-gray-800">
                      Premium Features
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl text-center">
                    <Gift className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <p className="text-sm font-medium text-gray-800">
                      Special Rewards
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-400/20 to-purple-500/20 rounded-full -translate-y-20 translate-x-20"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-pink-400/20 to-red-500/20 rounded-full translate-y-16 -translate-x-16"></div>

            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center transform -rotate-3 shadow-lg">
                <Lock className="w-10 h-10 text-white" />
              </div>

              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600 mb-2">
                  Redeem VIP Code
                </h2>
                <p className="text-gray-600">
                  Enter your VIP code below to activate premium features
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl text-center transform hover:scale-105 transition-transform">
                  <Crown className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                  <p className="text-sm font-medium text-gray-800">
                    VIP Status
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl text-center transform hover:scale-105 transition-transform">
                  <Star className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-sm font-medium text-gray-800">
                    Premium Features
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Form */}
                <div>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label
                        htmlFor="code"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        VIP Code
                      </label>
                      <div className="relative">
                        <input
                          id="code"
                          name="code"
                          type="text"
                          required
                          value={code}
                          onChange={(e) =>
                            setCode(e.target.value.toUpperCase())
                          }
                          placeholder="Enter your VIP code"
                          className={`appearance-none block w-full px-4 py-3 border rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ${
                            status === "success"
                              ? "border-green-500 focus:ring-green-500"
                              : status === "error"
                              ? "border-red-500 focus:ring-red-500"
                              : "border-gray-300 focus:ring-purple-500"
                          }`}
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          {status === "success" ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : status === "error" ? (
                            <XCircle className="w-5 h-5 text-red-500" />
                          ) : (
                            <Sparkles className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                      {message && (
                        <p
                          className={`mt-2 text-sm ${
                            status === "success"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {message}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white transition-all duration-300 transform hover:scale-105 ${
                        status === "success"
                          ? "bg-green-500 hover:bg-green-600"
                          : status === "error"
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        status === "success"
                          ? "focus:ring-green-500"
                          : status === "error"
                          ? "focus:ring-red-500"
                          : "focus:ring-purple-500"
                      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {isLoading ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Activating...
                        </>
                      ) : status === "success" ? (
                        <>
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Activated!
                        </>
                      ) : status === "error" ? (
                        <>
                          <XCircle className="w-5 h-5 mr-2" />
                          Try Again
                        </>
                      ) : (
                        <>
                          <Crown className="w-5 h-5 mr-2" />
                          Activate VIP
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                      Need a VIP code?{" "}
                      <a
                        href="mailto:support@kickin.com"
                        className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                      >
                        Contact support
                      </a>
                    </p>
                  </div>
                </div>

                {/* Right Column - Benefits */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    VIP Exclusive Benefits
                  </h3>

                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg transform hover:scale-[1.02] transition-transform">
                    <div className="flex items-center space-x-3">
                      <Gift className="w-5 h-5 text-purple-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">
                          Autoplay Feature
                        </p>
                        <p className="text-sm text-gray-600">
                          Exclusive automated gameplay
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg transform hover:scale-[1.02] transition-transform">
                    <div className="flex items-center space-x-3">
                      <Star className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">
                          VRF Chainlink
                        </p>
                        <p className="text-sm text-gray-600">
                          Fair blockchain gameplay
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg transform hover:scale-[1.02] transition-transform">
                    <div className="flex items-center space-x-3">
                      <Crown className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">AI Chat Bot</p>
                        <p className="text-sm text-gray-600">
                          Enhanced AI features
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-4 rounded-lg transform hover:scale-[1.02] transition-transform">
                    <div className="flex items-center space-x-3">
                      <Sparkles className="w-5 h-5 text-pink-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">
                          Smart Automation
                        </p>
                        <p className="text-sm text-gray-600">
                          Auto skill selection
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-lg transform hover:scale-[1.02] transition-transform">
                    <div className="flex items-center space-x-3">
                      <Lock className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">VIP Zone</p>
                        <p className="text-sm text-gray-600">
                          Exclusive VIP areas
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 text-center mt-4">
                    * Additional benefits added regularly
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
