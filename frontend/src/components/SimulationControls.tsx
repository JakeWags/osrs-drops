import { Card, SegmentedControl, Stack, Group, NumberInput, Button, Text, Divider, Title, LoadingOverlay } from '@mantine/core';

type SimulationMode = 'until-drop' | 'fixed-kills';

interface SimulationControlsProps {
  mode: SimulationMode;
  setMode: (mode: SimulationMode) => void;
  numerator: number;
  setNumerator: (value: number) => void;
  denominator: number;
  setDenominator: (value: number) => void;
  iterations: number;
  setIterations: (value: number) => void;
  killsPerPlayer: number;
  setKillsPerPlayer: (value: number) => void;
  loading: boolean;
  onRunSimulation: () => void;
}

export function SimulationControls({
  mode,
  setMode,
  numerator,
  setNumerator,
  denominator,
  setDenominator,
  iterations,
  setIterations,
  killsPerPlayer,
  setKillsPerPlayer,
  loading,
  onRunSimulation,
}: SimulationControlsProps) {
  return (
    <Card shadow="sm" p="lg" radius="md" withBorder style={{ height: '100%', position: 'relative' }}>
      <LoadingOverlay 
        visible={loading} 
        overlayProps={{ blur: 1 }} // Correct way to add blur in v7
      />
      
      <Stack spacing="lg">
        <div>
          <Title order={4} mb="md">Configuration</Title>
          <Text size="sm" weight={500} mb={5}>Simulation Mode</Text>
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value as SimulationMode)}
            data={[
              { label: 'Fixed Kill Count', value: 'fixed-kills' },
              { label: 'Kills Until Drop', value: 'until-drop' }
            ]}
            fullWidth
            mb="xs"
          />
          <Text size="xs" color="dimmed">
            {mode === 'fixed-kills' 
              ? 'Simulate a group of players doing a set number of kills.' 
              : 'Simulate how long it takes to get a specific drop.'}
          </Text>
        </div>

        <Divider />

        <div>
          <Text size="sm" weight={500} mb="xs">Drop Rate Chance</Text>
          <Group grow align="flex-start">
            <NumberInput
              label="Numerator"
              value={numerator}
              onChange={setNumerator}
              min={1}
            />
            <NumberInput
              label="Denominator"
              value={denominator}
              onChange={setDenominator}
              min={1}
            />
          </Group>
          <Text size="xs" color="dimmed" mt={5} align="right">
            Probability: {((numerator / denominator) * 100).toFixed(4)}%
          </Text>
        </div>

        <div>
          <Text size="sm" weight={500} mb="xs">Parameters</Text>
          <Stack spacing="xs">
            <NumberInput
              label={mode === 'fixed-kills' ? 'Number of Players' : 'Total Simulations'}
              value={iterations}
              onChange={setIterations}
              min={1000}
              step={10000}
              thousandSeparator=","
            />
            
            {mode === 'fixed-kills' && (
              <NumberInput
                label="Kills per Player"
                value={killsPerPlayer}
                onChange={setKillsPerPlayer}
                min={1}
              />
            )}
          </Stack>
        </div>

        <Button 
          onClick={onRunSimulation} 
          loading={loading} 
          fullWidth 
          size="md"
          mt="md"
        >
          Run Simulation
        </Button>
      </Stack>
    </Card>
  );
}