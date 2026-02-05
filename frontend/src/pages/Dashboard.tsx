import { useState, useEffect, useRef } from 'react';
import { Grid, Title, Text, Box, Progress } from '@mantine/core';
import { SimulationControls } from '../components/SimulationControls';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { HistogramDisplay } from '../components/HistogramDisplay';
import SimWorker from '../sim.worker?worker'; 
import { runWebGPUSimulation, type SimulationProgress } from '../webgpu-sim';

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
  
  // GPU State
  const [useGPU, setUseGPU] = useState(false);
  const [bitDepth, setBitDepth] = useState<string>('auto');
  
  // Progress State
  const [progress, setProgress] = useState<SimulationProgress | null>(null);

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
        setProgress(null);
      } else if (type === 'ERROR') {
        console.error(error);
        setLoading(false);
        setProgress(null);
        alert('Simulation Error');
      }
    };
    return () => workerRef.current?.terminate();
  }, []);

  const runSimulation = async () => {
    setLoading(true);
    setExecutionTime(null);
    setSimData(null);
    setProgress(null);
    startTimeRef.current = performance.now();

    if (useGPU && mode === 'fixed-kills') {
      try {
        const result = await runWebGPUSimulation(
          numerator, 
          denominator, 
          killsPerPlayer, 
          iterations,
          bitDepth === 'auto' ? 'auto' : parseInt(bitDepth),
          (progressUpdate) => {
            setProgress(progressUpdate);
          }
        );
        
        setExecutionTime(performance.now() - startTimeRef.current);
        setSimData(result);
        setLoading(false);
        setProgress(null);
      } catch (err: any) {
        console.error(err);
        alert(`GPU Error: ${err.message}`);
        setLoading(false);
        setProgress(null);
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
          High-performance Monte Carlo simulation engine (WebGPU)
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
          {loading && progress && (
            <Box mb="md">
              <Text size="sm" weight={500} mb="xs">
                Processing: {progress.completed.toLocaleString()} / {progress.total.toLocaleString()} simulations
              </Text>
              <Progress 
                value={progress.percentComplete} 
                size="lg" 
                radius="md"
                animate
              />
              <Text size="xs" c="dimmed" mt="xs">
                {progress.percentComplete.toFixed(1)}% complete • 
                ~{(progress.estimatedTimeRemaining / 1000).toFixed(1)}s remaining
              </Text>
            </Box>
          )}
          
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