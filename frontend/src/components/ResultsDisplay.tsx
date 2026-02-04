import { Card, Text, Group, Stack, SimpleGrid, Paper, Center, Title, Loader } from '@mantine/core';

type SimulationMode = 'until-drop' | 'fixed-kills';

interface ResultsDisplayProps {
  simData: any;
  mode: SimulationMode;
  executionTime: number | null;
}

export function ResultsDisplay({ simData, mode, executionTime }: ResultsDisplayProps) {
  // Safe check: Ensure simData exists AND has the required properties
  const hasData = simData && typeof simData.min !== 'undefined';

  if (!hasData) {
    return (
      <Card shadow="sm" p="xl" radius="md" withBorder h="100%">
        <Center h="100%">
          <Stack align="center" spacing="xs">
            <Text color="dimmed" size="lg">No simulation data</Text>
            <Text color="dimmed" size="sm">Run a simulation to view statistics</Text>
          </Stack>
        </Center>
      </Card>
    );
  }

  const label = mode === 'until-drop' ? 'Kills' : 'Drops';

  return (
    <Card shadow="sm" p="lg" radius="md" withBorder>
      <Group position="apart" mb="md">
        <Title order={4}>Results Summary</Title>
        {executionTime && (
          <Text size="xs" color="dimmed">
            Computed in {(executionTime / 1000).toFixed(3)}s
          </Text>
        )}
      </Group>

      <SimpleGrid cols={3} breakpoints={[{ maxWidth: 'sm', cols: 1 }]}>
        <Paper withBorder p="md" radius="md">
          <Text size="xs" color="dimmed" tt="uppercase" weight={700}>
            Minimum {label}
          </Text>
          <Text size="xl" weight={700}>
            {simData.min.toLocaleString()}
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md" style={{ borderColor: '#228be6' }}>
          <Text size="xs" color="blue" tt="uppercase" weight={700}>
            Average {label}
          </Text>
          <Text size="xl" weight={700} color="blue">
            {simData.avg?.toFixed(2) || "0.00"}
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Text size="xs" color="dimmed" tt="uppercase" weight={700}>
            Maximum {label}
          </Text>
          <Text size="xl" weight={700}>
            {simData.max?.toLocaleString() || "0"}
          </Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="md" radius="md" mt="md" bg="gray.0">
        <Group position="apart">
            <div>
                <Text size="xs" color="dimmed" tt="uppercase" weight={700}>Total Samples</Text>
                <Text weight={600}>{simData.totalCount?.toLocaleString() || "0"}</Text>
            </div>
        </Group>
      </Paper>
    </Card>
  );
}