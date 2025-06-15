import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { GiCrownCoin } from "react-icons/gi";

const VIPZoneModal = () => {
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState("");

  const handleInviteCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement invite code validation

  };

  const handleUpgradeClick = () => {
    // TODO: Implement upgrade flow

  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="group flex items-center space-x-2 px-3 py-2 rounded-lg text-pink-100 hover:text-white hover:bg-pink-500/20 transition-all duration-300 relative backdrop-blur-sm">
          <GiCrownCoin className="w-4 h-4 transition-transform group-hover:scale-110 text-yellow-500" />
          <span className="font-medium">VIP Zone</span>
          <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-pink-400 to-rose-500 group-hover:w-full transition-all duration-300"></div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center text-2xl font-bold text-purple-600">
            <GiCrownCoin className="w-8 h-8 mr-2 text-yellow-500" />
            VIP Zone
          </DialogTitle>
        </DialogHeader>

        {user?.is_vip ? (
          <div className="p-6 text-center">
            <h3 className="text-xl font-bold text-purple-600 mb-4">
              Welcome to VIP Zone!
            </h3>
            <p className="text-gray-600">Enjoy your exclusive VIP benefits.</p>
            {/* Add VIP-only content here */}
          </div>
        ) : (
          <div className="p-6">
            <div className="space-y-6">
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-semibold text-purple-800 mb-2">
                  VIP Benefits
                </h4>
                <ul className="space-y-2 text-sm text-purple-600">
                  <li>• Exclusive game modes</li>
                  <li>• Special tournaments</li>
                  <li>• Custom profile badges</li>
                  <li>• Priority matchmaking</li>
                  <li>• And much more...</li>
                </ul>
              </div>

              <form onSubmit={handleInviteCodeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="inviteCode"
                    className="text-sm font-medium text-gray-700"
                  >
                    Have a VIP Invite Code?
                  </label>
                  <Input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Enter your invite code"
                    className="w-full"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                >
                  Redeem Code
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or</span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Already a Pro member? Upgrade to VIP for exclusive benefits!
                </p>
                <Button
                  onClick={handleUpgradeClick}
                  className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
                >
                  Upgrade to VIP
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VIPZoneModal;
