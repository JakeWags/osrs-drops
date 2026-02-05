// --- PRODUCTION BITPACKING SIMULATION ---

/**
 * Auto-select optimal bit depth based on expected distribution
 */
function getOptimalBitDepth(
    numerator: number,
    denominator: number,
    killsPerPlayer: number
): number {
    const expectedMean = (numerator / denominator) * killsPerPlayer;
    const expectedStdDev = Math.sqrt(
        killsPerPlayer * (numerator / denominator) * (1 - numerator / denominator)
    );
    const maxExpected = Math.ceil(expectedMean + 6 * expectedStdDev); // 6 sigma coverage
    
    // Choose smallest bit depth that can handle expected max
    if (maxExpected <= 15) return 4;
    if (maxExpected <= 255) return 8;
    if (maxExpected <= 65535) return 16;
    return 32;
}

/**
 * Generate optimized bitpacking shader
 */
function getPackingShaderCode(bitDepth: number) {
    const simsPerInt = 32 / bitDepth;
    const maxValue = Math.pow(2, bitDepth) - 1;

    return `
struct SimParams {
    numerator: u32,
    denominator: u32,
    kills_per_player: u32,
    seed: u32,
    grid_width: u32,
}

@group(0) @binding(0) var<storage, read_write> packed_results: array<u32>;
@group(0) @binding(1) var<uniform> params: SimParams;

var<workgroup> local_results: array<u32, 64>;

fn rand(state: ptr<function, u32>) -> f32 {
    let old_state = *state;
    *state = old_state * 747796405u + 2891336453u;
    let word = ((*state >> ((*state >> 28u) + 4u)) ^ *state) * 277803737u;
    return f32((word >> 22u) ^ word) / 4294967296.0;
}

@compute @workgroup_size(64)
fn main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_index) local_index: u32,
    @builtin(workgroup_id) group_id: vec3<u32>
) {
    let index = global_id.x + (global_id.y * params.grid_width);
    var rng_state = params.seed + index; 
    let drop_rate = f32(params.numerator) / f32(params.denominator);

    var drop_count = 0u;
    for (var i = 0u; i < params.kills_per_player; i++) {
        if (rand(&rng_state) < drop_rate) {
            drop_count += 1u;
        }
    }
    
    // Clamp to max representable value
    if (drop_count > ${maxValue}u) { 
        drop_count = ${maxValue}u; 
    }

    local_results[local_index] = drop_count;
    workgroupBarrier();

    // Pack results
    if (local_index < ${64 / simsPerInt}u) {
        var packed_value = 0u;
        let start_offset = local_index * ${simsPerInt}u;

        for (var i = 0u; i < ${simsPerInt}u; i++) {
            let val = local_results[start_offset + i];
            packed_value = packed_value | (val << (i * ${bitDepth}u));
        }

        let groups_x = params.grid_width / 64u;
        let group_linear_index = group_id.y * groups_x + group_id.x;
        let output_index = (group_linear_index * ${64 / simsPerInt}u) + local_index;
        
        if (output_index < arrayLength(&packed_results)) {
            packed_results[output_index] = packed_value;
        }
    }
}
`;
}

/**
 * Unpack results and build histogram in parallel using Web Worker pattern
 */
function unpackAndBuildHistogram(
    packedData: Uint32Array,
    bitDepth: number,
    count: number
): { min: number; max: number; sum: number; histogram: number[] } {
    const BIT_MASK = Math.pow(2, bitDepth) - 1;
    
    let sum = 0;
    let min = BIT_MASK;
    let max = 0;
    const histogram: number[] = [];
    
    let processed = 0;
    for (let i = 0; i < packedData.length && processed < count; i++) {
        let val = packedData[i];
        for (let b = 0; b < 32; b += bitDepth) {
            if (processed >= count) break;
            
            const dropCount = (val >> b) & BIT_MASK;
            
            sum += dropCount;
            if (dropCount < min) min = dropCount;
            if (dropCount > max) max = dropCount;
            
            if (!histogram[dropCount]) histogram[dropCount] = 0;
            histogram[dropCount]++;
            
            processed++;
        }
    }
    
    // Fill gaps in histogram
    for (let i = 0; i <= max; i++) {
        if (histogram[i] === undefined) histogram[i] = 0;
    }
    
    return { min, max, sum, histogram };
}

// --- MAIN RUNNER ---

export interface SimulationProgress {
    completed: number;
    total: number;
    percentComplete: number;
    estimatedTimeRemaining: number;
}

export type ProgressCallback = (progress: SimulationProgress) => void;

export interface SimulationResult {
    min: number;
    max: number;
    avg: number;
    totalCount: number;
    histogram: number[];
    histogramMaxKey: number;
}

export async function runWebGPUSimulation(
    numerator: number, 
    denominator: number, 
    killsPerPlayer: number, 
    iterations: number,
    bitDepth?: number | 'auto',
    onProgress?: ProgressCallback
): Promise<SimulationResult> {
    if (!navigator.gpu) {
        throw new Error("WebGPU not supported in this browser");
    }
    
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error("Failed to get GPU adapter");
    }
    
    const device = await adapter.requestDevice();

    const WORKGROUP_SIZE = 64;
    const MAX_X_DISPATCH = 65535;

    // Auto-select bit depth if requested
    const selectedBitDepth = bitDepth === 'auto' || bitDepth === undefined
        ? getOptimalBitDepth(numerator, denominator, killsPerPlayer)
        : bitDepth;
    
    const SIMS_PER_INT = 32 / selectedBitDepth;
    const MAX_VAL = Math.pow(2, selectedBitDepth) - 1;
    
    console.log(`Using ${selectedBitDepth}-bit packing (${SIMS_PER_INT} sims per uint32)`);
    
    // Target 100MB per batch for optimal GPU utilization
    const BYTES_PER_SIM = 4 / SIMS_PER_INT;
    const MAX_BATCH_SIZE = Math.floor((100 * 1024 * 1024) / BYTES_PER_SIM);

    let totalSum = 0;
    let globalMin = MAX_VAL;
    let globalMax = 0;
    const globalHistogram: number[] = [];

    let remaining = iterations;
    let completed = 0;
    const startTime = performance.now();

    // Compile shader once
    const shaderCode = getPackingShaderCode(selectedBitDepth);
    const shaderModule = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' },
    });

    const paramBuffer = device.createBuffer({ 
        size: 32, 
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST 
    });

    // Process in batches
    while (remaining > 0) {
        // Calculate batch size (aligned to workgroup size)
        let currentBatch = Math.min(remaining, MAX_BATCH_SIZE);
        const alignedBatch = Math.ceil(currentBatch / WORKGROUP_SIZE) * WORKGROUP_SIZE;
        
        // Don't overshoot on final batch
        if (alignedBatch > remaining + WORKGROUP_SIZE) {
            currentBatch = remaining;
        }
        
        const bufferSize = Math.ceil(alignedBatch / SIMS_PER_INT) * 4;

        // Create result buffer for this batch
        const resultBuffer = device.createBuffer({ 
            size: bufferSize, 
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC 
        });
        
        // Calculate dispatch dimensions
        const totalWorkgroups = Math.ceil(alignedBatch / WORKGROUP_SIZE);
        let dX = totalWorkgroups;
        let dY = 1;
        
        if (totalWorkgroups > MAX_X_DISPATCH) {
            dX = MAX_X_DISPATCH;
            dY = Math.ceil(totalWorkgroups / MAX_X_DISPATCH);
        }

        // Update parameters
        const params = new Uint32Array([
            numerator, 
            denominator, 
            killsPerPlayer, 
            Math.floor(Math.random() * 1e9), // Random seed
            dX * WORKGROUP_SIZE,              // Grid width
            0, 0, 0                           // Padding
        ]);
        device.queue.writeBuffer(paramBuffer, 0, params);

        // Create bind group
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: resultBuffer } },
                { binding: 1, resource: { buffer: paramBuffer } },
            ],
        });

        // Dispatch compute
        const commandEncoder = device.createCommandEncoder();
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(dX, dY);
        pass.end();

        // Copy results to readable buffer
        const readBuffer = device.createBuffer({ 
            size: bufferSize, 
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ 
        });
        commandEncoder.copyBufferToBuffer(resultBuffer, 0, readBuffer, 0, bufferSize);
        device.queue.submit([commandEncoder.finish()]);

        // Wait for GPU and read results
        await readBuffer.mapAsync(GPUMapMode.READ);
        const packedData = new Uint32Array(readBuffer.getMappedRange());

        // Unpack and accumulate results (this is fast on CPU)
        const batchResults = unpackAndBuildHistogram(packedData, selectedBitDepth, currentBatch);
        
        totalSum += batchResults.sum;
        globalMin = Math.min(globalMin, batchResults.min);
        globalMax = Math.max(globalMax, batchResults.max);
        
        // Merge histograms
        for (let i = 0; i < batchResults.histogram.length; i++) {
            if (!globalHistogram[i]) globalHistogram[i] = 0;
            globalHistogram[i] += batchResults.histogram[i];
        }

        // Cleanup
        readBuffer.unmap();
        resultBuffer.destroy();
        readBuffer.destroy();
        
        // Update progress
        completed += currentBatch;
        remaining -= currentBatch;
        
        if (onProgress) {
            const elapsed = performance.now() - startTime;
            const rate = completed / elapsed; // sims per ms
            const estimatedTimeRemaining = remaining / rate;
            
            onProgress({
                completed,
                total: iterations,
                percentComplete: (completed / iterations) * 100,
                estimatedTimeRemaining
            });
        }
    }
    
    // Final histogram cleanup
    const finalMin = (globalMin === MAX_VAL && globalMax === 0) ? 0 : globalMin;
    for (let i = 0; i <= globalMax; i++) {
        if (globalHistogram[i] === undefined) {
            globalHistogram[i] = 0;
        }
    }

    return { 
        min: finalMin, 
        max: globalMax, 
        avg: totalSum / iterations, 
        totalCount: iterations, 
        histogram: globalHistogram, 
        histogramMaxKey: globalMax 
    };
}