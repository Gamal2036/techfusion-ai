import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Button,
  IconButton,
  Input,
  SearchInput,
  PasswordInput,
  Textarea,
  Label,
  Select,
  Switch,
  Checkbox,
  FormField,
  FieldMessage,
  buttonVariants,
  iconButtonVariants,
  cn,
} from '@techfusion/ui';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Button', () => {
  test('renders with default variant (primary)', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe('BUTTON');
  });

  test('renders all required variants', () => {
    const variants = [
      'primary',
      'secondary',
      'outline',
      'ghost',
      'danger',
      'success',
      'glass',
      'link',
    ] as const;
    variants.forEach((variant) => {
      const className = buttonVariants({ variant });
      expect(className).toBeTruthy();
      expect(typeof className).toBe('string');
    });
  });

  test('backward-compatible default variant matches primary', () => {
    const defaultCls = buttonVariants({ variant: 'default' });
    const primaryCls = buttonVariants({ variant: 'primary' });
    expect(defaultCls).toBe(primaryCls);
  });

  test('backward-compatible destructive variant matches danger', () => {
    const destructiveCls = buttonVariants({ variant: 'destructive' });
    const dangerCls = buttonVariants({ variant: 'danger' });
    expect(destructiveCls).toBe(dangerCls);
  });

  test('renders all required sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'icon'] as const;
    sizes.forEach((size) => {
      const className = buttonVariants({ size });
      expect(className).toBeTruthy();
    });
  });

  test('loading state shows spinner and prevents click', () => {
    const onClick = jest.fn();
    render(<Button loading onClick={onClick}>Submit</Button>);
    const btn = screen.getByRole('button', { name: /submit/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('loading text replaces children when loading', () => {
    render(<Button loading loadingText="Saving...">Submit</Button>);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  test('disabled state prevents click', () => {
    const onClick = jest.fn();
    render(<Button disabled onClick={onClick}>Click</Button>);
    const btn = screen.getByRole('button', { name: /click/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('renders leftIcon and rightIcon', () => {
    render(
      <Button leftIcon={<span data-testid="left">L</span>} rightIcon={<span data-testid="right">R</span>}>
        Content
      </Button>,
    );
    expect(screen.getByTestId('left')).toBeInTheDocument();
    expect(screen.getByTestId('right')).toBeInTheDocument();
  });

  test('hides icons during loading', () => {
    render(
      <Button loading leftIcon={<span data-testid="left">L</span>} rightIcon={<span data-testid="right">R</span>}>
        Content
      </Button>,
    );
    expect(screen.queryByTestId('left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right')).not.toBeInTheDocument();
  });

  test('fullWidth renders full width', () => {
    render(<Button fullWidth>Full</Button>);
    const btn = screen.getByRole('button', { name: /full/i });
    expect(btn.className).toContain('w-full');
  });

  test('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  test('supports custom className', () => {
    render(<Button className="custom-class">Test</Button>);
    const btn = screen.getByRole('button', { name: /test/i });
    expect(btn.className).toContain('custom-class');
  });

  test('renders as button element', () => {
    render(<Button>Type</Button>);
    const btn = screen.getByRole('button', { name: /type/i });
    expect(btn.tagName).toBe('BUTTON');
  });
});

describe('IconButton', () => {
  const icon = <span data-testid="icon">I</span>;

  test('requires label for accessibility', () => {
    render(<IconButton icon={icon} label="Delete" />);
    const btn = screen.getByRole('button', { name: /delete/i });
    expect(btn).toHaveAttribute('aria-label', 'Delete');
  });

  test('renders icon', () => {
    render(<IconButton icon={icon} label="Test" />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  test('disabled prevents click', () => {
    const onClick = jest.fn();
    render(<IconButton icon={icon} label="Test" disabled onClick={onClick} />);
    const btn = screen.getByRole('button', { name: /test/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('loading shows spinner and prevents click', () => {
    const onClick = jest.fn();
    render(<IconButton icon={icon} label="Test" loading onClick={onClick} />);
    const btn = screen.getByRole('button', { name: /test/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  test('all size variants render', () => {
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;
    sizes.forEach((size) => {
      const className = iconButtonVariants({ size });
      expect(className).toBeTruthy();
    });
  });

  test('all variant types render', () => {
    const variants = ['ghost', 'outline', 'secondary', 'danger', 'glass'] as const;
    variants.forEach((variant) => {
      const className = iconButtonVariants({ variant });
      expect(className).toBeTruthy();
    });
  });

  test('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<IconButton ref={ref} icon={icon} label="Test" />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe('Input', () => {
  test('renders basic input without wrapper', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  test('renders label and associates with input', () => {
    render(<Input label="Email" />);
    const label = screen.getByText('Email');
    expect(label).toHaveAttribute('for');
    const input = screen.getByRole('textbox');
    expect(input.id).toBe(label.getAttribute('for'));
  });

  test('shows required indicator', () => {
    render(<Input label="Name" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  test('shows error message with role="alert"', () => {
    render(<Input label="Email" error="Invalid email" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Invalid email');
  });

  test('sets aria-invalid when error present', () => {
    render(<Input error="Required" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  test('associates error with input via aria-describedby', () => {
    render(<Input error="Required" />);
    const input = screen.getByRole('textbox');
    const desc = input.getAttribute('aria-describedby');
    expect(desc).toBeTruthy();
    expect(document.getElementById(desc!)).toHaveTextContent('Required');
  });

  test('associates description with input', () => {
    render(<Input description="Enter your email" />);
    const input = screen.getByRole('textbox');
    const desc = input.getAttribute('aria-describedby');
    expect(desc).toBeTruthy();
    expect(document.getElementById(desc!)).toHaveTextContent('Enter your email');
  });

  test('shows success message', () => {
    render(<Input success="Looks good!" />);
    expect(screen.getByText('Looks good!')).toBeInTheDocument();
  });

  test('renders leading icon', () => {
    render(<Input leftIcon={<span data-testid="icon">I</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  test('renders trailing element', () => {
    render(<Input rightElement={<span data-testid="trail">T</span>} />);
    expect(screen.getByTestId('trail')).toBeInTheDocument();
  });

  test('size variants render', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    sizes.forEach((inputSize) => {
      const { unmount } = render(<Input inputSize={inputSize} />);
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      unmount();
    });
  });

  test('disabled state', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  test('readOnly state', () => {
    render(<Input readOnly value="read only" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
  });

  test('forwards ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});

describe('SearchInput', () => {
  test('renders search input', () => {
    render(<SearchInput placeholder="Search..." />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  test('clear button appears when value exists', () => {
    render(<SearchInput value="query" onClear={jest.fn()} />);
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });

  test('clear button hidden when empty value', () => {
    render(<SearchInput value="" onClear={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });

  test('onClear called when clear button clicked', () => {
    const onClear = jest.fn();
    render(<SearchInput value="test" onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('Escape key calls onClear when clearOnEscape enabled', () => {
    const onClear = jest.fn();
    render(<SearchInput value="test" onClear={onClear} clearOnEscape />);
    const input = screen.getByRole('searchbox');
    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('Escape does not call onClear when clearOnEscape disabled', () => {
    const onClear = jest.fn();
    render(<SearchInput value="test" onClear={onClear} clearOnEscape={false} />);
    const input = screen.getByRole('searchbox');
    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });
    expect(onClear).not.toHaveBeenCalled();
  });

  test('loading shows spinner on clear button', () => {
    render(<SearchInput value="test" onClear={jest.fn()} loading />);
    const btn = screen.getByRole('button', { name: /clear search/i });
    expect(btn.querySelector('svg')).toBeInTheDocument();
  });
});

describe('PasswordInput', () => {
  test('renders as password type by default', () => {
    render(<PasswordInput />);
    const input = document.querySelector('input');
    expect(input).toHaveAttribute('type', 'password');
  });

  test('toggle shows password', () => {
    render(<PasswordInput />);
    const toggle = screen.getByRole('button', { name: /toggle password visibility/i });
    fireEvent.click(toggle);
    const input = document.querySelector('input');
    expect(input).toHaveAttribute('type', 'text');
  });

  test('toggle hides password again', () => {
    render(<PasswordInput />);
    const toggle = screen.getByRole('button', { name: /toggle password visibility/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    const input = document.querySelector('input');
    expect(input).toHaveAttribute('type', 'password');
  });

  test('toggle has accessible label', () => {
    render(<PasswordInput />);
    const toggle = screen.getByRole('button', { name: /toggle password visibility/i });
    expect(toggle).toHaveAttribute('aria-label', 'Toggle password visibility');
  });

  test('supports custom toggle label', () => {
    render(<PasswordInput toggleLabel="Show password" />);
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
  });

  test('supports autoComplete', () => {
    render(<PasswordInput autoComplete="new-password" />);
    const input = document.querySelector('input');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
  });

  test('can hide toggle', () => {
    render(<PasswordInput showToggle={false} />);
    expect(screen.queryByRole('button', { name: /toggle password visibility/i })).not.toBeInTheDocument();
  });

  test('supports label and error', () => {
    render(<PasswordInput label="Password" error="Too short" />);
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Too short');
  });
});

describe('Textarea', () => {
  test('renders textarea', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  test('renders label and associates', () => {
    render(<Textarea label="Message" />);
    const label = screen.getByText('Message');
    const textarea = screen.getByRole('textbox');
    expect(textarea.id).toBe(label.getAttribute('for'));
  });

  test('shows error with role="alert"', () => {
    render(<Textarea error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  test('sets aria-invalid on error', () => {
    render(<Textarea error="Required" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  test('shows character count when enabled', () => {
    render(<Textarea showCharCount value="hello" />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  test('shows character count with maxLength', () => {
    render(<Textarea showCharCount maxLength={100} value="hello" />);
    expect(screen.getByText('5/100')).toBeInTheDocument();
  });

  test('resize variants render', () => {
    const resizeOptions = ['none', 'vertical', 'horizontal', 'both'] as const;
    resizeOptions.forEach((resize) => {
      const { unmount } = render(<Textarea resize={resize} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      unmount();
    });
  });

  test('size variants render', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    sizes.forEach((textareaSize) => {
      const { unmount } = render(<Textarea textareaSize={textareaSize} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      unmount();
    });
  });

  test('disabled state', () => {
    render(<Textarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  test('shows description', () => {
    render(<Textarea description="Max 500 chars" />);
    expect(screen.getByText('Max 500 chars')).toBeInTheDocument();
  });

  test('forwards ref', () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});

describe('Label', () => {
  test('renders as label element', () => {
    render(<Label>Name</Label>);
    const label = screen.getByText('Name');
    expect(label.tagName).toBe('LABEL');
  });

  test('shows required indicator', () => {
    render(<Label required>Email</Label>);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  test('supports htmlFor', () => {
    render(<Label htmlFor="my-input">Name</Label>);
    expect(screen.getByText('Name')).toHaveAttribute('for', 'my-input');
  });

  test('disabled visual state', () => {
    render(<Label disabled>Disabled</Label>);
    expect(screen.getByText('Disabled').className).toContain('opacity-50');
  });
});

describe('Switch', () => {
  test('renders as switch button', () => {
    render(<Switch />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('data-state', 'unchecked');
  });

  test('toggles on click', async () => {
    const user = userEvent.setup();
    render(<Switch />);
    const toggle = screen.getByRole('switch');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('data-state', 'checked');
  });

  test('label associates with switch', () => {
    render(<Switch label="Dark mode" />);
    const label = screen.getByText('Dark mode');
    const toggle = screen.getByRole('switch');
    expect(label).toHaveAttribute('for', toggle.id);
  });

  test('shows description', () => {
    render(<Switch description="Toggle dark mode" />);
    expect(screen.getByText('Toggle dark mode')).toBeInTheDocument();
  });

  test('shows error', () => {
    render(<Switch error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  test('keyboard interaction', async () => {
    const user = userEvent.setup();
    render(<Switch />);
    const toggle = screen.getByRole('switch');
    toggle.focus();
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('data-state', 'checked');
  });

  test('disabled state', () => {
    render(<Switch disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  test('defaultChecked works', () => {
    render(<Switch defaultChecked />);
    expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked');
  });
});

describe('Checkbox', () => {
  test('renders as checkbox', () => {
    render(<Checkbox />);
    const cb = screen.getByRole('checkbox');
    expect(cb).toBeInTheDocument();
    expect(cb).toHaveAttribute('data-state', 'unchecked');
  });

  test('toggles on click', async () => {
    const user = userEvent.setup();
    render(<Checkbox />);
    const cb = screen.getByRole('checkbox');
    await user.click(cb);
    expect(cb).toHaveAttribute('data-state', 'checked');
  });

  test('label associates with checkbox', () => {
    render(<Checkbox label="Accept terms" />);
    const label = screen.getByText('Accept terms');
    const cb = screen.getByRole('checkbox');
    expect(label).toHaveAttribute('for', cb.id);
  });

  test('shows description', () => {
    render(<Checkbox description="You must accept" />);
    expect(screen.getByText('You must accept')).toBeInTheDocument();
  });

  test('shows error', () => {
    render(<Checkbox error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  test('disabled state', () => {
    render(<Checkbox disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  test('keyboard interaction', async () => {
    const user = userEvent.setup();
    render(<Checkbox />);
    const cb = screen.getByRole('checkbox');
    cb.focus();
    await user.keyboard(' ');
    expect(cb).toHaveAttribute('data-state', 'checked');
  });

  test('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Checkbox ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe('Select', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ];

  test('renders trigger button', () => {
    render(<Select options={options} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  test('shows placeholder', () => {
    render(<Select options={options} placeholder="Pick one" />);
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  test('shows label', () => {
    render(<Select options={options} label="Choose" />);
    expect(screen.getByText('Choose')).toBeInTheDocument();
  });

  test('shows error', () => {
    render(<Select options={options} error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  test('shows description', () => {
    render(<Select options={options} description="Pick an option" />);
    expect(screen.getByText('Pick an option')).toBeInTheDocument();
  });

  test('required indicator shown', () => {
    render(<Select options={options} label="Pick" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  test('disabled state', () => {
    render(<Select options={options} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  test('option groups render without error', () => {
    const groupedOptions = [
      {
        label: 'Group 1',
        options: [{ value: 'a', label: 'Option A' }],
      },
    ];
    const { container } = render(<Select options={groupedOptions} />);
    expect(container.querySelector('[role="combobox"]')).toBeInTheDocument();
  });
});

describe('FormField', () => {
  test('renders label', () => {
    render(
      <FormField label="Name">
        <input />
      </FormField>,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  test('shows required indicator', () => {
    render(
      <FormField label="Email" required>
        <input />
      </FormField>,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  test('shows description', () => {
    render(
      <FormField description="Enter your name">
        <input />
      </FormField>,
    );
    expect(screen.getByText('Enter your name')).toBeInTheDocument();
  });

  test('shows error with role="alert"', () => {
    render(
      <FormField error="Required field">
        <input />
      </FormField>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Required field');
  });

  test('shows success', () => {
    render(
      <FormField success="Looks good!">
        <input />
      </FormField>,
    );
    expect(screen.getByText('Looks good!')).toBeInTheDocument();
  });

  test('hides description when error is present', () => {
    render(
      <FormField description="Help text" error="Error">
        <input />
      </FormField>,
    );
    expect(screen.queryByText('Help text')).not.toBeInTheDocument();
  });
});

describe('FieldMessage', () => {
  test('renders description variant', () => {
    render(<FieldMessage variant="description">Help text</FieldMessage>);
    expect(screen.getByText('Help text')).toBeInTheDocument();
  });

  test('renders error variant with role="alert"', () => {
    render(<FieldMessage variant="error">Error text</FieldMessage>);
    expect(screen.getByRole('alert')).toHaveTextContent('Error text');
  });

  test('renders success variant', () => {
    render(<FieldMessage variant="success">Success</FieldMessage>);
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  test('renders warning variant', () => {
    render(<FieldMessage variant="warning">Warning</FieldMessage>);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  test('renders icon', () => {
    render(
      <FieldMessage icon={<span data-testid="icon">!</span>} variant="error">
        Error
      </FieldMessage>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  test('returns null when no children', () => {
    const { container } = render(<FieldMessage />);
    expect(container.firstChild).toBeNull();
  });
});

describe('Theme Token Compliance', () => {
  test('button variants use semantic tokens', () => {
    const btnClasses = buttonVariants({ variant: 'outline' });
    expect(btnClasses).toContain('border-border');
    expect(btnClasses).not.toMatch(/border-white/);
  });

  test('button ghost uses semantic tokens', () => {
    const cls = buttonVariants({ variant: 'ghost' });
    expect(cls).toContain('text-text-secondary');
  });

  test('button glass uses semantic tokens', () => {
    const cls = buttonVariants({ variant: 'glass' });
    expect(cls).toContain('bg-surface-subtle');
    expect(cls).toContain('backdrop-blur-xl');
  });

  test('icon button ghost uses semantic tokens', () => {
    const cls = iconButtonVariants({ variant: 'ghost' });
    expect(cls).toContain('text-text-secondary');
  });
});

describe('Public Exports', () => {
  test('all components are exported', () => {
    expect(Button).toBeDefined();
    expect(IconButton).toBeDefined();
    expect(Input).toBeDefined();
    expect(SearchInput).toBeDefined();
    expect(PasswordInput).toBeDefined();
    expect(Textarea).toBeDefined();
    expect(Label).toBeDefined();
    expect(Select).toBeDefined();
    expect(Switch).toBeDefined();
    expect(Checkbox).toBeDefined();
    expect(FormField).toBeDefined();
    expect(FieldMessage).toBeDefined();
  });

  test('variant objects are exported', () => {
    expect(buttonVariants).toBeDefined();
    expect(typeof buttonVariants).toBe('function');
    expect(iconButtonVariants).toBeDefined();
    expect(typeof iconButtonVariants).toBe('function');
  });

  test('cn utility is exported', () => {
    expect(cn).toBeDefined();
    expect(typeof cn).toBe('function');
  });
});
