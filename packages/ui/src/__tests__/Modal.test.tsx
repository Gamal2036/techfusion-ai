import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Modal,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
  ModalClose,
} from '../components/Modal';

function ModalTest({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalTrigger>Open modal</ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Modal Title</ModalTitle>
          <ModalDescription>Modal description text</ModalDescription>
        </ModalHeader>
        <div>Modal body</div>
        <ModalFooter>
          <ModalClose>Cancel</ModalClose>
          <ModalClose>Save</ModalClose>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function ModalSizes() {
  return (
    <Modal open={true}>
      <ModalTrigger>Open</ModalTrigger>
      <ModalContent size="lg">
        <ModalTitle>Large Modal</ModalTitle>
      </ModalContent>
    </Modal>
  );
}

describe('Modal', () => {
  it('renders trigger', () => {
    render(<ModalTest />);
    expect(screen.getByText('Open modal')).toBeInTheDocument();
  });

  it('shows title when open', () => {
    render(<ModalTest open={true} />);
    expect(screen.getByText('Modal Title')).toBeInTheDocument();
  });

  it('shows description when open', () => {
    render(<ModalTest open={true} />);
    expect(screen.getByText('Modal description text')).toBeInTheDocument();
  });

  it('renders body content', () => {
    render(<ModalTest open={true} />);
    expect(screen.getByText('Modal body')).toBeInTheDocument();
  });

  it('renders footer with buttons', () => {
    render(<ModalTest open={true} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('has close button', () => {
    render(<ModalTest open={true} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('hides when closed', () => {
    render(<ModalTest open={false} />);
    expect(screen.queryByText('Modal Title')).not.toBeInTheDocument();
  });

  it('renders size variant', () => {
    render(<ModalSizes />);
    expect(screen.getByText('Large Modal')).toBeInTheDocument();
  });

  it('calls onOpenChange', () => {
    const onOpenChange = jest.fn();
    render(<ModalTest open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
