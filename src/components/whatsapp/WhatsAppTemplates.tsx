import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useWhatsAppTemplates, type TemplateFormData } from '@/hooks/useWhatsAppTemplates';
import { MessageSquare, Plus, Edit, Trash2, Send, Copy, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function WhatsAppTemplates() {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate, testTemplate } = useWhatsAppTemplates();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
    template_name: '',
    category: 'broadcast',
    message_content: '',
    variables: {},
    auto_send: false,
  });
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testVariables, setTestVariables] = useState('{}');

  const categories = [
    { value: 'broadcast', label: 'Broadcast', color: 'bg-blue-100 text-blue-800' },
    { value: 'payment_reminder', label: 'Payment Reminder', color: 'bg-green-100 text-green-800' },
    { value: 'emergency_alert', label: 'Emergency Alert', color: 'bg-red-100 text-red-800' },
    { value: 'verification_request', label: 'Verification Request', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'welcome', label: 'Welcome Message', color: 'bg-purple-100 text-purple-800' },
  ];

  const sampleTemplates = {
    broadcast: "Hello {{agent_name}}, this is an important update from the election monitoring team. {{message}}",
    payment_reminder: "Dear {{agent_name}}, your payment of {{amount}} for {{period}} is {{status}}. Please contact your supervisor if you have questions.",
    emergency_alert: "🚨 URGENT: {{emergency_type}} reported in {{location}}. All agents please {{action_required}}. Contact: {{contact_person}}",
    verification_request: "Please verify your report for {{location}} submitted on {{date}}. Confirm: YES/NO or call {{supervisor_name}} at {{phone}}",
    welcome: "Welcome {{agent_name}} to the election monitoring team! Your ward is {{ward_name}}. Your supervisor is {{supervisor_name}}. Reply HELP for commands.",
  };

  const resetForm = () => {
    setFormData({
      template_name: '',
      category: 'broadcast',
      message_content: '',
      variables: {},
      auto_send: false,
    });
    setEditingTemplate(null);
  };

  const handleCreateTemplate = async () => {
    if (!formData.template_name || !formData.message_content) {
      toast({
        title: "Error",
        description: "Template name and content are required",
        variant: "destructive",
      });
      return;
    }

    const result = await createTemplate(formData);
    if (result.success) {
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: "Success",
        description: "Template created successfully",
      });
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;

    const result = await updateTemplate(editingTemplate, formData);
    if (result.success) {
      setEditingTemplate(null);
      resetForm();
      toast({
        title: "Success",
        description: "Template updated successfully",
      });
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    const result = await deleteTemplate(id);
    if (result.success) {
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleTestTemplate = async (templateId: string) => {
    if (!testPhoneNumber) {
      toast({
        title: "Error",
        description: "Please enter a test phone number",
        variant: "destructive",
      });
      return;
    }

    let variables = {};
    try {
      variables = JSON.parse(testVariables);
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid JSON format for variables",
        variant: "destructive",
      });
      return;
    }

    const result = await testTemplate(templateId, testPhoneNumber, variables);
    if (result.success) {
      toast({
        title: "Success",
        description: "Test message sent successfully",
      });
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const startEdit = (template: any) => {
    setFormData({
      template_name: template.template_name,
      category: template.category,
      message_content: template.message_content,
      variables: template.variables || {},
      auto_send: template.auto_send,
    });
    setEditingTemplate(template.id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Template content copied to clipboard",
    });
  };

  const getCategoryColor = (category: string) => {
    return categories.find(c => c.value === category)?.color || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-16 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Message Templates</h2>
          <p className="text-muted-foreground">Create and manage reusable message templates</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
              <DialogDescription>
                Design a reusable message template with variables
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={formData.template_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, template_name: e.target.value }))}
                    placeholder="e.g., Payment Reminder"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value: any) => setFormData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="message-content">Message Content</Label>
                <Textarea
                  id="message-content"
                  value={formData.message_content}
                  onChange={(e) => setFormData(prev => ({ ...prev, message_content: e.target.value }))}
                  placeholder="Enter your message here. Use {{variable_name}} for dynamic content."
                  rows={6}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Use {'{'}{'variable_name'}{'}'} for dynamic variables (e.g., {'{'}{'agent_name'}{'}'}, {'{'}{'amount'}{'}'})
                </p>
              </div>

              {formData.category && (
                <div>
                  <Label>Sample Template</Label>
                  <div className="p-3 bg-gray-50 rounded-md text-sm font-mono">
                    {sampleTemplates[formData.category as keyof typeof sampleTemplates]}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      message_content: sampleTemplates[formData.category as keyof typeof sampleTemplates]
                    }))}
                  >
                    Use Sample
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTemplate}>
                Create Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{template.template_name}</CardTitle>
                  <div className="mt-2">
                    <Badge className={getCategoryColor(template.category)}>
                      {categories.find(c => c.value === template.category)?.label}
                    </Badge>
                    {template.auto_send && (
                      <Badge variant="outline" className="ml-2">
                        Auto Send
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(template)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 line-clamp-3">
                  {template.message_content}
                </p>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(template.message_content)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTestPhoneNumber('');
                      setTestVariables('{}');
                      // Open test dialog - you could implement this as a separate dialog
                    }}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Test
                  </Button>
                </div>

                {testPhoneNumber && (
                  <div className="border rounded-md p-3 space-y-2">
                    <Input
                      placeholder="Test phone number"
                      value={testPhoneNumber}
                      onChange={(e) => setTestPhoneNumber(e.target.value)}
                    />
                    <Textarea
                      placeholder='Variables in JSON format, e.g., {"name": "John"}'
                      value={testVariables}
                      onChange={(e) => setTestVariables(e.target.value)}
                      rows={2}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleTestTemplate(template.id)}
                    >
                      Send Test
                    </Button>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Created: {new Date(template.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Template Dialog */}
      {editingTemplate && (
        <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
              <DialogDescription>
                Update the template configuration
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-template-name">Template Name</Label>
                  <Input
                    id="edit-template-name"
                    value={formData.template_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, template_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category">Category</Label>
                  <Select value={formData.category} onValueChange={(value: any) => setFormData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-message-content">Message Content</Label>
                <Textarea
                  id="edit-message-content"
                  value={formData.message_content}
                  onChange={(e) => setFormData(prev => ({ ...prev, message_content: e.target.value }))}
                  rows={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTemplate}>
                Update Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {templates.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-gray-500 text-center mb-4">
              Create your first message template to streamline your WhatsApp communications
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}