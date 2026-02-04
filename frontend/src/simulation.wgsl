struct SimParams {
    numerator: u32,
    denominator: u32,
    kills_per_player: u32,
    seed: u32,
    grid_width: u32,
}

// Output: Each u32 contains 4 simulation results (8 bits each)
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
    
    // CLAMP to 255 (8 bits)
    // If a user gets > 255 drops, it caps here. 
    // This is extremely rare for normal drop rates.
    if (drop_count > 255u) { drop_count = 255u; }

    local_results[local_index] = drop_count;
    workgroupBarrier();

    // 3. Pack Results (First 16 threads pack 64 results)
    // 16 threads * 4 sims/thread = 64 sims
    if (local_index < 16u) {
        var packed_value = 0u;
        let start_offset = local_index * 4u;

        // Pack 4 results into one u32 (8 bits each)
        for (var i = 0u; i < 4u; i++) {
            let val = local_results[start_offset + i];
            // Shift by 8 bits (0, 8, 16, 24)
            packed_value = packed_value | (val << (i * 8u));
        }

        let groups_x = params.grid_width / 64u;
        let group_linear_index = group_id.y * groups_x + group_id.x;
        
        // Each workgroup produces 16 integers now
        let output_index = (group_linear_index * 16u) + local_index;
        
        if (output_index < arrayLength(&packed_results)) {
            packed_results[output_index] = packed_value;
        }
    }
}