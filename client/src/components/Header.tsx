import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrivy } from "@privy-io/react-auth";
import TaskMysteryBoxDropdown from "./TaskMysteryBoxDropdown";
import { websocketService } from '@/services/websocket';
import { toast } from "sonner";

export default function Header() {
  const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuth();
  const { login, user: privyUser, ready } = usePrivy();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPrivyLoading, setIsPrivyLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.profile-menu')) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrivyLogin = async () => {
    if (isPrivyLoading) return;

    setIsPrivyLoading(true);
    try {
      console.log('Starting Privy login...');
      await login();
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsPrivyLoading(false);
      setIsMenuOpen(false);
    }
  };

  const handleRefreshGuest = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Access token not found!');
        return;
      }
      const response = await fetch(API_ENDPOINTS.users.refreshGuest, {
        method: 'POST',
        headers: {
          ...defaultFetchOptions.headers,
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to refresh turn');
      }
      const data = await response.json();
      await checkAuth();
      
      // Emit websocket event to update waiting room
      websocketService.sendMessage({
        type: 'user_updated',
        user: data.user
      });
      
      toast.success(
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Turn refreshed successfully!</span>
        </div>
      );
    } catch (err) {
      toast.error('Failed to refresh turn!');
    }
  };

  function clearPrivyTokens() {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('privy:')) {
        localStorage.removeItem(key);
      }
    });
  }

  useEffect(() => {
    if (ready && privyUser?.id && user?.user_type === 'guest') {
      (async () => {
        try {
          setUpgradeError(null);
          const token = localStorage.getItem('access_token');
          if (!token) {
            setUpgradeError('Access token not found!');
            return;
          }

          const requestData = {
            privy_id: privyUser.id,
            email: privyUser.email?.address || null,
            wallet: privyUser.wallet?.address || null,
            name: privyUser.email?.address?.split('@')[0] || 'Player'
          };

          const response = await fetch(API_ENDPOINTS.users.upgradeGuest, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestData)
          });

          if (!response.ok) {
            const errorData = await response.json();
            if (
              errorData.detail &&
              (errorData.detail.includes('Email has already been used') || errorData.detail.includes('Wallet has already been used'))
            ) {
              clearPrivyTokens();
              setUpgradeError(errorData.detail);
            } else {
              setUpgradeError(errorData.detail || 'Failed to upgrade account');
            }
            return;
          }

          await checkAuth();
          window.location.reload();
        } catch (error) {
          setUpgradeError(error instanceof Error ? error.message : 'Unknown error');
        }
      })();
    }
  }, [privyUser, ready, user?.user_type]);

  const displayName = user?.name || user?.email || 'Guest';
  const avatarInitial = displayName[0]?.toUpperCase() || 'G';
  const getAvatarUrl = () => user?.avatar;
  const isGuestUser = user?.user_type === 'guest';

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
          <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9.4l1.93 1.93c.39.39 1.02.39 1.41 0L17 8.75l-1.38-1.38-3.07 3.07L9.8 7.68 8.42 9.06l1.58 1.54z" />
          </svg>
          <h1 className="text-2xl font-bold text-slate-800">Kick'in</h1>
        </Link>

        <nav className="hidden md:flex space-x-6">
          <Link href="/" className="text-primary font-medium hover:text-primary/80 transition-colors">Dashboard</Link>
          <Link href="/matches" className="text-slate-600 hover:text-primary transition-colors">Matches</Link>
          <Link href="/players" className="text-slate-600 hover:text-primary transition-colors">Players</Link>
          <Link href="/statistics" className="text-slate-600 hover:text-primary transition-colors">Statistics</Link>
        </nav>

        <div className="flex items-center space-x-4">
          <TaskMysteryBoxDropdown />
          
          <button className="text-slate-600 hover:text-primary transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          <div className="relative profile-menu">
            {isLoading ? (
              <Skeleton className="w-10 h-10 rounded-full" />
            ) : (
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center space-x-2 focus:outline-none hover:opacity-80 transition-opacity"
                  disabled={isLoading}
                >
                  <div className="w-10 h-10 rounded-full border-2 border-primary overflow-hidden">
                    {getAvatarUrl() ? (
                      <img
                        src={getAvatarUrl()}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary flex items-center justify-center text-white font-medium">
                        {avatarInitial}
                      </div>
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-white"></span>
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl py-2 z-50 border border-slate-100">
                    {isAuthenticated && !isGuestUser ? (
                      <>
                        <div className="py-1">
                          <Link 
                            href="/profile" 
                            className="flex items-center px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <svg className="w-4 h-4 mr-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Profile Settings
                          </Link>
                          <button
                            onClick={logout}
                            disabled={isLoading}
                            className="flex items-center w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4 mr-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            {isLoading ? 'Logging out...' : 'Logout'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="py-1">
                        <div className="px-4 py-3 border-b border-slate-100">
                          <p className="text-sm text-slate-500">
                            {isGuestUser 
                              ? 'Sign in to save progress and use full features'
                              : 'Please login to use full features'
                            }
                          </p>
                        </div>
                        {isGuestUser && (
                          <div className="p-4">
                            <button
                              onClick={handleRefreshGuest}
                              className="w-full flex items-center justify-center px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mb-2"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 19A9 9 0 1 1 19 5.635" />
                              </svg>
                              Refresh Turn
                            </button>
                          </div>
                        )}
                        <div className="p-4">
                          <button
                            onClick={handlePrivyLogin}
                            disabled={isPrivyLoading}
                            className="w-full flex items-center justify-center px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9.4l1.93 1.93c.39.39 1.02.39 1.41 0L17 8.75l-1.38-1.38-3.07 3.07L9.8 7.68 8.42 9.06l1.58 1.54z" fill="currentColor"/>
                            </svg>
                            {isPrivyLoading ? 'Connecting...' : 'Login'}
                          </button>
                        </div>
                        {isGuestUser && upgradeError && (
                          <div className="px-4 py-2 text-red-600 text-sm font-medium">
                            {upgradeError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button className="md:hidden text-slate-600 hover:text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
      </div>
    </header>
  );
}
