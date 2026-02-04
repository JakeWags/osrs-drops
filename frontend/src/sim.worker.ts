// Define the input/output types for safety
type SimParams = {
    mode: 'until-drop' | 'fixed-kills';
    numerator: number;
    denominator: number;
    iterations: number;
    killsPerPlayer: number;
};

// Import the WASM init and functions
import init, { simulate_drops_until_success, simulate_fixed_kills } from "drop-sim";

let initialized = false;

self.onmessage = async (e: MessageEvent<SimParams>) => {
    const { mode, numerator, denominator, iterations, killsPerPlayer } = e.data;

    // Initialize the Wasm module memory (only once)
    if (!initialized) {
        await init();
        initialized = true;
    }

    try {
        let result;
        
        if (mode === 'fixed-kills') {
            // Scenario 2: Fixed kills per player
            result = simulate_fixed_kills(numerator, denominator, iterations, killsPerPlayer);
        } else {
            // Scenario 1: Simulate until drop
            result = simulate_drops_until_success(numerator, denominator, iterations);
        }

        // Extract data from result object
        const data = {
            min: result.min,
            max: result.max,
            avg: result.avg,
            totalCount: result.total_count,
            histogram: Array.from(result.histogram),
            histogramMaxKey: result.histogram_max_key
        };

        // Send back to main thread
        self.postMessage({ type: 'SUCCESS', data });
    } catch (err) {
        self.postMessage({ type: 'ERROR', error: err });
    }
};