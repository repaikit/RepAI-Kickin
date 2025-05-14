import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePrivy } from '@privy-io/react-auth';
import { useGuestUserContext } from "@/contexts/GuestUserContext";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function Header() {
  const { login, logout, user, ready, authenticated } = usePrivy();
  const { guestUser } = useGuestUserContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasTriedConvert, setHasTriedConvert] = useState(false);

  // Close menu when clicking outside
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

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      await login();
      
      // Wait for Privy to update user data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (guestUser?.session_id && guestUser?.user_type === 'guest') {
        console.log('Converting guest user to regular user...');
        await convertGuestUser();
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const convertGuestUser = async () => {
    if (!guestUser?.session_id || !user?.id) {
      console.log('Missing required data for conversion:', {
        sessionId: guestUser?.session_id,
        privyId: user?.id
      });
      return;
    }

    try {
      setIsConverting(true);
      console.log('Starting guest user conversion...', {
        sessionId: guestUser.session_id,
        privyId: user.id,
        email: user.email?.address,
        wallet: user.wallet?.address
      });
      
      const response = await fetch(API_ENDPOINTS.users.convertGuest, {
        ...defaultFetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          session_id: guestUser.session_id,
          privy_info: {
            privy_id: user.id,
            email: user.email?.address,
            wallet: user.wallet?.address,
            name: user.email?.address?.split('@')[0] || 'User',
            is_verified: true
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to convert guest user: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Guest user converted successfully:', data);
      
      // Reload page to update user state
      window.location.reload();
    } catch (error) {
      console.error('Error converting guest user:', error);
    } finally {
      setIsConverting(false);
    }
  };

  useEffect(() => {
    if (
      authenticated &&
      user?.id &&
      guestUser?.session_id &&
      !isConverting &&
      guestUser?.user_type === 'guest' &&
      !hasTriedConvert
    ) {
      setHasTriedConvert(true);
      convertGuestUser();
    }
    // Nếu đã là user thì reset hasTriedConvert để lần sau login lại guest có thể convert tiếp
    if (guestUser?.user_type !== 'guest' && hasTriedConvert) {
      setHasTriedConvert(false);
    }
  }, [authenticated, user, guestUser, isConverting, hasTriedConvert]);

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await logout();
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthenticated = !!user;
  const displayName = user?.email?.address?.split('@')[0] || user?.wallet?.address?.slice(0, 6) || 'Guest';
  const avatarInitial = displayName[0].toUpperCase();

  const getAvatarUrl = () => {
    if (guestUser?.avatar) return guestUser.avatar;
    if (user && 'picture' in user && user.picture) return user.picture as string;
    if (user && 'avatar' in user && user.avatar) return user.avatar as string;
    return undefined;
  };

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
          <button className="text-slate-600 hover:text-primary transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          
          <div className="relative profile-menu">
            {!ready ? (
              <Skeleton className="w-10 h-10 rounded-full" />
            ) : (
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center space-x-2 focus:outline-none hover:opacity-80 transition-opacity"
                  disabled={isConverting || isLoading}
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
                    {isAuthenticated ? (
                      <>
                        <div className="px-4 py-3 border-b border-slate-100">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-medium text-lg">
                              {avatarInitial}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{displayName}</p>
                              <p className="text-sm text-slate-500 truncate">
                                {user?.email?.address || user?.wallet?.address}
                              </p>
                            </div>
                          </div>
                        </div>
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
                            onClick={handleLogout}
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
                          <p className="text-sm text-slate-500">Connect your wallet to access all features</p>
                        </div>
                        <div className="p-4">
                          <button
                            onClick={handleLogin}
                            disabled={isConverting || isLoading}
                            className="w-full flex items-center justify-center px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isConverting ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Converting...
                              </>
                            ) : isLoading ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Connecting...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9.4l1.93 1.93c.39.39 1.02.39 1.41 0L17 8.75l-1.38-1.38-3.07 3.07L9.8 7.68 8.42 9.06l1.58 1.54z" fill="currentColor"/>
                                </svg>
                                Connect with Privy
                              </>
                            )}
                          </button>
                        </div>
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
