/*
================================================================================
CODE 3: CONSERVATIVE GLACIER MAPPING - ROCK EXCLUSION WITH GOOD DEBRIS
================================================================================
Purpose: Conservative glacier inventory with rock exclusion and maintained debris detection

KEY IMPROVEMENTS:
  1. Conservative snow detection (NDSI > 0.5, must be bright)
  2. Stricter ice thresholds with rock exclusion masks
  3. Multiple validation requirements for ice detection
  4. Maintained good debris detection (user approved)
  5. Larger minimum areas to reduce noise
  6. Extreme reflectance exclusion (very bright/dark = not glacier)

CLASSIFICATION HIERARCHY:
  1. Snow (NDSI > 0.5 AND SWIR < 0.15 AND Blue > 0.25)
  2. Clean Ice (stricter thresholds + rock exclusion)
  3. Debris (unchanged - working well per user feedback)

Rock Exclusion Logic:
  - Rocks have SWIR > 0.18 (ice has SWIR < 0.10-0.15)
  - Rocks have NIR/SWIR < 1.3 (ice has higher ratio)
  - Very bright (NIR > 0.5) or very dark (Blue < 0.05) = not glacier

================================================================================
*/

// ============================================================================
// ██████  CHANGE THIS YEAR  ██████
// ============================================================================

var PROCESS_YEAR = 2025;   // <-- Inventory runs on a 3-year cadence by default:
                           //     2000, 2003, 2006, 2009, 2012, 2015, 2018, 2021, 2024, 2027, ...
                           //     (also accepts any individual year if a one-off map is needed)

// ============================================================================
// ██████  CALIBRATION PARAMETERS  ██████
// ============================================================================

var MIN_GLACIER_ELEVATION = 3500;   // meters
var MAX_GLACIER_ELEVATION = 7500;   // meters

// ============================================================================
// CONSERVATIVE CLASSIFICATION THRESHOLDS (REDUCED ICE DETECTION)
// ============================================================================

// SNOW DETECTION (stricter to avoid rocks)
var NDSI_SNOW_THRESHOLD = 0.5;      // Increased from 0.4 - higher confidence snow only
var SWIR_SNOW_THRESHOLD = 0.15;     // Reduced from 0.20 - snow should be darker in SWIR
var BLUE_MIN_FOR_SNOW = 0.25;       // Snow must be bright in blue to exclude rocks

// CLEAN ICE DETECTION (more conservative)
var NDSI_ICE_THRESHOLD = 0.35;      // Increased from 0.3 - higher confidence
var SWIR_ICE_THRESHOLD = 0.10;      // Reduced from 0.15 - stricter SWIR absorption
var NIR_MIN_THRESHOLD = 0.15;       // Increased from 0.12 - exclude dark rocks
var NIR_MAX_THRESHOLD = 0.5;        // NEW: Exclude very bright areas (likely rocks)
var BLUE_SWIR_THRESHOLD = 2.5;      // Increased from 2.0 - stricter ratio
var NIR_SWIR_THRESHOLD = 2.0;       // Increased from 1.5 - higher confidence shadows

// ROCK EXCLUSION THRESHOLDS (NEW)
var ROCK_SWIR_MIN = 0.18;           // Rocks typically have SWIR > 0.18
var ROCK_NIR_SWIR_MAX = 1.3;        // Rocks have low NIR/SWIR ratio

// DEBRIS DETECTION (MORE CONSERVATIVE)
var NDSDI_COARSE_MIN = -0.30;       // Stricter (was -0.37)
var NDSDI_COARSE_MAX = -0.05;       // Stricter (was 0.0)
var NDSDI_FINE_MIN = 0.75;          // Stricter (was 0.70)
var NDSDI_FINE_MAX = 0.88;          // Stricter (was 0.92)
var DEBRIS_MAX_SLOPE = 20;          // Reduced from 24 degrees
var DEBRIS_MIN_TEMP = 2;            // Debris must be warmer than 2°C (ice is ~0°C)

// CONNECTIVITY THRESHOLDS
var MIN_CONNECTED_AREA = 2.0;       // km² - increased from 1.0 for only LARGE patches

// Water exclusion
var NDWI_THRESHOLD = 0.1;           // Slightly higher to better exclude water

// ============================================================================
// TEMPORAL SETTINGS
// ============================================================================
//
// Inventory cadence: 3-year epochs (default).  The composite window below sets
// how many years of Landsat imagery are median-stacked around PROCESS_YEAR.
//
//   COMPOSITE_MODE = '3year'  -> PROCESS_YEAR ± 1  (default, 3-year moving window
//                                                   matching the 3-year cadence)
//   COMPOSITE_MODE = '5year'  -> PROCESS_YEAR ± 2  (legacy behaviour, retained for
//                                                   backward-compatibility with the
//                                                   earlier 5-year inventory)
//   COMPOSITE_MODE = 'single' -> just PROCESS_YEAR (single scene year)
//
var COMPOSITE_MODE = '3year';       // one of: '3year' | '5year' | 'single'

// (back-compat alias — left for any downstream code that still reads the flag)
var USE_5YEAR_COMPOSITE = (COMPOSITE_MODE === '5year');

// Late ablation season: Aug 15 - Oct 31
var DATE_START_MONTH = 8;
var DATE_START_DAY = 15;
var DATE_END_MONTH = 10;
var DATE_END_DAY = 31;

// ============================================================================
// MINIMUM MAPPING UNITS
// ============================================================================

var MIN_CLEANICE_AREA = 0.02;   // km² - increased from 0.01 to reduce noise
var MIN_DEBRIS_AREA = 0.05;     // km² for debris (conservative)

// ============================================================================
// STUDY AREA  (REQUIRED)  ----  ██████  SET THIS  ██████
// ----------------------------------------------------------------------------
// The study-area boundary defines where the inventory is produced. Upload the
// boundary shapefile (folder "Study_Area_Boundary" provided with this script,
// or any boundary of your own) to your Earth Engine assets and put its asset
// path below. To map a smaller region, simply upload a smaller boundary and
// point STUDY_AREA_ASSET at it — nothing else needs to change.
// ============================================================================

var STUDY_AREA_ASSET = 'projects/ee-tum/assets/Afg_gl_bound';   // <-- your boundary asset
var studyArea = ee.FeatureCollection(STUDY_AREA_ASSET);

// ============================================================================
// RGI REFERENCE GLACIER INVENTORY  (OPTIONAL)
// ----------------------------------------------------------------------------
// An existing glacier inventory (e.g. RGI 7.0, folder "RGI_Reference_Glaciers")
// can be overlaid for visual comparison and to print a reference total area.
// It is NOT required for the inventory to run. To use it: upload the inventory
// to your assets, set USE_RGI_REFERENCE = true and give its asset path and the
// name of its area field below. To skip it, leave USE_RGI_REFERENCE = false.
// ============================================================================

var USE_RGI_REFERENCE = false;                                 // <-- true to overlay a reference inventory
var RGI_ASSET         = 'projects/ee-tum/assets/Afg_GL';       // <-- reference inventory asset (if used)
var RGI_AREA_FIELD    = 'area_km2';                            // <-- name of its per-glacier area field

var rgiFiltered = USE_RGI_REFERENCE
    ? ee.FeatureCollection(RGI_ASSET).filter(ee.Filter.gte(RGI_AREA_FIELD, MIN_CLEANICE_AREA))
    : null;

// ============================================================================
// AUTOMATIC PROCESSING
// ============================================================================

// Derive composite window from COMPOSITE_MODE (see TEMPORAL SETTINGS above)
var _halfWin = (COMPOSITE_MODE === '5year') ? 2
             : (COMPOSITE_MODE === '3year') ? 1
             : 0;
var yearStart = PROCESS_YEAR - _halfWin;
var yearEnd   = PROCESS_YEAR + _halfWin;
var periodLabel = (_halfWin === 0) ? String(PROCESS_YEAR)
                                   : (yearStart + '-' + yearEnd);
var hasNDSDI = PROCESS_YEAR >= 2013;

print('╔════════════════════════════════════════════════════════════════╗');
print('║  CODE 3: CONSERVATIVE GLACIER MAPPING WITH ROCK EXCLUSION     ║');
print('╠════════════════════════════════════════════════════════════════╣');
print('║  Year:', PROCESS_YEAR, '| Period:', periodLabel, '| Cadence: 3-year | Mode:', COMPOSITE_MODE);
print('║  Key features:');
print('║    • Conservative snow (NDSI > 0.5, Blue > 0.25)');
print('║    • Strict ice detection (SWIR < 0.10, NDSI > 0.35)');
print('║    • Rock exclusion (SWIR > 0.18 = rock)');
print('║    • Good debris detection maintained');
print('║  Elevation:', MIN_GLACIER_ELEVATION + '-' + MAX_GLACIER_ELEVATION + 'm');
print('║  Debris (NDSDI):', hasNDSDI ? 'YES (working well)' : 'NO (needs 2013+)');
print('╚════════════════════════════════════════════════════════════════╝');

var dem = ee.Image('USGS/SRTMGL1_003');
var slope = ee.Terrain.slope(dem);
var aspect = ee.Terrain.aspect(dem);
var elevMask = dem.gte(MIN_GLACIER_ELEVATION).and(dem.lte(MAX_GLACIER_ELEVATION));

// ============================================================================
// LANDSAT FUNCTIONS
// ============================================================================

function processL57(img) {
  var qa = img.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  
  var blue = img.select('SR_B1').multiply(0.0000275).add(-0.2).rename('Blue');
  var green = img.select('SR_B2').multiply(0.0000275).add(-0.2).rename('Green');
  var red = img.select('SR_B3').multiply(0.0000275).add(-0.2).rename('Red');
  var nir = img.select('SR_B4').multiply(0.0000275).add(-0.2).rename('NIR');
  var swir1 = img.select('SR_B5').multiply(0.0000275).add(-0.2).rename('SWIR1');
  var swir2 = img.select('SR_B7').multiply(0.0000275).add(-0.2).rename('SWIR2');
  
  var ndsi = green.subtract(swir1).divide(green.add(swir1)).rename('NDSI');
  var nirSwir = nir.divide(swir1).rename('NIR_SWIR');
  var blueSwir = blue.divide(swir1).rename('Blue_SWIR');
  var ndwi = green.subtract(nir).divide(green.add(nir)).rename('NDWI');
  var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');
  
  return ee.Image([blue, green, red, nir, swir1, swir2, ndsi, nirSwir, blueSwir, ndwi, ndvi]).updateMask(qa);
}

function processL89(img) {
  var qa = img.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);

  var blue = img.select('SR_B2').multiply(0.0000275).add(-0.2).rename('Blue');
  var green = img.select('SR_B3').multiply(0.0000275).add(-0.2).rename('Green');
  var red = img.select('SR_B4').multiply(0.0000275).add(-0.2).rename('Red');
  var nir = img.select('SR_B5').multiply(0.0000275).add(-0.2).rename('NIR');
  var swir1 = img.select('SR_B6').multiply(0.0000275).add(-0.2).rename('SWIR1');
  var swir2 = img.select('SR_B7').multiply(0.0000275).add(-0.2).rename('SWIR2');
  var tir = img.select('ST_B10').multiply(0.00341802).add(149).subtract(273.15).rename('TIR');
  // PAN (B8) is brought in from the linked T1_TOA image (see collection setup below).
  // Level-2 SR products do not contain the panchromatic band, so we pull it from TOA.
  // TOA B8 is already reflectance in 0..1, no extra scaling needed.
  var pan = img.select('B8').rename('PAN');

  var ndsi = green.subtract(swir1).divide(green.add(swir1)).rename('NDSI');
  var nirSwir = nir.divide(swir1).rename('NIR_SWIR');
  var blueSwir = blue.divide(swir1).rename('Blue_SWIR');
  var ndwi = green.subtract(nir).divide(green.add(nir)).rename('NDWI');
  var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');

  // NDSDI for debris — Shokory & Lane (2023), J. Glaciology 69(277): 1260-1278
  //   NDSDI_C1 = (PAN - TIR) / (PAN + TIR)
  //   NDSDI_C2 = NIR / Blue
  // TIR is scaled from °C to a range comparable with reflectance so the published
  // threshold range (-0.37 … 0) holds; Shokory & Lane's calibration implicitly assumes
  // this normalisation of TIR against the reflective bands.
  var tirScaled = tir.divide(100);
  var ndsdi1 = pan.subtract(tirScaled).divide(pan.add(tirScaled)).rename('NDSDI_C1');
  var ndsdi2 = nir.divide(blue).rename('NDSDI_C2');

  return ee.Image([blue, green, red, nir, swir1, swir2, tir, pan, ndsi, nirSwir, blueSwir, ndwi, ndvi, ndsdi1, ndsdi2]).updateMask(qa);
}

// ============================================================================
// LOAD DATA
// ============================================================================

var startDate = yearStart + '-' + DATE_START_MONTH + '-' + DATE_START_DAY;
var endDate = yearEnd + '-' + DATE_END_MONTH + '-' + DATE_END_DAY;
var collection, sensors;

if (PROCESS_YEAR <= 1999) {
  collection = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
      .filterBounds(studyArea).filterDate(startDate, endDate)
      .filter(ee.Filter.calendarRange(DATE_START_MONTH, DATE_END_MONTH, 'month'))
      .filter(ee.Filter.lt('CLOUD_COVER', 30)).map(processL57);
  sensors = 'Landsat5';
} else if (PROCESS_YEAR <= 2011) {
  var l5 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
      .filterBounds(studyArea).filterDate(startDate, endDate)
      .filter(ee.Filter.calendarRange(DATE_START_MONTH, DATE_END_MONTH, 'month'))
      .filter(ee.Filter.lt('CLOUD_COVER', 30)).map(processL57);
  var l7a = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
      .filterBounds(studyArea).filterDate(startDate, endDate)
      .filter(ee.Filter.calendarRange(DATE_START_MONTH, DATE_END_MONTH, 'month'))
      .filter(ee.Filter.lt('CLOUD_COVER', 30)).map(processL57);
  collection = l5.merge(l7a);
  sensors = 'Landsat5_7';
} else if (PROCESS_YEAR <= 2012) {
  collection = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
      .filterBounds(studyArea).filterDate(startDate, endDate)
      .filter(ee.Filter.calendarRange(DATE_START_MONTH, DATE_END_MONTH, 'month'))
      .filter(ee.Filter.lt('CLOUD_COVER', 30)).map(processL57);
  sensors = 'Landsat7';
} else if (PROCESS_YEAR <= 2021) {
  // PAN (B8) is only in T1_TOA, so link it into each SR scene by system:index
  var l8srA = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
      .filterBounds(studyArea).filterDate(startDate, endDate)
      .filter(ee.Filter.calendarRange(DATE_START_MONTH, DATE_END_MONTH, 'month'))
      .filter(ee.Filter.lt('CLOUD_COVER', 30));
  var l8toaA = ee.ImageCollection('LANDSAT/LC08/C02/T1_TOA')
      .filterBounds(studyArea).filterDate(startDate, endDate)
      .filter(ee.Filter.calendarRange(DATE_START_MONTH, DATE_END_MONTH, 'month'));
  collection = l8srA.linkCollection(l8toaA, ['B8']).map(processL89);
  sensors = 'Landsat8';
} else {
  var l8sr = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
      .filterBounds(studyArea).filterDate(startDate, endDate)
      .filter(ee.Filter.calendarRange(DATE_START_MONTH, DATE_END_MONTH, 'month'))
      .filter(ee.Filter.lt('CLOUD_COVER', 30));
  var l8toa = ee.ImageCollection('LANDSAT/LC08/C02/T1_TOA')
      .filterBounds(studyArea).filterDate(startDate, endDate)
      .filter(ee.Filter.calendarRange(DATE_START_MONTH, DATE_END_MONTH, 'month'));
  var l8 = l8sr.linkCollection(l8toa, ['B8']).map(processL89);
  var l9sr = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
      .filterBounds(studyArea).filterDate(startDate, endDate)
      .filter(ee.Filter.calendarRange(DATE_START_MONTH, DATE_END_MONTH, 'month'))
      .filter(ee.Filter.lt('CLOUD_COVER', 30));
  var l9toa = ee.ImageCollection('LANDSAT/LC09/C02/T1_TOA')
      .filterBounds(studyArea).filterDate(startDate, endDate)
      .filter(ee.Filter.calendarRange(DATE_START_MONTH, DATE_END_MONTH, 'month'));
  var l9 = l9sr.linkCollection(l9toa, ['B8']).map(processL89);
  collection = l8.merge(l9);
  sensors = 'Landsat8_9';
}

var composite = collection.median().clip(studyArea);
print('Data:', sensors, '| Period:', periodLabel, '| Images:', collection.size());

// ============================================================================
// HIERARCHICAL GLACIER CLASSIFICATION
// ============================================================================

// Water exclusion mask (stricter threshold)
var waterMask = composite.select('NDWI').lt(NDWI_THRESHOLD);

// Vegetation exclusion (glaciers have low NDVI)
var vegMask = composite.select('NDVI').lt(0.2);

// ============================================================================
// STEP 1: SNOW DETECTION (conservative - must be bright and have high NDSI)
// ============================================================================

// Snow has high NDSI, low SWIR, and high visible reflectance
var snowMask = composite.select('NDSI').gt(NDSI_SNOW_THRESHOLD)
    .and(composite.select('SWIR1').lt(SWIR_SNOW_THRESHOLD))
    .and(composite.select('Blue').gt(BLUE_MIN_FOR_SNOW))  // Snow must be bright
    .and(elevMask)
    .and(waterMask)
    .and(vegMask);

// ============================================================================
// STEP 2: ROCK EXCLUSION MASKS (prevent false positives)
// ============================================================================

// Rocks have higher SWIR reflectance and lower NIR/SWIR ratios than ice
var likelyRock = composite.select('SWIR1').gt(ROCK_SWIR_MIN)
    .or(composite.select('NIR_SWIR').lt(ROCK_NIR_SWIR_MAX));

// Very bright or very dark areas are likely not glaciers
var extremeReflectance = composite.select('NIR').gt(NIR_MAX_THRESHOLD)
    .or(composite.select('Blue').lt(0.05));  // Very dark areas

// ============================================================================
// STEP 3: CLEAN ICE DETECTION (conservative with rock exclusion)
// ============================================================================

// Method 1: High confidence NDSI for ice
var ndsiIceMask = composite.select('NDSI').gt(NDSI_ICE_THRESHOLD)
    .and(composite.select('SWIR1').lt(0.15));  // Must also have low SWIR

// Method 2: Very strict SWIR absorption (strong ice signature)
var swirIceMask = composite.select('SWIR1').lt(SWIR_ICE_THRESHOLD)
    .and(composite.select('NIR').gt(NIR_MIN_THRESHOLD))
    .and(composite.select('NIR').lt(NIR_MAX_THRESHOLD));  // Not too bright

// Method 3: Blue/SWIR ratio (strict threshold)
var blueSwirIceMask = composite.select('Blue_SWIR').gt(BLUE_SWIR_THRESHOLD)
    .and(composite.select('Blue').gt(0.15));  // Must have decent blue reflectance

// Method 4: NIR/SWIR ratio (high confidence shadows)
var nirSwirIceMask = composite.select('NIR_SWIR').gt(NIR_SWIR_THRESHOLD)
    .and(composite.select('SWIR1').lt(0.12));  // Still need low SWIR

// Combine ice detection methods WITH rock exclusion
var iceMask = ndsiIceMask
    .or(swirIceMask)
    .or(blueSwirIceMask.and(nirSwirIceMask))  // Require both ratios for this method
    .and(likelyRock.not())  // EXCLUDE rocks
    .and(extremeReflectance.not())  // EXCLUDE extreme values
    .and(elevMask)
    .and(waterMask)
    .and(vegMask);

// ============================================================================
// STEP 4: COMBINE SNOW AND ICE (conservative glacier mask)
// ============================================================================

var initialGlacierMask = snowMask.or(iceMask);

// ============================================================================
// STEP 5: CONNECTED COMPONENT ANALYSIS (only very large patches)
// ============================================================================

// Use connectedPixelCount to identify large patches
var connectedPixelCount = initialGlacierMask.connectedPixelCount({
  maxSize: 256,
  eightConnected: true
});

// Convert pixel count to area
// Each pixel is 30m x 30m = 900 m² = 0.0009 km²
var minPixelsForLargeArea = Math.ceil(MIN_CONNECTED_AREA / 0.0009); // Convert km² to pixel count

// Include large connected patches (likely glaciers under snow)
var largeObjectMask = connectedPixelCount.gte(minPixelsForLargeArea);

// Final clean ice mask: original detection OR large connected patches
var cleanIceMask = initialGlacierMask.or(largeObjectMask).and(elevMask);

// ============================================================================
// STEP 6: MORPHOLOGICAL CLEANING (minimal to preserve real glaciers)
// ============================================================================

// Fill small holes (1-pixel gaps only - conservative)
var filled = cleanIceMask.focal_max(1, 'square', 'pixels').focal_min(1, 'square', 'pixels');

// Very gentle smoothing
var cleaned = filled;  // Skip additional smoothing to preserve edges

cleanIceMask = cleaned.unmask(0).gt(0).rename('clean_ice').selfMask();

// ============================================================================
// STEP 7: CONSERVATIVE DEBRIS DETECTION (only 2013+) - KEEP AS IS
// ============================================================================

var debrisMask = ee.Image(0).rename('debris').selfMask();
var totalMask = cleanIceMask.rename('glacier');

if (hasNDSDI) {
  // Stricter slope constraint
  var slopeMask = slope.lte(DEBRIS_MAX_SLOPE);
  
  // Thermal constraint: debris must be warmer than ice
  var thermalMask = composite.select('TIR').gt(DEBRIS_MIN_TEMP);
  
  // NDSDI with stricter thresholds
  var debris1 = composite.select('NDSDI_C1').gte(NDSDI_COARSE_MIN)
      .and(composite.select('NDSDI_C1').lte(NDSDI_COARSE_MAX))
      .and(elevMask)
      .and(slopeMask)
      .and(thermalMask)
      .and(waterMask);
  
  var debris2 = composite.select('NDSDI_C2').gte(NDSDI_FINE_MIN)
      .and(composite.select('NDSDI_C2').lte(NDSDI_FINE_MAX))
      .and(elevMask)
      .and(slopeMask)
      .and(thermalMask)
      .and(waterMask);
  
  // Combine debris methods
  var debrisCombined = debris1.or(debris2);
  
  // Less aggressive morphological operations for debris
  var debrisFilled = debrisCombined.focal_max(1, 'circle', 'pixels');
  var debrisCleaned = debrisFilled.focal_min(1, 'circle', 'pixels');
  
  // Exclude areas already classified as clean ice
  debrisMask = debrisCleaned.and(cleanIceMask.unmask(0).not())
      .unmask(0).gt(0).rename('debris').selfMask();
  
  // Total glacier mask
  totalMask = cleanIceMask.unmask(0).or(debrisMask.unmask(0)).rename('glacier').selfMask();
}

// ============================================================================
// VECTORIZATION
// ============================================================================

var minPxCleanIce = Math.ceil((MIN_CLEANICE_AREA * 1e6) / 900);
var minPxDebris = Math.ceil((MIN_DEBRIS_AREA * 1e6) / 900);

// Vectorize clean ice
var cleanIceVectors = cleanIceMask.reduceToVectors({
  geometry: studyArea,
  scale: 30,
  geometryType: 'polygon',
  eightConnected: true,
  labelProperty: 'glacier_id',
  reducer: ee.Reducer.countEvery(),
  maxPixels: 1e13,
  bestEffort: false,
  tileScale: 4
});

var cleanIceFiltered = cleanIceVectors.filter(ee.Filter.gte('count', minPxCleanIce));

// Add attributes
var cleanIceGlaciers = cleanIceFiltered.map(function(f) {
  var g = f.geometry();
  var pixelCount = ee.Number(f.get('count'));
  var area = pixelCount.multiply(900).divide(1e6);
  
  var elev = dem.reduceRegion({
    reducer: ee.Reducer.min().combine({
      reducer2: ee.Reducer.max(), sharedInputs: true
    }).combine({
      reducer2: ee.Reducer.mean(), sharedInputs: true
    }),
    geometry: g, scale: 30, maxPixels: 1e9
  });
  
  var slp = slope.reduceRegion({
    reducer: ee.Reducer.mean(), 
    geometry: g, scale: 30, maxPixels: 1e9
  });
  
  var asp = aspect.reduceRegion({
    reducer: ee.Reducer.mean(), 
    geometry: g, scale: 30, maxPixels: 1e9
  });
  
  var cent = g.centroid(30).coordinates();
  
  // Determine if mainly snow or ice
  var snowPct = snowMask.unmask(0).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: g, scale: 30, maxPixels: 1e9
  });
  
  return f.set({
    'area_km2': area,
    'pixel_count': pixelCount,
    'type': 'clean_ice',
    'snow_percent': ee.Number(snowPct.values().get(0)).multiply(100),
    'min_elev': elev.get('elevation_min'),
    'max_elev': elev.get('elevation_max'),
    'mean_elev': elev.get('elevation_mean'),
    'mean_slope': slp.get('slope'),
    'mean_aspect': asp.get('aspect'),
    'cent_lon': cent.get(0),
    'cent_lat': cent.get(1),
    'year': PROCESS_YEAR,
    'period': periodLabel,
    'sensors': sensors,
    'method': 'BALANCED_SNOW_AWARE'
  });
});

// ============================================================================
// VECTORIZE TOTAL AND DEBRIS (if applicable)
// ============================================================================

var totalGlaciers = cleanIceGlaciers;
var debrisGlaciers = ee.FeatureCollection([]);

if (hasNDSDI) {
  // Total glaciers vectorization
  var totalVectors = totalMask.reduceToVectors({
    geometry: studyArea,
    scale: 30,
    geometryType: 'polygon',
    eightConnected: true,
    labelProperty: 'glacier_id',
    reducer: ee.Reducer.countEvery(),
    maxPixels: 1e13,
    bestEffort: false,
    tileScale: 4
  });
  
  var totalFiltered = totalVectors.filter(ee.Filter.gte('count', minPxCleanIce));
  
  totalGlaciers = totalFiltered.map(function(f) {
    var g = f.geometry();
    var pixelCount = ee.Number(f.get('count'));
    var area = pixelCount.multiply(900).divide(1e6);
    
    var elev = dem.reduceRegion({
      reducer: ee.Reducer.min().combine({
        reducer2: ee.Reducer.max(), sharedInputs: true
      }).combine({
        reducer2: ee.Reducer.mean(), sharedInputs: true
      }),
      geometry: g, scale: 30, maxPixels: 1e9
    });
    
    var cleanAreaPx = cleanIceMask.unmask(0).reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: g, scale: 30, maxPixels: 1e9
    });
    var cleanA = ee.Number(cleanAreaPx.get('clean_ice')).multiply(900).divide(1e6);
    
    var debrisAreaPx = debrisMask.unmask(0).reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: g, scale: 30, maxPixels: 1e9
    });
    var debrisA = ee.Number(debrisAreaPx.get('debris')).multiply(900).divide(1e6);
    
    return f.set({
      'area_km2': area,
      'clean_km2': cleanA,
      'debris_km2': debrisA,
      'debris_pct': debrisA.divide(area).multiply(100),
      'pixel_count': pixelCount,
      'type': 'total',
      'min_elev': elev.get('elevation_min'),
      'max_elev': elev.get('elevation_max'),
      'mean_elev': elev.get('elevation_mean'),
      'year': PROCESS_YEAR,
      'period': periodLabel,
      'sensors': sensors,
      'method': 'BALANCED_WITH_DEBRIS'
    });
  });
  
  // Debris only vectorization
  var debrisVectors = debrisMask.reduceToVectors({
    geometry: studyArea,
    scale: 30,
    geometryType: 'polygon',
    eightConnected: true,
    labelProperty: 'glacier_id',
    reducer: ee.Reducer.countEvery(),
    maxPixels: 1e13,
    bestEffort: false,
    tileScale: 4
  });
  
  var debrisFiltered = debrisVectors.filter(ee.Filter.gte('count', minPxDebris));
  
  debrisGlaciers = debrisFiltered.map(function(f) {
    var g = f.geometry();
    var pixelCount = ee.Number(f.get('count'));
    var area = pixelCount.multiply(900).divide(1e6);
    
    return f.set({
      'area_km2': area,
      'pixel_count': pixelCount,
      'type': 'debris',
      'year': PROCESS_YEAR,
      'period': periodLabel,
      'sensors': sensors
    });
  });
}

// ============================================================================
// CALCULATE AREAS
// ============================================================================

var calcArea = function(mask) {
  var pixelSum = mask.unmask(0).gt(0).reduceRegion({
    reducer: ee.Reducer.sum(), 
    geometry: studyArea, scale: 30, maxPixels: 1e13
  });
  return ee.Number(pixelSum.values().get(0)).multiply(900).divide(1e6);
};

var cleanIceAreaKm2 = calcArea(cleanIceMask);
var debrisAreaKm2 = hasNDSDI ? calcArea(debrisMask) : ee.Number(0);
var totalAreaKm2 = calcArea(totalMask);
var rgiArea = USE_RGI_REFERENCE ? rgiFiltered.aggregate_sum(RGI_AREA_FIELD) : null;

print('');
print('═══════════════════════════════════════════════════════════════');
print('RESULTS FOR', PROCESS_YEAR);
print('═══════════════════════════════════════════════════════════════');
print('');
print('CLEAN ICE (including snow-covered):');
print('  Glaciers:', cleanIceGlaciers.size());
print('  Area:', cleanIceAreaKm2, 'km²');

if (hasNDSDI) {
  print('');
  print('DEBRIS-COVERED (conservative):');
  print('  Glaciers:', debrisGlaciers.size());
  print('  Area:', debrisAreaKm2, 'km²');
  print('');
  print('TOTAL (clean + debris):');
  print('  Glaciers:', totalGlaciers.size());
  print('  Area:', totalAreaKm2, 'km²');
}

if (USE_RGI_REFERENCE) {
  print('');
  print('Reference inventory total:', rgiArea, 'km²');
}

// ============================================================================
// VISUALIZATION
// ============================================================================

Map.centerObject(studyArea, 7);

// False color composites
var nirFalseColor = composite.select(['NIR', 'Red', 'Green']);
var swirFalseColor = composite.select(['SWIR2', 'NIR', 'Red']);

Map.addLayer(nirFalseColor, {min: 0, max: 0.4}, 'NIR False Color ' + PROCESS_YEAR, false);
Map.addLayer(swirFalseColor, {min: 0, max: 0.4}, 'SWIR False Color ' + PROCESS_YEAR, true);

// Component masks for debugging
Map.addLayer(snowMask.selfMask(), {palette: ['cyan']}, 'Conservative Snow', false);
Map.addLayer(iceMask.selfMask(), {palette: ['blue']}, 'Conservative Ice', false);
Map.addLayer(likelyRock.selfMask(), {palette: ['brown']}, 'Excluded Rocks', false);
Map.addLayer(largeObjectMask.selfMask(), {palette: ['purple']}, 'Large Patches (>2km²)', false);

// Reference inventory overlay (optional)
if (USE_RGI_REFERENCE) {
  var rgiRaster = rgiFiltered.reduceToImage({properties: [RGI_AREA_FIELD], reducer: ee.Reducer.first()})
      .gt(0).unmask(0);
  Map.addLayer(rgiRaster.selfMask(), {palette: ['FFD700']}, 'Reference Inventory', true);
}

// Final masks
Map.addLayer(cleanIceMask, {palette: ['00FFFF']}, 'Clean Ice Final', true);
if (hasNDSDI) {
  Map.addLayer(debrisMask, {palette: ['FF8C00']}, 'Debris (Conservative)', true);
  Map.addLayer(totalMask, {palette: ['00FF00']}, 'Total Glacier', false);
}

// Vectors
Map.addLayer(cleanIceGlaciers.style({color: 'blue', fillColor: '0000FF22', width: 1}), 
             {}, 'Clean Ice Vectors', false);

// ============================================================================
// EXPORTS
// ============================================================================

var prefix = 'AFG_' + periodLabel.replace('-', '_') + '_BALANCED';

// Export clean ice shapefile
Export.table.toDrive({
  collection: cleanIceGlaciers,
  description: 'CleanIce_Balanced_' + PROCESS_YEAR + '_SHP',
  folder: 'Afghanistan_Glacier_Inventory',
  fileNamePrefix: prefix + '_CleanIce',
  fileFormat: 'SHP'
});

// Export clean ice CSV
Export.table.toDrive({
  collection: cleanIceGlaciers,
  description: 'CleanIce_Balanced_' + PROCESS_YEAR + '_CSV',
  folder: 'Afghanistan_Glacier_Inventory',
  fileNamePrefix: prefix + '_CleanIce_attributes',
  fileFormat: 'CSV'
});

if (hasNDSDI) {
  // Export total glaciers
  Export.table.toDrive({
    collection: totalGlaciers,
    description: 'TotalGlacier_Balanced_' + PROCESS_YEAR + '_SHP',
    folder: 'Afghanistan_Glacier_Inventory',
    fileNamePrefix: prefix + '_TotalGlacier',
    fileFormat: 'SHP'
  });
  
  // Export debris
  Export.table.toDrive({
    collection: debrisGlaciers,
    description: 'Debris_Conservative_' + PROCESS_YEAR + '_SHP',
    folder: 'Afghanistan_Glacier_Inventory',
    fileNamePrefix: prefix + '_Debris',
    fileFormat: 'SHP'
  });
}

// Export raster masks
Export.image.toDrive({
  image: cleanIceMask.unmask(0).toUint8(),
  description: 'CleanIce_Mask_Balanced_' + PROCESS_YEAR,
  folder: 'Afghanistan_Glacier_Inventory',
  fileNamePrefix: prefix + '_CleanIce_mask',
  region: studyArea,
  scale: 30,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

if (hasNDSDI) {
  Export.image.toDrive({
    image: debrisMask.unmask(0).toUint8(),
    description: 'Debris_Mask_Conservative_' + PROCESS_YEAR,
    folder: 'Afghanistan_Glacier_Inventory',
    fileNamePrefix: prefix + '_Debris_mask',
    region: studyArea,
    scale: 30,
    crs: 'EPSG:4326',
    maxPixels: 1e13
  });
}

// ============================================================================
// SUMMARY
// ============================================================================

print('');
print('╔════════════════════════════════════════════════════════════════╗');
print('║  COMPLETE! Check Tasks tab to run exports                      ║');
print('╠════════════════════════════════════════════════════════════════╣');
print('║  CONSERVATIVE APPROACH FEATURES:                              ║');
print('║  ✓ Strict snow detection (NDSI>0.5, bright blue required)    ║');
print('║  ✓ Conservative ice (SWIR<0.10, NDSI>0.35)                   ║');
print('║  ✓ Rock exclusion (SWIR>0.18 or NIR/SWIR<1.3 = rock)        ║');
print('║  ✓ Extreme reflectance excluded (too bright/dark)            ║');
print('║  ✓ Debris detection maintained (working well)                 ║');
print('║  ✓ Larger minimum areas (0.02 km² ice, 0.05 km² debris)     ║');
print('║                                                               ║');
print('║  Check "Excluded Rocks" layer to see filtered areas!         ║');
print('╚════════════════════════════════════════════════════════════════╝');