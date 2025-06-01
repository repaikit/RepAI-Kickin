import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS, adminFetchOptions } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Plus, ExternalLink, Image as ImageIcon, Trash2, Edit2, Package, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface NFTManagementProps {
  initialNFTs: NFT[];
  initialCollections: NFTCollection[];
  loading: boolean;
  loadingCollections: boolean;
  onNFTsChange: (nfts: NFT[]) => void;
  onCollectionsChange: (collections: NFTCollection[]) => void;
}

export default function NFTManagement({ 
  initialNFTs = [], 
  initialCollections = [], 
  loading: initialLoading, 
  loadingCollections: initialLoadingCollections,
  onNFTsChange,
  onCollectionsChange 
}: NFTManagementProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('nfts');
  const [nfts, setNfts] = useState<NFT[]>(initialNFTs || []);
  const [collections, setCollections] = useState<NFTCollection[]>(initialCollections || []);
  const [loading, setLoading] = useState(initialLoading);
  const [loadingCollections, setLoadingCollections] = useState(initialLoadingCollections);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('all');
  const [chain, setChain] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateCollectionDialog, setShowCreateCollectionDialog] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [newNFT, setNewNFT] = useState({
    name: '',
    description: '',
    image_url: '',
    token_id: '',
    contract_address: '',
    chain: '',
    owner_address: '',
    metadata: {},
  });
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    image_url: '',
    contract_address: '',
    chain: '',
    owner_address: '',
  });

  const token = localStorage.getItem('access_token');
  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin privileges required');
      window.location.href = '/';
    }
  }, [user]);

  useEffect(() => {
    setNfts(initialNFTs);
  }, [initialNFTs]);

  useEffect(() => {
    setCollections(initialCollections);
  }, [initialCollections]);

  const fetchNFTs = async () => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.admin.nfts.list, {
        ...adminFetchOptions,
        headers: {
          ...adminFetchOptions.headers,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch NFTs');
      }
      const data = await response.json();
      setNfts(data.nfts);
      onNFTsChange(data.nfts);
      toast.success('NFTs data refreshed');
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          toast.error('Connection error. Please check your internet connection.');
        } else {
          toast.error(error.message || 'Failed to fetch NFTs');
        }
      } else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCollections = async () => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      setLoadingCollections(true);
      const response = await fetch(API_ENDPOINTS.admin.nfts.collections.list, {
        ...adminFetchOptions,
        headers: {
          ...adminFetchOptions.headers,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch collections');
      }
      const data = await response.json();
      setCollections(data.collections);
      onCollectionsChange(data.collections);
      toast.success('Collections data refreshed');
    } catch (error) {
      console.error('Error fetching collections:', error);
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          toast.error('Connection error. Please check your internet connection.');
        } else {
          toast.error(error.message || 'Failed to fetch collections');
        }
      } else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setLoadingCollections(false);
    }
  };

  // Fetch initial data when component mounts
  useEffect(() => {
    if (isInitialLoad) {
      fetchNFTs();
      fetchCollections();
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);

  // Only fetch when tab changes and data is not already loaded
  useEffect(() => {
    if (!isInitialLoad) {
      if (activeTab === 'nfts' && (!nfts.length || searchTerm || status !== 'all' || chain !== 'all')) {
        fetchNFTs();
      } else if (activeTab === 'collections' && (!collections.length || searchTerm || status !== 'all' || chain !== 'all')) {
        fetchCollections();
      }
    }
  }, [activeTab, searchTerm, status, chain, isInitialLoad]);

  const handleCreateNFT = async () => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.admin.nfts.create, {
        ...adminFetchOptions,
        method: 'POST',
        headers: {
          ...adminFetchOptions.headers,
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newNFT),
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Admin privileges required');
          return;
        }
        throw new Error('Failed to create NFT');
      }

      toast.success('NFT created successfully');
      setShowCreateDialog(false);
      fetchNFTs();
    } catch (error) {
      toast.error('Failed to create NFT');
      console.error('Error creating NFT:', error);
    }
  };

  const handleCreateCollection = async () => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.admin.nfts.collections.create, {
        ...adminFetchOptions,
        method: 'POST',
        headers: {
          ...adminFetchOptions.headers,
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newCollection),
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Admin privileges required');
          return;
        }
        throw new Error('Failed to create collection');
      }

      toast.success('Collection created successfully');
      setShowCreateCollectionDialog(false);
      fetchCollections();
    } catch (error) {
      toast.error('Failed to create collection');
      console.error('Error creating collection:', error);
    }
  };

  const handleDeleteNFT = async (nftId: string) => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    if (!confirm('Are you sure you want to delete this NFT?')) return;

    try {
      const response = await fetch(API_ENDPOINTS.admin.nfts.delete(nftId), {
        ...adminFetchOptions,
        method: 'DELETE',
        headers: {
          ...adminFetchOptions.headers,
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Admin privileges required');
          return;
        }
        throw new Error('Failed to delete NFT');
      }

      toast.success('NFT deleted successfully');
      fetchNFTs();
    } catch (error) {
      toast.error('Failed to delete NFT');
      console.error('Error deleting NFT:', error);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    if (!confirm('Are you sure you want to delete this collection? All NFTs in this collection will also be deleted.')) return;

    try {
      const response = await fetch(API_ENDPOINTS.admin.nfts.collections.delete(collectionId), {
        ...adminFetchOptions,
        method: 'DELETE',
        headers: {
          ...adminFetchOptions.headers,
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Admin privileges required');
          return;
        }
        throw new Error('Failed to delete collection');
      }

      toast.success('Collection deleted successfully');
      fetchCollections();
    } catch (error) {
      toast.error('Failed to delete collection');
      console.error('Error deleting collection:', error);
    }
  };

  const filteredNFTs = nfts.filter(nft => {
    const matchesSearch = 
      nft.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nft.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nft.token_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = status === 'all' || nft.status === status;
    const matchesChain = chain === 'all' || nft.chain === chain;

    return matchesSearch && matchesStatus && matchesChain;
  });

  const filteredCollections = collections.filter(collection => {
    const matchesSearch = 
      collection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collection.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = status === 'all' || collection.status === status;
    const matchesChain = chain === 'all' || collection.chain === chain;

    return matchesSearch && matchesStatus && matchesChain;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">NFT Management</h2>
        <div className="flex gap-2">
          <Button 
            onClick={() => {
              if (activeTab === 'nfts') {
                fetchNFTs();
              } else {
                fetchCollections();
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload {activeTab === 'nfts' ? 'NFTs' : 'Collections'}
          </Button>
          {activeTab === 'nfts' ? (
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                    <Plus className="w-4 h-4 mr-2" />
                    Create NFT
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl rounded-2xl">
                  <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">Create New NFT</DialogTitle>
                    <DialogDescription>
                      Add a new NFT to the collection
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right text-sm font-medium">Name</Label>
                      <Input
                        id="name"
                        value={newNFT.name}
                        onChange={(e) => setNewNFT({ ...newNFT, name: e.target.value })}
                      className="col-span-3 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right text-sm font-medium">Description</Label>
                      <Textarea
                        id="description"
                        value={newNFT.description}
                        onChange={(e) => setNewNFT({ ...newNFT, description: e.target.value })}
                      className="col-span-3 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="image_url" className="text-right text-sm font-medium">Image URL</Label>
                      <Input
                        id="image_url"
                        value={newNFT.image_url}
                        onChange={(e) => setNewNFT({ ...newNFT, image_url: e.target.value })}
                      className="col-span-3 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="token_id" className="text-right text-sm font-medium">Token ID</Label>
                      <Input
                        id="token_id"
                        value={newNFT.token_id}
                        onChange={(e) => setNewNFT({ ...newNFT, token_id: e.target.value })}
                      className="col-span-3 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="contract_address" className="text-right text-sm font-medium">Contract Address</Label>
                      <Input
                        id="contract_address"
                        value={newNFT.contract_address}
                        onChange={(e) => setNewNFT({ ...newNFT, contract_address: e.target.value })}
                      className="col-span-3 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="chain" className="text-right text-sm font-medium">Chain</Label>
                      <Select
                        value={newNFT.chain}
                        onValueChange={(value) => setNewNFT({ ...newNFT, chain: value })}
                      >
                      <SelectTrigger className="col-span-3 rounded-xl">
                          <SelectValue placeholder="Select chain" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ETH">Ethereum</SelectItem>
                          <SelectItem value="BSC">Binance Smart Chain</SelectItem>
                          <SelectItem value="SOL">Solana</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="owner_address" className="text-right text-sm font-medium">Owner Address</Label>
                      <Input
                        id="owner_address"
                        value={newNFT.owner_address}
                        onChange={(e) => setNewNFT({ ...newNFT, owner_address: e.target.value })}
                      className="col-span-3 rounded-xl"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button onClick={handleCreateNFT} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={showCreateCollectionDialog} onOpenChange={setShowCreateCollectionDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Collection
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">Create New Collection</DialogTitle>
                  <DialogDescription>
                    Add a new NFT collection
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right text-sm font-medium">Name</Label>
                    <Input
                      id="name"
                      value={newCollection.name}
                      onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                      className="col-span-3 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right text-sm font-medium">Description</Label>
                    <Textarea
                      id="description"
                      value={newCollection.description}
                      onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                      className="col-span-3 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="image_url" className="text-right text-sm font-medium">Image URL</Label>
                    <Input
                      id="image_url"
                      value={newCollection.image_url}
                      onChange={(e) => setNewCollection({ ...newCollection, image_url: e.target.value })}
                      className="col-span-3 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="contract_address" className="text-right text-sm font-medium">Contract Address</Label>
                    <Input
                      id="contract_address"
                      value={newCollection.contract_address}
                      onChange={(e) => setNewCollection({ ...newCollection, contract_address: e.target.value })}
                      className="col-span-3 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="chain" className="text-right text-sm font-medium">Chain</Label>
                    <Select
                      value={newCollection.chain}
                      onValueChange={(value) => setNewCollection({ ...newCollection, chain: value })}
                    >
                      <SelectTrigger className="col-span-3 rounded-xl">
                        <SelectValue placeholder="Select chain" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ETH">Ethereum</SelectItem>
                        <SelectItem value="BSC">Binance Smart Chain</SelectItem>
                        <SelectItem value="SOL">Solana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="owner_address" className="text-right text-sm font-medium">Owner Address</Label>
                    <Input
                      id="owner_address"
                      value={newCollection.owner_address}
                      onChange={(e) => setNewCollection({ ...newCollection, owner_address: e.target.value })}
                      className="col-span-3 rounded-xl"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateCollectionDialog(false)} className="rounded-xl">
                      Cancel
                    </Button>
                  <Button onClick={handleCreateCollection} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                    Create
                  </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-blue-50 p-1 rounded-xl">
          <TabsTrigger 
            value="nfts" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
          >
            NFTs
          </TabsTrigger>
          <TabsTrigger 
            value="collections" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
          >
            Collections
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nfts">
          {/* NFTs Management */}
          <div className="space-y-4">
            {/* Header with Create Button */}
            <div className="flex justify-between items-center">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-blue-400" />
                  <Input
                    placeholder="Search NFTs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 rounded-xl border-blue-200"
                  />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 bg-blue-50 p-4 rounded-xl shadow">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[180px] rounded-xl border-blue-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={chain} onValueChange={setChain}>
                <SelectTrigger className="w-[180px] rounded-xl border-blue-200">
                  <SelectValue placeholder="Chain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chains</SelectItem>
                  <SelectItem value="ETH">Ethereum</SelectItem>
                  <SelectItem value="BSC">Binance Smart Chain</SelectItem>
                  <SelectItem value="SOL">Solana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* NFTs Table */}
            <div className="rounded-2xl border bg-white shadow-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50">
                    <TableHead className="text-blue-900">Image</TableHead>
                    <TableHead className="text-blue-900">Name</TableHead>
                    <TableHead className="text-blue-900">Token ID</TableHead>
                    <TableHead className="text-blue-900">Contract Address</TableHead>
                    <TableHead className="text-blue-900">Chain</TableHead>
                    <TableHead className="text-blue-900">Owner</TableHead>
                    <TableHead className="text-blue-900">Status</TableHead>
                    <TableHead className="text-blue-900">Created At</TableHead>
                    <TableHead className="text-blue-900">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredNFTs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        No NFTs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredNFTs.map((nft) => (
                      <TableRow key={nft._id} className="hover:bg-blue-50">
                        <TableCell>
                          {nft.image_url ? (
                            <img
                              src={nft.image_url}
                              alt={nft.name}
                              className="w-12 h-12 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{nft.name}</TableCell>
                        <TableCell className="font-mono text-sm">{nft.token_id}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {`${nft.contract_address.slice(0, 6)}...${nft.contract_address.slice(-4)}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-lg">
                            {nft.chain}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {`${nft.owner_address.slice(0, 6)}...${nft.owner_address.slice(-4)}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={nft.status === 'active' ? 'default' : 'secondary'} className="rounded-lg">
                            {nft.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(nft.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteNFT(nft._id)}
                              className="hover:bg-red-100 rounded-xl"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="collections">
          {/* Collections Management */}
          <div className="space-y-4">
            {/* Header with Create Button */}
            <div className="flex justify-between items-center">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-blue-400" />
                  <Input
                    placeholder="Search collections..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 rounded-xl border-blue-200"
                  />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 bg-blue-50 p-4 rounded-xl shadow">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[180px] rounded-xl border-blue-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={chain} onValueChange={setChain}>
                <SelectTrigger className="w-[180px] rounded-xl border-blue-200">
                  <SelectValue placeholder="Chain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chains</SelectItem>
                  <SelectItem value="ETH">Ethereum</SelectItem>
                  <SelectItem value="BSC">Binance Smart Chain</SelectItem>
                  <SelectItem value="SOL">Solana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Collections Table */}
            <div className="rounded-2xl border bg-white shadow-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50">
                    <TableHead className="text-blue-900">Image</TableHead>
                    <TableHead className="text-blue-900">Name</TableHead>
                    <TableHead className="text-blue-900">Contract Address</TableHead>
                    <TableHead className="text-blue-900">Chain</TableHead>
                    <TableHead className="text-blue-900">Owner</TableHead>
                    <TableHead className="text-blue-900">Total NFTs</TableHead>
                    <TableHead className="text-blue-900">Status</TableHead>
                    <TableHead className="text-blue-900">Created At</TableHead>
                    <TableHead className="text-blue-900">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCollections ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredCollections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        No collections found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCollections.map((collection) => (
                      <TableRow key={collection._id} className="hover:bg-blue-50">
                        <TableCell>
                          {collection.image_url ? (
                            <img
                              src={collection.image_url}
                              alt={collection.name}
                              className="w-12 h-12 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{collection.name}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {`${collection.contract_address.slice(0, 6)}...${collection.contract_address.slice(-4)}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-lg">
                            {collection.chain}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {`${collection.owner_address.slice(0, 6)}...${collection.owner_address.slice(-4)}`}
                        </TableCell>
                        <TableCell>{collection.total_nfts}</TableCell>
                        <TableCell>
                          <Badge variant={collection.status === 'active' ? 'default' : 'secondary'} className="rounded-lg">
                            {collection.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(collection.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCollection(collection._id)}
                              className="hover:bg-red-100 rounded-xl"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 