import '@testing-library/jest-dom';
import {
  Alert,
  LoadingSpinner,
  Skeleton,
  SkeletonText,
  SkeletonTitle,
  SkeletonCircle,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonTableRow,
  EmptyState,
  ErrorState,
  StatusMessage,
  Progress,
  ProgressRing,
  Toaster,
  toast,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Breadcrumbs,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  Pagination,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverClose,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
  ModalClose,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  PresenceIndicator,
  TrendIndicator,
  StatusBadge,
  MetricValue,
  StatCard,
  MetricCard,
  HealthCard,
  DeviceCard,
  DataSummary,
  AIMessage,
  AIThinking,
  Citation,
  PromptCard,
} from '../index';

describe('exports', () => {
  it('exports Alert', () => {
    expect(Alert).toBeDefined();
  });

  it('exports LoadingSpinner', () => {
    expect(LoadingSpinner).toBeDefined();
  });

  it('exports Skeleton components', () => {
    expect(Skeleton).toBeDefined();
    expect(SkeletonText).toBeDefined();
    expect(SkeletonTitle).toBeDefined();
    expect(SkeletonCircle).toBeDefined();
    expect(SkeletonAvatar).toBeDefined();
    expect(SkeletonButton).toBeDefined();
    expect(SkeletonCard).toBeDefined();
    expect(SkeletonTableRow).toBeDefined();
  });

  it('exports EmptyState', () => {
    expect(EmptyState).toBeDefined();
  });

  it('exports ErrorState', () => {
    expect(ErrorState).toBeDefined();
  });

  it('exports StatusMessage', () => {
    expect(StatusMessage).toBeDefined();
  });

  it('exports Progress', () => {
    expect(Progress).toBeDefined();
  });

  it('exports ProgressRing', () => {
    expect(ProgressRing).toBeDefined();
  });

  it('exports Toaster', () => {
    expect(Toaster).toBeDefined();
  });

  it('exports toast', () => {
    expect(toast).toBeDefined();
    expect(typeof toast.success).toBe('function');
    expect(typeof toast.error).toBe('function');
    expect(typeof toast.warning).toBe('function');
    expect(typeof toast.info).toBe('function');
    expect(typeof toast.loading).toBe('function');
    expect(typeof toast.promise).toBe('function');
    expect(typeof toast.dismiss).toBe('function');
  });

  it('exports Tabs', () => {
    expect(Tabs).toBeDefined();
    expect(TabsList).toBeDefined();
    expect(TabsTrigger).toBeDefined();
    expect(TabsContent).toBeDefined();
  });

  it('exports Breadcrumbs', () => {
    expect(Breadcrumbs).toBeDefined();
    expect(BreadcrumbList).toBeDefined();
    expect(BreadcrumbItem).toBeDefined();
    expect(BreadcrumbLink).toBeDefined();
    expect(BreadcrumbPage).toBeDefined();
    expect(BreadcrumbSeparator).toBeDefined();
    expect(BreadcrumbEllipsis).toBeDefined();
  });

  it('exports Pagination', () => {
    expect(Pagination).toBeDefined();
  });

  it('exports Tooltip', () => {
    expect(TooltipProvider).toBeDefined();
    expect(Tooltip).toBeDefined();
    expect(TooltipTrigger).toBeDefined();
    expect(TooltipContent).toBeDefined();
  });

  it('exports Popover', () => {
    expect(Popover).toBeDefined();
    expect(PopoverTrigger).toBeDefined();
    expect(PopoverContent).toBeDefined();
    expect(PopoverAnchor).toBeDefined();
    expect(PopoverClose).toBeDefined();
  });

  it('exports DropdownMenu', () => {
    expect(DropdownMenu).toBeDefined();
    expect(DropdownMenuTrigger).toBeDefined();
    expect(DropdownMenuContent).toBeDefined();
    expect(DropdownMenuItem).toBeDefined();
  });

  it('exports ContextMenu', () => {
    expect(ContextMenu).toBeDefined();
    expect(ContextMenuTrigger).toBeDefined();
    expect(ContextMenuContent).toBeDefined();
    expect(ContextMenuItem).toBeDefined();
  });

  it('exports Modal', () => {
    expect(Modal).toBeDefined();
    expect(ModalContent).toBeDefined();
    expect(ModalHeader).toBeDefined();
    expect(ModalFooter).toBeDefined();
    expect(ModalTitle).toBeDefined();
    expect(ModalDescription).toBeDefined();
    expect(ModalClose).toBeDefined();
  });

  it('exports Drawer', () => {
    expect(Drawer).toBeDefined();
    expect(DrawerContent).toBeDefined();
    expect(DrawerHeader).toBeDefined();
    expect(DrawerFooter).toBeDefined();
    expect(DrawerTitle).toBeDefined();
    expect(DrawerDescription).toBeDefined();
    expect(DrawerClose).toBeDefined();
  });

  it('exports Avatar', () => {
    expect(Avatar).toBeDefined();
    expect(AvatarImage).toBeDefined();
    expect(AvatarFallback).toBeDefined();
  });

  it('exports AvatarGroup', () => {
    expect(AvatarGroup).toBeDefined();
  });

  it('exports PresenceIndicator', () => {
    expect(PresenceIndicator).toBeDefined();
  });

  it('exports TrendIndicator', () => {
    expect(TrendIndicator).toBeDefined();
  });

  it('exports StatusBadge', () => {
    expect(StatusBadge).toBeDefined();
  });

  it('exports MetricValue', () => {
    expect(MetricValue).toBeDefined();
  });

  it('exports StatCard', () => {
    expect(StatCard).toBeDefined();
  });

  it('exports MetricCard', () => {
    expect(MetricCard).toBeDefined();
  });

  it('exports HealthCard', () => {
    expect(HealthCard).toBeDefined();
  });

  it('exports DeviceCard', () => {
    expect(DeviceCard).toBeDefined();
  });

  it('exports DataSummary', () => {
    expect(DataSummary).toBeDefined();
  });

  it('exports AIMessage', () => {
    expect(AIMessage).toBeDefined();
  });

  it('exports AIThinking', () => {
    expect(AIThinking).toBeDefined();
  });

  it('exports Citation', () => {
    expect(Citation).toBeDefined();
  });

  it('exports PromptCard', () => {
    expect(PromptCard).toBeDefined();
  });
});
