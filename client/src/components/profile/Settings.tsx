import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Pencil, 
  Copy, 
  Shield, 
  Eye, 
  EyeOff, 
  Lock 
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "react-hot-toast";

interface SettingsProps {
  user: any;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  formData: {
    name: string;
    wallet: string;
  };
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpdateProfile: () => void;
  isSavingProfile: boolean;
  copiedWallet: string | null;
  handleCopyWallet: (address: string | undefined, type: string) => void;
  showDecodedInfo: {[key: string]: boolean};
  decodedInfo: {[key: string]: string};
  setShowDecodedInfo: (value: {[key: string]: boolean}) => void;
  setDecodedInfo: (value: {[key: string]: string}) => void;
  handleDecodeWalletInfo: (type: string) => void;
  showPasswordDialog: boolean;
  setShowPasswordDialog: (value: boolean) => void;
  password: string;
  setPassword: (value: string) => void;
  handlePasswordSubmit: () => void;
  isDecoding: boolean;
  logout: () => void;
}

export default function Settings({
  user,
  isEditing,
  setIsEditing,
  formData,
  handleInputChange,
  handleUpdateProfile,
  isSavingProfile,
  copiedWallet,
  handleCopyWallet,
  showDecodedInfo,
  decodedInfo,
  setShowDecodedInfo,
  setDecodedInfo,
  handleDecodeWalletInfo,
  showPasswordDialog,
  setShowPasswordDialog,
  password,
  setPassword,
  handlePasswordSubmit,
  isDecoding,
  logout
}: SettingsProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>Manage your account preferences and information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="display-name" className="text-right font-medium">
                Display Name
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Input
                  id="display-name"
                  value={user?.name || ''}
                  readOnly
                  className="bg-gray-50"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right font-medium">
                Email
              </Label>
              <Input
                id="email"
                value={user?.email || ''}
                readOnly
                className="col-span-3 bg-gray-50"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="wallet-address" className="text-right font-medium">
                Wallet Address
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Input
                  id="wallet-address"
                  value={user?.wallet || ''}
                  readOnly
                  className="bg-gray-50 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right font-medium">
                Account Type
              </Label>
              <div className="col-span-3">
                <Badge variant={user?.user_type === 'guest' ? 'secondary' : 'default'}>
                  {user?.user_type === 'guest' ? 'Guest Account' : 'Registered User'}
                </Badge>
                {user?.auth_provider && (
                  <Badge variant="outline" className="ml-2">
                    {user.auth_provider.charAt(0).toUpperCase() + user.auth_provider.slice(1)} Login
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Wallet Security Information</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">Security Warning</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Never share your private keys or mnemonics with anyone. These are sensitive information that gives full access to your wallet.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* EVM Wallet Info */}
              <div className="space-y-2">
                <Label className="font-medium">EVM Wallet</Label>
                <div className="grid gap-2">
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500">Public Address</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={user?.evm_address || ''}
                        readOnly
                        className="bg-gray-50 font-mono text-sm"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => user?.evm_address && handleCopyWallet(user.evm_address, 'evm_address')}
                        className="p-2"
                      >
                        {copiedWallet === 'evm_address' ? (
                          <span className="text-green-600 text-xs">✓</span>
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {user?.evm_private_key && (
                    <div className="space-y-1">
                      <Label className="text-sm text-gray-500">Private Key</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type={showDecodedInfo['evm_private'] ? 'text' : 'password'}
                          value={showDecodedInfo['evm_private'] ? decodedInfo['evm_private'] : '••••••••••••••••••••••••••••••••'}
                          readOnly
                          className="bg-gray-50 font-mono text-sm"
                        />
                        <div className="flex gap-1">
                          {user.auth_provider === 'google' ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (user.evm_private_key) {
                                    if (showDecodedInfo['evm_private']) {
                                      const newShowDecodedInfo = { ...showDecodedInfo };
                                      newShowDecodedInfo['evm_private'] = false;
                                      setShowDecodedInfo(newShowDecodedInfo);
                                    } else {
                                      // Decode private key here
                                      try {
                                        const decodedKey = atob(user.evm_private_key);
                                        const newDecodedInfo = { ...decodedInfo };
                                        newDecodedInfo['evm_private'] = decodedKey;
                                        setDecodedInfo(newDecodedInfo);
                                        
                                        const newShowDecodedInfo = { ...showDecodedInfo };
                                        newShowDecodedInfo['evm_private'] = true;
                                        setShowDecodedInfo(newShowDecodedInfo);
                                      } catch (error) {
                                        console.error('Error decoding private key:', error);
                                        toast.error('Failed to decode private key');
                                      }
                                    }
                                  }
                                }}
                                className="p-2"
                              >
                                {showDecodedInfo['evm_private'] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (showDecodedInfo['evm_private'] && decodedInfo['evm_private']) {
                                    handleCopyWallet(decodedInfo['evm_private'], 'evm_private');
                                    toast.success('Private key copied to clipboard');
                                  } else {
                                    toast.error('Please decode private key first');
                                  }
                                }}
                                className="p-2"
                              >
                                {copiedWallet === 'evm_private' ? (
                                  <span className="text-green-600 text-xs">✓</span>
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </>
                          ) : user.auth_provider === 'email' ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDecodeWalletInfo('evm_private')}
                                className="p-2"
                              >
                                {showDecodedInfo['evm_private'] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (showDecodedInfo['evm_private'] && decodedInfo['evm_private']) {
                                    handleCopyWallet(decodedInfo['evm_private'], 'evm_private');
                                    toast.success('Private key copied to clipboard');
                                  } else {
                                    toast.error('Please decode private key first');
                                  }
                                }}
                                className="p-2"
                              >
                                {copiedWallet === 'evm_private' ? (
                                  <span className="text-green-600 text-xs">✓</span>
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </>
                          ) : (
                            <div className="text-sm text-gray-500">
                              Please contact support to access wallet information
                            </div>
                          )}
                        </div>
                      </div>
                      {showDecodedInfo['evm_private'] && (
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠️ Private key is now visible. Make sure no one can see your screen.
                        </p>
                      )}
                    </div>
                  )}

                  {user?.evm_mnemonic && (
                    <div className="space-y-1">
                      <Label className="text-sm text-gray-500">Mnemonic Phrase</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type={showDecodedInfo['evm_mnemonic'] ? 'text' : 'password'}
                          value={showDecodedInfo['evm_mnemonic'] ? decodedInfo['evm_mnemonic'] : user.evm_mnemonic}
                          readOnly
                          className="bg-gray-50 font-mono text-sm"
                        />
                        <div className="flex gap-1">
                          {user.auth_provider === 'google' ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (user.evm_mnemonic) {
                                    if (showDecodedInfo['evm_mnemonic']) {
                                      const newShowDecodedInfo = { ...showDecodedInfo };
                                      newShowDecodedInfo['evm_mnemonic'] = false;
                                      setShowDecodedInfo(newShowDecodedInfo);
                                    } else {
                                      const newDecodedInfo = { ...decodedInfo };
                                      newDecodedInfo['evm_mnemonic'] = user.evm_mnemonic;
                                      setDecodedInfo(newDecodedInfo);
                                      
                                      const newShowDecodedInfo = { ...showDecodedInfo };
                                      newShowDecodedInfo['evm_mnemonic'] = true;
                                      setShowDecodedInfo(newShowDecodedInfo);
                                    }
                                  }
                                }}
                                className="p-2"
                              >
                                {showDecodedInfo['evm_mnemonic'] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => user.evm_mnemonic && handleCopyWallet(user.evm_mnemonic, 'evm_mnemonic')}
                                className="p-2"
                              >
                                {copiedWallet === 'evm_mnemonic' ? (
                                  <span className="text-green-600 text-xs">✓</span>
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </>
                          ) : user.auth_provider === 'email' ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDecodeWalletInfo('evm_mnemonic')}
                                className="p-2"
                              >
                                {showDecodedInfo['evm_mnemonic'] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleCopyWallet(
                                  showDecodedInfo['evm_mnemonic'] ? decodedInfo['evm_mnemonic'] : user.evm_mnemonic,
                                  'evm_mnemonic'
                                )}
                                className="p-2"
                              >
                                {copiedWallet === 'evm_mnemonic' ? (
                                  <span className="text-green-600 text-xs">✓</span>
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </>
                          ) : (
                            <div className="text-sm text-gray-500">
                              Please contact support to access wallet information
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Game Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Auto-play Notifications</Label>
                  <p className="text-sm text-gray-600">Get notified when auto-play completes</p>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Mystery Box Alerts</Label>
                  <p className="text-sm text-gray-600">Receive alerts for available mystery boxes</p>
                </div>
                <Button variant="outline" size="sm">
                  Enable
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Level Up Celebrations</Label>
                  <p className="text-sm text-gray-600">Show animations when leveling up</p>
                </div>
                <Button variant="outline" size="sm">
                  On
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Account Actions</h3>
                <p className="text-sm text-gray-600">Manage your account</p>
              </div>
              <div className="space-x-2">
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
                <Button variant="destructive" onClick={logout}>
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Pencil className="w-5 h-5" />
              <span>Edit Profile</span>
            </DialogTitle>
            <DialogDescription>
              Update your profile information. Changes will be saved to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Display Name
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your display name"
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="wallet" className="text-sm font-medium">
                Wallet Address
              </Label>
              <Input
                id="wallet"
                name="wallet"
                value={formData.wallet}
                onChange={handleInputChange}
                placeholder="Enter your wallet address"
                className="w-full font-mono text-sm"
              />
              <p className="text-xs text-gray-500">
                Your wallet address for receiving rewards and NFTs
              </p>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateProfile} 
              disabled={isSavingProfile}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              {isSavingProfile ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Lock className="w-5 h-5" />
              <span>Enter Password</span>
            </DialogTitle>
            <DialogDescription>
              Please enter your password to view the wallet information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePasswordSubmit}
              disabled={isDecoding || !password}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              {isDecoding ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Decoding...
                </div>
              ) : (
                'Decode'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 