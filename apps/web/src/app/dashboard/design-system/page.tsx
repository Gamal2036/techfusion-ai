'use client';

import { useState } from 'react';
import {
  Button, IconButton, Input, SearchInput, PasswordInput, Textarea, Label, Select, Switch, Checkbox,
  FormField, FieldMessage,
  Card, GlassPanel, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Badge, StatusBadge, StatusMessage, ScorePill, MetricValue, TrendIndicator, DataSummary,
  StatCard, MetricCard, HealthCard, DeviceCard,
  Alert, EmptyState, ErrorState, LoadingSpinner, Skeleton,
  SkeletonText, SkeletonTitle, SkeletonCircle, SkeletonButton, SkeletonCard,
  Progress, ProgressRing,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Breadcrumbs, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
  Pagination,
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
  Avatar, AvatarFallback,
  PresenceIndicator,
  AIMessage, AIThinking, Citation, PromptCard,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
  Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter, ModalClose,
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@techfusion/ui';
import {
  Plus, Search, Settings, User, Mail, Lock, Eye, EyeOff, Copy, Trash2,
  CheckCircle, AlertTriangle, Info, Activity, Monitor, Shield, Wifi,
  ArrowUpRight, ArrowDownRight, Bell, Zap, Server, BookOpen, FileText,
  ChevronDown, ChevronRight, Download, Edit3,
} from 'lucide-react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

export default function DesignSystemPage() {
  const [inputVal, setInputVal] = useState('');
  const [switchVal, setSwitchVal] = useState(false);
  const [checkVal, setCheckVal] = useState(false);
  const [selectVal, setSelectVal] = useState('');
  const [passwordVal, setPasswordVal] = useState('');
  const [textareaVal, setTextareaVal] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <TooltipProvider>
      <div className="space-y-8 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Design System Preview</h1>
          <p className="text-sm text-text-muted mt-1">Internal component library preview. All data is mocked.</p>
        </div>

        {/* BUTTONS */}
        <Section title="Buttons">
          <Row>
            <Button variant="primary">Primary</Button>
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="success">Success</Button>
            <Button variant="glass">Glass</Button>
            <Button variant="link">Link</Button>
          </Row>
          <Row>
            <Button size="xs">Extra Small</Button>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
          </Row>
          <Row>
            <Button loading>Loading</Button>
            <Button loading loadingText="Saving...">With Text</Button>
            <Button disabled>Disabled</Button>
            <Button leftIcon={<Plus className="h-4 w-4" />}>With Icon</Button>
            <Button rightIcon={<ArrowUpRight className="h-4 w-4" />}>Trailing Icon</Button>
            <Button fullWidth>Full Width</Button>
          </Row>
          <Row>
            <IconButton icon={<Settings className="h-4 w-4" />} label="Settings" variant="ghost" />
            <IconButton icon={<Trash2 className="h-4 w-4" />} label="Delete" variant="danger" />
            <IconButton icon={<Copy className="h-4 w-4" />} label="Copy" variant="outline" />
            <IconButton icon={<Plus className="h-4 w-4" />} label="Add" variant="glass" size="lg" />
          </Row>
        </Section>

        {/* INPUTS */}
        <Section title="Inputs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <Input label="Default Input" placeholder="Enter value..." value={inputVal} onChange={(e) => setInputVal(e.target.value)} />
            <Input label="With Value" value="Hello World" readOnly />
            <Input label="With Error" placeholder="Invalid" error="This field is required" />
            <Input label="With Success" placeholder="Valid" success="Looks good!" />
            <Input label="With Left Icon" placeholder="Search..." leftIcon={<Search className="h-4 w-4" />} />
            <Input label="Disabled" placeholder="Disabled" disabled />
            <Input label="Required" placeholder="Required field" required />
            <Input label="Full Width" placeholder="Full width" fullWidth />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
            <SearchInput placeholder="Search..." inputSize="sm" />
            <SearchInput placeholder="Search..." inputSize="md" />
            <SearchInput placeholder="Search..." inputSize="lg" />
          </div>
          <div className="max-w-md">
            <PasswordInput label="Password" placeholder="Enter password..." value={passwordVal} onChange={(e) => setPasswordVal(e.target.value)} />
          </div>
          <div className="max-w-md">
            <Textarea label="Message" placeholder="Type your message..." value={textareaVal} onChange={(e) => setTextareaVal(e.target.value)} rows={3} />
          </div>
        </Section>

        {/* FORM CONTROLS */}
        <Section title="Form Controls">
          <Row>
            <Switch label="Enable notifications" checked={switchVal} onCheckedChange={(v) => setSwitchVal(v === true)} />
            <Switch label="Disabled switch" disabled />
            <Checkbox label="I agree to the terms" checked={checkVal} onCheckedChange={(v) => setCheckVal(v === true)} />
            <Checkbox label="Disabled checkbox" disabled />
          </Row>
          <div className="max-w-sm">
            <Select
              label="Select Option"
              placeholder="Choose..."
              value={selectVal}
              onValueChange={setSelectVal}
              options={[
                { value: 'option1', label: 'Option 1' },
                { value: 'option2', label: 'Option 2' },
                { value: 'option3', label: 'Option 3' },
              ]}
            />
          </div>
          <div className="max-w-md">
            <Label>Label Component</Label>
            <FieldMessage variant="description">This is a description message</FieldMessage>
            <FieldMessage variant="error">This is an error message</FieldMessage>
            <FieldMessage variant="success">This is a success message</FieldMessage>
            <FieldMessage variant="warning">This is a warning message</FieldMessage>
          </div>
        </Section>

        {/* BADGES & STATUS */}
        <Section title="Badges & Status">
          <Row>
            <Badge variant="default">Default</Badge>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="outline">Outline</Badge>
          </Row>
          <Row>
            <StatusBadge status="online" label="Online" dot />
            <StatusBadge status="offline" label="Offline" dot />
            <StatusBadge status="away" label="Away" dot />
            <StatusBadge status="busy" label="Busy" dot />
            <StatusBadge status="success" label="Success" />
            <StatusBadge status="warning" label="Warning" />
            <StatusBadge status="danger" label="Danger" />
            <StatusBadge status="syncing" label="Syncing" pulse />
          </Row>
          <Row>
            <StatusMessage variant="success" layout="inline">Operation completed successfully</StatusMessage>
            <StatusMessage variant="error" layout="inline">Something went wrong</StatusMessage>
            <StatusMessage variant="warning" layout="inline">Please review your input</StatusMessage>
            <StatusMessage variant="info" layout="inline">This is informational</StatusMessage>
          </Row>
          <Row>
            <ScorePill label="Health" value={85} variant="health" />
            <ScorePill label="Risk" value={32} variant="risk" />
            <ScorePill label="Security" value={92} variant="security" />
          </Row>
        </Section>

        {/* METRIC DISPLAY */}
        <Section title="Metric Display">
          <Row>
            <MetricValue value={98.5} label="CPU Usage" unit="%" tone="success" size="sm" />
            <MetricValue value={72} label="Memory" unit="%" tone="warning" size="md" />
            <MetricValue value={45} label="Disk" unit="%" tone="danger" size="lg" />
            <MetricValue value={null} label="No Data" noDataLabel="N/A" size="md" />
            <MetricValue value={1234} label="Processes" prefix="" size="md" loading />
          </Row>
          <Row>
            <TrendIndicator direction="up" value={12} label="vs last week" />
            <TrendIndicator direction="down" value={5} label="vs last month" />
            <TrendIndicator direction="neutral" layout="badge" />
            <TrendIndicator direction="up" value={8} layout="compact" />
          </Row>
        </Section>

        {/* CARDS */}
        <Section title="Cards">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Devices" value={42} icon={<Monitor className="h-5 w-5" />} trend={{ direction: 'up', value: 3 }} />
            <StatCard title="Active Alerts" value={7} icon={<AlertTriangle className="h-5 w-5" />} tone="warning" trend={{ direction: 'down', value: 2 }} />
            <StatCard title="Online Agents" value={38} icon={<Activity className="h-5 w-5" />} tone="success" />
            <StatCard title="System Health" value="98.5%" icon={<Shield className="h-5 w-5" />} tone="info" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
              title="CPU Usage"
              value={67}
              unit="%"
              trend={{ direction: 'up', value: 5 }}
              status="warning"
              progress={{ value: 67, showPercentage: true, label: 'CPU' }}
            />
            <MetricCard
              title="Memory"
              value={4.2}
              unit="GB"
              description="of 8 GB total"
              trend={{ direction: 'down', value: 2 }}
              status="success"
              progress={{ value: 52, showPercentage: true, label: 'RAM' }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HealthCard title="Device Health" score={85} maxScore={100} status="success" displayMode="ring" />
            <HealthCard title="Security Score" score={72} maxScore={100} status="warning" displayMode="bar" />
          </div>
          <DeviceCard
            name="web-server-01"
            subtitle="Production Web Server"
            deviceType="server"
            status="online"
            presence="online"
            health={{ label: 'Health', value: '92', tone: 'success' }}
            performance={{ label: 'Performance', value: '88', tone: 'success' }}
            risk={{ label: 'Risk', value: '15', tone: 'success' }}
            operatingSystem="Ubuntu 22.04"
            interactive
          />
        </Section>

        {/* DATA DISPLAY */}
        <Section title="Data Summary">
          <DataSummary
            items={[
              { label: 'Devices', value: '42', tone: 'info' },
              { label: 'Online', value: '38', tone: 'success' },
              { label: 'Alerts', value: '7', tone: 'warning' },
              { label: 'Uptime', value: '99.9%', tone: 'success' },
            ]}
            columns={4}
          />
        </Section>

        {/* FEEDBACK */}
        <Section title="Feedback Components">
          <Alert variant="info" title="Information" description="This is an informational alert." />
          <Alert variant="success" title="Success" description="Operation completed successfully." />
          <Alert variant="warning" title="Warning" description="Please review your configuration." />
          <Alert variant="danger" title="Error" description="Something went wrong. Please try again." />
          <EmptyState
            icon={<Monitor className="h-12 w-12" />}
            title="No devices found"
            description="Connect your first device to get started."
            primaryAction={{ label: 'Connect Device', onClick: () => {} }}
            secondaryAction={{ label: 'Learn More', onClick: () => {} }}
          />
          <ErrorState
            title="Failed to load data"
            description="An error occurred while fetching device data."
            retryAction={{ label: 'Retry', onClick: () => {} }}
          />
        </Section>

        {/* LOADING & SKELETON */}
        <Section title="Loading & Skeleton">
          <Row>
            <LoadingSpinner size="xs" />
            <LoadingSpinner size="sm" />
            <LoadingSpinner size="md" />
            <LoadingSpinner size="lg" />
            <LoadingSpinner size="xl" />
          </Row>
          <div className="max-w-md space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <SkeletonText lines={3} />
            <SkeletonTitle />
            <div className="flex gap-3">
              <SkeletonCircle size={40} />
              <SkeletonCircle size={32} />
              <SkeletonCircle size={24} />
            </div>
            <SkeletonButton />
            <SkeletonCard />
          </div>
        </Section>

        {/* PROGRESS */}
        <Section title="Progress">
          <div className="max-w-md space-y-4">
            <Progress value={75} label="Storage" showPercentage color="primary" />
            <Progress value={45} label="CPU" showPercentage color="success" />
            <Progress value={90} label="Memory" showPercentage color="danger" />
            <Progress value={60} label="Network" showPercentage color="info" />
            <Progress indeterminate label="Syncing..." color="primary" />
          </div>
          <Row>
            <ProgressRing value={85} size="sm" color="success" showPercentage />
            <ProgressRing value={60} size="md" color="primary" showPercentage />
            <ProgressRing value={30} size="lg" color="danger" showPercentage />
            <ProgressRing value={72} size="xl" color="warning" showPercentage label="Health" />
          </Row>
        </Section>

        {/* NAVIGATION */}
        <Section title="Navigation">
          <Breadcrumbs>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/settings">Settings</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>General</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumbs>
          <Pagination currentPage={3} totalPages={10} onPageChange={() => {}} />
          <Pagination currentPage={1} totalPages={5} onPageChange={() => {}} compact />
        </Section>

        {/* TABS */}
        <Section title="Tabs">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <p className="text-sm text-text-secondary p-4">Overview content goes here.</p>
            </TabsContent>
            <TabsContent value="details">
              <p className="text-sm text-text-secondary p-4">Details content goes here.</p>
            </TabsContent>
            <TabsContent value="settings">
              <p className="text-sm text-text-secondary p-4">Settings content goes here.</p>
            </TabsContent>
          </Tabs>
        </Section>

        {/* AVATARS & PRESENCE */}
        <Section title="Avatars & Presence">
          <Row>
            <Avatar size="xs"><AvatarFallback>AB</AvatarFallback></Avatar>
            <Avatar size="sm"><AvatarFallback>CD</AvatarFallback></Avatar>
            <Avatar size="md"><AvatarFallback>EF</AvatarFallback></Avatar>
            <Avatar size="lg"><AvatarFallback>GH</AvatarFallback></Avatar>
            <Avatar size="xl"><AvatarFallback>IJ</AvatarFallback></Avatar>
          </Row>
          <Row>
            <Avatar size="md" shape="circle"><AvatarFallback>JD</AvatarFallback></Avatar>
            <Avatar size="md" shape="rounded"><AvatarFallback>AB</AvatarFallback></Avatar>
          </Row>
          <Row>
            <PresenceIndicator status="online" size="sm" showPulse />
            <PresenceIndicator status="offline" size="sm" />
            <PresenceIndicator status="away" size="sm" />
            <PresenceIndicator status="busy" size="sm" />
            <PresenceIndicator status="online" size="md" showPulse />
            <PresenceIndicator status="online" size="lg" showPulse />
          </Row>
        </Section>

        {/* TOOLTIPS */}
        <Section title="Tooltips">
          <Row>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>This is a tooltip</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm">Info</Button>
              </TooltipTrigger>
              <TooltipContent side="top">Top tooltip</TooltipContent>
            </Tooltip>
          </Row>
        </Section>

        {/* DROPDOWN MENU */}
        <Section title="Dropdown Menu">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem><Edit3 className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
              <DropdownMenuItem><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        {/* DIALOG */}
        <Section title="Dialog">
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>Open Dialog</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Action</DialogTitle>
                <DialogDescription>Are you sure you want to proceed? This action cannot be undone.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild><Button variant="secondary" size="sm">Cancel</Button></DialogClose>
                <Button size="sm">Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>

        {/* MODAL */}
        <Section title="Modal">
          <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>Open Modal</Button>
          <Modal open={modalOpen} onOpenChange={setModalOpen}>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>Modal Title</ModalTitle>
                <ModalDescription>This is a modal dialog with more space for content.</ModalDescription>
              </ModalHeader>
              <div className="p-4">
                <p className="text-sm text-text-secondary">Modal body content goes here.</p>
              </div>
              <ModalFooter>
                <ModalClose asChild><Button variant="secondary" size="sm">Cancel</Button></ModalClose>
                <Button size="sm">Save Changes</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </Section>

        {/* DRAWER */}
        <Section title="Drawer">
          <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>Open Drawer</Button>
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerContent side="right" size="md">
              <DrawerHeader>
                <DrawerTitle>Settings Panel</DrawerTitle>
                <DrawerDescription>Configure your preferences here.</DrawerDescription>
              </DrawerHeader>
              <div className="p-4 flex-1">
                <p className="text-sm text-text-secondary">Drawer body content goes here.</p>
              </div>
              <DrawerFooter>
                <DrawerClose asChild><Button variant="secondary" size="sm">Close</Button></DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </Section>

        {/* TABLE */}
        <Section title="Table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>web-server-01</TableCell>
                <TableCell><StatusBadge status="online" size="sm" dot /></TableCell>
                <TableCell>98%</TableCell>
                <TableCell>2 min ago</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>db-server-01</TableCell>
                <TableCell><StatusBadge status="online" size="sm" dot /></TableCell>
                <TableCell>95%</TableCell>
                <TableCell>5 min ago</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>backup-server-01</TableCell>
                <TableCell><StatusBadge status="offline" size="sm" dot /></TableCell>
                <TableCell>-</TableCell>
                <TableCell>2 hours ago</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Section>

        {/* AI COMPONENTS */}
        <Section title="AI Components">
          <div className="max-w-2xl space-y-4">
            <AIMessage role="user" content="How do I fix the high CPU usage on my server?" variant="bubble" />
            <AIMessage
              role="assistant"
              content="To troubleshoot high CPU usage, first identify the top processes using `top` or `htop`. Check if any specific service is consuming excessive resources."
              variant="bubble"
              timestamp="2 min ago"
              modelLabel="GPT-4"
            />
            <AIMessage role="system" content="System message: Monitoring active" variant="minimal" />
            <AIMessage role="error" content="Failed to fetch data from server" variant="panel" />
          </div>
          <div className="max-w-md space-y-4">
            <AIThinking status="thinking" label="Analyzing your request..." layout="dots" />
            <AIThinking status="searching" label="Searching knowledge base..." layout="spinner" />
            <AIThinking status="analyzing" label="Processing results..." layout="steps" steps={['Fetching data', 'Analyzing patterns', 'Generating response']} currentStep={1} />
            <AIThinking status="generating" label="Generating response..." layout="pulse" />
          </div>
          <div className="max-w-md space-y-2">
            <Citation index={1} title="CPU Monitoring Guide" source="Knowledge Base" excerpt="How to monitor CPU usage on Linux servers" variant="inline" />
            <Citation index={2} title="Performance Tuning" source="Documentation" excerpt="Best practices for optimizing server performance" variant="card" />
          </div>
          <div className="max-w-md space-y-2">
            <PromptCard title="Check CPU Usage" description="Analyze current CPU utilization" icon={<Activity className="h-4 w-4" />} category="Diagnostics" />
            <PromptCard title="Run Security Scan" description="Perform a comprehensive security audit" icon={<Shield className="h-4 w-4" />} category="Security" variant="glass" />
            <PromptCard title="Generate Report" description="Create a device health report" icon={<FileText className="h-4 w-4" />} category="Reports" variant="outline" disabled />
          </div>
        </Section>

        {/* GLASS PANEL */}
        <Section title="Glass Panel">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassPanel intensity="light" className="p-4">
              <p className="text-sm text-text-secondary">Light glass panel</p>
            </GlassPanel>
            <GlassPanel intensity="medium" className="p-4">
              <p className="text-sm text-text-secondary">Medium glass panel</p>
            </GlassPanel>
            <GlassPanel intensity="heavy" className="p-4">
              <p className="text-sm text-text-secondary">Heavy glass panel</p>
            </GlassPanel>
          </div>
        </Section>

        {/* RESPONSIVE & FOCUS EXAMPLES */}
        <Section title="Responsive Examples">
          <p className="text-xs text-text-muted">Components adapt to different screen sizes. Resize the browser to test responsiveness.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCard key={i} title={`Card ${i + 1}`} value={i * 25 + 10} icon={<Monitor className="h-5 w-5" />} compact />
            ))}
          </div>
        </Section>

        <Section title="Disabled Examples">
          <Row>
            <Button disabled>Disabled Button</Button>
            <Input placeholder="Disabled input" disabled />
            <Switch disabled />
            <Checkbox disabled label="Disabled" />
            <Badge variant="secondary">Disabled</Badge>
          </Row>
        </Section>

        <Section title="Loading Examples">
          <Row>
            <Button loading>Loading</Button>
            <MetricValue value={null} label="Loading" loading size="md" />
            <StatCard title="Loading Card" value={null} loading />
            <MetricCard title="Loading Metric" value={null} loading />
          </Row>
        </Section>

        <Section title="Empty Examples">
          <EmptyState
            icon={<Monitor className="h-12 w-12" />}
            title="No devices"
            description="Connect your first device to get started."
            primaryAction={{ label: 'Add Device', onClick: () => {} }}
          />
        </Section>

        <Section title="Error Examples">
          <ErrorState
            title="Connection failed"
            description="Unable to connect to the server."
            retryAction={{ label: 'Retry', onClick: () => {} }}
            details="Error: ECONNREFUSED 127.0.0.1:3001"
          />
        </Section>

        <div className="pb-12">
          <p className="text-xs text-text-disabled text-center">Design System Preview - Internal Use Only</p>
        </div>
      </div>
    </TooltipProvider>
  );
}
