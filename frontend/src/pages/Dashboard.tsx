import { useState, useRef } from 'react';
import { Grid, Title, Text, Box, Progress } from '@mantine/core';
import { SimulationControls } from '../components/SimulationControls';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { HistogramDisplay } from '../components/HistogramDisplay';
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

  const startTimeRef = useRef<number>(0);

  const numWorkers = 4;  // Number of Web Workers for parallelization

  // Function to aggregate results from multiple workers
  const aggregateResults = (results: any[]) => {
    if (results.length === 0) return { simData: null };

    let totalMin = Infinity;
    let totalMax = -Infinity;
    let totalSum = 0;
    let totalCount = 0;
    const maxHistogramLength = Math.max(...results.map(r => r.data.histogram?.length || 0));
    const aggregatedHistogram = new Array(maxHistogramLength).fill(0);

    results.forEach(({ data }) => {
      totalMin = Math.min(totalMin, data.min);
      totalMax = Math.max(totalMax, data.max);
      totalSum += data.avg * data.totalCount;  // Weighted sum for average
      totalCount += data.totalCount;

      if (data.histogram) {
        data.histogram.forEach((count: number, index: number) => {
          if (index < aggregatedHistogram.length) {
            aggregatedHistogram[index] += count;
          }
        });
      }
    });

    const aggregatedAvg = totalCount > 0 ? totalSum / totalCount : 0;

    return {
      simData: {
        min: totalMin,
        max: totalMax,
        avg: aggregatedAvg,
        totalCount,
        histogram: aggregatedHistogram,
      },
    };
  };

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
      // CPU simulation with multiple workers
      const partialIterations = Math.floor(iterations / numWorkers);
      const workers = [];
      const promises = [];

      for (let i = 0; i < numWorkers; i++) {
        const worker = new Worker(new URL('../sim.worker.ts', import.meta.url), { type: 'module' });
        workers.push(worker);

        const promise = new Promise<any>((resolve, reject) => {
          worker.onmessage = (e) => {
            const { type, data, error } = e.data;
            if (type === 'SUCCESS') {
              resolve({ data });
            } else if (type === 'ERROR') {
              reject(error);
            }
            worker.terminate();  // Clean up worker
          };
          worker.onerror = reject;
        });

        worker.postMessage({
          mode,
          numerator,
          denominator,
          partialIterations,
          killsPerPlayer
        });

        promises.push(promise);
      }

      try {
        const results = await Promise.all(promises);
        const aggregated = aggregateResults(results);
        setSimData(aggregated.simData);
        setExecutionTime(performance.now() - startTimeRef.current);
      } catch (error) {
        console.error('Simulation error:', error);
        alert('Simulation Error');
      } finally {
        setLoading(false);
        // Ensure all workers are terminated
        workers.forEach(w => w.terminate());
      }
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
              <Text size="sm" fw={500} mb="xs">
                Processing: {progress.completed.toLocaleString()} / {progress.total.toLocaleString()} simulations
              </Text>
              <Progress 
                value={progress.percentComplete} 
                size="lg" 
                radius="md"
                animated
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
            killsPerPlayer={mode === 'fixed-kills' ? killsPerPlayer : undefined}
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