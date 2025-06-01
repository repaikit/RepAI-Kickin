import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import { toast } from "sonner";
import router from "next/router";




const VIPZone = () => {
  const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [isLoadingRedeem, setLoadingRedeem] = useState(false);


  const handleInviteCodeSubmit = async (e: React.FormEvent) => {
    setLoadingRedeem(true);
    try {
      const verifyResponse = await fetch(
        API_ENDPOINTS.vip.verifyCode(inviteCode),
        {
          ...defaultFetchOptions,
          headers: {
            ...defaultFetchOptions.headers,
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.detail || "Invalid code");
        toast.error("Invalid code!");
      }

      // If verified, redeem code
      const redeemResponse = await fetch(
        API_ENDPOINTS.vip.redeemCode(inviteCode),
        {
          ...defaultFetchOptions,
          method: "POST",
          headers: {
            ...defaultFetchOptions.headers,
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      if (!redeemResponse.ok) {
        throw new Error("Failed to activate VIP status");
      }

      toast.success("VIP status activated successfully!");
      setTimeout(() => {
        router.push("/profile");
      }, 2000); // 2 giây = 2000ms
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setLoadingRedeem(false);
    }
  };

  const handleUpgradeClick = () => {
    // TODO: Implement upgrade flow

  };

  if (user?.is_vip) {
    return (
      <div className="p-4">
        <h3 className="text-xl font-bold text-purple-600">VIP Zone</h3>
        <p className="mt-2">Welcome to the exclusive VIP area!</p>
        {/* Add VIP-only content here */}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-xl font-bold text-gray-700">VIP Zone</h3>
      <div className="mt-4">
        <form onSubmit={handleInviteCodeSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="inviteCode"
              className="block text-sm font-medium text-gray-700"
            >
              Enter VIP Invite Code
            </label>
            <input
              type="text"
              id="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              placeholder="Enter your invite code"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
          >
            Submit Code
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600">Already a Pro member?</p>
          <button
            onClick={handleUpgradeClick}
            className="mt-2 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 px-4 rounded-md hover:from-purple-600 hover:to-pink-600 transition-colors"
          >
            Upgrade to VIP
          </button>
        </div>
      </div>
    </div>
  );
};

export default VIPZone;
