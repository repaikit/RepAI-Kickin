import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfileMenu() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
      <div className="px-4 py-3">
        <p className="text-sm">{user?.name}</p>
        <p className="truncate text-sm font-medium text-gray-900">
          {user?.email}
        </p>
      </div>
      <Link
        href="/profile"
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        Profile Settings
      </Link>
      <Link
        href="/redeem-code"
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        Redeem Code
      </Link>
      <button
        onClick={handleLogout}
        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
      >
        Logout
      </button>
    </div>
  );
}
