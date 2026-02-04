import { useState, useEffect, useRef } from 'react';
import { Grid, Title, Text, Box } from '@mantine/core';
import { SimulationControls } from '../components/SimulationControls';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { HistogramDisplay } from '../components/HistogramDisplay';
import SimWorker from '../sim.worker?worker'; 
import { runWebGPUSimulation } from '../webgpu-sim';

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
  
  const [useGPU, setUseGPU] = useState(false);
  const [bitDepth, setBitDepth] = useState<string>('8'); // Default 8-bit

  const workerRef = useRef<Worker | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    workerRef.current = new SimWorker();
    workerRef.current.onmessage = (e) => {
      const { type, data, error } = e.data;
      if (type === 'SUCCESS') {
        setExecutionTime(performance.now() - startTimeRef.current);
        setSimData(data);
        setLoading(false);
      } else if (type === 'ERROR') {
        console.error(error);
        setLoading(false);
        alert('Simulation Error');
      }
    };
    return () => workerRef.current?.terminate();
  }, []);

  const runSimulation = async () => {
    setLoading(true);
    setExecutionTime(null);
    setSimData(null);
    startTimeRef.current = performance.now();

    if (useGPU && mode === 'fixed-kills') {
      try {
        const result = await runWebGPUSimulation(
          numerator, 
          denominator, 
          killsPerPlayer, 
          iterations,
          parseInt(bitDepth) // Pass the selected bit depth
        );
        
        setExecutionTime(performance.now() - startTimeRef.current);
        setSimData(result);
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        alert(`GPU Error: ${err.message}. Falling back to CPU.`);
        setUseGPU(false); 
        setLoading(false); 
      }
    } else {
      workerRef.current?.postMessage({
        mode,
        numerator,
        denominator,
        iterations,
        killsPerPlayer
      });
    }
  };

  return (
    <Box>
      <Box mb="xl">
        <Title order={2}>RuneScape Drop Simulator</Title>
        <Text c="dimmed">
          High-performance Monte Carlo simulation engine (Rust/Wasm & WebGPU)
        </Text>
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
            useGPU={useGPU}
            setUseGPU={setUseGPU}
            bitDepth={bitDepth}
            setBitDepth={setBitDepth}
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