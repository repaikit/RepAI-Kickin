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
import { Search, Plus, Copy, Trash2, Key, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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

interface CodeManagementProps {
  initialCodes: Code[];
  loading: boolean;
  onCodesChange: (codes: Code[]) => void;
}

export default function CodeManagement({ initialCodes = [], loading: initialLoading, onCodesChange }: CodeManagementProps) {
  const { user } = useAuth();
  const [codes, setCodes] = useState<Code[]>(initialCodes || []);
  const [loading, setLoading] = useState(initialLoading);
  const [searchTerm, setSearchTerm] = useState('');
  const [codeType, setCodeType] = useState('VIP');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [generatePrefix, setGeneratePrefix] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin privileges required');
      window.location.href = '/';
    }
  }, [user]);

  useEffect(() => {
    setCodes(initialCodes);
  }, [initialCodes]);

  const fetchCodes = async () => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `${API_ENDPOINTS.admin.codes.list}?code_type=${codeType}`,
        {
          ...adminFetchOptions,
          headers: {
            ...adminFetchOptions.headers,
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Admin privileges required');
          window.location.href = '/';
          return;
        }
        throw new Error('Failed to fetch codes');
      }
      const data = await response.json();
      setCodes(data.codes);
      onCodesChange(data.codes);
      setTotalPages(data.total_pages);
      toast.success('Codes data refreshed');
    } catch (error) {
      toast.error('Failed to fetch codes');
      console.error('Error fetching codes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial data when component mounts
  useEffect(() => {
    if (isInitialLoad) {
      fetchCodes();
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);

  // Fetch codes when code type changes
  useEffect(() => {
    if (!isInitialLoad) {
      fetchCodes();
    }
  }, [codeType]);

  // Filter codes locally
  const filteredCodes = codes.filter(code => {
    const matchesSearch = code.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = codeType === 'all' || code.type === codeType;
    const matchesStatus = status === 'all' || code.status === status;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleGenerateCodes = async () => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.admin.codes.generate, {
        ...adminFetchOptions,
        method: 'POST',
        headers: {
          ...adminFetchOptions.headers,
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code_type: codeType,
          count: generateCount,
          prefix: generatePrefix || undefined
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Admin privileges required');
          return;
        }
        throw new Error('Failed to generate codes');
      }

      const data = await response.json();
      toast.success(`Generated ${data.length} codes successfully`);
      setIsGenerateDialogOpen(false);
      fetchCodes();
    } catch (error) {
      toast.error('Failed to generate codes');
      console.error('Error generating codes:', error);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    if (!confirm('Are you sure you want to delete this code?')) return;

    try {
      const response = await fetch(API_ENDPOINTS.admin.codes.delete(codeId), {
        ...adminFetchOptions,
        method: 'DELETE',
        headers: {
          ...adminFetchOptions.headers,
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code_type: codeType }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Admin privileges required');
          return;
        }
        throw new Error('Failed to delete code');
      }

      toast.success('Code deleted successfully');
      fetchCodes();
    } catch (error) {
      toast.error('Failed to delete code');
      console.error('Error deleting code:', error);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Code Management</h2>
        <div className="flex gap-2">
          <Button 
            onClick={fetchCodes}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Codes
          </Button>
          <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                Generate Codes
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">Generate {codeType} Codes</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="count" className="text-sm font-medium">Number of Codes</Label>
                  <Input
                    id="count"
                    type="number"
                    min="1"
                    max="100"
                    value={generateCount}
                    onChange={(e) => setGenerateCount(parseInt(e.target.value))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prefix" className="text-sm font-medium">Custom Prefix (Optional)</Label>
                  <Input
                    id="prefix"
                    value={generatePrefix}
                    onChange={(e) => setGeneratePrefix(e.target.value)}
                    placeholder={`Default: ${codeType}`}
                    className="rounded-xl"
                  />
                </div>
                <Button 
                  onClick={handleGenerateCodes} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                >
                  Generate
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-blue-50 p-4 rounded-xl shadow">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-blue-400" />
            <Input
              placeholder="Search codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 rounded-xl border-blue-200"
            />
          </div>
        </div>
        <Select value={codeType} onValueChange={setCodeType}>
          <SelectTrigger className="w-[180px] rounded-xl border-blue-200">
            <SelectValue placeholder="Code Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="VIP">VIP Codes</SelectItem>
            <SelectItem value="PRO">PRO Codes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px] rounded-xl border-blue-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unused">Unused</SelectItem>
            <SelectItem value="used">Used</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Codes Table */}
      <div className="rounded-2xl border bg-white shadow-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-blue-50">
              <TableHead className="text-blue-900">Code</TableHead>
              <TableHead className="text-blue-900">Type</TableHead>
              <TableHead className="text-blue-900">Status</TableHead>
              <TableHead className="text-blue-900">Created At</TableHead>
              <TableHead className="text-blue-900">Used At</TableHead>
              <TableHead className="text-blue-900">Used By</TableHead>
              <TableHead className="text-blue-900">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredCodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No codes found
                </TableCell>
              </TableRow>
            ) : (
              filteredCodes.map((code) => (
                <TableRow key={code._id} className="hover:bg-blue-50">
                  <TableCell className="font-mono">{code.code}</TableCell>
                  <TableCell>
                    <Badge variant={code.type === 'VIP' ? 'default' : 'secondary'} className="rounded-lg">
                      {code.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={code.status === 'used' ? 'destructive' : 'outline'} className="rounded-lg">
                      {code.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(code.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {code.used_at ? new Date(code.used_at).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>{code.used_by || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyCode(code.code)}
                        className="hover:bg-blue-100 rounded-xl"
                      >
                        <Copy className="h-4 w-4 text-blue-600" />
                      </Button>
                      {code.status === 'unused' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCode(code._id)}
                          className="hover:bg-red-100 rounded-xl"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2 mt-4">
        <Button
          variant="outline"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="rounded-xl border-blue-200"
        >
          Previous
        </Button>
        <Button
          variant="outline"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="rounded-xl border-blue-200"
        >
          Next
        </Button>
      </div>
    </div>
  );
} 