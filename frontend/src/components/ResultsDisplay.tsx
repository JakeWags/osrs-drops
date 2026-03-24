import { Card, Text, Group, Stack, SimpleGrid, Paper, Center, Title } from '@mantine/core';

type SimulationMode = 'until-drop' | 'fixed-kills';

interface ResultsDisplayProps {
  simData: any;
  mode: SimulationMode;
  executionTime: number | null;
  killsPerPlayer?: number;
}

export function ResultsDisplay({ simData, mode, executionTime, killsPerPlayer }: ResultsDisplayProps) {
  // Safe check: Ensure simData exists AND has the required properties
  const hasData = simData && typeof simData.min !== 'undefined';

  if (!hasData) {
    return (
      <Card shadow="sm" p="xl" radius="md" withBorder h="100%">
        <Center h="100%">
          <Stack align="center" gap="xs">
            <Text color="dimmed" size="lg">No simulation data</Text>
            <Text color="dimmed" size="sm">Run a simulation to view statistics</Text>
          </Stack>
        </Center>
      </Card>
    );
  }

  const label = mode === 'until-drop' ? 'Kills' : 'Drops';

  // Calculate total Bernoulli trials
  let totalTrials = 0;
  if (mode === 'fixed-kills' && killsPerPlayer) {
    totalTrials = simData.totalCount * killsPerPlayer;
  } else if (mode === 'until-drop' && simData.histogram) {
    for (let i = 0; i < simData.histogram.length; i++) {
      totalTrials += simData.histogram[i] * i;
    }
  }

  return (
    <Card shadow="sm" p="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={4}>Results Summary</Title>
        {executionTime && (
          <Text size="xs" color="dimmed">
            Computed in {(executionTime / 1000).toFixed(3)}s
          </Text>
        )}
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Paper withBorder p="md" radius="md">
          <Text size="xs" color="dimmed" tt="uppercase" fw={700}>
            Minimum {label}
          </Text>
          <Text size="xl" fw={700}>
            {simData.min.toLocaleString()}
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md" style={{ borderColor: '#228be6' }}>
          <Text size="xs" color="blue" tt="uppercase" fw={700}>
            Average {label}
          </Text>
          <Text size="xl" fw={700} color="blue">
            {simData.avg?.toFixed(2) || "0.00"}
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Text size="xs" color="dimmed" tt="uppercase" fw={700}>
            Maximum {label}
          </Text>
          <Text size="xl" fw={700}>
            {simData.max?.toLocaleString() || "0"}
          </Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="md" radius="md" mt="md" bg="gray.0">
        <Group justify="space-between">
            <div>
                <Text size="xs" color="dimmed" tt="uppercase" fw={700}>Total Bernoulli Trials</Text>
                <Text fw={600}>{totalTrials.toLocaleString()}</Text>
            </div>
        </Group>
      </Paper>
    </Card>
  );
}