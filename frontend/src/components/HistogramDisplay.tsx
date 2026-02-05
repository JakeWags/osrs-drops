import { Card, Title, Text, Box, useMantineTheme } from '@mantine/core';
import { VegaEmbed } from 'react-vega';

type SimulationMode = 'until-drop' | 'fixed-kills';

interface HistogramDisplayProps {
  simData: any;
  mode: SimulationMode;
}

export function HistogramDisplay({ simData, mode }: HistogramDisplayProps) {
  const theme = useMantineTheme();

  // SAFETY CHECK: Ensure simData exists AND histogram is a valid array.
  // This prevents crashes if the Worker returns stale data without the histogram.
  if (!simData || !simData.histogram || !Array.isArray(simData.histogram)) {
    return null;
  }

  // 1. Calculate Probability for Y-axis (Count / Total)
  const total = simData.totalCount || 1; // Prevent division by zero
  const chartData = simData.histogram
    .map((count: number, value: number) => ({ 
      x: value, 
      y: count / total 
    }))
    .filter((d: any) => d.y > 0);

  // 2. Dynamic Config based on Mode
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
    layer: [
      {
        mark: { 
          type: "area" as const, 
          line: { color: theme.colors.blue[7], interpolate: "monotone" }, 
          color: theme.colors.blue[2], 
          opacity: 0.3, 
          interpolate: "monotone"
        },
        encoding: {
          x: { 
            field: "x", 
            type: xType as any,
            title: xTitle,
            scale: { padding: 0.01 },
            axis: { 
              grid: false,
              labelAngle: 0, 
            }
          },
          y: { 
            field: "y", 
            type: "quantitative" as const, 
            title: "Probability",
            axis: { 
              format: ".1%"
            } 
          },
          tooltip: [
            { field: "x", type: xType as any, title: xTitle },
            { field: "y", type: "quantitative" as const, title: "Probability", format: ".4%" }
          ]
        }
      }
    ]
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