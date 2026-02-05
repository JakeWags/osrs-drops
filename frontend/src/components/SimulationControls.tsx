import { Card, SegmentedControl, Stack, Group, NumberInput, Button, Text, Divider, Title, LoadingOverlay, Switch, Accordion, Select } from '@mantine/core';

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
  useGPU: boolean;
  setUseGPU: (value: boolean) => void;
  bitDepth: string;
  setBitDepth: (value: string) => void;
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
  useGPU,
  setUseGPU,
  bitDepth,
  setBitDepth
}: SimulationControlsProps) {
  return (
    <Card shadow="sm" p="lg" radius="md" withBorder style={{ height: '100%', position: 'relative' }}>
      <LoadingOverlay visible={loading} overlayProps={{ blur: 1 }} />
      
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
        </div>

        <Divider />

        <div>
          <Text size="sm" weight={500} mb="xs">Drop Rate Chance</Text>
          <Group grow align="flex-start">
            <NumberInput label="Numerator" value={numerator} onChange={setNumerator} min={1} />
            <NumberInput label="Denominator" value={denominator} onChange={setDenominator} min={1} />
          </Group>
        </div>

        <div>
          <Text size="sm" weight={500} mb="xs">Parameters</Text>
          <Stack spacing="xs">
            <NumberInput
              label={mode === 'fixed-kills' ? 'Number of Players' : 'Total Simulations'}
              value={iterations}
              onChange={setIterations}
              min={1000}
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

        <Accordion variant="contained" radius="md" chevronPosition="left">
            <Accordion.Item value="advanced">
                <Accordion.Control>
                    <Text size="sm" weight={500}>Advanced Performance</Text>
                </Accordion.Control>
                <Accordion.Panel>
                    <Stack spacing="xs">
                        <Switch 
                            label="Enable GPU Acceleration" 
                            checked={useGPU}
                            onChange={(event) => setUseGPU(event.currentTarget.checked)}
                            disabled={mode === 'until-drop'} 
                        />
                        
                        {useGPU && (
                            <Select
                                label="Bit Depth"
                                description="Auto-tuning recommended for best performance"
                                value={bitDepth}
                                onChange={(val) => setBitDepth(val || 'auto')}
                                data={[
                                    { value: 'auto', label: 'Auto (Recommended)' },
                                    { value: '4', label: '4-Bit (Max 15 Drops)' },
                                    { value: '8', label: '8-Bit (Max 255 Drops)' },
                                    { value: '16', label: '16-Bit (Max 65,535 Drops)' },
                                    { value: '32', label: '32-Bit (No Limit)' }
                                ]}
                            />
                        )}
                        
                        {useGPU && bitDepth === 'auto' && (
                            <Text size="xs" c="dimmed" mt="xs">
                                Auto-tuning will select the optimal bit depth based on your drop rate and kill count.
                            </Text>
                        )}
                    </Stack>
                </Accordion.Panel>
            </Accordion.Item>
        </Accordion>

        <Button 
          onClick={onRunSimulation} 
          loading={loading} 
          fullWidth 
          size="md"
          variant={useGPU ? "gradient" : "filled"}
          gradient={{ from: 'orange', to: 'red' }}
        >
          Run Simulation
        </Button>
      </Stack>
    </Card>
  );
}