import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const EMBEDDING_DIMENSION = 64;

function embeddingToJson(text: string, dim: number): string {
  const values = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    values[i % dim] += text.charCodeAt(i) / 255;
  }
  let normSq = 0;
  for (let i = 0; i < dim; i++) normSq += values[i] * values[i];
  const norm = Math.sqrt(normSq);
  if (norm === 0) return '[' + Array(dim).fill('0').join(',') + ']';
  const parts: string[] = [];
  for (let i = 0; i < dim; i++) {
    parts.push((values[i] / norm).toFixed(8));
  }
  return '[' + parts.join(',') + ']';
}

function splitIntoChunks(markdown: string, chunkSize = 500, overlap = 100): string[] {
  const chunks: string[] = [];
  let pos = 0;
  while (pos < markdown.length) {
    const end = Math.min(pos + chunkSize, markdown.length);
    chunks.push(markdown.substring(pos, end));
    if (end >= markdown.length) break;
    pos = end - overlap;
  }
  return chunks;
}

const SEED_ARTICLES = [
  {
    title: 'Troubleshooting a Slow Computer',
    markdown: `# Troubleshooting a Slow Computer
## Overview
A slow computer is one of the most common IT support issues. This guide covers systematic steps to diagnose and resolve performance problems.

## Common Causes
### 1. High CPU Usage
Check Task Manager (Windows) or Activity Monitor (macOS) for processes consuming >90% CPU. Common culprits: antivirus scans, Windows Update, browser tabs, background apps.
### 2. Insufficient RAM (Memory)
Symptoms: System sluggish when multiple apps are open, frequent disk thrashing. Solution: Close unused applications, increase virtual memory, upgrade RAM.
### 3. Full or Failing Hard Drive
Symptoms: Slow boot times, file operations take long. Check: Drive should have at least 15-20% free space. Run Disk Cleanup, uninstall unused programs.
### 4. Malware or Bloatware
Symptoms: Unknown processes, pop-ups, browser toolbars. Run full antivirus scan, use Malwarebytes for secondary scan.
### 5. Outdated Drivers
Symptoms: General system instability, poor graphics performance. Update chipset, graphics, and storage drivers from manufacturer website.

## Step-by-Step Fix
1. Restart the computer 2. Check and close high-resource processes 3. Run disk cleanup 4. Scan for malware 5. Update drivers and OS 6. Consider hardware upgrade if >5 years old`,
  },
  {
    title: 'Network Connectivity Troubleshooting',
    markdown: `# Network Connectivity Troubleshooting
## Overview
Network connectivity issues are frequent in IT support. This guide provides a structured approach to diagnosing and resolving network problems.

## Initial Checks
1. Is the issue affecting one device or multiple devices? 2. Are there any recent changes to network configuration? 3. Check physical connections

## Step-by-Step Diagnosis
### Layer 1: Physical Connectivity
Check Ethernet cable is securely plugged in. Verify link lights on NIC and switch port. Try a different cable or port. For Wi-Fi: Check if airplane mode is off, verify Wi-Fi is enabled.

### Layer 2: IP Configuration
Run ipconfig (Windows) or ifconfig (Mac/Linux). Verify IP address is not 169.254.x.x (APIPA - no DHCP server). Try ipconfig /release then ipconfig /renew.

### Layer 3: Connectivity Tests
ping 127.0.0.1 - Tests local TCP/IP stack. ping gateway-ip - Tests local network connectivity. ping 8.8.8.8 - Tests internet connectivity. ping google.com - Tests DNS resolution.

## Common Fixes
No IP address: Restart DHCP client service. DNS failures: Flush DNS cache (ipconfig /flushdns), change to 8.8.8.8. Intermittent drops: Update NIC driver, check for IP address conflicts.`,
  },
  {
    title: 'Blue Screen of Death (BSOD) Analysis',
    markdown: `# Blue Screen of Death (BSOD) Analysis
## Overview
BSOD (Stop Error) indicates a critical system crash in Windows. The most important information is the STOP CODE displayed on the blue screen.

## Common Stop Codes
### MEMORY_MANAGEMENT (0x1A)
Cause: Faulty RAM or incompatible memory. Diagnostic: Run Windows Memory Diagnostic or MemTest86. Fix: Reseat RAM modules, test one stick at a time.

### DRIVER_IRQL_NOT_LESS_OR_EQUAL (0xD1)
Cause: Faulty or incompatible driver. Diagnostic: Note which driver is mentioned in the error (e.g., nvlddmkm.sys = NVIDIA). Fix: Boot into Safe Mode, roll back or update the offending driver.

### PAGE_FAULT_IN_NONPAGED_AREA (0x50)
Cause: Bad RAM, failing hard drive, or corrupted system file. Diagnostic: Run chkdsk /f and sfc /scannow. Fix: Replace failing hardware or repair system files.

### CRITICAL_PROCESS_DIED (0xEF)
Cause: Critical system process crashed (often after failed update). Fix: Boot into Recovery Environment, run System Restore or Startup Repair.

## Permanent Fix Steps
1. Note the stop code 2. Search the stop code + your Windows version 3. Update all drivers 4. Run sfc /scannow 5. Check hard drive health 6. Test RAM 7. Check for overheating`,
  },
  {
    title: 'Printer Not Working - Troubleshooting Guide',
    markdown: `# Printer Not Working - Troubleshooting Guide
## Overview
Printer issues are extremely common in IT support. Follow these steps in order for fastest resolution.

## Quick Checks
1. Is the printer powered on? 2. Is there paper and toner/ink? 3. Are there any error messages? 4. Is the printer connected to the network/USB?

## Step 1: Check Physical Connection
USB printers: Try a different USB port and cable. Network printers: Ping the printer IP address. Wireless printers: Check Wi-Fi connection on printer panel.

## Step 2: Check Print Queue
Open Devices and Printers, cancel all stuck documents. Restart the Print Spooler service (services.msc > Print Spooler > Restart).

## Step 3: Verify Driver
Go to printer manufacturer website, download latest driver. Remove and re-add the printer. Try the generic/text-only driver as a test.

## Step 4: Test Print
Print a test page from printer properties. Try printing from Notepad (eliminates application issues). Try printing from a different application.

## Advanced Troubleshooting
Network printers: Check if other users can print. Permissions: Verify user has Print permission on shared printer. Firewall: Ensure port 9100 or 515 is open for network printers. Event Viewer: Check System logs for PrintService errors.`,
  },
  {
    title: 'Email Configuration and Troubleshooting',
    markdown: `# Email Configuration and Troubleshooting
## Overview
Email configuration issues typically involve incorrect server settings, authentication problems, or security software blocking connections.

## Common Email Protocols
### IMAP (Recommended)
Incoming: imap.domain.com (Port 993, SSL/TLS). Outgoing: smtp.domain.com (Port 587, STARTTLS). Keeps emails on server, syncs across devices.

### POP3
Incoming: pop.domain.com (Port 995, SSL/TLS). Outgoing: smtp.domain.com (Port 587, STARTTLS). Downloads emails to device only.

### Exchange / Office 365
Server: outlook.office365.com. Use modern authentication (OAuth 2.0).

## Common Issues and Fixes
### Cannot connect to server
Check internet connectivity first. Verify server name and port numbers. Test connectivity: telnet smtp.gmail.com 587.

### Authentication failures
Check username/password (try webmail first). Update password in email client. Check if 2FA is enabled (may need app password). Revoke and re-grant app permissions.

### Can send but not receive (or vice versa)
Verify incoming vs outgoing server settings separately. Check if ISP blocks port 25 (use 587 instead). Firewall/antivirus may be blocking email client.

## Security Tips
Always use SSL/TLS encryption. Enable 2FA on email accounts. Never configure email on public/shared computers.`,
  },
  {
    title: 'VPN Connection Troubleshooting',
    markdown: `# VPN Connection Troubleshooting
## Overview
VPN issues can stem from client configuration, network restrictions, server problems, or authentication failures.

## Common Issues
### Connection Timed Out
Cause: Firewall blocking VPN port or protocol. Check: Can you ping the VPN server? Test with telnet vpn-server port. Fix: Try TCP port 443 (HTTPS) instead of UDP.

### Authentication Failed
Cause: Incorrect credentials, expired certificate, or token issue. Check: Verify password has not expired; check certificate validity dates. Fix: Reset password, reissue certificate, sync system time (important for cert validation).

### Connected but No Internet Access
Cause: Incorrect routing (split tunnel vs full tunnel). Check: route print (Windows) or netstat -rn (Mac/Linux) to see routes. Fix: Check if VPN pushes routes correctly.

### VPN Drops Frequently
Cause: Unstable network, timeout settings, power saving. Fix: Disable network power saving; increase keepalive interval.

## Protocol-Specific Tips
OpenVPN: Use .ovpn config file. WireGuard: Verify public/private key match on both ends. IKEv2: UDP ports 500 and 4500 must be open. SSTP: Uses TCP 443, good for restrictive networks.`,
  },
  {
    title: 'Disk Space Management and Recovery',
    markdown: `# Disk Space Management and Recovery
## Overview
Low disk space causes system slowdowns, application crashes, and update failures.

## Immediate Recovery Steps
### 1. Run Disk Cleanup
Start > Disk Cleanup > Select drive. Clean: Temporary files, Recycle Bin, Delivery Optimization files. Click Clean up system files for additional options.

### 2. Find Large Files
Windows: Use dir /s /o-s or install TreeSize/WinDirStat. macOS: Finder > Show View Options > Calculate all sizes. Linux: du -ah / | sort -rh | head -20.

### 3. Clear Temporary Files
Windows: %temp%, prefetch, C:\\Windows\\Temp. Browser caches in Chrome/Edge/Firefox settings.

### 4. Uninstall Unused Applications
Sort installed programs by size. Remove bloatware and trial software.

### 5. Move User Data
Move Documents, Pictures, Videos to external drive or cloud. Archive old projects to external storage.

## Prevention Strategy
Keep at least 15-20% free space on system drive. Use Storage Sense (Windows 10/11) for automatic cleanup. Monitor disk space with alerts at 80%, 90%, 95% thresholds.`,
  },
  {
    title: 'Malware Infection Detection and Response',
    markdown: `# Malware Infection Detection and Response
## Overview
Early detection and proper response to malware infections minimizes damage and prevents spread.

## Signs of Infection
Computer running slower than usual. Unexpected pop-up ads or browser redirects. New toolbars or programs appearing. Antivirus disabled or unable to update. Unusual network activity when idle. Files being renamed (ransomware indicator).

## Immediate Response
### Step 1: Isolate the Device
Disconnect from network (unplug Ethernet, disable Wi-Fi). Do NOT shut down (may lose volatile evidence).

### Step 2: Identify the Malware
Check running processes in Task Manager. Review %temp% and startup folders. Check browser extensions and add-ons.

### Step 3: Remove the Malware
1. Boot into Safe Mode with Networking 2. Run full antivirus scan (Windows Defender, Malwarebytes) 3. Use removal tools (Malwarebytes AdwCleaner, HitmanPro) 4. Remove suspicious browser extensions 5. Clear system restore points

### Step 4: Verify Removal
Run multiple antivirus scans from different vendors. Monitor network traffic for unusual activity. Change all passwords after clean.

## Prevention
Keep OS and software updated. Use ad-blocker in browser. Never click links in unsolicited emails. Enable controlled folder access. Regular backups (3-2-1 rule: 3 copies, 2 media, 1 offsite).`,
  },
];

async function main() {
  console.log('=== Tech Fusion AI Seed ===\n');

  try {
    await prisma.$connect();
    console.log('Connected to database.\n');

    // 1. Seed global catalog data (DriverCatalogItem)
    console.log('Seeding DriverCatalogItem catalog...');
    const SEED_DRIVERS = [
      { name: 'nvidia', vendor: 'NVIDIA Corporation', latestVersion: '550.120', category: 'gpu', isBuiltin: false },
      { name: 'amdgpu', vendor: 'Advanced Micro Devices', latestVersion: '6.8.0', category: 'gpu', isBuiltin: true },
      { name: 'i915', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'gpu', isBuiltin: true },
      { name: 'e1000', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
      { name: 'e1000e', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
      { name: 'igb', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
      { name: 'ixgbe', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
      { name: 'r8169', vendor: 'Realtek Semiconductor', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
      { name: 'rtl8192cu', vendor: 'Realtek Semiconductor', latestVersion: '6.8.0', category: 'wireless', isBuiltin: true },
      { name: 'iwlwifi', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'wireless', isBuiltin: true },
      { name: 'ath9k', vendor: 'Qualcomm Atheros', latestVersion: '6.8.0', category: 'wireless', isBuiltin: true },
      { name: 'ath10k', vendor: 'Qualcomm Atheros', latestVersion: '6.8.0', category: 'wireless', isBuiltin: true },
      { name: 'nvme', vendor: 'NVM Express', latestVersion: '6.8.0', category: 'storage', isBuiltin: true },
      { name: 'ahci', vendor: 'Generic', latestVersion: '6.8.0', category: 'storage', isBuiltin: true },
      { name: 'megaraid_sas', vendor: 'Broadcom', latestVersion: '6.8.0', category: 'storage', isBuiltin: true },
      { name: 'mlx5_core', vendor: 'Mellanox Technologies', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
      { name: 'bnxt_en', vendor: 'Broadcom', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
      { name: 'tg3', vendor: 'Broadcom', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
      { name: 'snd_hda_intel', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'audio', isBuiltin: true },
      { name: 'usb_storage', vendor: 'Generic', latestVersion: '6.8.0', category: 'storage', isBuiltin: true },
      { name: 'xhci_hcd', vendor: 'Generic', latestVersion: '6.8.0', category: 'usb', isBuiltin: true },
      { name: 'virtio_net', vendor: 'Red Hat', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
      { name: 'virtio_blk', vendor: 'Red Hat', latestVersion: '6.8.0', category: 'storage', isBuiltin: true },
      { name: 'vmwgfx', vendor: 'VMware', latestVersion: '6.8.0', category: 'gpu', isBuiltin: true },
      { name: 'vmxnet3', vendor: 'VMware', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
    ];

    let driverCount = 0;
    for (const d of SEED_DRIVERS) {
      await prisma.driverCatalogItem.upsert({
        where: { name_vendor: { name: d.name, vendor: d.vendor } },
        update: { latestVersion: d.latestVersion, category: d.category },
        create: { ...d, minVersion: '1.0.0' },
      });
      driverCount++;
    }
    console.log(`  Seeded ${driverCount} driver catalog entries.\n`);

    // 2. Seed KB articles if an organization exists
    const org = await prisma.organization.findFirst();
    if (!org) {
      console.log('No organization found. Skipping KB article seed.');
      console.log('Create an organization and user first, then re-run the seed to populate the knowledge base.\n');
      console.log('Seed complete!');
      return;
    }

    console.log(`Found organization: ${org.name} (${org.id})`);
    console.log('Seeding KB articles...\n');

    // Clear existing seed data
    await prisma.kbEmbedding.deleteMany();
    await prisma.kbArticle.deleteMany();

    for (const article of SEED_ARTICLES) {
      const articleId = crypto.randomUUID();
      const now = new Date();

      const created = await prisma.kbArticle.create({
        data: {
          id: articleId,
          orgId: org.id,
          title: article.title,
          markdown: article.markdown,
          createdAt: now,
          updatedAt: now,
        },
      });

      const chunks = splitIntoChunks(article.markdown, 500, 100);
      for (let i = 0; i < chunks.length; i++) {
        const embId = crypto.randomUUID();
        const embeddingJson = embeddingToJson(chunks[i], EMBEDDING_DIMENSION);

        await prisma.kbEmbedding.create({
          data: {
            id: embId,
            articleId: created.id,
            chunkIndex: i,
            chunkText: chunks[i],
            embedding: JSON.parse(embeddingJson),
            createdAt: now,
          },
        });
      }

      console.log(`  Article: "${article.title}" (${articleId}) - ${chunks.length} chunks`);
    }

    console.log('\nSeed complete!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
