use wasm_bindgen::prelude::*;
use rand::prelude::*;
use rand::distributions::Uniform;
use std::collections::HashMap;

#[wasm_bindgen]
pub struct SimulationResult {
    min: u32,
    max: u32,
    avg: f64,
    total_count: u32,
    #[wasm_bindgen(getter_with_clone)]
    pub histogram: Vec<u32>,  // histogram[i] = count of value i
    histogram_max_key: u32,
}

#[wasm_bindgen]
impl SimulationResult {
    #[wasm_bindgen(getter)]
    pub fn min(&self) -> u32 { self.min }
    
    #[wasm_bindgen(getter)]
    pub fn max(&self) -> u32 { self.max }
    
    #[wasm_bindgen(getter)]
    pub fn avg(&self) -> f64 { self.avg }
    
    #[wasm_bindgen(getter)]
    pub fn total_count(&self) -> u32 { self.total_count }
    
    #[wasm_bindgen(getter)]
    pub fn histogram_max_key(&self) -> u32 { self.histogram_max_key }
}

/// Scenario 1: Run N simulations, each simulation runs until getting ONE drop
/// Returns: Stats and histogram of kill counts
#[wasm_bindgen]
pub fn simulate_drops_until_success(numerator: u32, denominator: u32, num_simulations: u32) -> SimulationResult {
    let mut rng = SmallRng::from_entropy();
    let dist = Uniform::new(0, denominator);
    
    let mut min = u32::MAX;
    let mut max = 0u32;
    let mut sum = 0u64;
    let mut histogram_map: HashMap<u32, u32> = HashMap::new();
    
    for _ in 0..num_simulations {
        let mut kills_until_drop = 0;
        
        loop {
            kills_until_drop += 1;
            
            if rng.sample(dist) < numerator {
                // Update stats
                if kills_until_drop < min { min = kills_until_drop; }
                if kills_until_drop > max { max = kills_until_drop; }
                sum += kills_until_drop as u64;
                
                // Update histogram
                *histogram_map.entry(kills_until_drop).or_insert(0) += 1;
                break;
            }
        }
    }
    
    // Convert HashMap to Vec for histogram
    let histogram_max_key = max;
    let mut histogram = vec![0u32; (histogram_max_key + 1) as usize];
    for (key, count) in histogram_map {
        histogram[key as usize] = count;
    }
    
    SimulationResult {
        min,
        max,
        avg: sum as f64 / num_simulations as f64,
        total_count: num_simulations,
        histogram,
        histogram_max_key,
    }
}

/// Scenario 2: Run N players, each doing X kills
/// Returns: Stats and histogram of drop counts
#[wasm_bindgen]
pub fn simulate_fixed_kills(numerator: u32, denominator: u32, num_players: u32, kills_per_player: u32) -> SimulationResult {
    let mut rng = SmallRng::from_entropy();
    let dist = Uniform::new(0, denominator);
    
    let mut min = u32::MAX;
    let mut max = 0u32;
    let mut sum = 0u64;
    let mut histogram_map: HashMap<u32, u32> = HashMap::new();
    
    for _ in 0..num_players {
        let mut drops = 0;
        
        for _ in 0..kills_per_player {
            if rng.sample(dist) < numerator {
                drops += 1;
            }
        }
        
        // Update stats
        if drops < min { min = drops; }
        if drops > max { max = drops; }
        sum += drops as u64;
        
        // Update histogram
        *histogram_map.entry(drops).or_insert(0) += 1;
    }
    
    // Convert HashMap to Vec for histogram
    let histogram_max_key = max;
    let mut histogram = vec![0u32; (histogram_max_key + 1) as usize];
    for (key, count) in histogram_map {
        histogram[key as usize] = count;
    }
    
    SimulationResult {
        min,
        max,
        avg: sum as f64 / num_players as f64,
        total_count: num_players,
        histogram,
        histogram_max_key,
    }
}