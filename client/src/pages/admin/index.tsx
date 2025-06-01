import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Key, Package, RefreshCw } from 'lucide-react';
import UserManagement from '@/components/admin/UserManagement';
import CodeManagement from '@/components/admin/CodeManagement';
import NFTManagement from '@/components/admin/NFTManagement';
import AdminLayout from '@/components/layouts/AdminLayout';
import { API_ENDPOINTS, adminFetchOptions } from '@/config/api';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface User {
  _id: string;
  name: string;
  email?: string;
  wallet?: string;
  user_type: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login?: string;
  nft_minted?: number;
}

interface Code {
  _id: string;
  code: string;
  type: string;
  status: string;
  created_by: string;
  used_by?: string;
  created_at: string;
  used_at?: string;
  expires_at?: string;
}

interface NFT {
  _id: string;
  name: string;
  description: string;
  image_url: string;
  token_id: string;
  contract_address: string;
  owner_address: string;
  chain: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'inactive';
  metadata?: Record<string, any>;
}

interface NFTCollection {
  _id: string;
  name: string;
  description: string;
  image_url: string;
  contract_address: string;
  chain: string;
  owner_address: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'inactive';
  total_nfts: number;
}

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('users');

  // Statistics
  const [userCount, setUserCount] = useState<number | null>(null);
  const [codeCount, setCodeCount] = useState<number | null>(null);
  const [nftCount, setNftCount] = useState<number | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Data states
  const [users, setUsers] = useState<User[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [loadingData, setLoadingData] = useState({
    users: false,
    codes: false,
    nfts: false,
    collections: false
  });
  const token = localStorage.getItem('access_token');

  // Redirect if not admin
  React.useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push('/login');
    }
  }, [isAuthenticated, user, router]);

  // Fetch dashboard stats
  const fetchStats = async () => {
    if (!token) return;
    setLoadingStats(true);
    try {
      const res = await fetch(API_ENDPOINTS.admin.dashboardStats, {
        ...adminFetchOptions,
        headers: { ...adminFetchOptions.headers, Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUserCount(data.userCount);
      setCodeCount(data.codeCount);
      setNftCount(data.nftCount);
    } catch (err) {
      setUserCount(0);
      setCodeCount(0);
      setNftCount(0);
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch all data
  const fetchAllData = async () => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      // Fetch users
      setLoadingData(prev => ({ ...prev, users: true }));
      const usersRes = await fetch(API_ENDPOINTS.admin.users.list, {
        ...adminFetchOptions,
        headers: { 
          ...adminFetchOptions.headers, 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!usersRes.ok) {
        const errorData = await usersRes.json();
        throw new Error(errorData.detail || 'Failed to fetch users');
      }
      const usersData = await usersRes.json();
      setUsers(usersData.users);

      // Fetch codes
      setLoadingData(prev => ({ ...prev, codes: true }));
      const codesRes = await fetch(`${API_ENDPOINTS.admin.codes.list}?code_type=VIP`, {
        ...adminFetchOptions,
        headers: { 
          ...adminFetchOptions.headers, 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!codesRes.ok) {
        const errorData = await codesRes.json();
        throw new Error(errorData.detail || 'Failed to fetch codes');
      }
      const codesData = await codesRes.json();
      setCodes(codesData.codes);

      // Fetch NFTs
      setLoadingData(prev => ({ ...prev, nfts: true }));
      const nftsRes = await fetch(API_ENDPOINTS.admin.nfts.list, {
        ...adminFetchOptions,
        headers: { 
          ...adminFetchOptions.headers, 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!nftsRes.ok) {
        const errorData = await nftsRes.json();
        throw new Error(errorData.detail || 'Failed to fetch NFTs');
      }
      const nftsData = await nftsRes.json();
      setNfts(nftsData.nfts);

      // Fetch collections
      setLoadingData(prev => ({ ...prev, collections: true }));
      const collectionsRes = await fetch(API_ENDPOINTS.admin.nfts.collections.list, {
        ...adminFetchOptions,
        headers: { 
          ...adminFetchOptions.headers, 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!collectionsRes.ok) {
        const errorData = await collectionsRes.json();
        throw new Error(errorData.detail || 'Failed to fetch collections');
      }
      const collectionsData = await collectionsRes.json();
      setCollections(collectionsData.collections);

      toast.success('Data refreshed successfully');
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          toast.error('Connection error. Please check your internet connection.');
        } else {
          toast.error(error.message || 'Failed to fetch data');
        }
      } else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setLoadingData({
        users: false,
        codes: false,
        nfts: false,
        collections: false
      });
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchStats();
    fetchAllData();
  }, [token]);

  const handleReload = () => {
    fetchStats();
    fetchAllData();
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8 min-h-screen bg-gradient-to-b from-white via-blue-50 to-blue-100">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 tracking-tight">Admin Dashboard</h1>
          <Button 
            onClick={handleReload}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Data
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {/* User Statistics */}
          <Card className="shadow-lg rounded-2xl border-0 bg-white hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-blue-700">Total Users</CardTitle>
              <Users className="h-6 w-6 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-blue-900">
                {loadingStats ? <span className="animate-pulse">...</span> : userCount}
              </div>
              <p className="text-xs text-gray-400 mt-1">Compared to last month</p>
            </CardContent>
          </Card>
          {/* Code Statistics */}
          <Card className="shadow-lg rounded-2xl border-0 bg-white hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-blue-700">Total Codes Issued</CardTitle>
              <Key className="h-6 w-6 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-blue-900">
                {loadingStats ? <span className="animate-pulse">...</span> : codeCount}
              </div>
              <p className="text-xs text-gray-400 mt-1">Compared to last month</p>
            </CardContent>
          </Card>
          {/* NFT Statistics */}
          <Card className="shadow-lg rounded-2xl border-0 bg-white hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-blue-700">Total NFTs</CardTitle>
              <Package className="h-6 w-6 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-blue-900">
                {loadingStats ? <span className="animate-pulse">...</span> : nftCount}
              </div>
              <p className="text-xs text-gray-400 mt-1">Compared to last month</p>
            </CardContent>
          </Card>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="flex gap-4 bg-blue-50 rounded-xl p-2 mb-4">
              <TabsTrigger value="users" className="px-6 py-2 rounded-xl text-blue-700 font-semibold data-[state=active]:bg-blue-100">User Management</TabsTrigger>
              <TabsTrigger value="codes" className="px-6 py-2 rounded-xl text-blue-700 font-semibold data-[state=active]:bg-blue-100">Code Management</TabsTrigger>
              <TabsTrigger value="nfts" className="px-6 py-2 rounded-xl text-blue-700 font-semibold data-[state=active]:bg-blue-100">NFT Management</TabsTrigger>
            </TabsList>
            <TabsContent value="users">
              <UserManagement 
                initialUsers={users} 
                loading={loadingData.users}
                onUsersChange={setUsers}
              />
            </TabsContent>
            <TabsContent value="codes">
              <CodeManagement 
                initialCodes={codes}
                loading={loadingData.codes}
                onCodesChange={setCodes}
              />
            </TabsContent>
            <TabsContent value="nfts">
              <NFTManagement 
                initialNFTs={nfts}
                initialCollections={collections}
                loading={loadingData.nfts}
                loadingCollections={loadingData.collections}
                onNFTsChange={setNfts}
                onCollectionsChange={setCollections}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminLayout>
  );
} 