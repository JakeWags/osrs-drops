import { Card, SegmentedControl, Stack, Group, NumberInput, Button, Text, Divider, Title, LoadingOverlay, Switch, Tooltip, Badge, Accordion, Select } from '@mantine/core';

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
  // New Prop
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
        {/* ... Mode Selection (Existing) ... */}
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

        {/* ... Drop Rate (Existing) ... */}
        <div>
          <Text size="sm" weight={500} mb="xs">Drop Rate Chance</Text>
          <Group grow align="flex-start">
            <NumberInput label="Numerator" value={numerator} onChange={setNumerator} min={1} />
            <NumberInput label="Denominator" value={denominator} onChange={setDenominator} min={1} />
          </Group>
        </div>

        {/* ... Parameters (Existing) ... */}
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

        {/* ... Advanced Options (NEW) ... */}
        <Accordion variant="contained" radius="md" chevronPosition="left">
            <Accordion.Item value="advanced">
                <Accordion.Control>
                    <Text size="sm" weight={500}>Advanced Performance</Text>
                </Accordion.Control>
                <Accordion.Panel>
                    <Stack spacing="xs">
                        <Text size="xs" color="dimmed">
                            Adjust memory packing to increase max simulation count.
                        </Text>
                        <Select
                            label="Bit Packing Strategy"
                            description="Lower bits = Faster, but lower max drops per player."
                            value={bitDepth}
                            onChange={(val) => setBitDepth(val || '8')}
                            data={[
                                { value: '4', label: '4-Bit (Max 15 Drops) - Ultra Fast' },
                                { value: '8', label: '8-Bit (Max 255 Drops) - Standard' },
                                { value: '32', label: '32-Bit (No Limit) - Slow' },
                            ]}
                            disabled={!useGPU || mode !== 'fixed-kills'}
                        />
                         <Switch 
                            label="Enable GPU Acceleration" 
                            checked={useGPU}
                            onChange={(event) => setUseGPU(event.currentTarget.checked)}
                            disabled={mode === 'until-drop'} 
                            mt="sm"
                        />
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
          {useGPU ? 'Run on GPU' : 'Run Simulation'}
        </Button>
      </Stack>
    </Card>
  );
}