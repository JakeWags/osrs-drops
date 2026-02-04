/**
 * Generates the Compute Shader dynamically based on the selected Bit Depth.
 * This allows us to switch between 4-bit, 8-bit, and 32-bit modes optimized for specific limits.
 */
function getShaderCode(bitDepth: number) {
    // 32-bit = 1 sim per int (No packing)
    // 8-bit  = 4 sims per int
    // 4-bit  = 8 sims per int
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

// Output: Packed results
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
fn main(@builtin(global_invocation_id) global_id: vec3<u32>, @builtin(local_invocation_index) local_index: u32, @builtin(workgroup_id) group_id: vec3<u32>) {
    // 1. Calculate Seed
    let index = global_id.x + (global_id.y * params.grid_width);
    var rng_state = params.seed + index; 
    let drop_rate = f32(params.numerator) / f32(params.denominator);

    // 2. Run Simulation
    var drop_count = 0u;
    for (var i = 0u; i < params.kills_per_player; i++) {
        if (rand(&rng_state) < drop_rate) {
            drop_count += 1u;
        }
    }
    
    // CLAMP to Max Value (${maxValue})
    if (drop_count > ${maxValue}u) { drop_count = ${maxValue}u; }

    local_results[local_index] = drop_count;
    workgroupBarrier();

    // 3. Pack Results
    // We pack ${simsPerInt} simulations into a single u32.
    // Only the first (64 / ${simsPerInt}) threads need to run this.
    if (local_index < ${64 / simsPerInt}u) {
        var packed_value = 0u;
        let start_offset = local_index * ${simsPerInt}u;

        for (var i = 0u; i < ${simsPerInt}u; i++) {
            let val = local_results[start_offset + i];
            // Shift logic depends on bit depth
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

export async function runWebGPUSimulation(
    numerator: number, 
    denominator: number, 
    killsPerPlayer: number, 
    iterations: number,
    bitDepth: number = 8 // Default to 8-bit (Max 255)
) {
    if (!navigator.gpu) throw new Error("WebGPU not supported");

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter!.requestDevice();

    // --- CONFIGURATION ---
    const WORKGROUP_SIZE = 64;
    const MAX_X_DISPATCH = 65535;
    
    // Calculate packing constants based on selection
    const SIMS_PER_INT = 32 / bitDepth;
    const MAX_VAL = Math.pow(2, bitDepth) - 1;
    const BIT_MASK = MAX_VAL;

    // --- DYNAMIC BATCH SIZING ---
    // We target a 100MB buffer to stay safely under the 128MB limit
    const TARGET_BUFFER_BYTES = 100 * 1024 * 1024; 
    
    // How many bytes does one simulation take? (e.g., 32-bit = 4 bytes, 8-bit = 1 byte)
    const BYTES_PER_SIM = 4 / SIMS_PER_INT;
    
    // Calculate safe batch size
    const MAX_BATCH_SIZE = Math.floor(TARGET_BUFFER_BYTES / BYTES_PER_SIM);

    // --- ACCUMULATORS ---
    let totalSum = 0;
    let globalMin = MAX_VAL;
    let globalMax = 0;
    const globalHistogram: number[] = [];

    let remainingIterations = iterations;

    // Generate shader code dynamically
    const shaderCode = getShaderCode(bitDepth);
    const shaderModule = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' },
    });

    while (remainingIterations > 0) {
        // Ensure batch size is a multiple of Workgroup (64) for clean packing
        let currentBatchSize = Math.min(remainingIterations, MAX_BATCH_SIZE);
        currentBatchSize = Math.ceil(currentBatchSize / WORKGROUP_SIZE) * WORKGROUP_SIZE;
        
        // Don't exceed remaining if we rounded up
        if (currentBatchSize > remainingIterations) currentBatchSize = remainingIterations;
        
        // Re-align to workgroup if it's the final odd chunk
        const alignedBatchSize = Math.ceil(currentBatchSize / WORKGROUP_SIZE) * WORKGROUP_SIZE;

        // 1. Buffer Size Calculation (Dynamic based on SIMS_PER_INT)
        const resultBufferSize = Math.ceil(alignedBatchSize / SIMS_PER_INT) * 4;
        
        const resultBuffer = device.createBuffer({
            size: resultBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        // 2. Dispatch
        const totalWorkgroups = Math.ceil(alignedBatchSize / WORKGROUP_SIZE);
        let dispatchX = totalWorkgroups;
        let dispatchY = 1;

        if (totalWorkgroups > MAX_X_DISPATCH) {
            dispatchX = MAX_X_DISPATCH;
            dispatchY = Math.ceil(totalWorkgroups / MAX_X_DISPATCH);
        }
        const gridWidth = dispatchX * WORKGROUP_SIZE;

        // 3. Params
        const paramBuffer = device.createBuffer({
            size: 32, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const params = new Uint32Array([
            numerator, 
            denominator, 
            killsPerPlayer, 
            Math.floor(Math.random() * 1000000), 
            gridWidth, 
            0, 0, 0
        ]);
        device.queue.writeBuffer(paramBuffer, 0, params);

        // 4. Bind & Run
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: resultBuffer } },
                { binding: 1, resource: { buffer: paramBuffer } },
            ],
        });

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.dispatchWorkgroups(dispatchX, dispatchY);
        passEncoder.end();

        // 5. Readback
        const gpuReadBuffer = device.createBuffer({
            size: resultBufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        commandEncoder.copyBufferToBuffer(resultBuffer, 0, gpuReadBuffer, 0, resultBufferSize);
        device.queue.submit([commandEncoder.finish()]);

        await gpuReadBuffer.mapAsync(GPUMapMode.READ);
        const arrayBuffer = gpuReadBuffer.getMappedRange();
        const packedData = new Uint32Array(arrayBuffer);

        // 6. Unpack & Aggregate (Dynamic Unpacking)
        let processedInBatch = 0;

        for (let i = 0; i < packedData.length; i++) {
            let intVal = packedData[i];
            
            // Loop step depends on bitDepth (4, 8, 32)
            for (let bit = 0; bit < 32; bit += bitDepth) {
                if (processedInBatch >= currentBatchSize) break;

                // Dynamic Mask
                const count = (intVal >> bit) & BIT_MASK;
                
                totalSum += count;
                if (count < globalMin) globalMin = count;
                if (count > globalMax) globalMax = count;
                
                if (globalHistogram[count] === undefined) globalHistogram[count] = 0;
                globalHistogram[count]++;
                
                processedInBatch++;
            }
        }
        
        gpuReadBuffer.unmap();
        resultBuffer.destroy();
        paramBuffer.destroy();
        gpuReadBuffer.destroy();

        remainingIterations -= currentBatchSize;
    }

    // Handle min edge case
    const finalMin = (globalMin === MAX_VAL && globalMax === 0) ? 0 : globalMin;

    for (let i = 0; i <= globalMax; i++) {
        if (globalHistogram[i] === undefined) globalHistogram[i] = 0;
    }
    
    return {
        min: finalMin,
        max: globalMax,
        avg: totalSum / iterations,
        totalCount: iterations,
        histogram: globalHistogram,
        histogramMaxKey: globalMax,
        hitLimit: globalMax === MAX_VAL
    };
}