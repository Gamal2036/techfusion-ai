import * as fs from 'fs';
import * as path from 'path';

const globalsPath = path.resolve(__dirname, '../app/globals.css');
const tailwindPath = path.resolve(__dirname, '../../tailwind.config.js');

function readGlobals(): string {
  return fs.readFileSync(globalsPath, 'utf-8');
}

function readTailwind(): string {
  return fs.readFileSync(tailwindPath, 'utf-8');
}

describe('Theme Token Foundation', () => {
  let globals: string;
  let tailwind: string;

  beforeAll(() => {
    globals = readGlobals();
    tailwind = readTailwind();
  });

  describe('1. Dark theme semantic tokens exist', () => {
    const darkTokens = [
      '--background',
      '--foreground',
      '--surface',
      '--surface-subtle',
      '--surface-muted',
      '--surface-elevated',
      '--surface-overlay',
      '--text-primary',
      '--text-secondary',
      '--text-muted',
      '--border',
      '--border-subtle',
      '--border-strong',
      '--popover',
      '--popover-foreground',
      '--dialog',
      '--dialog-foreground',
      '--input-background',
      '--input-border',
      '--input-placeholder',
      '--primary',
      '--secondary',
      '--ring',
      '--ring-offset',
      '--success',
      '--warning',
      '--danger',
      '--info',
      '--muted',
      '--muted-foreground',
      '--accent',
      '--destructive',
    ];

    darkTokens.forEach((token) => {
      test(`dark theme defines ${token}`, () => {
        const darkSection = globals.match(/\.dark\s*\{([^}]+)\}/);
        expect(darkSection).not.toBeNull();
        expect(darkSection![1]).toContain(`${token}:`);
      });
    });
  });

  describe('2. Light theme semantic tokens exist', () => {
    const lightTokens = [
      '--background',
      '--foreground',
      '--surface',
      '--surface-subtle',
      '--surface-muted',
      '--surface-elevated',
      '--surface-overlay',
      '--text-primary',
      '--text-secondary',
      '--text-muted',
      '--border',
      '--border-subtle',
      '--border-strong',
      '--popover',
      '--popover-foreground',
      '--dialog',
      '--dialog-foreground',
      '--input-background',
      '--input-border',
      '--input-placeholder',
      '--primary',
      '--secondary',
      '--ring',
      '--ring-offset',
      '--success',
      '--warning',
      '--danger',
      '--info',
      '--muted',
      '--muted-foreground',
      '--accent',
      '--destructive',
      '--radius',
    ];

    lightTokens.forEach((token) => {
      test(`light theme defines ${token}`, () => {
        const rootSection = globals.match(/:root\s*\{([^}]+)\}/);
        expect(rootSection).not.toBeNull();
        expect(rootSection![1]).toContain(`${token}:`);
      });
    });
  });

  describe('3. Required token names are not missing', () => {
    test('background and foreground tokens exist', () => {
      expect(globals).toContain('--background:');
      expect(globals).toContain('--foreground:');
    });

    test('surface hierarchy tokens exist', () => {
      expect(globals).toContain('--surface:');
      expect(globals).toContain('--surface-subtle:');
      expect(globals).toContain('--surface-muted:');
      expect(globals).toContain('--surface-elevated:');
      expect(globals).toContain('--surface-overlay:');
    });

    test('text tokens exist', () => {
      expect(globals).toContain('--text-primary:');
      expect(globals).toContain('--text-secondary:');
      expect(globals).toContain('--text-muted:');
      expect(globals).toContain('--text-disabled:');
    });

    test('border tokens exist', () => {
      expect(globals).toContain('--border:');
      expect(globals).toContain('--border-subtle:');
      expect(globals).toContain('--border-strong:');
    });

    test('input tokens exist', () => {
      expect(globals).toContain('--input-background:');
      expect(globals).toContain('--input-border:');
      expect(globals).toContain('--input-placeholder:');
    });

    test('overlay tokens exist', () => {
      expect(globals).toContain('--popover:');
      expect(globals).toContain('--popover-foreground:');
      expect(globals).toContain('--dialog:');
      expect(globals).toContain('--dialog-foreground:');
    });

    test('status tokens exist', () => {
      expect(globals).toContain('--success:');
      expect(globals).toContain('--warning:');
      expect(globals).toContain('--danger:');
      expect(globals).toContain('--info:');
    });

    test('focus ring tokens exist', () => {
      expect(globals).toContain('--ring:');
      expect(globals).toContain('--ring-offset:');
    });
  });

  describe('4. Command Palette uses semantic tokens', () => {
    const commandPalettePath = path.resolve(__dirname, '../components/CommandPalette.tsx');
    let commandPalette: string;

    beforeAll(() => {
      commandPalette = fs.readFileSync(commandPalettePath, 'utf-8');
    });

    test('uses bg-popover instead of bg-surface-950', () => {
      expect(commandPalette).toContain('bg-popover');
      expect(commandPalette).not.toContain('bg-surface-950');
    });

    test('uses text-foreground for main text', () => {
      expect(commandPalette).toContain('text-foreground');
    });

    test('uses text-text-muted for muted text', () => {
      expect(commandPalette).toContain('text-text-muted');
    });

    test('uses border-border for borders', () => {
      expect(commandPalette).toContain('border-border');
      expect(commandPalette).not.toContain('border-white/');
    });

    test('uses text-input-placeholder for placeholder', () => {
      expect(commandPalette).toContain('text-input-placeholder');
    });

    test('uses bg-surface-muted for kbd and selected states', () => {
      expect(commandPalette).toContain('bg-surface-muted');
    });

    test('does not use hardcoded white classes', () => {
      expect(commandPalette).not.toMatch(/text-white/);
      expect(commandPalette).not.toMatch(/bg-white/);
    });
  });

  describe('5. Organization dropdown uses semantic tokens', () => {
    const topbarPath = path.resolve(__dirname, '../components/Topbar.tsx');
    const dropdownMenuPath = path.resolve(
      __dirname,
      '../../../../packages/ui/src/components/DropdownMenu.tsx',
    );
    let topbar: string;
    let dropdownMenu: string;

    beforeAll(() => {
      topbar = fs.readFileSync(topbarPath, 'utf-8');
      dropdownMenu = fs.readFileSync(dropdownMenuPath, 'utf-8');
    });

    test('org dropdown uses DropdownMenu', () => {
      expect(topbar).toContain('DropdownMenu');
      expect(topbar).toContain('DropdownMenuContent');
    });

    test('dropdown menu uses bg-popover', () => {
      expect(dropdownMenu).toContain('bg-popover');
    });

    test('dropdown menu uses border-border', () => {
      expect(dropdownMenu).toContain('border-border');
    });

    test('dropdown menu uses text-text-muted for labels', () => {
      expect(dropdownMenu).toContain('text-text-muted');
    });

    test('dropdown menu uses text-text-secondary for items', () => {
      expect(dropdownMenu).toContain('text-text-secondary');
    });

    test('dropdown menu uses hover states', () => {
      expect(dropdownMenu).toContain('focus:bg-surface-subtle');
    });

    test('does not use bg-surface-950 in dropdowns', () => {
      expect(topbar).not.toContain('bg-surface-950');
      expect(dropdownMenu).not.toContain('bg-surface-950');
    });
  });

  describe('6. User dropdown uses semantic tokens', () => {
    const topbarPath = path.resolve(__dirname, '../components/Topbar.tsx');
    const dropdownMenuPath = path.resolve(
      __dirname,
      '../../../../packages/ui/src/components/DropdownMenu.tsx',
    );
    let topbar: string;
    let dropdownMenu: string;

    beforeAll(() => {
      topbar = fs.readFileSync(topbarPath, 'utf-8');
      dropdownMenu = fs.readFileSync(dropdownMenuPath, 'utf-8');
    });

    test('user dropdown uses DropdownMenu', () => {
      expect(topbar).toContain('DropdownMenu');
      expect(topbar).toContain('DropdownMenuContent');
    });

    test('user dropdown uses bg-popover via DropdownMenu', () => {
      expect(dropdownMenu).toContain('bg-popover');
    });

    test('user dropdown uses border-border via DropdownMenu', () => {
      expect(dropdownMenu).toContain('border-border');
    });

    test('user name uses text-text-primary', () => {
      expect(topbar).toContain('text-text-primary');
    });

    test('user role uses text-text-muted', () => {
      expect(topbar).toContain('text-text-muted');
    });

    test('sign out uses destructive variant', () => {
      expect(topbar).toContain('destructive');
    });
  });

  describe('7. Dialog uses semantic tokens (no bg-surface-950)', () => {
    const dialogPath = path.resolve(
      __dirname,
      '../../../../packages/ui/src/components/Dialog.tsx',
    );
    let dialog: string;

    beforeAll(() => {
      dialog = fs.readFileSync(dialogPath, 'utf-8');
    });

    test('uses bg-dialog instead of bg-surface-950', () => {
      expect(dialog).toContain('bg-dialog');
      expect(dialog).not.toContain('bg-surface-950');
    });

    test('uses border-border', () => {
      expect(dialog).toContain('border-border');
      expect(dialog).not.toMatch(/border-white\//);
    });

    test('uses text-text-primary for title', () => {
      expect(dialog).toContain('text-text-primary');
    });

    test('uses text-text-muted for description', () => {
      expect(dialog).toContain('text-text-muted');
    });

    test('close button uses ring-offset-background', () => {
      expect(dialog).toContain('ring-offset-background');
      expect(dialog).not.toContain('ring-offset-surface-950');
    });
  });

  describe('8. Input uses semantic tokens', () => {
    const inputPath = path.resolve(
      __dirname,
      '../../../../packages/ui/src/components/Input.tsx',
    );
    let input: string;

    beforeAll(() => {
      input = fs.readFileSync(inputPath, 'utf-8');
    });

    test('uses bg-input-background', () => {
      expect(input).toContain('bg-input-background');
      expect(input).not.toMatch(/bg-white\//);
    });

    test('uses border-input-border', () => {
      expect(input).toContain('border-input-border');
      expect(input).not.toMatch(/border-white\//);
    });

    test('uses text-foreground', () => {
      expect(input).toContain('text-foreground');
      expect(input).not.toMatch(/text-white/);
    });

    test('uses text-input-placeholder', () => {
      expect(input).toContain('text-input-placeholder');
    });

    test('uses ring-ring for focus', () => {
      expect(input).toContain('ring-ring');
    });

    test('uses ring-offset-background', () => {
      expect(input).toContain('ring-offset-background');
      expect(input).not.toContain('ring-offset-surface-950');
    });
  });

  describe('9. Card/GlassPanel use semantic tokens', () => {
    const cardPath = path.resolve(
      __dirname,
      '../../../../packages/ui/src/components/Card.tsx',
    );
    let card: string;

    beforeAll(() => {
      card = fs.readFileSync(cardPath, 'utf-8');
    });

    test('Card uses bg-card', () => {
      expect(card).toContain('bg-card');
      expect(card).not.toMatch(/bg-white\//);
    });

    test('Card uses border-border', () => {
      expect(card).toContain('border-border');
      expect(card).not.toMatch(/border-white\//);
    });

    test('Card uses text-card-foreground', () => {
      expect(card).toContain('text-card-foreground');
    });

    test('CardTitle uses text-text-primary', () => {
      expect(card).toContain('text-text-primary');
    });

    test('CardDescription uses text-text-muted', () => {
      expect(card).toContain('text-text-muted');
    });

    test('GlassPanel uses semantic surface tokens', () => {
      expect(card).toContain('bg-surface-subtle');
      expect(card).toContain('bg-surface-muted');
      expect(card).not.toMatch(/bg-white\//);
    });

    test('GlassPanel uses border-border', () => {
      expect(card).toContain('border-border');
      expect(card).not.toMatch(/border-white\//);
    });
  });

  describe('10. Global CSS does not apply border-white/* to every element', () => {
    test('no * { border-white/... } rule', () => {
      const starBorderRule = globals.match(/\*\s*\{[^}]*border-white/);
      expect(starBorderRule).toBeNull();
    });

    test('no universal element border rule', () => {
      const starRule = globals.match(/\*\s*\{/);
      expect(starRule).toBeNull();
    });
  });

  describe('11. Dark Theme remains the default', () => {
    test('layout.tsx sets defaultTheme to dark', () => {
      const layoutPath = path.resolve(__dirname, '../app/layout.tsx');
      const layout = fs.readFileSync(layoutPath, 'utf-8');
      expect(layout).toContain('defaultTheme="dark"');
    });

    test('dark class uses dark color-scheme', () => {
      expect(globals).toContain('.dark');
      expect(globals).toContain('color-scheme: dark');
    });
  });

  describe('12. Shared component public APIs remain unchanged', () => {
    test('Card exports all expected components', () => {
      const cardPath = path.resolve(
        __dirname,
        '../../../../packages/ui/src/components/Card.tsx',
      );
      const card = fs.readFileSync(cardPath, 'utf-8');
      expect(card).toContain('export {');
      expect(card).toContain('Card');
      expect(card).toContain('GlassPanel');
      expect(card).toContain('CardHeader');
      expect(card).toContain('CardTitle');
      expect(card).toContain('CardDescription');
      expect(card).toContain('CardContent');
      expect(card).toContain('CardFooter');
    });

    test('Dialog exports all expected components', () => {
      const dialogPath = path.resolve(
        __dirname,
        '../../../../packages/ui/src/components/Dialog.tsx',
      );
      const dialog = fs.readFileSync(dialogPath, 'utf-8');
      expect(dialog).toContain('export {');
      expect(dialog).toContain('Dialog');
      expect(dialog).toContain('DialogPortal');
      expect(dialog).toContain('DialogOverlay');
      expect(dialog).toContain('DialogClose');
      expect(dialog).toContain('DialogTrigger');
      expect(dialog).toContain('DialogContent');
      expect(dialog).toContain('DialogHeader');
      expect(dialog).toContain('DialogFooter');
      expect(dialog).toContain('DialogTitle');
      expect(dialog).toContain('DialogDescription');
    });

    test('Button exports Button and buttonVariants', () => {
      const buttonPath = path.resolve(
        __dirname,
        '../../../../packages/ui/src/components/Button.tsx',
      );
      const button = fs.readFileSync(buttonPath, 'utf-8');
      expect(button).toContain('export { Button, buttonVariants }');
    });

    test('Input exports Input', () => {
      const inputPath = path.resolve(
        __dirname,
        '../../../../packages/ui/src/components/Input.tsx',
      );
      const input = fs.readFileSync(inputPath, 'utf-8');
      expect(input).toContain('export { Input }');
    });

    test('Table exports all expected components', () => {
      const tablePath = path.resolve(
        __dirname,
        '../../../../packages/ui/src/components/Table.tsx',
      );
      const table = fs.readFileSync(tablePath, 'utf-8');
      expect(table).toContain('export {');
      expect(table).toContain('Table');
      expect(table).toContain('TableHeader');
      expect(table).toContain('TableBody');
      expect(table).toContain('TableFooter');
      expect(table).toContain('TableHead');
      expect(table).toContain('TableRow');
      expect(table).toContain('TableCell');
      expect(table).toContain('TableCaption');
    });

    test('Badge exports Badge and badgeVariants', () => {
      const badgePath = path.resolve(
        __dirname,
        '../../../../packages/ui/src/components/Badge.tsx',
      );
      const badge = fs.readFileSync(badgePath, 'utf-8');
      expect(badge).toContain('export { Badge, badgeVariants }');
    });

    test('ScorePill exports ScorePill', () => {
      const scorePillPath = path.resolve(
        __dirname,
        '../../../../packages/ui/src/components/ScorePill.tsx',
      );
      const scorePill = fs.readFileSync(scorePillPath, 'utf-8');
      expect(scorePill).toContain('export { ScorePill }');
    });

    test('Toaster exports Toaster', () => {
      const toastPath = path.resolve(
        __dirname,
        '../../../../packages/ui/src/components/Toast.tsx',
      );
      const toast = fs.readFileSync(toastPath, 'utf-8');
      expect(toast).toContain('Toaster');
      expect(toast).toContain('export');
    });
  });

  describe('13. Theme toggle behavior intact', () => {
    test('Topbar contains theme toggle with useTheme', () => {
      const topbarPath = path.resolve(__dirname, '../components/Topbar.tsx');
      const topbar = fs.readFileSync(topbarPath, 'utf-8');
      expect(topbar).toContain('useTheme');
      expect(topbar).toContain("setTheme(theme === 'dark' ? 'light' : 'dark')");
    });

    test('layout.tsx uses ThemeProvider with class attribute', () => {
      const layoutPath = path.resolve(__dirname, '../app/layout.tsx');
      const layout = fs.readFileSync(layoutPath, 'utf-8');
      expect(layout).toContain('attribute="class"');
      expect(layout).toContain('ThemeProvider');
    });

    test('layout.tsx has suppressHydrationWarning', () => {
      const layoutPath = path.resolve(__dirname, '../app/layout.tsx');
      const layout = fs.readFileSync(layoutPath, 'utf-8');
      expect(layout).toContain('suppressHydrationWarning');
    });
  });

  describe('14. Tailwind config maps semantic tokens', () => {
    test('background color references CSS variable', () => {
      expect(tailwind).toContain("background: 'hsl(var(--background))'");
    });

    test('foreground color references CSS variable', () => {
      expect(tailwind).toContain("foreground: 'hsl(var(--foreground))'");
    });

    test('surface tokens are defined', () => {
      expect(tailwind).toContain('surface:');
      expect(tailwind).toContain('subtle:');
      expect(tailwind).toContain('muted:');
      expect(tailwind).toContain('elevated:');
      expect(tailwind).toContain('overlay:');
    });

    test('text tokens are defined', () => {
      expect(tailwind).toContain("primary: 'hsl(var(--text-primary))'");
      expect(tailwind).toContain("secondary: 'hsl(var(--text-secondary))'");
      expect(tailwind).toContain("muted: 'hsl(var(--text-muted))'");
    });

    test('border tokens are defined', () => {
      expect(tailwind).toContain("DEFAULT: 'hsl(var(--border))'");
      expect(tailwind).toContain('subtle:');
      expect(tailwind).toContain('strong:');
    });

    test('popover and dialog tokens are defined', () => {
      expect(tailwind).toContain('popover:');
      expect(tailwind).toContain('dialog:');
    });

    test('input tokens are defined', () => {
      expect(tailwind).toContain('input:');
    });

    test('ring tokens are defined', () => {
      expect(tailwind).toContain('ring:');
    });

    test('primary color scale is preserved', () => {
      expect(tailwind).toContain('500: \'#3b82f6\'');
      expect(tailwind).toContain('600: \'#2563eb\'');
    });

    test('accent color scale is preserved', () => {
      expect(tailwind).toContain("500: '#06b6d4'");
    });
  });

  describe('15. Global CSS autofill rules use semantic tokens', () => {
    test('autofill uses var(--foreground) instead of hardcoded white', () => {
      expect(globals).toContain('var(--foreground)');
      expect(globals).not.toMatch(/-webkit-text-fill-color:\s*#ffffff/);
    });

    test('autofill uses var(--input-background) instead of hardcoded dark', () => {
      expect(globals).toContain('var(--input-background)');
      expect(globals).not.toMatch(/box-shadow:.*rgba\(10,\s*10,\s*10/);
    });
  });

  describe('16. Global CSS select rules use semantic tokens', () => {
    test('select uses var(--input-background) instead of hardcoded rgba', () => {
      const selectSection = globals.match(/select\s*\{[^}]+\}/);
      expect(selectSection).not.toBeNull();
      expect(selectSection![0]).toContain('var(--input-background)');
      expect(selectSection![0]).not.toContain('rgba(255, 255, 255');
    });

    test('select option uses var(--input-background) instead of hardcoded hex', () => {
      const selectOptionSection = globals.match(/select option\s*\{[^}]+\}/);
      expect(selectOptionSection).not.toBeNull();
      expect(selectOptionSection![0]).toContain('var(--input-background)');
      expect(selectOptionSection![0]).not.toContain('#0a0a0a');
    });
  });

  describe('17. Global CSS scrollbar uses semantic tokens', () => {
    test('scrollbar thumb uses border tokens instead of white', () => {
      const scrollbarSection = globals.match(/::-webkit-scrollbar-thumb\s*\{[^}]+\}/);
      expect(scrollbarSection).not.toBeNull();
      expect(scrollbarSection![0]).toContain('bg-border');
      expect(scrollbarSection![0]).not.toMatch(/bg-white/);
    });
  });

  describe('18. Toast uses semantic tokens', () => {
    const toastPath = path.resolve(
      __dirname,
      '../../../../packages/ui/src/components/Toast.tsx',
    );
    let toast: string;

    beforeAll(() => {
      toast = fs.readFileSync(toastPath, 'utf-8');
    });

    test('uses bg-dialog instead of bg-surface-950', () => {
      expect(toast).toContain('bg-dialog');
      expect(toast).not.toContain('bg-surface-950');
    });

    test('uses text-dialog-foreground', () => {
      expect(toast).toContain('text-dialog-foreground');
    });

    test('uses border-border', () => {
      expect(toast).toContain('border-border');
      expect(toast).not.toMatch(/border-white/);
    });
  });

  describe('19. Button uses semantic tokens', () => {
    const buttonPath = path.resolve(
      __dirname,
      '../../../../packages/ui/src/components/Button.tsx',
    );
    let button: string;

    beforeAll(() => {
      button = fs.readFileSync(buttonPath, 'utf-8');
    });

    test('base uses ring-offset-background', () => {
      expect(button).toContain('ring-offset-background');
      expect(button).not.toContain('ring-offset-surface-950');
    });

    test('outline variant uses border-border', () => {
      expect(button).toContain('border border-border');
    });

    test('ghost variant uses text-text-secondary', () => {
      expect(button).toContain('text-text-secondary');
    });

    test('glass variant uses bg-surface-subtle', () => {
      expect(button).toContain('bg-surface-subtle');
    });
  });

  describe('20. Table uses semantic tokens', () => {
    const tablePath = path.resolve(
      __dirname,
      '../../../../packages/ui/src/components/Table.tsx',
    );
    let table: string;

    beforeAll(() => {
      table = fs.readFileSync(tablePath, 'utf-8');
    });

    test('uses border-border instead of border-white', () => {
      expect(table).toContain('border-border');
      expect(table).not.toMatch(/border-white/);
    });

    test('uses bg-surface-subtle for header/footer', () => {
      expect(table).toContain('bg-surface-subtle');
      expect(table).not.toMatch(/bg-white/);
    });

    test('uses text-text-muted for table head', () => {
      expect(table).toContain('text-text-muted');
      expect(table).not.toMatch(/text-white/);
    });
  });

  describe('21. Badge uses semantic tokens', () => {
    const badgePath = path.resolve(
      __dirname,
      '../../../../packages/ui/src/components/Badge.tsx',
    );
    let badge: string;

    beforeAll(() => {
      badge = fs.readFileSync(badgePath, 'utf-8');
    });

    test('default variant uses bg-surface-muted', () => {
      expect(badge).toContain('bg-surface-muted');
    });

    test('uses border-border', () => {
      expect(badge).toContain('border-border');
      expect(badge).not.toMatch(/border-white/);
    });

    test('outline variant uses text-text-secondary', () => {
      expect(badge).toContain('text-text-secondary');
    });
  });
});
