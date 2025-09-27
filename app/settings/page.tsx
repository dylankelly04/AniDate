"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Heart,
  ArrowLeft,
  Shield,
  Key,
  Download,
  Trash2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Email change state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  
  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  
  // Privacy settings state
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: true,
    showAge: true,
    showLocation: false,
    showOnlineStatus: true,
  });
  
  const supabase = createClient();

  // Load privacy settings on mount
  useEffect(() => {
    if (user) {
      fetchPrivacySettings();
    }
  }, [user]);

  const fetchPrivacySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_key, preference_value')
        .eq('user_id', user?.id)
        .in('preference_key', ['profileVisibility', 'showAge', 'showLocation', 'showOnlineStatus']);

      if (error) {
        console.error('Error fetching privacy settings:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return;
      }

      console.log('Fetched privacy settings:', data);

      // Update privacy settings with fetched values
      const newSettings = { ...privacySettings };
      data?.forEach(pref => {
        newSettings[pref.preference_key as keyof typeof privacySettings] = pref.preference_value === 'true';
      });
      setPrivacySettings(newSettings);
    } catch (err) {
      console.error('Failed to fetch privacy settings:', err);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
  };

  const handleDeleteAccount = async () => {
    const confirmText = 'DELETE';
    const userInput = prompt(
      `Are you sure you want to delete your account? This action cannot be undone.\n\nType "${confirmText}" to confirm:`
    );
    
    if (userInput !== confirmText) {
      return;
    }
    
    try {
      // Delete user's profile data first
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user?.id);
        
      if (profileError) {
        console.error('Failed to delete profile:', profileError);
      }
      
      // Delete user's matches
      const { error: matchesError } = await supabase
        .from('matches')
        .delete()
        .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id}`);
        
      if (matchesError) {
        console.error('Failed to delete matches:', matchesError);
      }
      
      // Delete user's messages
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`);
        
      if (messagesError) {
        console.error('Failed to delete messages:', messagesError);
      }
      
      // Delete user's preferences
      const { error: preferencesError } = await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user?.id);
        
      if (preferencesError) {
        console.error('Failed to delete preferences:', preferencesError);
      }
      
      // Finally, delete the auth user
      const { error: authError } = await supabase.auth.admin.deleteUser(user?.id || '');
      
      if (authError) {
        alert('Failed to delete account: ' + authError.message);
        return;
      }
      
      alert('Account deleted successfully. You will be signed out.');
      await signOut();
    } catch (err) {
      alert('Failed to delete account');
      console.error('Account deletion error:', err);
    }
  };

  const handleDownloadData = async () => {
    try {
      // Fetch user's profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
        
      if (profileError) {
        alert('Failed to fetch profile data: ' + profileError.message);
        return;
      }
      
      // Fetch user's matches
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id}`);
        
      if (matchesError) {
        console.error('Failed to fetch matches:', matchesError);
      }
      
      // Fetch user's messages
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`);
        
      if (messagesError) {
        console.error('Failed to fetch messages:', messagesError);
      }
      
      // Create data object
      const userData = {
        profile,
        matches: matches || [],
        messages: messages || [],
        exportedAt: new Date().toISOString(),
        userId: user?.id,
        email: user?.email
      };
      
      // Create and download file
      const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anidate-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Data download started!');
    } catch (err) {
      alert('Failed to download data');
      console.error('Data download error:', err);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    if (newEmail === user?.email) {
      setEmailError('This is already your current email address');
      return;
    }
    
    setEmailLoading(true);
    setEmailError("");
    
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      });
      
      if (error) {
        setEmailError(error.message);
      } else {
        setEmailDialogOpen(false);
        setNewEmail("");
        alert('Email change request sent! Please check your new email for confirmation.');
      }
    } catch (err) {
      setEmailError('Failed to update email');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    
    setPasswordLoading(true);
    setPasswordError("");
    
    try {
      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword
      });
      
      if (signInError) {
        setPasswordError('Current password is incorrect');
        setPasswordLoading(false);
        return;
      }
      
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordDialogOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        alert('Password updated successfully!');
      }
    } catch (err) {
      setPasswordError('Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        alert('Failed to connect Google account: ' + error.message);
      }
    } catch (err) {
      alert('Failed to connect Google account');
    }
  };
  
  const handlePrivacySettingChange = async (setting: string, value: boolean) => {
    setPrivacySettings(prev => ({ ...prev, [setting]: value }));
    
    // Update in user_preferences table
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ 
          user_id: user?.id,
          preference_key: setting,
          preference_value: value.toString()
        }, {
          onConflict: 'user_id,preference_key'
        });
        
      if (error) {
        console.error('Failed to update privacy setting:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        // Revert the change
        setPrivacySettings(prev => ({ ...prev, [setting]: !value }));
      } else {
        console.log('Privacy setting updated successfully:', setting, value);
      }
    } catch (err) {
      console.error('Failed to update privacy setting:', err);
      // Revert the change
      setPrivacySettings(prev => ({ ...prev, [setting]: !value }));
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 opacity-10 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/cute-anime-landscape.jpg')",
        }}
      />

      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/homescreen">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">AniDate</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profile">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account, privacy, and security settings
            </p>
          </div>

          <div className="space-y-6">
            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Account Information
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage your account details and authentication
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label className="text-base font-medium">Email Address</Label>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Change Email
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Change Email Address</DialogTitle>
                        <DialogDescription>
                          Enter your new email address. You'll receive a confirmation email.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="newEmail">New Email Address</Label>
                          <Input
                            id="newEmail"
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="Enter new email address"
                          />
                        </div>
                        {emailError && (
                          <p className="text-sm text-red-600">{emailError}</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            onClick={handleChangeEmail}
                            disabled={emailLoading}
                            className="flex-1"
                          >
                            {emailLoading ? "Updating..." : "Update Email"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEmailDialogOpen(false);
                              setNewEmail("");
                              setEmailError("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label className="text-base font-medium">Password</Label>
                      <p className="text-sm text-muted-foreground">Last changed: Never</p>
                    </div>
                  </div>
                  <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Change Password
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>
                          Enter your current password and choose a new one.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="currentPassword">Current Password</Label>
                          <div className="relative">
                            <Input
                              id="currentPassword"
                              type={showCurrentPassword ? "text" : "password"}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="Enter current password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                            >
                              {showCurrentPassword ? <EyeOff /> : <Eye />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="newPassword">New Password</Label>
                          <div className="relative">
                            <Input
                              id="newPassword"
                              type={showNewPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Enter new password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                            >
                              {showNewPassword ? <EyeOff /> : <Eye />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="confirmPassword">Confirm New Password</Label>
                          <div className="relative">
                            <Input
                              id="confirmPassword"
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Confirm new password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                            >
                              {showConfirmPassword ? <EyeOff /> : <Eye />}
                            </button>
                          </div>
                        </div>
                        {passwordError && (
                          <p className="text-sm text-red-600">{passwordError}</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            onClick={handleChangePassword}
                            disabled={passwordLoading}
                            className="flex-1"
                          >
                            {passwordLoading ? "Updating..." : "Update Password"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setPasswordDialogOpen(false);
                              setCurrentPassword("");
                              setNewPassword("");
                              setConfirmPassword("");
                              setPasswordError("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Account Status</Label>
                    <p className="text-sm text-muted-foreground">
                      Active since {new Date(user?.created_at || '').toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Privacy Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Privacy Controls
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Control what information is visible to other users
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Profile Visibility</Label>
                    <p className="text-sm text-muted-foreground">Allow other users to see your profile</p>
                  </div>
                  <Button 
                    variant={privacySettings.profileVisibility ? "default" : "outline"} 
                    size="sm"
                    onClick={() => handlePrivacySettingChange('profileVisibility', !privacySettings.profileVisibility)}
                  >
                    {privacySettings.profileVisibility ? "Public" : "Private"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Show Age</Label>
                    <p className="text-sm text-muted-foreground">Display your age on your profile</p>
                  </div>
                  <Button 
                    variant={privacySettings.showAge ? "default" : "outline"} 
                    size="sm"
                    onClick={() => handlePrivacySettingChange('showAge', !privacySettings.showAge)}
                  >
                    {privacySettings.showAge ? "Visible" : "Hidden"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Show Location</Label>
                    <p className="text-sm text-muted-foreground">Display your location on your profile</p>
                  </div>
                  <Button 
                    variant={privacySettings.showLocation ? "default" : "outline"} 
                    size="sm"
                    onClick={() => handlePrivacySettingChange('showLocation', !privacySettings.showLocation)}
                  >
                    {privacySettings.showLocation ? "Visible" : "Hidden"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Show Online Status</Label>
                    <p className="text-sm text-muted-foreground">Show when you're currently online</p>
                  </div>
                  <Button 
                    variant={privacySettings.showOnlineStatus ? "default" : "outline"} 
                    size="sm"
                    onClick={() => handlePrivacySettingChange('showOnlineStatus', !privacySettings.showOnlineStatus)}
                  >
                    {privacySettings.showOnlineStatus ? "Visible" : "Hidden"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Data & Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Data & Activity
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage your data and account activity
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label className="text-base font-medium">Download My Data</Label>
                      <p className="text-sm text-muted-foreground">Get a copy of all your data</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDownloadData}>
                    Request Download
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-5 h-5 text-red-500" />
                    <div>
                      <Label className="text-base font-medium">Delete Account</Label>
                      <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Connected Accounts */}
            <Card>
              <CardHeader>
                <CardTitle>Connected Accounts</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage your connected social accounts
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    <div>
                      <Label className="text-base font-medium">Google</Label>
                      <p className="text-sm text-muted-foreground">Not connected</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleConnectGoogle}>
                    Connect
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sign Out */}
            <Card>
              <CardHeader>
                <CardTitle>Session</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage your current session
                </p>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  onClick={handleSignOut} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Signing out..." : "Sign Out"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
