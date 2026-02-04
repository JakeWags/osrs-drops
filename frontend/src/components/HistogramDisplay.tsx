import { Card, Title, Text, Box, useMantineTheme } from '@mantine/core';
import { VegaEmbed } from 'react-vega';

type SimulationMode = 'until-drop' | 'fixed-kills';

interface HistogramDisplayProps {
  simData: any;
  mode: SimulationMode;
}

export function HistogramDisplay({ simData, mode }: HistogramDisplayProps) {
  const theme = useMantineTheme();

  if (!simData) return null;

  // 1. Calculate Probability for Y-axis (Count / Total)
  const total = simData.totalCount || 1; // Prevent division by zero
  const chartData = simData.histogram
    .map((count: number, value: number) => ({ 
      x: value, 
      y: count / total 
    }))
    .filter((d: any) => d.y > 0);

  // 2. Dynamic Config based on Mode
  // 'ordinal' type for drops removes 0.5 ticks and makes bars wider automatically
  const xType = mode === 'fixed-kills' ? 'ordinal' : 'quantitative';
  const xTitle = mode === 'until-drop' ? "Kill Count" : "Drops Received";

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: "container" as const,
    height: 300,
    autosize: { type: "fit", contains: "padding" as const },
    data: { 
      values: chartData 
    },
    mark: { 
      type: "area" as const, 
      line: { color: theme.colors.blue[7], interpolate: "monotone" }, 
      color: theme.colors.blue[2], 
      opacity: 0.6, 
      tooltip: true,
      interpolate: "monotone"
    },
    encoding: {
      x: { 
        field: "x", 
        type: xType as any, // 'ordinal' or 'quantitative'
        title: xTitle,
        scale: { padding: 0.01 },
        axis: { 
          grid: false,
          labelAngle: 0, // Keep labels flat for ordinal (drops)
        }
      },
      y: { 
        field: "y", 
        type: "quantitative" as const, 
        title: "Probability", // Changed from "Frequency"
        axis: { 
          format: ".1%" // Shows 0.5 as "50.0%"
        } 
      }
    }
  };

  return (
    <Card shadow="sm" p="lg" radius="md" withBorder mt="md">
      <Title order={4} mb="lg">Distribution Visualization</Title>
      
      <Box w="100%" h={320}>
        <VegaEmbed 
          spec={spec as any}
          style={{ width: '100%' }}
        />
      </Box>

      <Text size="sm" c="dimmed" mt="sm" ta="center">
        {mode === 'until-drop' 
          ? 'Shows the probability of getting the drop at a specific kill count.' 
          : 'Shows the probability of receiving X number of drops within the set kills.'}
      </Text>
    </Card>
  );
}