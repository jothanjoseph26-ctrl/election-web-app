import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WhatsAppService } from '@/services/whatsapp.service';
import type { WhatsAppGroup, WhatsAppMessage, WhatsAppTemplate } from '@/services/whatsapp.service';
import { WhatsAppAnalytics } from '@/components/whatsapp/WhatsAppAnalytics';
import { WhatsAppTemplates } from '@/components/whatsapp/WhatsAppTemplates';
import { 
  MessageSquare,
  Users, 
  CheckCircle, 
  AlertTriangle,
  Send,
  RefreshCw,
  Plus,
  TrendingUp,
  Phone,
  Settings,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface WhatsAppDashboardProps {
  className?: string;
}

export function WhatsAppDashboard({ className }: WhatsAppDashboardProps) {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, messagesRes] = await Promise.all([
        WhatsAppService.getGroups(),
        WhatsAppService.getMessages({ limit: 100 }),
      ]);

      if (groupsRes.data) setGroups(groupsRes.data);
      if (messagesRes.data) setMessages(messagesRes.data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load WhatsApp data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Create new group
  const createGroup = async () => {
    try {
      const groupName = prompt('Enter group name:');
      if (!groupName) return;

      const { data, error } = await WhatsAppService.createGroup({
        group_name: groupName,
        description: prompt('Describe the group purpose (optional):'),
      });

      if (data) {
        toast({
          title: 'Success',
          description: `Group "${data.group_name}" created successfully`,
        });
        loadData();
      } else {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to create group',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create group',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const recentMessages = messages.slice(0, 5);
  const todayMessages = messages.filter(msg => {
    const msgDate = new Date(msg.created_at);
    const today = new Date();
    return msgDate.toDateString() === today.toDateString();
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Communication Hub</h1>
          <p className="text-muted-foreground">Manage groups, templates, and messaging analytics</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={createGroup}>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groups.length}</div>
            <p className="text-xs text-muted-foreground">Active WhatsApp groups</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayMessages.length}</div>
            <p className="text-xs text-muted-foreground">Messages sent today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messages.length > 0 ? 
                Math.round((messages.filter(m => m.status === 'delivered').length / messages.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Success rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Messages</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {messages.filter(m => m.status === 'failed').length}
            </div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Messages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Recent Messages
                </CardTitle>
                <CardDescription>Latest message activity</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : recentMessages.length > 0 ? (
                  <div className="space-y-4">
                    {recentMessages.map((message) => (
                      <div key={message.id} className="flex items-start space-x-3 pb-3 border-b last:border-b-0">
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                          {message.agent?.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">
                              {message.agent?.full_name || 'Unknown'}
                            </p>
                            <Badge className={getStatusColor(message.status)}>
                              {message.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {message.message_content}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(message.created_at), 'MMM d, HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No messages sent yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Groups Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Active Groups
                </CardTitle>
                <CardDescription>WhatsApp group management</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : groups.length > 0 ? (
                  <div className="space-y-4">
                    {groups.slice(0, 5).map((group) => (
                      <div key={group.id} className="flex items-center justify-between pb-3 border-b last:border-b-0">
                        <div>
                          <p className="font-medium">{group.group_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {group.phone_numbers?.length || 0} members
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {group.broadcast_enabled && (
                            <Badge variant="secondary">Active</Badge>
                          )}
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No groups created yet</p>
                    <Button onClick={createGroup} className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Group
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <WhatsAppAnalytics />
        </TabsContent>

        <TabsContent value="templates">
          <WhatsAppTemplates />
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Group Management
              </CardTitle>
              <CardDescription>Create and manage WhatsApp communication groups</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse border rounded-lg p-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : groups.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups.map((group) => (
                    <Card key={group.id} className="relative">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{group.group_name}</CardTitle>
                            <CardDescription className="mt-1">
                              {group.description || 'No description'}
                            </CardDescription>
                          </div>
                          <Badge variant={group.broadcast_enabled ? 'default' : 'secondary'}>
                            {group.broadcast_enabled ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Members</span>
                            <span className="font-medium">{group.phone_numbers?.length || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Auto Reply</span>
                            <Badge variant={group.auto_reply_enabled ? 'default' : 'secondary'}>
                              {group.auto_reply_enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Created {format(new Date(group.created_at), 'MMM d, yyyy')}
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" variant="outline" className="flex-1">
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Message
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1">
                              <Settings className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Groups Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first WhatsApp group to start communicating with field agents
                  </p>
                  <Button onClick={createGroup}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Group
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}