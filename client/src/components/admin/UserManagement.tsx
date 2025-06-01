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
import { Search, Filter, MoreVertical, Users, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

interface UserManagementProps {
  initialUsers: User[];
  loading: boolean;
  onUsersChange: (users: User[]) => void;
}

export default function UserManagement({ initialUsers = [], loading: initialLoading, onUsersChange }: UserManagementProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>(initialUsers || []);
  const [loading, setLoading] = useState(initialLoading);
  const [searchTerm, setSearchTerm] = useState('');
  const [userType, setUserType] = useState('all');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin privileges required');
      window.location.href = '/';
    }
  }, [user]);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const fetchUsers = async () => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `${API_ENDPOINTS.admin.users.list}?page=${page}&limit=10&search=${searchTerm}&user_type=${userType}&role=${role}`,
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
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data.users);
      onUsersChange(data.users);
      setTotalPages(data.total_pages);
      toast.success('Users data refreshed');
    } catch (error) {
      toast.error('Failed to fetch users');
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter users locally
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (user.wallet?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesType = userType === 'all' || user.user_type === userType;
    const matchesRole = role === 'all' || user.role === role;

    return matchesSearch && matchesType && matchesRole;
  });

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.admin.users.update(userId), {
        ...adminFetchOptions,
        method: 'PATCH',
        headers: {
          ...adminFetchOptions.headers,
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Admin privileges required');
          return;
        }
        throw new Error('Failed to update user');
      }

      toast.success('User updated successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user');
      console.error('Error updating user:', error);
    }
  };

  const handleActivateUser = async (userId: string) => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.admin.users.activate(userId), {
        ...adminFetchOptions,
        method: 'POST',
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
        throw new Error('Failed to activate user');
      }

      toast.success('User activated successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to activate user');
      console.error('Error activating user:', error);
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.admin.users.deactivate(userId), {
        ...adminFetchOptions,
        method: 'POST',
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
        throw new Error('Failed to deactivate user');
      }

      toast.success('User deactivated successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to deactivate user');
      console.error('Error deactivating user:', error);
    }
  };

  const handleMakeAdmin = async (userId: string) => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.admin.users.makeAdmin(userId), {
        ...adminFetchOptions,
        method: 'POST',
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
        throw new Error('Failed to make user admin');
      }

      toast.success('User is now an admin');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to make user admin');
      console.error('Error making user admin:', error);
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.admin.users.removeAdmin(userId), {
        ...adminFetchOptions,
        method: 'POST',
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
        throw new Error('Failed to remove admin role');
      }

      toast.success('Admin role removed successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to remove admin role');
      console.error('Error removing admin role:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(API_ENDPOINTS.admin.users.delete(userId), {
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
        throw new Error('Failed to delete user');
      }

      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
      console.error('Error deleting user:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <Button 
          onClick={fetchUsers}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reload Users
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-blue-50 p-4 rounded-xl shadow">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-blue-400" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 rounded-xl border-blue-200"
            />
          </div>
        </div>
        <Select value={userType} onValueChange={setUserType}>
          <SelectTrigger className="w-[180px] rounded-xl border-blue-200">
            <SelectValue placeholder="User Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="guest">Guest</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-[180px] rounded-xl border-blue-200">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border bg-white shadow-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-blue-50">
              <TableHead className="text-blue-900">Name</TableHead>
              <TableHead className="text-blue-900">Email</TableHead>
              <TableHead className="text-blue-900">Wallet</TableHead>
              <TableHead className="text-blue-900">Type</TableHead>
              <TableHead className="text-blue-900">Role</TableHead>
              <TableHead className="text-blue-900">Status</TableHead>
              <TableHead className="text-blue-900">NFTs</TableHead>
              <TableHead className="text-blue-900">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user._id} className="hover:bg-blue-50">
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {user.wallet ? `${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.user_type === 'admin' ? 'destructive' : 'secondary'} className="rounded-lg">
                      {user.user_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'destructive' : 'outline'} className="rounded-lg">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'default' : 'destructive'} className="rounded-lg">
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.nft_minted || 0}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-100 rounded-xl">
                          <MoreVertical className="h-4 w-4 text-blue-600" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl border-blue-200">
                        {user.is_active ? (
                          <DropdownMenuItem 
                            onClick={() => handleDeactivateUser(user._id)}
                            className="text-red-600 hover:bg-red-50 focus:bg-red-50"
                          >
                            Deactivate User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => handleActivateUser(user._id)}
                            className="text-green-600 hover:bg-green-50 focus:bg-green-50"
                          >
                            Activate User
                          </DropdownMenuItem>
                        )}
                        {user.role === 'admin' ? (
                          <DropdownMenuItem 
                            onClick={() => handleRemoveAdmin(user._id)}
                            className="text-red-600 hover:bg-red-50 focus:bg-red-50"
                          >
                            Remove Admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => handleMakeAdmin(user._id)}
                            className="text-blue-600 hover:bg-blue-50 focus:bg-blue-50"
                          >
                            Make Admin
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600 hover:bg-red-50 focus:bg-red-50"
                          onClick={() => handleDeleteUser(user._id)}
                        >
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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