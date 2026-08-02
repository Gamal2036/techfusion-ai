import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '../components/Drawer';

function DrawerTest({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger>Open drawer</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Drawer Title</DrawerTitle>
          <DrawerDescription>Drawer description</DrawerDescription>
        </DrawerHeader>
        <div className="p-6">Drawer body</div>
        <DrawerFooter>
          <DrawerClose>Close</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function DrawerLeft() {
  return (
    <Drawer open={true}>
      <DrawerTrigger>Open</DrawerTrigger>
      <DrawerContent side="left">
        <DrawerTitle>Left Drawer</DrawerTitle>
      </DrawerContent>
    </Drawer>
  );
}

function DrawerTop() {
  return (
    <Drawer open={true}>
      <DrawerTrigger>Open</DrawerTrigger>
      <DrawerContent side="top">
        <DrawerTitle>Top Drawer</DrawerTitle>
      </DrawerContent>
    </Drawer>
  );
}

function DrawerBottom() {
  return (
    <Drawer open={true}>
      <DrawerTrigger>Open</DrawerTrigger>
      <DrawerContent side="bottom">
        <DrawerTitle>Bottom Drawer</DrawerTitle>
      </DrawerContent>
    </Drawer>
  );
}

describe('Drawer', () => {
  it('renders trigger', () => {
    render(<DrawerTest />);
    expect(screen.getByText('Open drawer')).toBeInTheDocument();
  });

  it('shows title when open', () => {
    render(<DrawerTest open={true} />);
    expect(screen.getByText('Drawer Title')).toBeInTheDocument();
  });

  it('shows description when open', () => {
    render(<DrawerTest open={true} />);
    expect(screen.getByText('Drawer description')).toBeInTheDocument();
  });

  it('renders body', () => {
    render(<DrawerTest open={true} />);
    expect(screen.getByText('Drawer body')).toBeInTheDocument();
  });

  it('hides when closed', () => {
    render(<DrawerTest open={false} />);
    expect(screen.queryByText('Drawer Title')).not.toBeInTheDocument();
  });

  it('supports left side', () => {
    render(<DrawerLeft />);
    expect(screen.getByText('Left Drawer')).toBeInTheDocument();
  });

  it('supports top side', () => {
    render(<DrawerTop />);
    expect(screen.getByText('Top Drawer')).toBeInTheDocument();
  });

  it('supports bottom side', () => {
    render(<DrawerBottom />);
    expect(screen.getByText('Bottom Drawer')).toBeInTheDocument();
  });
});
