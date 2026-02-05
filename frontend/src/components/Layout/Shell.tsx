import { AppShell, Burger, Group, Title, UnstyledButton, Text, Box, rem, useMantineTheme } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { ReactNode } from "react";

const navLinks = [
  { label: 'Dashboard', active: true },
  { label: 'Settings', active: false },
  { label: 'Documentation', active: false },
];

export function Shell({ children }: { children: ReactNode }) {
  // Sidebar defaults to CLOSED (false)
  const [opened, { toggle }] = useDisclosure(false);
  const theme = useMantineTheme();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 2500,
        breakpoint: 'sm',
        // Collapsed by default on desktop AND mobile until toggled
        collapsed: { mobile: !opened, desktop: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} size="sm" />
          <Group justify="space-between" style={{ flex: 1 }}>
            <Title order={3}>DropRate Sim</Title>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {navLinks.map((link) => (
          <UnstyledButton
            key={link.label}
            data-active={link.active || undefined}
            style={{
              display: 'block',
              width: '100%',
              padding: theme.spacing.xs,
              borderRadius: theme.radius.sm,
              color: link.active ? theme.colors.blue[7] : theme.colors.gray[7],
              backgroundColor: link.active ? theme.colors.blue[0] : 'transparent',
              fontWeight: link.active ? 500 : 400,
            }}
          >
            <Text size="sm">{link.label}</Text>
          </UnstyledButton>
        ))}
      </AppShell.Navbar>

      {/* Main content area fills the void */}
      <AppShell.Main bg="gray.0">
        {children}
      </AppShell.Main>
    </AppShell>
  );
}