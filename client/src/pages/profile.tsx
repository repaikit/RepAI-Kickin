import React from "react";
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Profile() {
  const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuth();

  const getAvatarUrl = () => {
    if (user?.avatar) return user.avatar;
    if (user && 'picture' in user && user.picture) return user.picture as string;
    if (user && 'avatar' in user && user.avatar) return user.avatar as string;
    return undefined;
  };

  const displayName = user?.email?.split('@')[0]  || user?.name || 'Guest';
  // || user?.wallet?.address?.slice(0, 6)
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-xl">
        <div className="bg-white rounded-xl shadow-md p-8 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full border-4 border-primary overflow-hidden mb-4">
            {getAvatarUrl() ? (
              <img src={getAvatarUrl()} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary flex items-center justify-center text-white text-3xl font-bold">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">{displayName}</h2>
          <p className="text-slate-500 mb-4">
            {user?.email || user?.user_type}
          </p>

          <div className="w-full space-y-3 mt-4">
            <div className="flex justify-between text-slate-700">
              <span className="font-medium">Account Type:</span>
              <span>{user?.user_type === 'guest' ? 'Guest' : 'Privy'}</span>
            </div>
            {/* <div className="flex justify-between text-slate-700">
              <span className="font-medium">Wallet:</span>
              <span>{user?.wallet?.address || 'N/A'}</span>
            </div> */}
            <div className="flex justify-between text-slate-700">
              <span className="font-medium">Points:</span>
              <span>{user?.total_point ?? 0}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span className="font-medium">Wins:</span>
              <span>{user?.total_kicked ?? 0}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span className="font-medium">Losses:</span>
              <span>{user?.total_keep ?? 0}</span>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
} 