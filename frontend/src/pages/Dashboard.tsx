import { useState, useEffect, useRef } from 'react';
import { Grid, Title, Text, Box } from '@mantine/core';
import { SimulationControls } from '../components/SimulationControls';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { HistogramDisplay } from '../components/HistogramDisplay';
import SimWorker from '../sim.worker?worker'; 

type SimulationMode = 'until-drop' | 'fixed-kills';

export function Dashboard() {
  const [numerator, setNumerator] = useState<number>(1);
  const [denominator, setDenominator] = useState<number>(512);
  const [iterations, setIterations] = useState<number>(1_000_000);
  const [killsPerPlayer, setKillsPerPlayer] = useState<number>(500);
  const [mode, setMode] = useState<SimulationMode>('fixed-kills');
  const [simData, setSimData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    workerRef.current = new SimWorker();
    workerRef.current.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'SUCCESS') {
        setExecutionTime(performance.now() - startTimeRef.current);
        setSimData(data);
        setLoading(false);
      }
    };
    return () => workerRef.current?.terminate();
  }, []);

  const runSimulation = () => {
    setLoading(true);
    setExecutionTime(null);
    startTimeRef.current = performance.now();
    workerRef.current?.postMessage({
      mode,
      numerator,
      denominator,
      iterations,
      killsPerPlayer
    });
  };

  return (
    <Box>
      <Box mb="xl">
        <Title order={2}>RuneScape Drop Simulator</Title>
        <Text c="dimmed">Monte Carlo simulation engine (Rust/Wasm)</Text>
      </Box>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
          <SimulationControls
            mode={mode}
            setMode={setMode}
            numerator={numerator}
            setNumerator={setNumerator}
            denominator={denominator}
            setDenominator={setDenominator}
            iterations={iterations}
            setIterations={setIterations}
            killsPerPlayer={killsPerPlayer}
            setKillsPerPlayer={setKillsPerPlayer}
            loading={loading}
            onRunSimulation={runSimulation}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
          <ResultsDisplay 
            simData={simData} 
            mode={mode} 
            executionTime={executionTime} 
          />
          <HistogramDisplay 
            simData={simData} 
            mode={mode} 
          />
        </Grid.Col>
      </Grid>
    </Box>
  );
}